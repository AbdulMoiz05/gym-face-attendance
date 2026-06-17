from django.urls import path
from .views import AttendanceListCreateView, AttendanceDetailView
from .ai_views import StoreFaceEmbeddingView, MarkAttendanceView, FaceEmbeddingsListView
from .unknown_views import UnknownFaceLogSaveView, UnknownFaceLogListView

urlpatterns = [
    path("", AttendanceListCreateView.as_view(), name="attendance-list"),
    path("<int:pk>/", AttendanceDetailView.as_view(), name="attendance-detail"),
    path("store-face-embedding/", StoreFaceEmbeddingView.as_view(), name="store-face-embedding"),
    path("face-embeddings/", FaceEmbeddingsListView.as_view(), name="face-embeddings-list"),
    path("mark-attendance/", MarkAttendanceView.as_view(), name="mark-attendance"),
    path("unknown-faces/", UnknownFaceLogListView.as_view(), name="unknown-face-list"),
    path("unknown-faces/save/", UnknownFaceLogSaveView.as_view(), name="unknown-face-save"),
]
