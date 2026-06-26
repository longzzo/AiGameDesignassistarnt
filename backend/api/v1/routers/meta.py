"""메타 정보 라우터 — 프론트가 AI 연결 상태를 표시하기 위한 엔드포인트."""
from __future__ import annotations

from fastapi import APIRouter

from api.v1.services import llm

router = APIRouter(tags=["meta"])


@router.get("/meta")
def meta() -> dict:
    enabled = llm.is_enabled()
    return {
        "llm_enabled": enabled,
        "provider": llm.provider_label() if enabled else None,
        "mode": "ai" if enabled else "mockup",
        "model_main": llm.model_for("main") if enabled else None,
        "model_mini": llm.model_for("mini") if enabled else None,
    }
