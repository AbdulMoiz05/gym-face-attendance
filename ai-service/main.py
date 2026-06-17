"""
Face Attendance – AI microservice (FastAPI).
Face registration (KYC-style) + real-time recognition with InsightFace (ArcFace) and FAISS.
"""
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from services.faiss_index import load as faiss_load, load_from_django, count as faiss_count
from utils.django_client import fetch_embeddings_from_django
from routers import register_router, recognize_router

# Structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load FAISS index on startup; optionally sync from Django if no local index."""
    logger.info("Starting AI service...")
    loaded = faiss_load()
    if not loaded:
        logger.info("No local FAISS index; fetching embeddings from Django...")
        embeddings = fetch_embeddings_from_django()
        if embeddings:
            load_from_django(embeddings)
            from services.faiss_index import save
            save()
        else:
            logger.info("No embeddings in Django; starting with empty index.")
    else:
        logger.info("FAISS index loaded: %d vectors", faiss_count())
    yield
    logger.info("Shutting down AI service.")


app = FastAPI(
    title="Face Attendance AI Service",
    version="1.0.0",
    description="Face registration (InsightFace + FAISS) and real-time recognition with attendance marking.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(register_router)
app.include_router(recognize_router)


@app.get("/health")
def health():
    """Health check; reports FAISS and model status."""
    from services.face_detector import _get_app
    model_loaded = False
    try:
        _get_app()
        model_loaded = True
    except Exception:
        pass
    return {
        "status": "ok",
        "service": "face-attendance-ai",
        "faiss_loaded": faiss_count() > 0,
        "faiss_count": faiss_count(),
        "model_loaded": model_loaded,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(getattr(config, "PORT", os.getenv("PORT", 8001)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
