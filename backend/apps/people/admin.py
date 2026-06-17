from django.contrib import admin
from .models import Person, FaceEmbedding


@admin.register(Person)
class PersonAdmin(admin.ModelAdmin):
    list_display = ("member_id", "full_name", "phone", "face_registered", "status")
    search_fields = ("member_id", "full_name", "phone", "email")


@admin.register(FaceEmbedding)
class FaceEmbeddingAdmin(admin.ModelAdmin):
    list_display = ("person", "updated_at")
