import os
import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import BasePermission

from apps.people.models import Person, FaceEmbedding
from .models import Attendance

logger = logging.getLogger(__name__)
ATTENDANCE_COOLDOWN_HOURS = int(os.getenv("ATTENDANCE_COOLDOWN_HOURS", "4"))


class IsAIService(BasePermission):
    def has_permission(self, request, view):
        secret = os.getenv("AI_SERVICE_SECRET", "")
        if not secret:
            return bool(getattr(settings, "DEBUG", False))
        token = request.headers.get("X-Service-Token") or (
            (request.headers.get("Authorization") or "").replace("Bearer ", "").strip()
        )
        return token == secret


class StoreFaceEmbeddingView(APIView):
    permission_classes = [IsAIService]

    def post(self, request):
        member_id = request.data.get("member_id")
        embedding = request.data.get("embedding")
        if not member_id or not embedding:
            return Response(
                {"success": False, "error": "member_id and embedding required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not isinstance(embedding, list) or len(embedding) != 512:
            return Response(
                {"success": False, "error": "embedding must be a list of 512 floats"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            if isinstance(member_id, int) or (isinstance(member_id, str) and member_id.isdigit()):
                person = Person.objects.get(pk=int(member_id))
            else:
                person = Person.objects.get(member_id=member_id)
        except Person.DoesNotExist:
            return Response({"success": False, "error": "Person not found"}, status=status.HTTP_404_NOT_FOUND)
        except (ValueError, TypeError):
            try:
                person = Person.objects.get(member_id=member_id)
            except Person.DoesNotExist:
                return Response({"success": False, "error": "Person not found"}, status=status.HTTP_404_NOT_FOUND)

        FaceEmbedding.objects.update_or_create(
            person=person,
            defaults={"embedding": embedding},
        )
        person.face_registered = True
        person.save(update_fields=["face_registered", "updated_at"])
        logger.info("Stored face embedding for member_id=%s pk=%s", person.member_id, person.pk)
        return Response(
            {"success": True, "member_id": person.member_id, "member_pk": person.pk},
            status=status.HTTP_200_OK,
        )


class FaceEmbeddingsListView(APIView):
    permission_classes = [IsAIService]

    def get(self, request):
        rows = FaceEmbedding.objects.select_related("person").all()
        data = [
            {
                "member_id": fe.person.member_id,
                "member_pk": fe.person.pk,
                "embedding": fe.embedding,
            }
            for fe in rows
        ]
        return Response({"embeddings": data})


class MarkAttendanceView(APIView):
    permission_classes = [IsAIService]

    def post(self, request):
        member_id = request.data.get("member_id")
        timestamp = request.data.get("timestamp")
        if not member_id:
            return Response(
                {"success": False, "error": "member_id required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            person = Person.objects.get(pk=member_id)
        except (Person.DoesNotExist, ValueError):
            try:
                person = Person.objects.get(member_id=member_id)
            except Person.DoesNotExist:
                return Response({"success": False, "error": "Person not found"}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        if timestamp:
            try:
                ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                if timezone.is_naive(ts):
                    ts = timezone.make_aware(ts)
                check_in = ts
            except Exception:
                check_in = now
        else:
            check_in = now

        cooldown_until = now - timedelta(hours=ATTENDANCE_COOLDOWN_HOURS)
        last = (
            Attendance.objects.filter(person=person, check_in__gte=cooldown_until)
            .order_by("-check_in")
            .first()
        )
        if last:
            return Response(
                {
                    "success": False,
                    "error": "already_marked",
                    "message": f"Attendance already marked within {ATTENDANCE_COOLDOWN_HOURS}h cooldown",
                    "last_check_in": last.check_in.isoformat(),
                },
                status=status.HTTP_200_OK,
            )

        Attendance.objects.create(
            person=person,
            check_in=check_in,
            method="face",
            confidence=request.data.get("confidence"),
        )
        logger.info("Marked face attendance for member_id=%s", person.member_id)
        return Response(
            {
                "success": True,
                "member_id": person.member_id,
                "check_in": check_in.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )
