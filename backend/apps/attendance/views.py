from datetime import date

from django.utils import timezone
from rest_framework import generics, permissions

from .models import Attendance
from .serializers import AttendanceSerializer


class AttendanceListCreateView(generics.ListCreateAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Attendance.objects.select_related("person").order_by("-check_in")
        member = self.request.query_params.get("member")
        if member:
            qs = qs.filter(person_id=member)
        today_param = self.request.query_params.get("today", "").lower()
        date_param = self.request.query_params.get("date")
        if today_param in ("1", "true", "yes"):
            today = timezone.localdate()
            qs = qs.filter(check_in__date=today)
        elif date_param:
            try:
                filter_date = date.fromisoformat(date_param)
                qs = qs.filter(check_in__date=filter_date)
            except ValueError:
                pass
        return qs


class AttendanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AttendanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Attendance.objects.select_related("person")
