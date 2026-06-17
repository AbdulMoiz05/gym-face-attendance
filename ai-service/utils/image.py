"""Image decoding and quality checks."""
import base64
import logging
import cv2
import numpy as np

from config import BLUR_THRESHOLD, MIN_BRIGHTNESS, MAX_BRIGHTNESS

logger = logging.getLogger(__name__)


def decode_image(b64: str, max_size: int = 0) -> np.ndarray:
    """
    Decode base64 to BGR numpy array (OpenCV).
    If max_size > 0, downscale so max(h, w) <= max_size for faster inference in real-time.
    """
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image data")
    if max_size > 0:
        h, w = img.shape[:2]
        if max(h, w) > max_size:
            scale = max_size / max(h, w)
            new_w = int(round(w * scale))
            new_h = int(round(h * scale))
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
    return img


def check_blur(img: np.ndarray, threshold: float = None) -> tuple[bool, float]:
    """Laplacian variance. Returns (is_ok, variance). Lower variance = more blur."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    var = cv2.Laplacian(gray, cv2.CV_64F).var()
    th = threshold if threshold is not None else BLUR_THRESHOLD
    return (var >= th, float(var))


def check_brightness(img: np.ndarray) -> tuple[bool, float]:
    """Mean brightness in [0,255]. Returns (is_ok, mean)."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img
    mean = float(np.mean(gray))
    ok = MIN_BRIGHTNESS <= mean <= MAX_BRIGHTNESS
    return (ok, mean)
