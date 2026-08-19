from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services.person_service import PersonService

router = APIRouter(tags=["Face Images"])


@router.get(
    "/faces/{image_id}/file",
    summary="Download face image",
    description="Return the stored image bytes for a face image.",
    responses={404: {"description": "Face image not found"}},
)
def get_face_file(
    image_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    data, media_type = PersonService(db).get_face_file(image_id)
    return Response(content=data, media_type=media_type)


@router.delete(
    "/faces/{image_id}",
    response_model=MessageResponse,
    summary="Delete face image",
    description="Remove a single face image and its embedding.",
    responses={404: {"description": "Face image not found"}},
)
def delete_face(
    image_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MessageResponse:
    PersonService(db).delete_face(image_id)
    return MessageResponse(message="Face image deleted")
