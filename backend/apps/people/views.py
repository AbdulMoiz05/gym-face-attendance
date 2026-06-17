from rest_framework import generics, permissions
from .models import Person
from .serializers import PersonSerializer


class PersonListCreateView(generics.ListCreateAPIView):
    serializer_class = PersonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Person.objects.all()
        status = self.request.query_params.get("status")
        if status and status in dict(Person.STATUS_CHOICES):
            qs = qs.filter(status=status)
        return qs


class PersonDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = PersonSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Person.objects.all()
