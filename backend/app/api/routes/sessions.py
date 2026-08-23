import json
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.exceptions import InvalidRecordingError
from app.database.session import get_db
from app.models.user import User
from app.schemas.session import (
    SessionDetailResponse,
    SessionEventIn,
    SessionStartRequest,
    SessionStartResponse,
    SessionSummaryResponse,
)
from app.services.session_service import SessionService

router = APIRouter(prefix="/sessions", tags=["Sessions"])


def _parse_events(raw: str | None) -> list[SessionEventIn]:
    if not raw or not raw.strip():
        return []
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise InvalidRecordingError("events must be a valid JSON array") from exc
    if not isinstance(payload, list):
        raise InvalidRecordingError("events must be a JSON array")
    try:
        return [SessionEventIn.model_validate(item) for item in payload]
    except ValidationError as exc:
        raise InvalidRecordingError(f"Invalid session events: {exc.errors()[0].get('msg', 'validation failed')}") from exc


@router.post(
    "/start",
    response_model=SessionStartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a live session",
    description="Create a new live session and return a unique session id.",
)
def start_session(
    payload: SessionStartRequest = SessionStartRequest(),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SessionStartResponse:
    return SessionService(db).start(user.id, payload.language)


@router.post(
    "/{session_id}/stop",
    response_model=SessionDetailResponse,
    summary="Stop a live session",
    description=(
        "Stop a session by id. Optionally upload the recorded video/audio file and a JSON array of "
        "presence/speech events. After this call, GET /sessions/{id} returns the stored result."
    ),
    responses={
        404: {"description": "Session not found"},
        409: {"description": "Session already stopped"},
    },
)
async def stop_session(
    session_id: UUID,
    events: str | None = Form(default=None, description="JSON array of presence and speech events"),
    duration_seconds: float | None = Form(default=None),
    language: str | None = Form(default=None),
    file: UploadFile | None = File(default=None, description="Recorded video/audio file"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SessionDetailResponse:
    recording = await file.read() if file is not None else None
    filename = file.filename if file is not None else None
    content_type = file.content_type if file is not None else None
    if recording == b"":
        recording = None
    return SessionService(db).stop(
        session_id,
        _parse_events(events),
        duration_seconds,
        language,
        recording,
        filename,
        content_type,
    )


@router.get(
    "",
    response_model=list[SessionSummaryResponse],
    summary="List live sessions",
    description="Return every stored session, newest first.",
)
def list_sessions(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SessionSummaryResponse]:
    return SessionService(db).list(skip=skip, limit=limit)


@router.get(
    "/{session_id}",
    response_model=SessionDetailResponse,
    summary="Get session result",
    description="Return the recording URL, transcript text, and facial states for a session.",
    responses={404: {"description": "Session not found"}},
)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> SessionDetailResponse:
    return SessionService(db).get_detail(session_id)


@router.get(
    "/{session_id}/recording",
    summary="Download session recording",
    description="Return the stored video/audio bytes for a stopped session.",
    responses={404: {"description": "Session or recording not found"}},
)
def get_session_recording(
    session_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Response:
    data, media_type, filename = SessionService(db).get_recording(session_id)
    return Response(
        content=data,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
