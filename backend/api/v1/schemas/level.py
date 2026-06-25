"""레벨 디자인 설계 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class LevelDesignRequest(BaseModel):
    """레벨 디자인 생성 입력."""

    level_type: str = Field("탐험", description="레벨 유형: 튜토리얼 | 탐험 | 보스")
    duration_min: int = Field(10, ge=1, le=120, description="목표 플레이 길이(분)")
    mechanics: list[str] = Field(
        default_factory=lambda: ["이동", "전투", "퍼즐"],
        description="이 레벨에서 사용할 메커니즘",
    )
    curve: str = Field("상승", description="목표 난이도 곡선: 완만 | 상승 | 스파이크")

    model_config = {
        "json_schema_extra": {
            "example": {
                "level_type": "탐험",
                "duration_min": 12,
                "mechanics": ["이동", "은신", "전투", "퍼즐"],
                "curve": "상승",
            }
        }
    }


class Beat(BaseModel):
    phase: str
    start_pct: int
    end_pct: int
    intensity: int = Field(..., description="긴장도 0~100")
    note: str


class IntensityPoint(BaseModel):
    t_pct: int
    intensity: int


class Encounter(BaseModel):
    at_pct: int
    kind: str = Field(..., description="적 | 퍼즐 | 이벤트 | 보스 | 보상")
    detail: str
    enemies: Optional[str] = Field(None, description="적/오브젝트 구성 (AI 상세화)")
    setup: Optional[str] = Field(None, description="배치·전술·기믹 (AI 상세화)")


class DifficultyJump(BaseModel):
    """인접 비트 간 난이도 변화(정량 진단)."""

    from_phase: str
    to_phase: str
    delta: int = Field(..., description="긴장도 변화량(다음-현재)")
    severity: str = Field(..., description="급상승 | 적정 | 급강하")


class LevelDesignResponse(BaseModel):
    beats: list[Beat]
    intensity_curve: list[IntensityPoint]
    encounters: list[Encounter]
    difficulty_jumps: list[DifficultyJump] = Field(default_factory=list, description="구간 간 난이도 점프 진단")
    recommended_curve: list[IntensityPoint] = Field(default_factory=list, description="급경사를 완화한 권장 곡선")
    max_jump: int = Field(0, description="가장 큰 난이도 상승폭")
    critique: list[str] = Field(..., description="레벨 디자인 함정 지적 + 수정안")
    ai_feedback: str
