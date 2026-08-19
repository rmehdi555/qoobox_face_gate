from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.recognition.service import recognition_service
from app.schemas.recognition import RecognitionResponse, RecognitionStatusResponse

router = APIRouter(prefix="/recognition", tags=["Recognition"])
logger = get_logger(__name__)


@router.get(
    "/status",
    response_model=RecognitionStatusResponse,
    summary="Recognition system status",
    description="Return model load state, embedding count, threshold, and recommended capture interval.",
)
def recognition_status(_: User = Depends(get_current_user)) -> RecognitionStatusResponse:
    return RecognitionStatusResponse(**recognition_service.status)


@router.post(
    "/recognize",
    response_model=RecognitionResponse,
    summary="Recognize faces from an image frame",
    description=(
        "Accept a camera frame, detect every face, estimate expression/action, compare embeddings "
        "against registered people, and identify which numbered face matched."
    ),
    responses={400: {"description": "Invalid image"}},
)
async def recognize(
    file: UploadFile = File(..., description="JPEG/PNG/WEBP camera frame"),
    _: User = Depends(get_current_user),
) -> RecognitionResponse:
    data = await file.read()
    try:
        result = recognition_service.recognize_frame(data)
    except Exception as exc:
        logger.exception("Recognition error")
        raise exc
    return result.to_response()
