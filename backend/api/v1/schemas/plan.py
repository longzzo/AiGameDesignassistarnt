"""개발 로드맵(WBS / 워크플로우 / 기능명세서) 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class RoleCount(BaseModel):
    role: str
    count: int = Field(1, ge=0, le=50, description="해당 역할 인원 수")


def _default_roles() -> list["RoleCount"]:
    return [
        RoleCount(role="기획", count=1),
        RoleCount(role="개발", count=2),
        RoleCount(role="아트", count=1),
        RoleCount(role="QA", count=1),
    ]


class PlanRequest(BaseModel):
    """개발 계획 생성 입력."""

    period_weeks: int = Field(6, ge=1, le=52, description="총 개발 기간(주)")
    roles: list[RoleCount] = Field(default_factory=_default_roles, description="역할별 인원 구성")
    features: list[str] = Field(
        default_factory=lambda: ["로그인", "대시보드", "결제"],
        description="개발할 기능 목록",
    )
    start_date: Optional[str] = Field(None, description="시작일(선택, YYYY-MM-DD)")


class WbsTask(BaseModel):
    id: str
    phase: str
    role: str = Field(..., description="담당 역할")
    name: str
    estimate_days: float = Field(..., description="산정 공수(인일)")
    depends_on: list[str] = Field(default_factory=list)
    feature: Optional[str] = None
    week: int = Field(..., description="배정된 주차")


class WeekPlan(BaseModel):
    week: int
    capacity_days: float
    planned_days: float
    role_load: dict[str, float] = Field(default_factory=dict, description="역할별 그 주의 공수")
    tasks: list[str]


class RoleTotal(BaseModel):
    role: str
    days: float
    capacity: float


class FeatureSpec(BaseModel):
    feature: str
    overview: str
    inputs: str
    outputs: str
    acceptance: list[str]
    priority: str


class PlanResponse(BaseModel):
    wbs: list[WbsTask]
    schedule: list[WeekPlan]
    specs: list[FeatureSpec]
    role_totals: list[RoleTotal]
    advice: list[str]
    warnings: list[str]
    total_days: float
    capacity_days: float
    ai_feedback: str


# --- 기능 목록 자동 생성 ---
class FeatureGenRequest(BaseModel):
    description: str = Field(..., description="만들 게임/제품에 대한 짧은 설명")
    genre: Optional[str] = Field(None, description="장르(선택)")
    count: int = Field(6, ge=1, le=20, description="생성할 기능 개수")


class FeatureGenResponse(BaseModel):
    features: list[str]
    ai_feedback: str
