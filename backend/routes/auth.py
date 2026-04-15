from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.routes.deps import get_current_user
from backend.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse
from backend.services.auth_service import login
from backend.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    result = login(db, payload.email, payload.password)
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token, role, name = result
    return TokenResponse(access_token=token, role=role, name=name)


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    try:
        auth_service.change_password(db, user, payload.old_password, payload.new_password, payload.confirm_password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"message": "Password updated successfully"}
