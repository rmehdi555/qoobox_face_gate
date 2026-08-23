from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, NotFoundError
from app.core.logging import get_logger
from app.models.live_session import LiveSession
from app.repositories.repositories import LiveSessionRepository
from app.schemas.session import (
    FacialState,
    SessionDetailResponse,
    SessionEventIn,
    SessionEventOut,
    SessionStartResponse,
    SessionSummaryResponse,
    TranscriptLine,
)
from app.services.storage_service import storage_service

logger = get_logger(__name__)


def _event_payload(item: SessionEventIn) -> dict:
    return item.model_dump(exclude_none=False)


def _to_detail(session: LiveSession) -> SessionDetailResponse:
    raw_events = session.events or []
    events = [SessionEventOut.model_validate(item) for item in raw_events]
    transcript = [
        TranscriptLine(at_ms=event.at_ms, speaker=event.speaker, text=event.text)
        for event in events
        if event.kind == "speech" and event.text
    ]
    facial_states = [
        FacialState(at_ms=event.at_ms, speaker=event.speaker, action=event.action, emotion=event.emotion)
        for event in events
        if event.kind == "presence"
    ]
    recording_url = f"/api/sessions/{session.id}/recording" if session.recording_path else None
    return SessionDetailResponse(
        id=session.id,
        status=session.status,
        language=session.language,
        started_at=session.started_at,
        ended_at=session.ended_at,
        duration_seconds=session.duration_seconds,
        recording_url=recording_url,
        recording_filename=session.recording_filename,
        transcript=transcript,
        facial_states=facial_states,
        events=events,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


def _to_summary(session: LiveSession) -> SessionSummaryResponse:
    detail = _to_detail(session)
    return SessionSummaryResponse(
        id=detail.id,
        status=detail.status,
        language=detail.language,
        started_at=detail.started_at,
        ended_at=detail.ended_at,
        duration_seconds=detail.duration_seconds,
        recording_url=detail.recording_url,
        transcript_count=len(detail.transcript),
        facial_state_count=len(detail.facial_states),
    )


class SessionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.sessions = LiveSessionRepository(db)

    def start(self, created_by: UUID, language: str | None) -> SessionStartResponse:
        session = self.sessions.create(created_by, language or "en")
        logger.info("Live session started", extra={"extra_data": {"session_id": str(session.id)}})
        return SessionStartResponse(
            id=session.id,
            status=session.status,
            language=session.language,
            started_at=session.started_at,
        )

    def get(self, session_id: UUID) -> LiveSession:
        session = self.sessions.get(session_id)
        if session is None:
            raise NotFoundError("Session not found")
        return session

    def get_detail(self, session_id: UUID) -> SessionDetailResponse:
        return _to_detail(self.get(session_id))

    def list(self, skip: int = 0, limit: int = 100) -> list[SessionSummaryResponse]:
        return [_to_summary(session) for session in self.sessions.list(skip=skip, limit=limit)]

    def stop(
        self,
        session_id: UUID,
        events: list[SessionEventIn],
        duration_seconds: float | None,
        language: str | None,
        recording: bytes | None,
        filename: str | None,
        content_type: str | None,
    ) -> SessionDetailResponse:
        session = self.get(session_id)
        if session.status != "recording":
            raise ConflictError("This session has already been stopped")
        now = datetime.now(timezone.utc)
        session.status = "stopped"
        session.ended_at = now
        if language:
            session.language = language
        if duration_seconds is not None:
            session.duration_seconds = round(float(duration_seconds), 2)
        elif session.started_at:
            started = session.started_at
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            session.duration_seconds = round((now - started).total_seconds(), 2)
        session.events = [_event_payload(item) for item in events]
        if recording:
            path, stored_name, mime = storage_service.save_session_recording(
                recording,
                filename,
                content_type,
            )
            session.recording_path = path
            session.recording_filename = stored_name
            session.recording_content_type = mime
        self.sessions.save(session)
        logger.info("Live session stopped", extra={"extra_data": {"session_id": str(session.id)}})
        return _to_detail(session)

    def get_recording(self, session_id: UUID) -> tuple[bytes, str, str]:
        session = self.get(session_id)
        if not session.recording_path:
            raise NotFoundError("No recording file is stored for this session")
        data = storage_service.read(session.recording_path)
        media_type = session.recording_content_type or "application/octet-stream"
        filename = session.recording_filename or "session.webm"
        return data, media_type, filename
