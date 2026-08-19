from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.person import (
    FaceImageResponse,
    PersonCreate,
    PersonDetailResponse,
    PersonResponse,
    PersonUpdate,
)
from app.services.person_service import PersonService

router = APIRouter(prefix="/persons", tags=["Persons"])


@router.get(
    "",
    response_model=list[PersonResponse],
    summary="List people",
    description="List registered people. Use `search` to filter by first or last name.",
)
def list_persons(
    search: str | None = Query(default=None, description="Search by name"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[PersonResponse]:
    return PersonService(db).list_people(search=search, skip=skip, limit=limit)


@router.post(
    "",
    response_model=PersonDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create person",
    description="Register a new person with first name and last name.",
)
def create_person(
    payload: PersonCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PersonDetailResponse:
    return PersonService(db).create(payload.first_name, payload.last_name)


@router.get(
    "/{person_id}",
    response_model=PersonDetailResponse,
    summary="Get person",
    description="Retrieve a person including uploaded face images.",
    responses={404: {"description": "Person not found"}},
)
def get_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PersonDetailResponse:
    return PersonService(db).get_detail(person_id)


@router.put(
    "/{person_id}",
    response_model=PersonDetailResponse,
    summary="Update person",
    description="Update a person's first name and/or last name.",
    responses={404: {"description": "Person not found"}},
)
def update_person(
    person_id: UUID,
    payload: PersonUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PersonDetailResponse:
    return PersonService(db).update(person_id, payload.first_name, payload.last_name)


@router.delete(
    "/{person_id}",
    response_model=MessageResponse,
    summary="Delete person",
    description="Delete a person and all associated face images and embeddings.",
    responses={404: {"description": "Person not found"}},
)
def delete_person(
    person_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> MessageResponse:
    PersonService(db).delete(person_id)
    return MessageResponse(message="Person deleted")


@router.post(
    "/{person_id}/faces",
    response_model=FaceImageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload face image",
    description=(
        "Upload a face image for a person. The image must contain exactly one detectable face. "
        "Supported formats: JPG, JPEG, PNG, WEBP."
    ),
    responses={
        404: {"description": "Person not found"},
        413: {"description": "File too large"},
        422: {"description": "No face or multiple faces"},
    },
)
async def upload_face(
    person_id: UUID,
    file: UploadFile = File(..., description="Face image file"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FaceImageResponse:
    data = await file.read()
    image = PersonService(db).add_face(person_id, file.filename, file.content_type, data)
    return FaceImageResponse.model_validate(image)
