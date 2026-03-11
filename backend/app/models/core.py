import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base
import enum

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    CLIENT = "CLIENT"
    STAFF = "STAFF"

class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DISPUTED = "DISPUTED"

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    
    client_id = Column(String, ForeignKey("users.id"), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Staff relationships
    locked_payments = relationship("PaymentRequest", back_populates="locked_by_staff", foreign_keys="[PaymentRequest.locked_by_staff_id]")
    
    # Client relationships 
    workers = relationship("Worker", back_populates="client")

class Worker(Base):
    """
    Workers are the end-users who receive payments. They belong to a Client.
    """
    __tablename__ = "workers"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    client_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    name = Column(String, nullable=True)
    worker_id_code = Column(String, nullable=True, index=True)
    qr_code_url = Column(String, nullable=True) # S3 or local path
    bank_account_number = Column(String, nullable=True)
    bank_ifsc = Column(String, nullable=True)
    bank_account_name = Column(String, nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    client = relationship("User", back_populates="workers")
    payments = relationship("PaymentRequest", back_populates="worker")

class PaymentRequest(Base):
    __tablename__ = "payment_requests"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    worker_id = Column(String, ForeignKey("workers.id"), nullable=False)
    client_id = Column(String, ForeignKey("users.id"), nullable=False)
    
    amount = Column(Float, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    
    # Locking for Staff concurrency
    locked_by_staff_id = Column(String, ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    
    # Completion data
    completed_at = Column(DateTime, nullable=True)
    transaction_ref_no = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True)
    staff_comment = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    worker = relationship("Worker", back_populates="payments")
    locked_by_staff = relationship("User", back_populates="locked_payments", foreign_keys=[locked_by_staff_id])
    client = relationship("User", foreign_keys=[client_id])
