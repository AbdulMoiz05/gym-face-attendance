"""
Face recognition: extract and normalize 512-d embeddings (ArcFace via InsightFace).
Delegates to face_detector for actual inference; this module handles normalization and averaging.
"""
import logging
import numpy as np
from typing import List, Optional

from services.face_detector import get_single_face_embedding, detect_faces

logger = logging.getLogger(__name__)


def normalize_embedding(emb: np.ndarray) -> np.ndarray:
    """L2-normalize for cosine similarity (IndexFlatIP expects normalized vectors)."""
    emb = np.array(emb, dtype=np.float32)
    n = np.linalg.norm(emb)
    if n < 1e-6:
        raise ValueError("Zero embedding")
    return (emb / n).astype(np.float32)


def get_embedding_from_image(img: np.ndarray, conf_threshold: float = None) -> Optional[np.ndarray]:
    """
    Single face in image -> 512-d L2-normalized embedding.
    Returns None if 0 or >1 face.
    """
    emb = get_single_face_embedding(img, conf_threshold=conf_threshold)
    if emb is None:
        return None
    return normalize_embedding(emb)


def average_embeddings(embeddings: List[np.ndarray]) -> np.ndarray:
    """
    Average multiple embeddings and L2-normalize (for registration).
    """
    if not embeddings:
        raise ValueError("No embeddings to average")
    arr = np.array(embeddings, dtype=np.float32)
    mean = np.mean(arr, axis=0)
    return normalize_embedding(mean)
