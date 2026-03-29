from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_, func, case, desc
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.core import User, PaymentRequest, PaymentStatus, Worker
from app.schemas.core import PaymentResponse, PaymentComplete
from app.core.deps import require_staff
from app.core.s3 import resolve_qr_urls, upload_file_to_s3

IST = timezone(timedelta(hours=5, minutes=30))

router = APIRouter(prefix="/staff", tags=["staff"])

# Constants
PROCESSING_TIMEOUT_MINUTES = 5
_CLEANUP_INTERVAL_SECONDS = 30
_last_cleanup_time: float = 0

@router.get("/payments/pending", response_model=List[PaymentResponse])
def get_pending_payments(db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    import time
    global _last_cleanup_time
    now_ts = time.time()

    # Throttle: only run timeout cleanup every 30 seconds, not on every request
    if now_ts - _last_cleanup_time > _CLEANUP_INTERVAL_SECONDS:
        _last_cleanup_time = now_ts
        timeout_threshold = datetime.now(IST) - timedelta(minutes=PROCESSING_TIMEOUT_MINUTES)
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
    #    If staff_scope is "own_client", only show payments from the staff's assigned client.
    #    If staff_scope is "all", show payments from all clients.
    base_filter = or_(
        PaymentRequest.status == PaymentStatus.PENDING,
        and_(
            PaymentRequest.status == PaymentStatus.PROCESSING,
            PaymentRequest.locked_by_staff_id == current_user.id
        )
    )

    eager_opts = [joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)]

    if current_user.staff_scope == "all":
        payments = db.query(PaymentRequest).options(*eager_opts).filter(base_filter).all()
    else:
        payments = db.query(PaymentRequest).options(*eager_opts).filter(
            base_filter,
            PaymentRequest.client_id == current_user.client_id
        ).all()

    resolve_qr_urls(payments)
    return payments

@router.post("/payments/{payment_id}/lock", response_model=PaymentResponse)
def lock_payment(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    # Lock without JOIN to avoid "FOR UPDATE cannot be applied to nullable side of outer join"
    lock_filters = [PaymentRequest.id == payment_id, PaymentRequest.status == PaymentStatus.PENDING]
    if current_user.staff_scope != "all":
        lock_filters.append(PaymentRequest.client_id == current_user.client_id)

    stmt = (
        select(PaymentRequest)
        .filter(*lock_filters)
        .with_for_update(skip_locked=True)
    )

    payment = db.scalars(stmt).first()

    if not payment:
        existing = db.query(PaymentRequest).options(
            joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)
        ).filter(PaymentRequest.id == payment_id).first()
        if existing and existing.status == PaymentStatus.PROCESSING:
            if existing.locked_by_staff_id == current_user.id:
                resolve_qr_urls(existing)
                return existing
            raise HTTPException(status_code=409, detail="Payment is currently being processed by someone else.")
        if existing and existing.status == PaymentStatus.COMPLETED:
            raise HTTPException(status_code=409, detail="Payment has already been completed.")

        raise HTTPException(status_code=404, detail="Payment not found or not available.")

    # Apply lock
    payment.status = PaymentStatus.PROCESSING
    payment.locked_by_staff_id = current_user.id
    payment.locked_at = datetime.now(IST)

    db.commit()
    payment = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)
    ).filter(PaymentRequest.id == payment_id).first()
    resolve_qr_urls(payment)
    return payment

@router.post("/payments/upload-receipt")
async def upload_receipt(file: UploadFile = File(...), current_user: User = Depends(require_staff)):
    url = await upload_file_to_s3(file, folder="receipts")
    return {"url": url}

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
    payment.completed_at = datetime.now(IST)

    db.commit()
    payment = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)
    ).filter(PaymentRequest.id == payment_id).first()
    resolve_qr_urls(payment)
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
    payment.completed_at = datetime.now(IST)

    db.commit()
    payment = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)
    ).filter(PaymentRequest.id == payment_id).first()
    resolve_qr_urls(payment)
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
    payment = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker), joinedload(PaymentRequest.locked_by_staff)
    ).filter(PaymentRequest.id == payment_id).first()
    resolve_qr_urls(payment)
    return payment

@router.get("/my-transactions")
def get_my_transactions(
    worker_id: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    search: Optional[str] = None,
    limit: int = Query(default=200, le=500),
    offset: int = Query(default=0, ge=0),
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
    if search:
        query = query.join(Worker, PaymentRequest.worker_id == Worker.id).filter(
            or_(
                Worker.worker_id_code.ilike(f'%{search}%'),
                Worker.name.ilike(f'%{search}%')
            )
        )

    payments = query.order_by(PaymentRequest.completed_at.desc()).offset(offset).limit(limit).all()
    resolve_qr_urls(payments)

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
