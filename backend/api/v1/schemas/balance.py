"""밸런스 랩 스키마 — 빌드 비교(C) · 목표 기반 자동 밸런싱(A, Goal-Seek)."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


# --- C. 무기/직업 빌드 비교 ---
class BuildSpec(BaseModel):
    label: str = Field(..., description="빌드/직업/무기 이름")
    base_attack: float = Field(100.0, gt=0)
    growth_rate: float = Field(0.08, ge=0)
    attacks_per_second: float = Field(1.5, gt=0)


class CompareRequest(BaseModel):
    builds: list[BuildSpec] = Field(..., min_length=2, description="비교할 빌드(2개 이상)")
    level: int = Field(10, ge=1, le=200, description="비교 기준 레벨")
    monster_hp: float = Field(1000.0, gt=0)
    monster_def: float = Field(20.0, ge=0)


class BuildResult(BaseModel):
    label: str
    attack: float
    dps: float
    ttk: float
    dps_index: float = Field(..., description="중위 DPS 대비 비율(1.0=중위)")
    verdict: str = Field(..., description="OP | 균형 | 약함")


class CompareResponse(BaseModel):
    results: list[BuildResult]
    median_dps: float
    level: int
    ai_feedback: str


# --- A. 목표 기반 자동 밸런싱(Goal-Seek) ---
class SolveRequest(BaseModel):
    module: str = Field(..., description="stat | economy | gacha")
    target_metric: str = Field(..., description="맞출 지표 키 (예: late_ttk, pity_rate, warning_day)")
    target_value: float = Field(..., description="목표 수치")
    vary_param: str = Field(..., description="역산할 파라미터 키 (예: growth_rate)")
    bounds: Optional[list[float]] = Field(None, description="탐색 범위 [최소, 최대] (선택)")
    base_params: dict = Field(default_factory=dict, description="고정할 나머지 입력값")


class SolveTracePoint(BaseModel):
    iter: int
    param: float
    metric: float


class SolveResponse(BaseModel):
    module: str
    vary_param: str
    target_metric: str
    target_value: float
    found_param: float
    achieved_metric: float
    success: bool
    bounds: list[float]
    trace: list[SolveTracePoint]
    suggestions: list[str]
    ai_feedback: str
