"""가챠/드랍률 몬테카를로 검증 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class MonteCarloRequest(BaseModel):
    """가챠 시뮬레이션 입력."""

    base_rate: float = Field(
        0.006, gt=0, le=1, description="단일 뽑기 기본 성공 확률 (0.006 = 0.6%)"
    )
    pity_count: int = Field(
        90, ge=1, le=10_000, description="천장 횟수 (해당 횟수에서 확정 획득)"
    )
    simulations: int = Field(
        10_000, ge=100, le=200_000, description="몬테카를로 시뮬레이션 반복 횟수"
    )
    fifty_fifty: bool = Field(
        False,
        description="50/50 천장(원신식): 5성 획득 시 50% 확률로 비픽업, 실패하면 다음 5성은 픽업 확정. "
        "켜면 '픽업(featured) 획득까지'의 횟수를 계산한다.",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "base_rate": 0.006,
                "pity_count": 90,
                "simulations": 10000,
                "fifty_fifty": False,
            }
        }
    }


class HistogramBucket(BaseModel):
    range_start: int
    range_end: int
    count: int
    label: str


class MonteCarloResponse(BaseModel):
    simulations: int
    mean_pulls: float = Field(..., description="첫 획득까지의 평균 뽑기 횟수")
    median_pulls: float = Field(..., description="첫 획득까지의 중위값")
    p25_pulls: float
    p75_pulls: float
    p90_pulls: float
    pity_hit_rate: float = Field(..., description="천장까지 도달한 비율(%)")
    distribution: list[HistogramBucket]
    ai_feedback: str
