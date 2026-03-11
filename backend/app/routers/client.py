from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models.core import User, Worker, PaymentRequest, PaymentStatus, UserRole
from app.schemas.core import WorkerCreate, WorkerResponse, PaymentCreate, PaymentResponse, StaffCreate, UserResponse
from app.core.deps import require_client
from app.core.security import get_password_hash
from pydantic import BaseModel

router = APIRouter(prefix="/client", tags=["client"])

# --- STAFF MANAGEMENT (ADMIN PANEL) ---
@router.post("/staff", response_model=UserResponse)
def create_staff(staff_data: StaffCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    # Check if username exists
    if db.query(User).filter(User.username == staff_data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
        
    new_staff = User(
        username=staff_data.username,
        hashed_password=get_password_hash(staff_data.password),
        role=UserRole.STAFF,
        client_id=current_user.id
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff

@router.get("/staff", response_model=List[UserResponse])
def get_staff(db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    return db.query(User).filter(User.client_id == current_user.id, User.role == UserRole.STAFF).all()

@router.put("/staff/{staff_id}/toggle", response_model=UserResponse)
def toggle_staff_active(staff_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    staff = db.query(User).filter(User.id == staff_id, User.client_id == current_user.id, User.role == UserRole.STAFF).first()
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
    staff = db.query(User).filter(User.id == staff_id, User.client_id == current_user.id, User.role == UserRole.STAFF).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password reset successfully"}

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
import shutil
import os
import uuid

@router.post("/workers/upload-qr")
async def upload_qr(file: UploadFile = File(...), current_user: User = Depends(require_client)):
    ext = file.filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join("uploads", filename)
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"url": f"/uploads/{filename}"}

# --- PAYMENT MANAGEMENT & STATEMENTS ---
@router.post("/payments", response_model=PaymentResponse)
def create_payment(payment_data: PaymentCreate, db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    worker = db.query(Worker).filter(Worker.id == payment_data.worker_id, Worker.client_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
        
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
    db: Session = Depends(get_db), 
    current_user: User = Depends(require_client)
):
    """
    Get paginated/filtered statements. Supports date ranges, specific workers, and specific statuses.
    """
    query = db.query(PaymentRequest).options(joinedload(PaymentRequest.worker)).filter(PaymentRequest.client_id == current_user.id)
    
    if worker_id:
        query = query.filter(PaymentRequest.worker_id == worker_id)
    if status:
        query = query.filter(PaymentRequest.status == status)
    if start_date:
        query = query.filter(PaymentRequest.created_at >= start_date)
    if end_date:
        query = query.filter(PaymentRequest.created_at <= end_date)
        
    return query.order_by(PaymentRequest.created_at.desc()).all()

@router.get("/statistics")
def get_statistics(db: Session = Depends(get_db), current_user: User = Depends(require_client)):
    """
    Returns comprehensive statistics using minimal queries.
    """
    from sqlalchemy import case, desc

    # Single query for all payment stats grouped by status
    payment_stats = db.query(
        PaymentRequest.status,
        func.count(PaymentRequest.id).label('cnt'),
        func.coalesce(func.sum(PaymentRequest.amount), 0).label('total')
    ).filter(
        PaymentRequest.client_id == current_user.id
    ).group_by(PaymentRequest.status).all()

    stats_map = {row.status: {"count": row.cnt, "amount": float(row.total)} for row in payment_stats}

    completed = stats_map.get(PaymentStatus.COMPLETED, {"count": 0, "amount": 0.0})
    pending = stats_map.get(PaymentStatus.PENDING, {"count": 0, "amount": 0.0})
    processing = stats_map.get(PaymentStatus.PROCESSING, {"count": 0, "amount": 0.0})
    failed = stats_map.get(PaymentStatus.FAILED, {"count": 0, "amount": 0.0})

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
        "top_pending_workers": top_pending
    }
