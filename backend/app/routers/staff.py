from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_, func, case, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models.core import User, PaymentRequest, PaymentStatus, Worker
from app.schemas.core import PaymentResponse, PaymentComplete
from app.core.deps import require_staff

router = APIRouter(prefix="/staff", tags=["staff"])

# Constants
PROCESSING_TIMEOUT_MINUTES = 5

@router.get("/payments/pending", response_model=List[PaymentResponse])
def get_pending_payments(db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    timeout_threshold = datetime.utcnow() - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)

    # 1. Update any globally timed-out payments back to PENDING
    timed_out_payments = db.query(PaymentRequest).filter(
        PaymentRequest.status == PaymentStatus.PROCESSING,
        PaymentRequest.locked_at < timeout_threshold
    ).update({
        PaymentRequest.status: PaymentStatus.PENDING,
        PaymentRequest.locked_by_staff_id: None,
        PaymentRequest.locked_at: None
    })
    if timed_out_payments > 0:
        db.commit()

    # 2. Fetch all fully PENDING, PLUS anything currently PROCESSING locked by ME.
    payments = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(
        or_(
            PaymentRequest.status == PaymentStatus.PENDING,
            and_(
                PaymentRequest.status == PaymentStatus.PROCESSING,
                PaymentRequest.locked_by_staff_id == current_user.id
            )
        )
    ).all()

    return payments

@router.post("/payments/{payment_id}/lock", response_model=PaymentResponse)
def lock_payment(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    stmt = (
        select(PaymentRequest)
        .options(joinedload(PaymentRequest.worker))
        .filter(PaymentRequest.id == payment_id, PaymentRequest.status == PaymentStatus.PENDING)
        .with_for_update(skip_locked=True)
    )

    payment = db.scalars(stmt).first()

    if not payment:
        existing = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(PaymentRequest.id == payment_id).first()
        if existing and existing.status == PaymentStatus.PROCESSING:
            if existing.locked_by_staff_id == current_user.id:
                return existing
            raise HTTPException(status_code=409, detail="Payment is currently being processed by someone else.")
        if existing and existing.status == PaymentStatus.COMPLETED:
            raise HTTPException(status_code=409, detail="Payment has already been completed.")

        raise HTTPException(status_code=404, detail="Payment not found or not available.")

    # Apply lock
    payment.status = PaymentStatus.PROCESSING
    payment.locked_by_staff_id = current_user.id
    payment.locked_at = datetime.utcnow()

    db.commit()
    payment = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(
        PaymentRequest.id == payment_id
    ).first()
    return payment

@router.post("/payments/{payment_id}/complete", response_model=PaymentResponse)
def complete_payment(payment_id: str, data: PaymentComplete, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    payment = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(
        PaymentRequest.id == payment_id,
        PaymentRequest.status == PaymentStatus.PROCESSING,
        PaymentRequest.locked_by_staff_id == current_user.id
    ).first()

    if not payment:
        raise HTTPException(status_code=400, detail="Invalid payment or lock expired. Please return to Pending list.")

    # Deduct from staff's available balance
    if current_user.available_balance < payment.amount:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Your balance: ₹{current_user.available_balance:.2f}, Payment: ₹{payment.amount:.2f}")

    current_user.available_balance -= payment.amount

    payment.status = PaymentStatus.COMPLETED
    payment.transaction_ref_no = data.transaction_ref_no
    payment.receipt_url = data.receipt_url
    payment.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    return payment

@router.post("/payments/{payment_id}/fail", response_model=PaymentResponse)
def fail_payment(payment_id: str, data: PaymentComplete, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    payment = db.query(PaymentRequest).filter(
        PaymentRequest.id == payment_id,
        PaymentRequest.status == PaymentStatus.PROCESSING,
        PaymentRequest.locked_by_staff_id == current_user.id
    ).first()

    if not payment:
        raise HTTPException(status_code=400, detail="Invalid payment or lock expired.")

    payment.status = PaymentStatus.FAILED
    payment.staff_comment = data.staff_comment
    payment.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)
    return payment

@router.post("/payments/{payment_id}/release", response_model=PaymentResponse)
def release_lock(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    payment = db.query(PaymentRequest).filter(
        PaymentRequest.id == payment_id,
        PaymentRequest.status == PaymentStatus.PROCESSING,
        PaymentRequest.locked_by_staff_id == current_user.id
    ).first()

    if not payment:
        raise HTTPException(status_code=400, detail="Invalid payment or lock expired.")

    payment.status = PaymentStatus.PENDING
    payment.locked_by_staff_id = None
    payment.locked_at = None

    db.commit()
    db.refresh(payment)
    return payment

@router.get("/my-transactions")
def get_my_transactions(
    worker_id: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    """Get transactions processed by this staff member with filters."""
    query = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(
        PaymentRequest.locked_by_staff_id == current_user.id,
        PaymentRequest.status.in_([PaymentStatus.COMPLETED, PaymentStatus.FAILED])
    )

    if worker_id:
        query = query.filter(PaymentRequest.worker_id == worker_id)
    if status:
        query = query.filter(PaymentRequest.status == status)
    if start_date:
        query = query.filter(PaymentRequest.completed_at >= start_date)
    if end_date:
        query = query.filter(PaymentRequest.completed_at <= end_date)

    payments = query.order_by(PaymentRequest.completed_at.desc()).all()

    # If search by userid, filter in python (worker relation)
    if search:
        search_lower = search.lower()
        payments = [p for p in payments if p.worker and (
            (p.worker.worker_id_code or '').lower().find(search_lower) >= 0 or
            (p.worker.name or '').lower().find(search_lower) >= 0
        )]

    return [PaymentResponse.model_validate(p) for p in payments]

@router.get("/my-stats")
def get_my_stats(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_staff)
):
    """Get this staff member's transaction statistics."""
    query = db.query(
        PaymentRequest.status,
        func.count(PaymentRequest.id).label('cnt'),
        func.coalesce(func.sum(PaymentRequest.amount), 0).label('total')
    ).filter(
        PaymentRequest.locked_by_staff_id == current_user.id,
        PaymentRequest.status.in_([PaymentStatus.COMPLETED, PaymentStatus.FAILED])
    )

    if start_date:
        query = query.filter(PaymentRequest.completed_at >= start_date)
    if end_date:
        query = query.filter(PaymentRequest.completed_at <= end_date)

    stats = query.group_by(PaymentRequest.status).all()
    stats_map = {row.status: {"count": row.cnt, "amount": float(row.total)} for row in stats}

    completed = stats_map.get(PaymentStatus.COMPLETED, {"count": 0, "amount": 0.0})
    failed = stats_map.get(PaymentStatus.FAILED, {"count": 0, "amount": 0.0})

    return {
        "completed_count": completed["count"],
        "completed_amount": completed["amount"],
        "failed_count": failed["count"],
        "failed_amount": failed["amount"],
        "total_count": completed["count"] + failed["count"],
        "total_amount": completed["amount"] + failed["amount"],
        "available_balance": current_user.available_balance,
    }

@router.get("/my-balance")
def get_my_balance(current_user: User = Depends(require_staff)):
    """Get staff's current available balance."""
    return {"available_balance": current_user.available_balance}
