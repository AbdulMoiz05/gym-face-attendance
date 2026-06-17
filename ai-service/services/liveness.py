"""
Lightweight liveness: eye aspect ratio (blink) or head movement.
Prevents static image spoofing.
"""
import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)

# Eye aspect ratio (EAR) threshold: below = eye closed
EAR_CLOSED_THRESHOLD = 0.2
EAR_OPEN_THRESHOLD = 0.25


def _eye_aspect_ratio(eye_pts: np.ndarray) -> float:
    """EAR from 6 points (left/right eye)."""
    if eye_pts is None or len(eye_pts) < 6:
        return 1.0
    # Vertical distances
    v1 = np.linalg.norm(eye_pts[1] - eye_pts[5])
    v2 = np.linalg.norm(eye_pts[2] - eye_pts[4])
    # Horizontal
    h = np.linalg.norm(eye_pts[0] - eye_pts[3])
    if h < 1e-6:
        return 1.0
    return (v1 + v2) / (2.0 * h)


def check_blink_from_landmarks(kps: Optional[np.ndarray]) -> Tuple[bool, Optional[float]]:
    """
    kps: 5 keypoints (left_eye, right_eye, nose, left_mouth, right_mouth) or similar.
    Returns (blink_detected, ear). If kps not available, returns (False, None).
    """
    if kps is None or len(kps) < 5:
        return (False, None)
    # Assume indices: 0=left eye, 1=right eye (or 0-1 left, 2-3 right depending on model)
    # InsightFace 5-point: left_eye, right_eye, nose, left_mouth_corner, right_mouth_corner
    left_eye = kps[0]
    right_eye = kps[1]
    # Simple EAR: use eye width and height proxy from single point (we don't have 6 pts)
    # Fallback: use distance between eyes and nose to infer "open"
    left_to_nose = np.linalg.norm(kps[2] - left_eye) if len(kps) > 2 else 1.0
    right_to_nose = np.linalg.norm(kps[2] - right_eye) if len(kps) > 2 else 1.0
    eye_dist = np.linalg.norm(right_eye - left_eye)
    if eye_dist < 1e-6:
        return (False, None)
    # Proxy EAR: ratio of (avg distance to nose) / eye_dist
    ear = (left_to_nose + right_to_nose) / (2.0 * eye_dist)
    blink = ear < EAR_CLOSED_THRESHOLD
    return (blink, float(ear))


def detect_blink_sequence(ear_values: list, threshold: float = EAR_CLOSED_THRESHOLD) -> bool:
    """
    Given a list of EAR values over frames, return True if a blink was detected
    (value went below threshold then back above).
    """
    if len(ear_values) < 3:
        return False
    below = False
    for e in ear_values:
        if e is None:
            continue
        if e < threshold:
            below = True
        elif below and e > EAR_OPEN_THRESHOLD:
            return True
    return False


def check_head_movement(positions: list) -> bool:
    """
    positions: list of (x, y) or bbox centers. Return True if meaningful movement.
    """
    if len(positions) < 2:
        return False
    positions = np.array(positions)
    if positions.ndim == 1:
        return False
    diff = np.diff(positions, axis=0)
    movement = np.linalg.norm(diff, axis=1).sum()
    return movement > 5.0  # pixels
