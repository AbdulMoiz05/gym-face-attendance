from django.contrib import admin
from .models import Attendance, UnknownFaceLog


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("person", "check_in", "method", "confidence")
    list_filter = ("method",)


@admin.register(UnknownFaceLog)
class UnknownFaceLogAdmin(admin.ModelAdmin):
    list_display = ("id", "detected_at")
