import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import api_router, health_router
from app.core.config import settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging, get_logger
from app.database.session import SessionLocal
from app.middleware.request_logging import RequestLoggingMiddleware
from app.recognition.service import recognition_service

configure_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info(
        "Starting FaceGate",
        extra={"extra_data": {"version": settings.app_version}},
    )
    if os.getenv("FACEGATE_TESTING") == "1":
        yield
        return

    try:
        db = SessionLocal()
        try:
            logger.info("Connecting to database")
            recognition_service.reload_index(db)
        finally:
            db.close()
    except Exception:
        logger.exception("Failed to load embedding index from database")

    def load_model() -> None:
        try:
            recognition_service.load_model()
        except Exception:
            logger.exception(
                "Recognition model failed to load; recognition endpoints will error until it succeeds"
            )

    threading.Thread(target=load_model, daemon=True, name="insightface-loader").start()

    yield
    logger.info("Shutting down FaceGate")


app = FastAPI(
    title="FaceGate API",
    description=(
        "Production face recognition API. Administrators register people with face images. "
        "The live recognition endpoint compares camera frames against stored embeddings.\n\n"
        "### Authentication\n"
        "1. Call `POST /api/auth/login` with email and password.\n"
        "2. Send the returned token as `Authorization: Bearer <token>` on admin endpoints.\n"
        "Use the Authorize button in Swagger to persist the token."
    ),
    version=settings.app_version,
    lifespan=lifespan,
    swagger_ui_parameters={"persistAuthorization": True},
    openapi_tags=[
        {"name": "Health", "description": "Liveness and dependency checks"},
        {"name": "Authentication", "description": "Admin login and current user"},
        {"name": "Persons", "description": "Registered people"},
        {"name": "Face Images", "description": "Face image upload, download, and deletion"},
        {"name": "Recognition", "description": "Live face matching"},
        {"name": "Dashboard", "description": "Aggregate statistics"},
    ],
)

app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.include_router(health_router)
app.include_router(api_router, prefix="/api")
