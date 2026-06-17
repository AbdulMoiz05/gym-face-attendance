from django.db import models


class Person(models.Model):
    GENDER_CHOICES = [("M", "Male"), ("F", "Female"), ("O", "Other")]
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]

    member_id = models.CharField(max_length=32, unique=True, null=True, blank=True)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default="M")
    dob = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    face_registered = models.BooleanField(default=False)
    join_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "face_attendance_person"
        ordering = ["-created_at"]

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.member_id is None:
            mid = f"P{self.pk:06d}"
            type(self).objects.filter(pk=self.pk).update(member_id=mid)
            self.member_id = mid

    def __str__(self):
        return f"{self.member_id or self.pk} – {self.full_name}"


class FaceEmbedding(models.Model):
    person = models.OneToOneField(Person, on_delete=models.CASCADE, related_name="face_embedding")
    embedding = models.JSONField(help_text="List of 512 floats (L2-normalized)")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "face_attendance_face_embedding"
