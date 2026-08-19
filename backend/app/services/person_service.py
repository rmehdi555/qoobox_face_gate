from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError
from app.core.logging import get_logger
from app.models.face_image import FaceImage
from app.models.person import Person
from app.recognition.service import recognition_service
from app.repositories.repositories import FaceRepository, PersonRepository
from app.schemas.person import FaceImageResponse, PersonDetailResponse, PersonResponse
from app.services.storage_service import storage_service

logger = get_logger(__name__)


def _to_person_response(person: Person, face_count: int, thumbnail_id: UUID | None) -> PersonResponse:
    return PersonResponse(
        id=person.id,
        first_name=person.first_name,
        last_name=person.last_name,
        created_at=person.created_at,
        updated_at=person.updated_at,
        face_count=face_count,
        thumbnail_id=thumbnail_id,
    )


class PersonService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.persons = PersonRepository(db)
        self.faces = FaceRepository(db)

    def list_people(self, search: str | None = None, skip: int = 0, limit: int = 100) -> list[PersonResponse]:
        people = self.persons.list(search=search, skip=skip, limit=limit)
        results: list[PersonResponse] = []
        for person in people:
            images = self.faces.list_images(person.id)
            thumbnail = images[0].id if images else None
            results.append(_to_person_response(person, len(images), thumbnail))
        return results

    def get_person(self, person_id: UUID) -> Person:
        person = self.persons.get(person_id)
        if person is None:
            raise NotFoundError("Person not found")
        return person

    def get_detail(self, person_id: UUID) -> PersonDetailResponse:
        person = self.get_person(person_id)
        images = self.faces.list_images(person.id)
        thumbnail = images[0].id if images else None
        base = _to_person_response(person, len(images), thumbnail)
        return PersonDetailResponse(
            **base.model_dump(),
            faces=[FaceImageResponse.model_validate(image) for image in images],
        )

    def create(self, first_name: str, last_name: str) -> PersonDetailResponse:
        person = self.persons.create(first_name, last_name)
        return self.get_detail(person.id)

    def update(self, person_id: UUID, first_name: str | None, last_name: str | None) -> PersonDetailResponse:
        person = self.get_person(person_id)
        self.persons.update(person, first_name, last_name)
        recognition_service.reload_index(self.db)
        return self.get_detail(person.id)

    def delete(self, person_id: UUID) -> None:
        person = self.get_person(person_id)
        images = self.faces.list_images(person.id)
        for image in images:
            storage_service.delete(image.file_path)
        recognition_service.remove_person(person.id)
        self.persons.delete(person)

    def add_face(self, person_id: UUID, filename: str | None, content_type: str | None, data: bytes) -> FaceImage:
        person = self.get_person(person_id)
        extension = storage_service.validate_upload(filename, content_type, data)
        try:
            embedding = recognition_service.embed_registration_image(data)
        except Exception:
            logger.info(
                "Upload validation failure",
                extra={"extra_data": {"person_id": str(person_id), "filename": filename}},
            )
            raise
        file_path = storage_service.save(data, extension)
        try:
            image = self.faces.create_image(
                person_id=person.id,
                file_path=file_path,
                original_filename=filename or f"face{extension}",
                embedding=embedding,
            )
        except Exception:
            storage_service.delete(file_path)
            raise

        embedding_row = image.embedding
        if embedding_row is not None:
            recognition_service.add_embedding(
                embedding_id=embedding_row.id,
                person_id=person.id,
                face_image_id=image.id,
                first_name=person.first_name,
                last_name=person.last_name,
                embedding=embedding,
            )
        return image

    def delete_face(self, image_id: UUID) -> None:
        image = self.faces.get_image(image_id)
        if image is None:
            raise NotFoundError("Face image not found")
        storage_service.delete(image.file_path)
        recognition_service.remove_image(image.id)
        self.faces.delete_image(image)

    def get_face_file(self, image_id: UUID) -> tuple[bytes, str]:
        image = self.faces.get_image(image_id)
        if image is None:
            raise NotFoundError("Face image not found")
        data = storage_service.read(image.file_path)
        name = image.original_filename.lower()
        if name.endswith(".png"):
            media_type = "image/png"
        elif name.endswith(".webp"):
            media_type = "image/webp"
        else:
            media_type = "image/jpeg"
        return data, media_type
