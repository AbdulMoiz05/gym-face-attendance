from rest_framework import serializers
from .models import Person


class PersonSerializer(serializers.ModelSerializer):
    class Meta:
        model = Person
        fields = [
            "id",
            "member_id",
            "full_name",
            "email",
            "phone",
            "gender",
            "dob",
            "address",
            "emergency_contact",
            "notes",
            "status",
            "join_date",
            "face_registered",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["member_id", "join_date", "face_registered", "created_at", "updated_at"]
