import base64
import io
import re

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.core.files.base import ContentFile

from .models import UnknownFaceLog

try:
    from PIL import Image, ImageDraw, ImageFont
    HAS_PIL = True
except ImportError:
    HAS_PIL = False


def _normalize_b64(value):
    if value is None:
        return None
    s = str(value).strip()
    m = re.match(r"^data:image/[^;]+;base64,(.+)$", s, re.IGNORECASE | re.DOTALL)
    if m:
        s = m.group(1).strip()
    s = "".join(s.split())
    return s or None


def _draw_bbox_on_image(image_bytes, bbox, label="Unknown", color_red=True):
    if not HAS_PIL:
        return image_bytes
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return image_bytes
    draw = ImageDraw.Draw(img)
    if not bbox or len(bbox) < 4:
        out = io.BytesIO()
        img.save(out, format="JPEG", quality=90)
        return out.getvalue()
    x1, y1, x2, y2 = [int(round(float(b))) for b in bbox[:4]]
    x1 = max(0, min(x1, img.width))
    x2 = max(0, min(x2, img.width))
    y1 = max(0, min(y1, img.height))
    y2 = max(0, min(y2, img.height))
    if x1 > x2:
        x1, x2 = x2, x1
    if y1 > y2:
        y1, y2 = y2, y1
    outline = (220, 38, 38) if color_red else (34, 197, 94)
    fill = outline
    thickness = max(2, min(img.width, img.height) // 150)
    for t in range(thickness):
        draw.rectangle([x1 - t, y1 - t, x2 + t, y2 + t], outline=outline)
    try:
        font = ImageFont.truetype("arial.ttf", max(12, min(img.width, img.height) // 25))
    except Exception:
        font = ImageFont.load_default()
    text_y = max(0, y1 - 20)
    draw.rectangle([x1, text_y - 2, x1 + 120, text_y + 18], fill=fill)
    draw.text((x1 + 2, text_y), label, fill=(255, 255, 255), font=font)
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=90)
    return out.getvalue()


class UnknownFaceLogSaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        image_b64 = request.data.get("image_b64")
        bbox = request.data.get("bbox")
        bboxes = request.data.get("bboxes")
        if not image_b64:
            return Response({"error": "image_b64 required."}, status=status.HTTP_400_BAD_REQUEST)
        image_b64 = _normalize_b64(image_b64)
        if not image_b64:
            return Response({"error": "image_b64 required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            raw = base64.b64decode(image_b64)
        except Exception:
            return Response({"error": "Invalid base64 image."}, status=status.HTTP_400_BAD_REQUEST)
        if not raw or len(raw) < 100:
            return Response({"error": "Image data too small."}, status=status.HTTP_400_BAD_REQUEST)
        if isinstance(bboxes, (list, tuple)) and len(bboxes) > 0:
            to_save = [b for b in bboxes if isinstance(b, (list, tuple)) and len(b) >= 4]
        elif isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
            to_save = [bbox]
        else:
            to_save = []
        img_width = request.data.get("image_width")
        img_height = request.data.get("image_height")
        saved = []
        for i, bbox_list in enumerate(to_save):
            image_with_bbox = _draw_bbox_on_image(raw, list(bbox_list), label="Unknown", color_red=True)
            fname = f"unknown_{timezone.now().strftime('%Y%m%d_%H%M%S')}_{i}.jpg"
            log = UnknownFaceLog(
                image_width=img_width,
                image_height=img_height,
                bbox=list(bbox_list),
            )
            log.image.save(fname, ContentFile(image_with_bbox), save=True)
            saved.append(
                {
                    "id": log.id,
                    "detected_at": log.detected_at.isoformat(),
                    "image_url": request.build_absolute_uri(log.image.url) if log.image else None,
                }
            )
        if not saved:
            return Response({"error": "No valid bbox or bboxes provided."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"saved": len(saved), "logs": saved} if len(saved) > 1 else saved[0],
            status=status.HTTP_201_CREATED,
        )


class UnknownFaceLogListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = UnknownFaceLog.objects.all().order_by("-detected_at")
        today_param = request.query_params.get("today", "").lower()
        if today_param in ("1", "true", "yes"):
            today = timezone.localdate()
            qs = qs.filter(detected_at__date=today)
        count = qs.count()
        page = int(request.query_params.get("page", 1))
        page_size = min(50, max(1, int(request.query_params.get("page_size", 20))))
        start = (page - 1) * page_size
        page_qs = qs[start : start + page_size]
        results = [
            {
                "id": log.id,
                "detected_at": log.detected_at.isoformat(),
                "image_url": request.build_absolute_uri(log.image.url) if log.image else None,
                "bbox": log.bbox,
                "image_width": log.image_width,
                "image_height": log.image_height,
            }
            for log in page_qs
        ]
        return Response({"count": count, "results": results})
