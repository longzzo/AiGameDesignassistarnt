"""스탯 성장 및 DPS/TTK 시뮬레이터 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class DpsTtkRequest(BaseModel):
    """레벨별 TTK 시뮬레이션 입력."""

    base_attack: float = Field(100.0, gt=0, description="1레벨 기준 기본 공격력")
    growth_rate: float = Field(
        0.08, ge=0, description="레벨당 공격력 성장률 (0.08 = 레벨당 +8%)"
    )
    attacks_per_second: float = Field(1.5, gt=0, description="초당 공격 횟수")
    monster_hp: float = Field(1000.0, gt=0, description="대상 몬스터 HP")
    monster_def: float = Field(20.0, ge=0, description="대상 몬스터 방어력(DEF)")
    max_level: int = Field(20, ge=1, le=200, description="시뮬레이션할 최대 레벨")

    model_config = {
        "json_schema_extra": {
            "example": {
                "base_attack": 100,
                "growth_rate": 0.08,
                "attacks_per_second": 1.5,
                "monster_hp": 1000,
                "monster_def": 20,
                "max_level": 20,
            }
        }
    }


class TtkPoint(BaseModel):
    """차트 한 점(레벨 단위)."""

    level: int
    attack: float
    effective_damage: float
    dps: float
    ttk: float = Field(..., description="Time-To-Kill (초)")


class DpsTtkResponse(BaseModel):
    chart_data: list[TtkPoint]
    ai_feedback: str
