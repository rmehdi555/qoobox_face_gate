from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    database: str = "unknown"
    recognition: str = "unknown"


class MessageResponse(BaseModel):
    message: str
