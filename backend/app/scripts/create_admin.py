"""Create the first FaceGate administrator.

Usage:
    python -m app.scripts.create_admin
    python -m app.scripts.create_admin --email admin@example.com --password 'your-password'
"""

from __future__ import annotations

import argparse
import getpass
import sys

from app.core.exceptions import AppError
from app.database.session import SessionLocal
from app.services.auth_service import AuthService


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create the first FaceGate admin user")
    parser.add_argument("--email", help="Admin email address")
    parser.add_argument("--password", help="Admin password (avoid in shared shells)")
    return parser.parse_args()


def prompt_credentials(email: str | None, password: str | None) -> tuple[str, str]:
    if not email:
        email = input("Email: ").strip()
    if not password:
        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            raise SystemExit("Passwords do not match")
    return email, password


def main() -> None:
    args = parse_args()
    email, password = prompt_credentials(args.email, args.password)
    if not email or "@" not in email:
        raise SystemExit("A valid email is required")
    if len(password) < 8:
        raise SystemExit("Password must be at least 8 characters")

    db = SessionLocal()
    try:
        user = AuthService(db).create_admin(email, password)
        print(f"Admin created: {user.email}")
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    except AppError as exc:
        raise SystemExit(exc.message) from exc
    except Exception as exc:
        raise SystemExit(f"Failed to create admin: {exc}") from exc
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
