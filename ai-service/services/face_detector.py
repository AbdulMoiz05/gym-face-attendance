"""
Face detection using InsightFace (RetinaFace). Lazy-loaded singleton.
"""
import logging
from typing import Optional, List, Tuple
import numpy as np

from config import (
    INSIGHTFACE_MODEL,
    INSIGHTFACE_ROOT,
    INSIGHTFACE_PROVIDER,
    FACE_CONFIDENCE_THRESHOLD,
    DET_SIZE,
)

logger = logging.getLogger(__name__)

# Lazy-loaded app
_face_app = None


def _get_app():
    global _face_app
    if _face_app is None:
        try:
            from insightface.app import FaceAnalysis
            # ONNX Runtime expects full provider names to avoid "Unknown Provider Type" and retry lag
            use_cuda = INSIGHTFACE_PROVIDER.upper() == "CUDA"
            providers = ["CUDAExecutionProvider", "CPUExecutionProvider"] if use_cuda else ["CPUExecutionProvider"]
            ctx_id = 0 if use_cuda else -1
            _face_app = FaceAnalysis(
                name=INSIGHTFACE_MODEL,
                root=INSIGHTFACE_ROOT,
                providers=providers,
            )
            det_sz = max(320, min(640, DET_SIZE))
            _face_app.prepare(ctx_id=ctx_id, det_size=(det_sz, det_sz))
            logger.info("InsightFace FaceAnalysis loaded (model=%s, provider=%s)", INSIGHTFACE_MODEL, providers[0])
        except Exception as e:
            logger.exception("Failed to load InsightFace: %s", e)
            raise
    return _face_app


def detect_faces(
    img: np.ndarray,
    conf_threshold: float = None,
    max_faces: int = 1,
) -> List[dict]:
    """
    Detect faces in BGR image. Returns list of dicts with bbox, score, embedding.
    Uses InsightFace (RetinaFace + ArcFace); each face has 512-d embedding.
    """
    app = _get_app()
    th = conf_threshold if conf_threshold is not None else FACE_CONFIDENCE_THRESHOLD
    faces = app.get(img)
    out = []
    for f in faces:
        det_score = float(getattr(f, "det_score", 0.0))
        if det_score < th:
            continue
        bbox = getattr(f, "bbox", None)
        if bbox is not None and hasattr(bbox, "tolist"):
            bbox = bbox.tolist()
        else:
            bbox = [0, 0, 0, 0]
        emb = getattr(f, "embedding", None)
        if emb is not None:
            emb = np.array(emb, dtype=np.float32)
        out.append({
            "bbox": bbox,
            "score": det_score,
            "embedding": emb,
        })
        if len(out) >= max_faces:
            break
    return out


def get_single_face_embedding(img: np.ndarray, conf_threshold: float = None) -> Optional[np.ndarray]:
    """
    Detect exactly one face and return its 512-d embedding (L2-normalized).
    Returns None if 0 or >1 face.
    """
    faces = detect_faces(img, conf_threshold=conf_threshold, max_faces=2)
    if len(faces) != 1:
        return None
    emb = faces[0].get("embedding")
    if emb is None:
        return None
    emb = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(emb)
    if norm > 1e-6:
        emb = emb / norm
    return emb


def get_single_face_embedding_and_bbox(
    img: np.ndarray, conf_threshold: float = None
) -> Optional[Tuple[np.ndarray, List[float]]]:
    """
    Detect exactly one face; return (L2-normalized embedding, bbox [x1,y1,x2,y2]).
    Returns None if 0 or >1 face.
    """
    faces = detect_faces(img, conf_threshold=conf_threshold, max_faces=2)
    if len(faces) != 1:
        return None
    f = faces[0]
    emb = f.get("embedding")
    bbox = f.get("bbox") or [0, 0, 0, 0]
    if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
        bbox = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
    else:
        bbox = [0.0, 0.0, 0.0, 0.0]
    if emb is None:
        return None
    emb = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(emb)
    if norm > 1e-6:
        emb = emb / norm
    return (emb, bbox)


def get_best_face_embedding_and_bbox(
    img: np.ndarray, conf_threshold: float = None
) -> Optional[Tuple[np.ndarray, List[float]]]:
    """
    Real-time: detect and return the first/best face (highest confidence).
    One call = detect + embed. Returns (L2-normalized embedding, bbox) or None if no face.
    Use this for real-time so "face detect hotey hi recognize" with no wait for exactly-one-face.
    """
    faces = detect_faces(img, conf_threshold=conf_threshold, max_faces=1)
    if not faces:
        return None
    f = faces[0]
    emb = f.get("embedding")
    bbox = f.get("bbox") or [0, 0, 0, 0]
    if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
        bbox = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
    else:
        bbox = [0.0, 0.0, 0.0, 0.0]
    if emb is None:
        return None
    emb = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(emb)
    if norm > 1e-6:
        emb = emb / norm
    return (emb, bbox)
