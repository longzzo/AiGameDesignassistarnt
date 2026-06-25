"""아이데이션(장르·기능 추천) 스키마."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class IdeationRequest(BaseModel):
    """세계관/키워드를 받아 어울리는 장르와 핵심 기능을 추천하기 위한 입력."""

    world_setting: Optional[str] = Field(
        None, description="세계관/Lore 설정 (선택). 톤과 방향성의 기준."
    )
    keywords: list[str] = Field(
        default_factory=list,
        description="추구하는 경험/메커니즘 키워드 (예: 소셜 디덕션, 시야 제한, 파티)",
    )
    seed_genre: Optional[str] = Field(
        None, description="이미 고려 중인 장르 (선택). 인접/변형 장르 추천에 활용."
    )
    count: int = Field(3, ge=1, le=8, description="추천받을 장르 후보 개수")

    model_config = {
        "json_schema_extra": {
            "example": {
                "world_setting": "귀여운 슬라임들이 사는 컬러풀한 파티 월드",
                "keywords": ["슬라임", "소셜 디덕션", "술래잡기", "시야 제한", "파티"],
                "seed_genre": "탑다운 액션 파티 게임",
                "count": 3,
            }
        }
    }


class GenreRecommendation(BaseModel):
    genre: str = Field(..., description="추천 장르명")
    tagline: str = Field(..., description="한 줄 컨셉")
    fit_score: int = Field(..., description="입력과의 적합도 (0~100)")
    rationale: str = Field(..., description="왜 어울리는지에 대한 근거")
    matched_keywords: list[str] = Field(
        default_factory=list, description="입력과 매칭된 키워드/태그"
    )
    core_features: list[str] = Field(..., description="핵심 차별화 기능 제안")
    reference_games: list[str] = Field(
        default_factory=list, description="레퍼런스/유사 게임"
    )


class IdeationResponse(BaseModel):
    recommendations: list[GenreRecommendation]
    ai_feedback: str
