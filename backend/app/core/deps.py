from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app.core.security import decode_access_token
from app.models.core import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception
        
    username: str = payload.get("sub")
    role: str = payload.get("role")
    
    if username is None:
        raise credentials_exception
        
    user = db.query(User).filter(User.username == username).first()
    if user is None or not user.is_active:
        raise credentials_exception
        
    return user

def require_admin(current_user: User = Depends(get_current_user)):
    if current_user.role != "ADMIN":
        raise HTTPException(status_code=403, detail="Not authorized (Requires Admin)")
    return current_user

def require_client(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "CLIENT"]:
        raise HTTPException(status_code=403, detail="Not authorized (Requires Client)")
    return current_user

def require_staff(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["ADMIN", "STAFF"]:
        raise HTTPException(status_code=403, detail="Not authorized (Requires Staff)")
    return current_user
