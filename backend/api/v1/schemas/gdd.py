"""기획서(GDD) 초안 생성 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class GddRequest(BaseModel):
    """장르/세계관/메커니즘을 받아 기획서 초안을 생성하기 위한 입력."""

    genre: str = Field("탑다운 액션 파티 게임", description="게임 장르")
    world_setting: Optional[str] = Field(
        None, description="세계관/Lore 설정 (선택)"
    )
    core_mechanics: list[str] = Field(
        default_factory=lambda: [
            "슬라임 캐릭터",
            "소셜 디덕션 기반 술래잡기",
            "시야 제한",
        ],
        description="핵심 메커니즘 리스트",
    )
    validation_notes: list[str] = Field(
        default_factory=list,
        description="검증 단계(시뮬레이터)에서 수집한 피드백. 기획서에 '검증 노트' 섹션으로 반영된다.",
    )
    target_platform: str = Field("PC / 모바일", description="타겟 플랫폼")
    target_audience: Optional[str] = Field(
        None, description="타겟 유저층 (선택)"
    )
    monetization: Optional[str] = Field(
        None, description="수익화 모델 (선택, 예: 부분유료/패키지/광고)"
    )
    references: list[str] = Field(
        default_factory=list, description="레퍼런스 게임 (선택)"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "genre": "소셜 디덕션 파티",
                "world_setting": "귀여운 슬라임들이 사는 컬러풀한 파티 월드",
                "core_mechanics": ["역할 분배", "회의·투표", "시야 제한 술래잡기"],
                "target_platform": "PC / 모바일",
                "target_audience": "친구와 함께 즐기는 캐주얼/미드코어",
                "monetization": "부분유료(코스메틱)",
                "references": ["Among Us", "Fall Guys"],
            }
        }
    }


class GddSection(BaseModel):
    heading: str
    bullets: list[str]


class StatBaseline(BaseModel):
    base_attack: float
    growth_rate: float
    attacks_per_second: float
    monster_hp: float
    monster_def: float
    max_level: int


class EconomyBaseline(BaseModel):
    initial_currency: float
    daily_production: float
    sink_rate: float
    expected_dau: int
    days: int


class GachaBaseline(BaseModel):
    base_rate: float
    pity_count: int
    simulations: int


class BalanceBaseline(BaseModel):
    """기획서가 제안하는 시뮬레이터 시작값 — '기획 → 검증' 핸드오프에 사용."""

    stat: StatBaseline
    economy: EconomyBaseline
    gacha: GachaBaseline
    note: str


class GddResponse(BaseModel):
    title: str = Field(..., description="제안 (가제) 프로젝트명")
    one_liner: str = Field(..., description="한 줄 컨셉")
    sections: list[GddSection]
    balance_baseline: BalanceBaseline = Field(
        ..., description="스탯/경제 시뮬레이터로 바로 넘길 수 있는 제안 밸런스 시작값"
    )
    markdown: str = Field(..., description="문서 전체를 마크다운으로 직렬화한 텍스트")
    meta_prompt: str = Field(..., description="LLM으로 기획서를 확장할 때 쓰는 메타 프롬프트")
    ai_feedback: str
