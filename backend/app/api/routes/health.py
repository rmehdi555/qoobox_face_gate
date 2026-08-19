from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.recognition.engine import face_engine
from app.schemas.common import HealthResponse

router = APIRouter(tags=["Health"])


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Health check",
    description="Return application, database, and recognition model status.",
)
def health(db: Session = Depends(get_db)) -> HealthResponse:
    database = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        database = "error"

    recognition = "ok" if face_engine.is_loaded else "unavailable"
    overall = "ok" if database == "ok" else "degraded"
    return HealthResponse(status=overall, database=database, recognition=recognition)
