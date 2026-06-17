from django.urls import path
from .views import PersonListCreateView, PersonDetailView

urlpatterns = [
    path("", PersonListCreateView.as_view(), name="person-list"),
    path("<int:pk>/", PersonDetailView.as_view(), name="person-detail"),
]
