"""에셋 파이프라인(Lore 번역) 스키마."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class LoreTranslateRequest(BaseModel):
    """기초 데이터에 세계관을 입혀 다국어로 변환하는 입력."""

    json_data: dict[str, Any] = Field(
        ..., description="텍스트를 입힐 기초 데이터(JSON)"
    )
    world_setting: Optional[str] = Field(
        None,
        description="세계관/Lore 설정 (선택). 비우면 Lore 없이 순수 번역만 수행한다.",
    )
    target_languages: list[str] = Field(
        default_factory=lambda: ["ko", "en", "ja"],
        description="목표 언어 코드 리스트 (ISO 639-1)",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "json_data": {
                    "item_001": {"name": "Rusty Sword", "desc": "A basic blade."},
                    "item_002": {"name": "Health Potion", "desc": "Restores HP."},
                },
                "world_setting": "멸망 직전의 증기기관 판타지 세계, 비장하고 고풍스러운 어조",
                "target_languages": ["ko", "en", "ja"],
            }
        }
    }


class LoreTranslateResponse(BaseModel):
    world_setting: Optional[str] = None
    lore_applied: bool = Field(..., description="세계관 톤이 적용되었는지 여부")
    target_languages: list[str]
    localized: dict[str, Any] = Field(
        ..., description="언어 코드별로 lore가 입혀진 다국어 JSON"
    )
    ai_feedback: str
