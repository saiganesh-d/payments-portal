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

    # Client 1: 7basic1 / 1basic7
    client1 = db.query(User).filter(User.username == "7basic1").first()
    if not client1:
        client1_user = User(
            username="7basic1",
            hashed_password=get_password_hash("1basic7"),
            role=UserRole.CLIENT
        )
        db.add(client1_user)

    # Client 2: 7basic2 / 2basic7
    client2 = db.query(User).filter(User.username == "7basic2").first()
    if not client2:
        client2_user = User(
            username="7basic2",
            hashed_password=get_password_hash("2basic7"),
            role=UserRole.CLIENT
        )
        db.add(client2_user)

    db.commit()
    db.close()
    print("Database seeded with accounts: admin/admin | 7basic1/1basic7 | 7basic2/2basic7")

if __name__ == "__main__":
    seed_data()
