from django.urls import path
from .views import analyze_routes

urlpatterns = [
    path("routes/analyze/", analyze_routes),
]