import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Enum, JSON, Boolean, Text, Index
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

IST = timezone(timedelta(hours=5, minutes=30))

def now_ist():
    return datetime.now(IST)

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), nullable=False)

    client_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_ist)

    # Available balance for staff (client deposits, deducted on payments)
    available_balance = Column(Float, default=0.0, nullable=False, server_default="0")

    # Staff scope: "own_client" = see only creating client's payments, "all" = see all clients' payments
    staff_scope = Column(String, default="own_client", nullable=False, server_default="own_client")

    # Session management - single device login for staff
    session_id = Column(String, nullable=True)

    # Staff relationships
    locked_payments = relationship("PaymentRequest", back_populates="locked_by_staff", foreign_keys="[PaymentRequest.locked_by_staff_id]")

    # Client relationships
    workers = relationship("Worker", back_populates="client")
    balance_logs = relationship("BalanceLog", back_populates="staff_user", foreign_keys="[BalanceLog.staff_id]")

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
    bank_name = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_ist)

    client = relationship("User", back_populates="workers")
    payments = relationship("PaymentRequest", back_populates="worker")

class PaymentRequest(Base):
    __tablename__ = "payment_requests"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    worker_id = Column(String, ForeignKey("workers.id"), nullable=False, index=True)
    client_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    amount = Column(Float, nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING, index=True)
    
    # Locking for Staff concurrency
    locked_by_staff_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    locked_at = Column(DateTime, nullable=True)
    
    # Completion data
    completed_at = Column(DateTime, nullable=True)
    transaction_ref_no = Column(String, nullable=True)
    receipt_url = Column(String, nullable=True)
    staff_comment = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=now_ist)
    
    # Composite indexes for common query patterns
    __table_args__ = (
        Index('ix_payment_client_status', 'client_id', 'status'),
        Index('ix_payment_worker_status', 'worker_id', 'client_id', 'status'),
        Index('ix_payment_staff_status', 'locked_by_staff_id', 'status'),
        Index('ix_payment_completed_at', 'completed_at'),
    )

    worker = relationship("Worker", back_populates="payments")
    locked_by_staff = relationship("User", back_populates="locked_payments", foreign_keys=[locked_by_staff_id])
    client = relationship("User", foreign_keys=[client_id])


class BalanceLog(Base):
    """Tracks balance additions by client for staff members."""
    __tablename__ = "balance_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    staff_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    added_by_client_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    amount = Column(Float, nullable=False)
    balance_after = Column(Float, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_ist)

    __table_args__ = (
        Index('ix_balancelog_client', 'added_by_client_id'),
    )

    staff_user = relationship("User", back_populates="balance_logs", foreign_keys=[staff_id])
    client_user = relationship("User", foreign_keys=[added_by_client_id])
