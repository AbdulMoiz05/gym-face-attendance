"""
FAISS index: IndexFlatIP (cosine similarity with normalized vectors).
Persist index and member_id mapping to disk; reload on startup.
"""
import json
import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

try:
    import faiss
except ImportError:
    faiss = None

from config import FAISS_INDEX_PATH, FAISS_MAPPING_PATH, EMBEDDING_DIM

logger = logging.getLogger(__name__)
_lock = threading.Lock()

# In-memory: index + list of member_id per FAISS id (index position)
_index: Optional["faiss.IndexFlatIP"] = None
_id_to_member: List[str] = []  # faiss_id -> member_id (or str(member_pk))


def _ensure_index():
    global _index, _id_to_member
    if _index is not None:
        return
    if faiss is None:
        raise RuntimeError("faiss not installed")
    _index = faiss.IndexFlatIP(EMBEDDING_DIM)
    _id_to_member = []


def add_embedding(member_id: str, embedding: np.ndarray) -> None:
    """Add one normalized 512-d vector; member_id can be Django member_id or str(pk)."""
    embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
    if embedding.shape[1] != EMBEDDING_DIM:
        raise ValueError(f"Embedding dim must be {EMBEDDING_DIM}, got {embedding.shape[1]}")
    with _lock:
        _ensure_index()
        _index.add(embedding)
        _id_to_member.append(member_id)


def search(embedding: np.ndarray, k: int = 1) -> List[Tuple[str, float]]:
    """
    Search top-k by cosine similarity (IP on normalized = cosine).
    Returns list of (member_id, score).
    """
    embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
    with _lock:
        _ensure_index()
        if _index.ntotal == 0:
            return []
        scores, indices = _index.search(embedding, min(k, _index.ntotal))
    out = []
    for i, idx in enumerate(indices[0]):
        if idx < 0 or idx >= len(_id_to_member):
            continue
        out.append((_id_to_member[idx], float(scores[0][i])))
    return out


def count() -> int:
    with _lock:
        if _index is None:
            return 0
        return _index.ntotal


def save() -> None:
    """Persist index and mapping to disk."""
    with _lock:
        if _index is None or _index.ntotal == 0:
            return
        faiss.write_index(_index, str(FAISS_INDEX_PATH))
        FAISS_MAPPING_PATH.write_text(json.dumps(_id_to_member), encoding="utf-8")
        logger.info("Saved FAISS index: %d vectors to %s", _index.ntotal, FAISS_INDEX_PATH)


def load() -> bool:
    """Load from disk. Returns True if loaded, False if no file."""
    global _index, _id_to_member
    with _lock:
        if not FAISS_INDEX_PATH.exists() or not FAISS_MAPPING_PATH.exists():
            return False
        try:
            _index = faiss.read_index(str(FAISS_INDEX_PATH))
            _id_to_member = json.loads(FAISS_MAPPING_PATH.read_text(encoding="utf-8"))
            if _index.ntotal != len(_id_to_member):
                logger.warning("FAISS count %d != mapping length %d", _index.ntotal, len(_id_to_member))
            logger.info("Loaded FAISS index: %d vectors", _index.ntotal)
            return True
        except Exception as e:
            logger.exception("Failed to load FAISS: %s", e)
            return False


def load_from_django(embeddings: List[dict]) -> None:
    """
    Build index from list of {member_id, member_pk, embedding}.
    Use member_pk as stable id for mapping (or member_id).
    """
    global _index, _id_to_member
    if faiss is None:
        raise RuntimeError("faiss not installed")
    with _lock:
        _index = faiss.IndexFlatIP(EMBEDDING_DIM)
        _id_to_member = []
        for row in embeddings:
            emb = np.array(row["embedding"], dtype=np.float32)
            if emb.size != EMBEDDING_DIM:
                continue
            norm = np.linalg.norm(emb)
            if norm < 1e-6:
                continue
            emb = (emb / norm).reshape(1, -1)
            _index.add(emb)
            # Prefer business member_id so FAISS matches registration payloads
            mid = str(row.get("member_id") or row.get("member_pk") or "")
            _id_to_member.append(mid)
        logger.info("Built FAISS index from Django: %d vectors", _index.ntotal)
