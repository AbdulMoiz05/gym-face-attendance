from django.db import models
from apps.people.models import Person


class Attendance(models.Model):
    METHOD_CHOICES = [("face", "Face Detection"), ("manual", "Manual")]

    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name="attendance_records")
    check_in = models.DateTimeField()
    check_out = models.DateTimeField(null=True, blank=True)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default="face")
    confidence = models.FloatField(null=True, blank=True)
    slot = models.CharField(max_length=50, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "face_attendance_log"
        ordering = ["-check_in"]

    def __str__(self):
        return f"{self.person.full_name} @ {self.check_in:%Y-%m-%d %H:%M}"


class UnknownFaceLog(models.Model):
    image = models.FileField(upload_to="unknown_faces/%Y/%m/%d/", blank=True)
    bbox = models.JSONField(default=list, help_text="[x1, y1, x2, y2] in image pixels")
    image_width = models.IntegerField(null=True, blank=True)
    image_height = models.IntegerField(null=True, blank=True)
    detected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "face_attendance_unknown_face_log"
        ordering = ["-detected_at"]

    def __str__(self):
        return f"Unknown face @ {self.detected_at}"
