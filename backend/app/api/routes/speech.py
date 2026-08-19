from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.speech import SpeechStatusResponse, TranscriptionResponse
from app.speech.transcriber import speech_service

router = APIRouter(prefix="/speech", tags=["Speech"])


@router.get(
    "/status",
    response_model=SpeechStatusResponse,
    summary="Speech-to-text status",
    description="Return whether the Whisper model is loaded and ready.",
)
def speech_status(_: User = Depends(get_current_user)) -> SpeechStatusResponse:
    return SpeechStatusResponse(**speech_service.status)


@router.post(
    "/transcribe",
    response_model=TranscriptionResponse,
    summary="Transcribe audio to text",
    description=(
        "Upload a recorded or file audio clip. Whisper runs on CPU and returns the transcript. "
        "Set language to `auto` to detect automatically, or pass `en` / `fa`."
    ),
)
async def transcribe(
    file: UploadFile = File(..., description="Audio file (WAV, MP3, WEBM, OGG, M4A)"),
    language: str = Form(default="auto"),
    _: User = Depends(get_current_user),
) -> TranscriptionResponse:
    data = await file.read()
    result = speech_service.transcribe(data, file.filename, file.content_type, language)
    return TranscriptionResponse(**result)
