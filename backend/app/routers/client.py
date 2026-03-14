from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, desc, or_
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.core import User, Worker, PaymentRequest, PaymentStatus, UserRole, BalanceLog
from app.schemas.core import (
    WorkerCreate, WorkerResponse, PaymentCreate, PaymentResponse,
    StaffCreate, UserResponse, BalanceAdd, BalanceLogResponse
)
from app.core.deps import require_client
from app.core.security import get_password_hash
from pydantic import BaseModel

router = APIRouter(prefix="/client", tags=["client"])

def _get_accessible_staff(db: Session, staff_id: str, current_user: User):
    """Get a staff member if current client can access them (own staff or 'all' scope staff)."""
    return db.query(User).filter(
        User.id == staff_id,
        User.role == UserRole.STAFF,
        or_(User.client_id == current_user.id, User.staff_scope == "all")
    ).first()

# --- STAFF MANAGEMENT (ADMIN PANEL) ---
@router.post("/staff", response_model=UserResponse)
def create_staff(staff_data: StaffCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    if db.query(User).filter(User.username == staff_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    scope = staff_data.scope if staff_data.scope in ("own_client", "all") else "own_client"
    new_staff = User(
        username=staff_data.username,
        hashed_password=get_password_hash(staff_data.password),
        role=UserRole.STAFF,
        client_id=current_user.id,
        staff_scope=scope
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@router.get("/staff", response_model=List[UserResponse])
def get_staff(db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    # Show staff belonging to this client + any "all" scope staff from other clients
    return db.query(User).filter(
        User.role == UserRole.STAFF,
        or_(
            User.client_id == current_user.id,
            User.staff_scope == "all"
        )
    ).all()

@router.put("/staff/{staff_id}/toggle", response_model=UserResponse)
def toggle_staff_active(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    staff = _get_accessible_staff(db, staff_id, current_user)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_active = not staff.is_active
    db.commit()
    db.refresh(staff)
    return staff

class PasswordResetSchema(BaseModel):
    new_password: str

@router.put("/staff/{staff_id}/reset-password")
def reset_staff_password(staff_id: str, data: PasswordResetSchema, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    staff = _get_accessible_staff(db, staff_id, current_user)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password reset successfully"}

# --- BALANCE MANAGEMENT ---
@router.post("/staff/{staff_id}/add-balance", response_model=UserResponse)
def add_staff_balance(staff_id: str, data: BalanceAdd, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    staff = _get_accessible_staff(db, staff_id, current_user)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    staff.available_balance += data.amount
    new_balance = staff.available_balance

    # Create balance log
    log = BalanceLog(
        staff_id=staff.id,
        added_by_client_id=current_user.id,
        amount=data.amount,
        balance_after=new_balance,
        note=data.note
    )
    db.add(log)
    db.commit()
    db.refresh(staff)
    return staff

@router.get("/staff/{staff_id}/balance-logs", response_model=List[BalanceLogResponse])
def get_balance_logs(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    staff = _get_accessible_staff(db, staff_id, current_user)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    logs = db.query(BalanceLog).filter(BalanceLog.staff_id == staff_id).order_by(BalanceLog.created_at.desc()).all()
    return logs

@router.get("/staff/{staff_id}/full-history")
def get_staff_full_history(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    """Returns combined deposit and payment history for a staff member, sorted by time descending."""
    staff = _get_accessible_staff(db, staff_id, current_user)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")

    # Get balance deposits with client info
    logs = db.query(BalanceLog).options(
        joinedload(BalanceLog.client_user)
    ).filter(BalanceLog.staff_id == staff_id).all()
    entries = []
    for log in logs:
        entries.append({
            "type": "deposit",
            "amount": log.amount,
            "balance_after": log.balance_after,
            "created_at": log.created_at,
            "completed_at": None,
            "note": log.note,
            "worker_id_code": None,
            "status": None,
            "deposited_by": log.client_user.username if log.client_user else None,
        })

    # Get completed/failed payments processed by this staff
    # For "all" scope staff, show payments from all clients
    payment_query = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker),
        joinedload(PaymentRequest.client)
    ).filter(
        PaymentRequest.locked_by_staff_id == staff_id,
        PaymentRequest.status.in_([PaymentStatus.COMPLETED, PaymentStatus.FAILED])
    )
    if staff.staff_scope != "all":
        payment_query = payment_query.filter(PaymentRequest.client_id == current_user.id)

    payments = payment_query.all()
    for p in payments:
        entries.append({
            "type": "payment",
            "amount": p.amount,
            "balance_after": None,
            "created_at": p.created_at,
            "completed_at": p.completed_at,
            "note": None,
            "worker_id_code": p.worker.worker_id_code if p.worker else None,
            "status": p.status.value if p.status else None,
            "deposited_by": p.client.username if p.client else None,
        })

    # Sort by time descending (use completed_at for payments if available, else created_at)
    entries.sort(key=lambda e: e["completed_at"] or e["created_at"] or datetime.min, reverse=True)

    return entries

# --- WORKER MANAGEMENT ---
@router.post("/workers", response_model=WorkerResponse)
def create_worker(worker_data: WorkerCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    new_worker = Worker(
        client_id=current_user.id,
        name=worker_data.name,
        worker_id_code=worker_data.worker_id_code,
        qr_code_url=worker_data.qr_code_url,
        bank_account_number=worker_data.bank_account_number,
        bank_ifsc=worker_data.bank_ifsc,
        bank_account_name=worker_data.bank_account_name,
        bank_name=worker_data.bank_name,
        is_active=True
    )
    db.add(new_worker)
    db.commit()
    db.refresh(new_worker)
    return new_worker

@router.get("/workers", response_model=List[WorkerResponse])
def get_workers(db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    workers = db.query(Worker).filter(Worker.client_id == current_user.id, Worker.is_active == True).all()
    return workers

class WorkerUpdate(BaseModel):
    qr_code_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None

@router.put("/workers/{worker_id}", response_model=WorkerResponse)
def update_worker(worker_id: str, data: WorkerUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    worker = db.query(Worker).filter(Worker.id == worker_id, Worker.client_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    if data.qr_code_url is not None:
        worker.qr_code_url = data.qr_code_url
    if data.bank_account_number is not None:
        worker.bank_account_number = data.bank_account_number
    if data.bank_ifsc is not None:
        worker.bank_ifsc = data.bank_ifsc
    if data.bank_account_name is not None:
        worker.bank_account_name = data.bank_account_name
    if data.bank_name is not None:
        worker.bank_name = data.bank_name
    db.commit()
    db.refresh(worker)
    return worker

@router.delete("/workers/{worker_id}")
def delete_worker(worker_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    worker = db.query(Worker).filter(Worker.id == worker_id, Worker.client_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Soft delete
    worker.is_active = False
    db.commit()
    return {"message": "Worker deleted successfully"}

from fastapi import UploadFile, File
from app.core.s3 import upload_file_to_s3

@router.post("/workers/upload-qr")
async def upload_qr(file: UploadFile = File(...), current_user: User = Depends(require_client)):
    url = await upload_file_to_s3(file, folder="qr-codes")
    return {"url": url}

# --- PAYMENT MANAGEMENT & STATEMENTS ---
@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment_data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    worker = db.query(Worker).filter(Worker.id == payment_data.worker_id, Worker.client_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Prevent duplicate: check if worker already has PENDING or PROCESSING payment
    existing = db.query(PaymentRequest).filter(
        PaymentRequest.worker_id == worker.id,
        PaymentRequest.client_id == current_user.id,
        PaymentRequest.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING])
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="This user already has a pending or processing payment. Wait until it's completed before adding another."
        )

    payment = PaymentRequest(
        worker_id=worker.id,
        client_id=current_user.id,
        amount=payment_data.amount,
        status=PaymentStatus.PENDING
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment

@router.delete("/payments/{payment_id}")
def delete_payment(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    """Delete a PENDING payment (client added by mistake or wrong amount)."""
    payment = db.query(PaymentRequest).filter(
        PaymentRequest.id == payment_id,
        PaymentRequest.client_id == current_user.id
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only PENDING payments can be deleted")

    db.delete(payment)
    db.commit()
    return {"message": "Payment deleted successfully"}

@router.put("/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(payment_id: str, amount: float, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id, PaymentRequest.client_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only modify PENDING payments")

    payment.amount = amount
    db.commit()
    db.refresh(payment)
    return payment

@router.post("/payments/{payment_id}/retry", response_model=PaymentResponse)
def retry_payment(payment_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    payment = db.query(PaymentRequest).filter(PaymentRequest.id == payment_id, PaymentRequest.client_id == current_user.id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment.status != PaymentStatus.FAILED:
        raise HTTPException(status_code=400, detail="Only failed payments can be retried.")

    payment.status = PaymentStatus.PENDING
    payment.locked_by_staff_id = None
    payment.locked_at = None
    payment.completed_at = None
    payment.transaction_ref_no = None
    payment.staff_comment = None
    db.commit()
    db.refresh(payment)
    return payment

@router.get("/statements", response_model=List[PaymentResponse])
def get_statements(
    worker_id: Optional[str] = None,
    status: Optional[PaymentStatus] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    staff_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client)
):
    query = db.query(PaymentRequest).options(
        joinedload(PaymentRequest.worker),
        joinedload(PaymentRequest.locked_by_staff)
    ).filter(PaymentRequest.client_id == current_user.id)

    if worker_id:
        query = query.filter(PaymentRequest.worker_id == worker_id)
    if status:
        query = query.filter(PaymentRequest.status == status)
    if start_date:
        query = query.filter(PaymentRequest.created_at >= start_date)
    if end_date:
        query = query.filter(PaymentRequest.created_at <= end_date)
    if staff_id:
        query = query.filter(PaymentRequest.locked_by_staff_id == staff_id)

    return query.order_by(PaymentRequest.created_at.desc()).all()

@router.get("/statistics")
def get_statistics(
    staff_id: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_client)
):
    """Returns comprehensive statistics with optional staff and date range filters."""

    query = db.query(
        PaymentRequest.status,
        func.count(PaymentRequest.id).label('cnt'),
        func.coalesce(func.sum(PaymentRequest.amount), 0).label('total')
    ).filter(
        PaymentRequest.client_id == current_user.id
    )

    if staff_id:
        query = query.filter(PaymentRequest.locked_by_staff_id == staff_id)
    if start_date:
        query = query.filter(PaymentRequest.created_at >= start_date)
    if end_date:
        query = query.filter(PaymentRequest.created_at <= end_date)

    payment_stats = query.group_by(PaymentRequest.status).all()

    stats_map = {row.status: {"count": row.cnt, "amount": float(row.total)} for row in payment_stats}

    completed = stats_map.get(PaymentStatus.COMPLETED, {"count": 0, "amount": 0.0})
    pending = stats_map.get(PaymentStatus.PENDING, {"count": 0, "amount": 0.0})
    processing = stats_map.get(PaymentStatus.PROCESSING, {"count": 0, "amount": 0.0})
    failed = stats_map.get(PaymentStatus.FAILED, {"count": 0, "amount": 0.0})

    # Total deposited to all staff
    total_deposited = db.query(
        func.coalesce(func.sum(BalanceLog.amount), 0)
    ).filter(
        BalanceLog.added_by_client_id == current_user.id
    ).scalar() or 0

    # Current total balance across all staff
    total_staff_balance = db.query(
        func.coalesce(func.sum(User.available_balance), 0)
    ).filter(
        User.client_id == current_user.id,
        User.role == UserRole.STAFF
    ).scalar() or 0

    # Single query for worker + staff counts
    total_users = db.query(func.count(Worker.id)).filter(
        Worker.client_id == current_user.id, Worker.is_active == True
    ).scalar() or 0

    staff_stats = db.query(
        func.count(User.id).label('total'),
        func.count(case((User.is_active == True, 1))).label('active')
    ).filter(
        User.client_id == current_user.id, User.role == UserRole.STAFF
    ).first()

    # Top pending workers
    top_pending_workers = db.query(
        Worker.id, Worker.name, Worker.worker_id_code,
        func.count(PaymentRequest.id).label('pending_count'),
        func.sum(PaymentRequest.amount).label('pending_amount')
    ).join(PaymentRequest, PaymentRequest.worker_id == Worker.id).filter(
        PaymentRequest.client_id == current_user.id,
        PaymentRequest.status == PaymentStatus.PENDING
    ).group_by(Worker.id, Worker.name, Worker.worker_id_code).order_by(
        desc('pending_amount')
    ).limit(10).all()

    top_pending = [
        {"worker_id": w.id, "name": w.name, "worker_id_code": w.worker_id_code, "pending_count": w.pending_count, "pending_amount": float(w.pending_amount or 0)}
        for w in top_pending_workers
    ]

    return {
        "total_withdrawal_amount": completed["amount"],
        "total_transactions": completed["count"],
        "active_workers": total_users,
        "pending_count": pending["count"],
        "pending_amount": pending["amount"],
        "processing_count": processing["count"],
        "processing_amount": processing["amount"],
        "failed_count": failed["count"],
        "failed_amount": failed["amount"],
        "total_staff": staff_stats.total if staff_stats else 0,
        "active_staff": staff_stats.active if staff_stats else 0,
        "top_pending_workers": top_pending,
        "total_deposited": float(total_deposited),
        "total_staff_balance": float(total_staff_balance),
    }

# Workers with pending payment status (for withdrawal tab)
@router.get("/workers-with-status")
def get_workers_with_payment_status(db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    """Get workers with their active payment status to prevent duplicates on frontend."""
    workers = db.query(Worker).filter(Worker.client_id == current_user.id, Worker.is_active == True).all()

    # Get all workers that have pending/processing payments
    active_payments = db.query(PaymentRequest.worker_id).filter(
        PaymentRequest.client_id == current_user.id,
        PaymentRequest.status.in_([PaymentStatus.PENDING, PaymentStatus.PROCESSING])
    ).all()
    blocked_worker_ids = {p.worker_id for p in active_payments}

    result = []
    for w in workers:
        worker_data = WorkerResponse.model_validate(w).model_dump()
        worker_data["has_active_payment"] = w.id in blocked_worker_ids
        result.append(worker_data)

    return result
