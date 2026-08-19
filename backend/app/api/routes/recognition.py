from fastapi import APIRouter, Depends, File, UploadFile

from app.api.deps import get_current_user
from app.core.logging import get_logger
from app.models.user import User
from app.recognition.service import recognition_service
from app.schemas.recognition import PersonMatch, RecognitionResponse, RecognitionStatusResponse

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
    summary="Recognize a face from an image frame",
    description=(
        "Accept a camera frame or still image, detect a face, compare it against registered "
        "embeddings, and return the best match if the similarity exceeds the configured threshold."
    ),
    responses={400: {"description": "Invalid image"}},
)
async def recognize(
    file: UploadFile = File(..., description="JPEG/PNG/WEBP camera frame"),
    _: User = Depends(get_current_user),
) -> RecognitionResponse:
    data = await file.read()
    try:
        face_detected, match = recognition_service.recognize_frame(data)
    except Exception as exc:
        logger.exception("Recognition error")
        raise exc

    if not face_detected:
        return RecognitionResponse(
            recognized=False,
            person=None,
            confidence=0.0,
            face_detected=False,
            message="No face detected",
        )
    if match is None:
        return RecognitionResponse(
            recognized=False,
            person=None,
            confidence=0.0,
            face_detected=True,
            message="Unknown person",
        )
    return RecognitionResponse(
        recognized=True,
        person=PersonMatch(
            id=match.person_id,
            first_name=match.first_name,
            last_name=match.last_name,
        ),
        confidence=round(match.confidence, 4),
        face_detected=True,
        message="Person recognized",
    )
