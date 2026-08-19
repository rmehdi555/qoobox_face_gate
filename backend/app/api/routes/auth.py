from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Admin login",
    description="Authenticate with email and password and receive a JWT access token.",
    responses={401: {"description": "Invalid credentials"}},
)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    return AuthService(db).authenticate(payload.email, payload.password)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Current admin",
    description="Return the currently authenticated administrator.",
    responses={401: {"description": "Missing or invalid token"}},
)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
