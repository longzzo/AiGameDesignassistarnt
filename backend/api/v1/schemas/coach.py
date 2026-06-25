"""AI 밸런스 코치 스키마."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class CoachRequest(BaseModel):
    """시뮬레이터 결과를 받아 튜닝안을 요청하는 입력."""

    module: str = Field(..., description="검증 모듈: stat | economy | gacha")
    inputs: dict[str, Any] = Field(..., description="시뮬레이터에 넣었던 입력값")
    summary: str = Field("", description="시뮬레이션 핵심 결과/AI 피드백 텍스트")

    model_config = {
        "json_schema_extra": {
            "example": {
                "module": "stat",
                "inputs": {"base_attack": 100, "growth_rate": 0.08, "monster_hp": 1000},
                "summary": "1레벨 TTK 8.3초 → 20레벨 0.8초. 고레벨에서 거의 즉사.",
            }
        }
    }


class CoachResponse(BaseModel):
    module: str
    suggestions: list[str] = Field(..., description="구체적 수치 튜닝 제안들")
    rationale: str = Field("", description="제안 근거 요약")
    ai_feedback: str
