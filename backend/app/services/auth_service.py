from sqlalchemy.orm import Session

from app.core.exceptions import AuthenticationError
from app.core.logging import get_logger
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.repositories import UserRepository
from app.schemas.auth import TokenResponse

logger = get_logger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.users = UserRepository(db)

    def authenticate(self, email: str, password: str) -> TokenResponse:
        user = self.users.get_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            logger.info("Authentication failure", extra={"extra_data": {"email": email.lower()}})
            raise AuthenticationError()
        token = create_access_token(str(user.id), extra_claims={"email": user.email})
        return TokenResponse(access_token=token)

    def create_admin(self, email: str, password: str) -> User:
        existing = self.users.get_by_email(email)
        if existing is not None:
            raise ValueError(f"An admin with email {email} already exists")
        return self.users.create(email=email, password_hash=hash_password(password))
