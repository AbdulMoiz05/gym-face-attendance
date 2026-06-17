"""
Real-time face recognition: detect all faces -> recognize each; return list of bbox + member_id per face.
Multi-face mode: process every face in the frame, draw known/unknown on each. Attendance marked in background per recognized member.
"""
import base64
import logging
import re
from datetime import datetime
from typing import Any, List

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request

import config
from utils.image import decode_image
from services.face_detector import detect_faces, get_best_face_embedding_and_bbox
from services.face_recognizer import normalize_embedding
from services.faiss_index import search
from utils.django_client import mark_attendance_in_django

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/recognize-face", tags=["recognition"])


def _mark_attendance_background(member_id: str, confidence: float) -> None:
    """Run in background so recognition response returns immediately."""
    now = datetime.utcnow().isoformat() + "Z"
    resp = mark_attendance_in_django(member_id, timestamp=now, confidence=confidence)
    if not resp.get("success") and resp.get("error") != "already_marked":
        logger.warning("Attendance mark failed: %s", resp)


def _normalize_image_b64(value: Any) -> str:
    """Accept raw base64 or data URL; return raw base64 string."""
    if value is None:
        raise ValueError("image_b64 required")
    s = str(value).strip()
    if not s:
        raise ValueError("image_b64 is empty")
    m = re.match(r"^data:image/[^;]+;base64,(.+)$", s, re.IGNORECASE | re.DOTALL)
    if m:
        s = m.group(1).strip()
    s = "".join(s.split())
    if not s:
        raise ValueError("image_b64 is empty after normalization")
    return s


def _process_multi_face(img, w: int, h: int, background_tasks: BackgroundTasks) -> dict:
    """Detect all faces, recognize each, return { faces: [...], image_width, image_height }."""
    max_faces = getattr(config, "RECOGNITION_MAX_FACES", 20) or 20
    conf_th = config.FACE_CONFIDENCE_THRESHOLD
    threshold = config.RECOGNITION_SIMILARITY_THRESHOLD

    all_faces = detect_faces(
        img,
        conf_threshold=conf_th,
        max_faces=max_faces,
    )
    if not all_faces:
        return {"faces": [], "error": "no_face", "image_width": w, "image_height": h}

    faces_out: List[dict] = []
    for f in all_faces:
        bbox = f.get("bbox") or [0, 0, 0, 0]
        bbox = [round(float(x), 1) for x in bbox[:4]]
        emb = f.get("embedding")
        if emb is None:
            faces_out.append({"bbox": bbox, "recognized": False, "image_width": w, "image_height": h})
            continue
        try:
            emb = normalize_embedding(emb)
        except Exception:
            faces_out.append({"bbox": bbox, "recognized": False, "image_width": w, "image_height": h})
            continue
        results = search(emb, k=1)
        if not results:
            faces_out.append({"bbox": bbox, "recognized": False, "image_width": w, "image_height": h})
            continue
        member_id, score = results[0]
        if score < threshold:
            faces_out.append({
                "bbox": bbox,
                "recognized": False,
                "confidence": round(score, 4),
                "image_width": w,
                "image_height": h,
            })
            continue
        confidence = round(score, 4)
        background_tasks.add_task(_mark_attendance_background, member_id, confidence)
        faces_out.append({
            "bbox": bbox,
            "recognized": True,
            "member_id": member_id,
            "confidence": confidence,
            "attendance_marked": True,
            "image_width": w,
            "image_height": h,
        })
    return {"faces": faces_out, "image_width": w, "image_height": h}


def _process_single_face(img, w: int, h: int, background_tasks: BackgroundTasks) -> dict:
    """Legacy single-face: first/best face only. Returns same shape as before (no .faces array)."""
    out = get_best_face_embedding_and_bbox(img, conf_threshold=config.FACE_CONFIDENCE_THRESHOLD)
    if out is None:
        return {"recognized": False, "error": "no_face", "image_width": w, "image_height": h}
    emb, bbox = out
    emb = normalize_embedding(emb)
    results = search(emb, k=1)
    if not results:
        return {
            "recognized": False,
            "bbox": [round(x, 1) for x in bbox],
            "image_width": w,
            "image_height": h,
        }
    member_id, score = results[0]
    threshold = config.RECOGNITION_SIMILARITY_THRESHOLD
    if score < threshold:
        return {
            "recognized": False,
            "confidence": round(score, 4),
            "bbox": [round(x, 1) for x in bbox],
            "image_width": w,
            "image_height": h,
        }
    confidence = round(score, 4)
    background_tasks.add_task(_mark_attendance_background, member_id, confidence)
    return {
        "recognized": True,
        "member_id": member_id,
        "confidence": confidence,
        "attendance_marked": True,
        "bbox": [round(x, 1) for x in bbox],
        "image_width": w,
        "image_height": h,
    }


@router.post("/")
async def recognize_face(request: Request, background_tasks: BackgroundTasks):
    """
    Recognize faces from image. Multi-face mode (default): detects all faces, recognizes each,
    returns { faces: [ { bbox, recognized, member_id?, confidence? }, ... ], image_width, image_height }.
    Single-face mode (REALTIME_FIRST_FACE_ONLY=true): returns { recognized, member_id?, bbox?, ... } for one face.
    """
    image_b64 = None
    content_type = (request.headers.get("content-type") or "").lower()

    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if file and hasattr(file, "read"):
            raw = await file.read()
            image_b64 = base64.b64encode(raw).decode("ascii") if raw else ""
        if not image_b64:
            raise HTTPException(status_code=400, detail="Upload a file in the 'file' field")
    else:
        try:
            body = await request.json()
        except Exception as e:
            logger.warning("Recognize body parse failed: %s", e)
            raise HTTPException(status_code=400, detail="Invalid JSON body")
        if not isinstance(body, dict):
            raise HTTPException(status_code=400, detail="Body must be a JSON object")
        raw_b64 = body.get("image_b64")
        if raw_b64 is None or (isinstance(raw_b64, str) and not raw_b64.strip()):
            raise HTTPException(status_code=400, detail="JSON body must include non-empty 'image_b64'")
        try:
            image_b64 = _normalize_image_b64(raw_b64)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    if not image_b64:
        raise HTTPException(status_code=400, detail="Provide JSON body with image_b64 or multipart file")

    max_dim = config.RECOGNITION_MAX_IMAGE_DIM or 0
    try:
        img = decode_image(image_b64, max_size=max_dim)
    except Exception as e:
        logger.warning("decode_image failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid image data (bad or unsupported format)")

    h, w = img.shape[:2]
    if getattr(config, "REALTIME_FIRST_FACE_ONLY", False):
        return _process_single_face(img, w, h, background_tasks)
    return _process_multi_face(img, w, h, background_tasks)
