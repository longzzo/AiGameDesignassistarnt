"""경제 인플레이션 추적기 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class InflationRequest(BaseModel):
    """경제 시뮬레이션 입력."""

    initial_currency: float = Field(
        1_000_000.0, ge=0, description="시뮬레이션 시작 시점의 총 유통 재화"
    )
    daily_production: float = Field(
        500.0, ge=0, description="유저 1인당 일일 재화 생산량(Faucet)"
    )
    sink_rate: float = Field(
        12.0, ge=0, le=100, description="일일 재화 소모율(Sink, %)"
    )
    expected_dau: int = Field(10_000, ge=1, description="예상 일일 활성 유저 수(DAU)")
    days: int = Field(90, ge=1, le=730, description="시뮬레이션 일수")

    model_config = {
        "json_schema_extra": {
            "example": {
                "initial_currency": 1000000,
                "daily_production": 500,
                "sink_rate": 12,
                "expected_dau": 10000,
                "days": 90,
            }
        }
    }


class InflationPoint(BaseModel):
    day: int
    total_currency: float
    faucet: float = Field(..., description="당일 생산량")
    sink: float = Field(..., description="당일 소모량")
    per_capita: float = Field(..., description="유저 1인당 보유 재화")


class InflationResponse(BaseModel):
    chart_data: list[InflationPoint]
    equilibrium_currency: Optional[float] = Field(
        None, description="이론적 균형 유통량 (faucet == sink 지점)"
    )
    inflation_warning_day: Optional[int] = Field(
        None, description="인플레이션 경고가 발생한 일자 (없으면 null)"
    )
    ai_feedback: str
