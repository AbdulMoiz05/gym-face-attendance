"""API routers."""
from .register import router as register_router
from .recognize import router as recognize_router

__all__ = ["register_router", "recognize_router"]
