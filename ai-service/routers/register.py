"""
Face registration (KYC-style): accept images per step, quality checks, then average embedding and save.
"""
import logging
from typing import Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import config
from utils.image import decode_image, check_blur, check_brightness
from services.face_detector import get_single_face_embedding
from services.face_recognizer import normalize_embedding, average_embeddings
from services.faiss_index import add_embedding, save as faiss_save
from utils.django_client import store_embedding_in_django

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/register-face", tags=["registration"])

# In-memory: member_id -> list of embeddings (temporary until is_final=True)
_registration_buffer: Dict[str, List] = {}


class RegisterFacePayload(BaseModel):
    member_id: str
    member_pk: int | None = None
    step: int | None = None
    image_b64: str
    is_final: bool = False


class RegisterFaceBatchPayload(BaseModel):
    """Single request: send all images at once for faster registration (avoids timeout from many round-trips)."""
    member_id: str
    member_pk: int | None = None
    images_b64: List[str]


class AddSamplesPayload(BaseModel):
    """Stream samples during scan: append embeddings to buffer; no Django/FAISS yet."""
    member_id: str
    images_b64: List[str]


class FinalizePayload(BaseModel):
    """After scan complete: average buffer, save to Django + FAISS, clear buffer."""
    member_id: str


class ClearPayload(BaseModel):
    """Clear in-memory buffer for a member (e.g. when starting a new registration)."""
    member_id: str


@router.post("/", response_model=None)
async def register_face(payload: RegisterFacePayload):
    """
    Register face: send multiple images (5+ per angle). On is_final=True we average
    embeddings, save to Django, add to FAISS, and clear buffer.
    """
    member_id = payload.member_id
    image_b64 = payload.image_b64.strip()
    if not image_b64:
        raise HTTPException(status_code=400, detail="image_b64 required")

    try:
        img = decode_image(image_b64)
    except Exception as e:
        logger.warning("Invalid image: %s", e)
        raise HTTPException(status_code=400, detail="Invalid image data")

    # Quality checks
    blur_ok, blur_var = check_blur(img)
    if not blur_ok:
        raise HTTPException(
            status_code=422,
            detail={"success": False, "error": "Image too blurry", "code": "blur"},
        )
    bright_ok, bright_val = check_brightness(img)
    if not bright_ok:
        raise HTTPException(
            status_code=422,
            detail={"success": False, "error": "Brightness out of range", "code": "brightness"},
        )

    # Single face + embedding
    emb = get_single_face_embedding(img, conf_threshold=config.FACE_CONFIDENCE_THRESHOLD)
    if emb is None:
        raise HTTPException(
            status_code=422,
            detail={"success": False, "error": "No face or multiple faces", "code": "no_face"},
        )
    emb = normalize_embedding(emb)

    if payload.is_final:
        # Flush buffer for this member: average all collected + this one
        key = member_id
        if key not in _registration_buffer:
            _registration_buffer[key] = []
        _registration_buffer[key].append(emb)
        all_embs = _registration_buffer[key]
        if len(all_embs) < 3:
            raise HTTPException(
                status_code=422,
                detail={"success": False, "error": "Need at least 3 samples", "code": "insufficient_samples"},
            )
        final_emb = average_embeddings(all_embs)
        final_list = final_emb.tolist()

        # Save to Django
        # Django accepts member_id (str) or member_pk; we send member_id for lookup
        ok, err_msg = store_embedding_in_django(member_id, final_list)
        if not ok:
            raise HTTPException(status_code=502, detail={"success": False, "error": err_msg or "Django store failed"})

        # Add to FAISS (use member_id for lookup; Django returns member_pk we could use)
        add_embedding(member_id, final_emb)
        faiss_save()
        del _registration_buffer[key]
        logger.info("Registered face for member_id=%s", member_id)
        return {
            "success": True,
            "message": "Face registered",
            "samples_collected": len(all_embs),
        }

    # Not final: append to buffer
    if member_id not in _registration_buffer:
        _registration_buffer[member_id] = []
    _registration_buffer[member_id].append(emb)
    return {
        "success": True,
        "message": "Sample accepted",
        "step": payload.step,
        "samples_collected": len(_registration_buffer[member_id]),
    }


@router.post("/batch", response_model=None)
async def register_face_batch(payload: RegisterFaceBatchPayload):
    """
    Register face in one request: send 6–20 images. Backend processes all, averages embeddings,
    saves to Django + FAISS. Much faster than many round-trips (avoids timeouts).
    """
    member_id = payload.member_id
    images_b64 = payload.images_b64 or []
    if len(images_b64) < 3:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "error": "Need at least 3 images", "code": "insufficient_samples"},
        )
    if len(images_b64) > 30:
        raise HTTPException(
            status_code=400,
            detail={"success": False, "error": "Maximum 30 images per batch", "code": "too_many"},
        )

    collected = []
    for i, b64 in enumerate(images_b64):
        b64 = (b64 or "").strip()
        if not b64:
            continue
        try:
            img = decode_image(b64)
        except Exception:
            continue
        if not check_blur(img)[0] or not check_brightness(img)[0]:
            continue
        emb = get_single_face_embedding(img, conf_threshold=config.FACE_CONFIDENCE_THRESHOLD)
        if emb is not None:
            collected.append(normalize_embedding(emb))

    if len(collected) < 3:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "error": f"Only {len(collected)} valid face(s). Need at least 3 clear faces.",
                "code": "insufficient_valid",
            },
        )

    final_emb = average_embeddings(collected)
    final_list = final_emb.tolist()
    ok, err_msg = store_embedding_in_django(member_id, final_list)
    if not ok:
        raise HTTPException(status_code=502, detail={"success": False, "error": err_msg or "Django store failed"})
    add_embedding(member_id, final_emb)
    faiss_save()
    logger.info("Registered face (batch) for member_id=%s, samples=%d", member_id, len(collected))
    return {
        "success": True,
        "message": "Face registered",
        "samples_collected": len(collected),
    }


@router.post("/clear", response_model=None)
async def clear_buffer(payload: ClearPayload):
    """Clear registration buffer for this member (call when starting a new scan)."""
    member_id = payload.member_id
    if member_id in _registration_buffer:
        del _registration_buffer[member_id]
    return {"success": True, "message": "Buffer cleared"}


@router.post("/add-samples", response_model=None)
async def add_samples(payload: AddSamplesPayload):
    """
    Process images during scan: extract face embeddings and append to in-memory buffer.
    Call this as frames are captured; then call /finalize when capture is complete.
    """
    member_id = payload.member_id
    images_b64 = payload.images_b64 or []
    if member_id not in _registration_buffer:
        _registration_buffer[member_id] = []

    for b64 in images_b64:
        b64 = (b64 or "").strip()
        if not b64:
            continue
        try:
            img = decode_image(b64)
        except Exception:
            continue
        if not check_blur(img)[0] or not check_brightness(img)[0]:
            continue
        emb = get_single_face_embedding(img, conf_threshold=config.FACE_CONFIDENCE_THRESHOLD)
        if emb is not None:
            _registration_buffer[member_id].append(normalize_embedding(emb))

    return {
        "success": True,
        "samples_collected": len(_registration_buffer[member_id]),
    }


@router.post("/finalize", response_model=None)
async def finalize_registration(payload: FinalizePayload):
    """
    Average all embeddings in buffer for member_id, save to Django, add to FAISS, clear buffer.
    Call after add-samples when capture is complete.
    """
    member_id = payload.member_id
    if member_id not in _registration_buffer or len(_registration_buffer[member_id]) < 3:
        raise HTTPException(
            status_code=422,
            detail={
                "success": False,
                "error": f"Need at least 3 samples (have {len(_registration_buffer.get(member_id, []))}). Complete scanning first.",
                "code": "insufficient_samples",
            },
        )

    all_embs = _registration_buffer[member_id]
    final_emb = average_embeddings(all_embs)
    final_list = final_emb.tolist()

    ok, err_msg = store_embedding_in_django(member_id, final_list)
    if not ok:
        raise HTTPException(status_code=502, detail={"success": False, "error": err_msg or "Django store failed"})

    add_embedding(member_id, final_emb)
    faiss_save()
    del _registration_buffer[member_id]
    logger.info("Finalized face registration for member_id=%s, samples=%d", member_id, len(all_embs))
    return {
        "success": True,
        "message": "Face registered",
        "samples_collected": len(all_embs),
    }
