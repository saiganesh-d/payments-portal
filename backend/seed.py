import os
import sys
from app.database import SessionLocal, Base, engine
from app.models.core import User, UserRole
from app.core.security import get_password_hash

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if admin exists
    admin = db.query(User).filter(User.username == "admin").first()
    if not admin:
        admin_user = User(
            username="admin",
            hashed_password=get_password_hash("admin"),
            role=UserRole.ADMIN
        )
        db.add(admin_user)
        
    client = db.query(User).filter(User.username == "client").first()
    if not client:
        client_user = User(
            username="client",
            hashed_password=get_password_hash("client"),
            role=UserRole.CLIENT
        )
        db.add(client_user)

    staff1 = db.query(User).filter(User.username == "staff1").first()
    if not staff1:
        staff_user1 = User(
            username="staff1",
            hashed_password=get_password_hash("staff1"),
            role=UserRole.STAFF
        )
        db.add(staff_user1)
        
    staff2 = db.query(User).filter(User.username == "staff2").first()
    if not staff2:
        staff_user2 = User(
            username="staff2",
            hashed_password=get_password_hash("staff2"),
            role=UserRole.STAFF
        )
        db.add(staff_user2)
        
    db.commit()
    db.close()
    print("Database seeded with accounts: admin/admin | client/client | staff1/staff1 | staff2/staff2")

if __name__ == "__main__":
    seed_data()
