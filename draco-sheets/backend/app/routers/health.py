from fastapi import APIRouter

from ..services import convert

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    return {"ok": True, "service": "draco-sheets-backend", "version": "1.0.0", "convert": convert.available()}
