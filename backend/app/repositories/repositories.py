from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.person import Person
from app.models.face_image import FaceImage
from app.models.face_embedding import FaceEmbedding


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(func.lower(User.email) == email.lower()))

    def get_by_id(self, user_id: UUID) -> User | None:
        return self.db.get(User, user_id)

    def create(self, email: str, password_hash: str) -> User:
        user = User(email=email.lower(), password_hash=password_hash)
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user


class PersonRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(self, search: str | None = None, skip: int = 0, limit: int = 100) -> list[Person]:
        stmt = select(Person).order_by(Person.created_at.desc())
        if search:
            term = f"%{search.strip().lower()}%"
            full_name = func.lower(Person.first_name) + " " + func.lower(Person.last_name)
            stmt = stmt.where(
                or_(
                    func.lower(Person.first_name).like(term),
                    func.lower(Person.last_name).like(term),
                    full_name.like(term),
                )
            )
        return list(self.db.scalars(stmt.offset(skip).limit(limit)).unique().all())

    def count(self, search: str | None = None) -> int:
        stmt = select(func.count(Person.id))
        if search:
            term = f"%{search.strip().lower()}%"
            full_name = func.lower(Person.first_name) + " " + func.lower(Person.last_name)
            stmt = stmt.where(
                or_(
                    func.lower(Person.first_name).like(term),
                    func.lower(Person.last_name).like(term),
                    full_name.like(term),
                )
            )
        return int(self.db.scalar(stmt) or 0)

    def get(self, person_id: UUID) -> Person | None:
        return self.db.get(Person, person_id)

    def create(self, first_name: str, last_name: str) -> Person:
        person = Person(first_name=first_name.strip(), last_name=last_name.strip())
        self.db.add(person)
        self.db.commit()
        self.db.refresh(person)
        return person

    def update(self, person: Person, first_name: str | None, last_name: str | None) -> Person:
        if first_name is not None:
            person.first_name = first_name.strip()
        if last_name is not None:
            person.last_name = last_name.strip()
        self.db.add(person)
        self.db.commit()
        self.db.refresh(person)
        return person

    def delete(self, person: Person) -> None:
        self.db.delete(person)
        self.db.commit()


class FaceRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_image(self, image_id: UUID) -> FaceImage | None:
        return self.db.get(FaceImage, image_id)

    def list_images(self, person_id: UUID) -> list[FaceImage]:
        stmt = (
            select(FaceImage)
            .where(FaceImage.person_id == person_id)
            .order_by(FaceImage.created_at.asc())
        )
        return list(self.db.scalars(stmt).all())

    def count_images(self, person_id: UUID | None = None) -> int:
        stmt = select(func.count(FaceImage.id))
        if person_id is not None:
            stmt = stmt.where(FaceImage.person_id == person_id)
        return int(self.db.scalar(stmt) or 0)

    def create_image(
        self,
        person_id: UUID,
        file_path: str,
        original_filename: str,
        embedding: list[float],
    ) -> FaceImage:
        image = FaceImage(
            person_id=person_id,
            file_path=file_path,
            original_filename=original_filename,
        )
        self.db.add(image)
        self.db.flush()
        record = FaceEmbedding(
            person_id=person_id,
            face_image_id=image.id,
            embedding=embedding,
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(image)
        self.db.refresh(record)
        image.embedding = record
        return image

    def delete_image(self, image: FaceImage) -> None:
        self.db.delete(image)
        self.db.commit()

    def list_all_embeddings(self) -> list[tuple[UUID, UUID, UUID, list[float], str, str]]:
        stmt = (
            select(
                FaceEmbedding.id,
                FaceEmbedding.person_id,
                FaceEmbedding.face_image_id,
                FaceEmbedding.embedding,
                Person.first_name,
                Person.last_name,
            )
            .join(Person, Person.id == FaceEmbedding.person_id)
        )
        return list(self.db.execute(stmt).all())
