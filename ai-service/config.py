"""
AI Service configuration. Env-based; safe defaults for CPU.
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
FAISS_INDEX_PATH = DATA_DIR / "faiss_index.bin"
FAISS_MAPPING_PATH = DATA_DIR / "faiss_member_mapping.json"

# InsightFace
INSIGHTFACE_ROOT = os.getenv("INSIGHTFACE_ROOT", str(BASE_DIR))
# Use buffalo_l for better accuracy (larger), buffalo_s for lower RAM
INSIGHTFACE_MODEL = os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
# CPU or CUDA
INSIGHTFACE_PROVIDER = os.getenv("INSIGHTFACE_PROVIDER", "CPU")
# Detection input size: smaller = faster (320), larger = more accurate (640). Real-time: use 320.
DET_SIZE = int(os.getenv("DET_SIZE", "320"))
# Real-time: use first/best face in frame (don't require exactly one face). If False, multi-face mode.
REALTIME_FIRST_FACE_ONLY = os.getenv("REALTIME_FIRST_FACE_ONLY", "false").lower() in ("1", "true", "yes")
# Multi-face: max faces to detect and recognize per frame (only when REALTIME_FIRST_FACE_ONLY is False)
RECOGNITION_MAX_FACES = int(os.getenv("RECOGNITION_MAX_FACES", "20"))
# Max image dimension for recognition (downscale larger images for speed). 0 = no limit.
RECOGNITION_MAX_IMAGE_DIM = int(os.getenv("RECOGNITION_MAX_IMAGE_DIM", "640"))

# Thresholds (tune for your environment)
FACE_CONFIDENCE_THRESHOLD = float(os.getenv("FACE_CONFIDENCE_THRESHOLD", "0.5"))
RECOGNITION_SIMILARITY_THRESHOLD = float(os.getenv("RECOGNITION_SIMILARITY_THRESHOLD", "0.6"))
BLUR_THRESHOLD = float(os.getenv("BLUR_THRESHOLD", "100.0"))  # Laplacian variance; lower = stricter
MIN_BRIGHTNESS = float(os.getenv("MIN_BRIGHTNESS", "40.0"))
MAX_BRIGHTNESS = float(os.getenv("MAX_BRIGHTNESS", "220.0"))

# Django integration
DJANGO_API_URL = os.getenv("DJANGO_API_URL", "http://localhost:8000/api/v1")
AI_SERVICE_SECRET = os.getenv("AI_SERVICE_SECRET", "")

# Embedding dimension (ArcFace typically 512)
EMBEDDING_DIM = 512

# Liveness
LIVENESS_BLINK_THRESHOLD = float(os.getenv("LIVENESS_BLINK_THRESHOLD", "0.2"))
LIVENESS_MIN_FRAMES = int(os.getenv("LIVENESS_MIN_FRAMES", "3"))

DATA_DIR.mkdir(parents=True, exist_ok=True)
