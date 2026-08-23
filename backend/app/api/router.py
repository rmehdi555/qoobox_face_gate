from fastapi import APIRouter

from app.api.routes import auth, faces, health, persons, recognition, sessions, speech, stats

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(persons.router)
api_router.include_router(faces.router)
api_router.include_router(recognition.router)
api_router.include_router(speech.router)
api_router.include_router(sessions.router)
api_router.include_router(stats.router)

health_router = health.router
