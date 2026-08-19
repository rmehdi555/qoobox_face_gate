from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.recognition.service import recognition_service
from app.repositories.repositories import FaceRepository, PersonRepository
from app.schemas.recognition import DashboardStatsResponse

router = APIRouter(prefix="/stats", tags=["Dashboard"])


@router.get(
    "",
    response_model=DashboardStatsResponse,
    summary="Dashboard statistics",
    description="Return total people, total face images, and recognition system status.",
)
def stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> DashboardStatsResponse:
    status = recognition_service.status
    return DashboardStatsResponse(
        total_people=PersonRepository(db).count(),
        total_face_images=FaceRepository(db).count_images(),
        recognition_status=status["status"],
        model_loaded=status["model_loaded"],
        registered_embeddings=status["registered_embeddings"],
        threshold=status["threshold"],
        execution_device=status.get("execution_device", "cpu"),
    )
