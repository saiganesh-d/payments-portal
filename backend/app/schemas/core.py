from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
from app.models.core import UserRole, PaymentStatus

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class StaffCreate(BaseModel):
    username: str
    password: str
    scope: str = "own_client"  # "own_client" or "all"

class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole

class UserResponse(BaseModel):
    id: str
    username: str
    role: UserRole
    is_active: bool
    available_balance: float = 0.0
    staff_scope: Optional[str] = "own_client"
    client_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Worker Schemas
class WorkerCreate(BaseModel):
    name: Optional[str] = None
    worker_id_code: Optional[str] = None
    qr_code_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None

class WorkerResponse(BaseModel):
    id: str
    client_id: str
    name: str
    worker_id_code: Optional[str] = None
    qr_code_url: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_ifsc: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Payment Schemas
class PaymentCreate(BaseModel):
    worker_id: str
    amount: float = Field(gt=0)

class PaymentResponse(BaseModel):
    id: str
    worker_id: str
    client_id: str
    amount: float
    status: PaymentStatus
    locked_by_staff_id: Optional[str] = None
    locked_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    transaction_ref_no: Optional[str] = None
    staff_comment: Optional[str] = None
    created_at: datetime

    worker: Optional[WorkerResponse] = None
    locked_by_staff: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class PaymentComplete(BaseModel):
    transaction_ref_no: Optional[str] = None
    receipt_url: Optional[str] = None
    staff_comment: Optional[str] = None

# Balance Schemas
class BalanceAdd(BaseModel):
    staff_id: str
    amount: float = Field(gt=0)
    note: Optional[str] = None

class BalanceLogResponse(BaseModel):
    id: str
    staff_id: str
    added_by_client_id: str
    amount: float
    balance_after: float
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
