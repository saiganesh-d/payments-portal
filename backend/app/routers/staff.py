from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, and_, or_
from typing import List
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
    """
    Get all pending payments. Also return payments locked by 'this' user that haven't timed out, 
    so they can resume them if they accidentally refreshed.
    """
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
    """
    Pessimistic Locking to prevent Double Payments using Postgres `WITH FOR UPDATE SKIP LOCKED`.
    This guarantees that if two staff members click the same payment at the exact same millisecond,
    only one gets it.
    """
    stmt = (
        select(PaymentRequest)
        .filter(PaymentRequest.id == payment_id, PaymentRequest.status == PaymentStatus.PENDING)
        .with_for_update(skip_locked=True)
    )
    
    payment = db.scalars(stmt).first()
    
    if not payment:
        # Check if it was already locked or deleted by querying without lock
        existing = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id).first()
        if existing and existing.status == PaymentStatus.PROCESSING:
            if existing.locked_by_staff_id == current_user.id:
                # Already locked by me (refresh case)
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
    db.refresh(payment)
    return payment

@router.post("/payments/{payment_id}/complete", response_model=PaymentResponse)
def complete_payment(payment_id: str, data: PaymentComplete, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    """
    Finalize the payment. Requires UTR submission.
    """
    payment = db.query(PaymentRequest).filter(
        PaymentRequest.id == payment_id,
        PaymentRequest.status == PaymentStatus.PROCESSING,
        PaymentRequest.locked_by_staff_id == current_user.id
    ).first()
    
    if not payment:
        raise HTTPException(status_code=400, detail="Invalid payment or lock expired. Please return to Pending list.")
        
    payment.status = PaymentStatus.COMPLETED
    payment.transaction_ref_no = data.transaction_ref_no
    payment.receipt_url = data.receipt_url
    payment.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(payment)
    
    return payment

@router.post("/payments/{payment_id}/fail", response_model=PaymentResponse)
def fail_payment(payment_id: str, data: PaymentComplete, db: Session = Depends(get_db), current_user: User = Depends(require_staff)):
    """
    Mark payment as FAILED (e.g., incorrect bank details) and release the lock.
    staff_comment is required/encouraged here via the PaymentComplete schema (we repurpose it).
    """
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
    """
    Release the lock on a processing payment and return it to the queue.
    """
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
