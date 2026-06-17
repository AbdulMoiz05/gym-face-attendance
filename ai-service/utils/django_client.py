"""HTTP client for Django backend (store embedding, mark attendance, fetch embeddings)."""
import logging
import os
from typing import List, Optional

import requests

import config

logger = logging.getLogger(__name__)


def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if config.AI_SERVICE_SECRET:
        h["X-Service-Token"] = config.AI_SERVICE_SECRET
    return h


def store_embedding_in_django(member_id_or_pk, embedding: List[float]) -> tuple[bool, str]:
    """POST embedding to Django. Returns (success, error_message). member_id_or_pk can be int pk or str member_id."""
    url = f"{config.DJANGO_API_URL}/attendance/store-face-embedding/"
    payload = {"member_id": member_id_or_pk, "embedding": embedding}
    try:
        r = requests.post(url, json=payload, headers=_headers(), timeout=15)
        if r.status_code in (200, 201):
            return True, ""
        try:
            err = r.json().get("error", r.text)
        except Exception:
            err = r.text or f"HTTP {r.status_code}"
        if r.status_code == 403:
            err = "Django rejected (check AI_SERVICE_SECRET in both Django and AI service)."
        elif r.status_code == 404:
            err = "Member not found in Django."
        logger.warning("Django store-face-embedding failed: %s %s", r.status_code, err)
        return False, err
    except requests.exceptions.ConnectError as e:
        logger.exception("Django not reachable: %s", e)
        return False, "Cannot reach Django. Is the backend running?"
    except Exception as e:
        logger.exception("Django store request failed: %s", e)
        return False, str(e)


def mark_attendance_in_django(member_id: str, timestamp: Optional[str] = None, confidence: Optional[float] = None) -> dict:
    """
    POST mark-attendance to Django. Returns response dict with success/error.
    """
    url = f"{config.DJANGO_API_URL}/attendance/mark-attendance/"
    payload = {"member_id": member_id}
    if timestamp:
        payload["timestamp"] = timestamp
    if confidence is not None:
        payload["confidence"] = confidence
    try:
        r = requests.post(url, json=payload, headers=_headers(), timeout=5)
        return r.json() if r.headers.get("content-type", "").startswith("application/json") else {"success": False, "error": r.text}
    except Exception as e:
        logger.exception("Django mark-attendance failed: %s", e)
        return {"success": False, "error": str(e)}


def fetch_embeddings_from_django() -> List[dict]:
    """GET all face embeddings from Django (for FAISS rebuild on startup)."""
    url = f"{config.DJANGO_API_URL}/attendance/face-embeddings/"
    try:
        r = requests.get(url, headers=_headers(), timeout=30)
        if r.status_code != 200:
            return []
        data = r.json()
        return data.get("embeddings", [])
    except Exception as e:
        logger.warning("Django face-embeddings fetch failed: %s", e)
        return []
