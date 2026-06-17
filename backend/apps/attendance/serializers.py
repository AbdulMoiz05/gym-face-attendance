from rest_framework import serializers
from apps.people.models import Person
from .models import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="person.full_name", read_only=True)
    member = serializers.PrimaryKeyRelatedField(source="person", queryset=Person.objects.all())

    class Meta:
        model = Attendance
        fields = ["id", "member", "member_name", "check_in", "check_out", "method", "confidence", "slot", "notes", "created_at"]
        read_only_fields = ["created_at"]
