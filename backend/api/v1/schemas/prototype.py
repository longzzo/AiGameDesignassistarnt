"""프로토타입 프롬프트 제너레이터 스키마."""
from __future__ import annotations

from pydantic import BaseModel, Field


class PromptRequest(BaseModel):
    """메타 프롬프트 생성 입력."""

    genre: str = Field(
        "탑다운 액션 파티 게임", description="게임 장르"
    )
    core_mechanics: list[str] = Field(
        default_factory=lambda: [
            "슬라임 캐릭터",
            "소셜 디덕션 기반 술래잡기",
            "시야 제한",
        ],
        description="핵심 메커니즘 리스트",
    )
    tech_stack: str = Field(
        "단일 HTML + Vanilla JS (Canvas)",
        description="타겟 기술 스택",
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "genre": "탑다운 액션 파티 게임",
                "core_mechanics": [
                    "슬라임 캐릭터",
                    "소셜 디덕션 기반 술래잡기",
                    "시야 제한",
                ],
                "tech_stack": "단일 HTML + Vanilla JS (Canvas)",
            }
        }
    }


class PromptResponse(BaseModel):
    prompt: str = Field(..., description="구조화된 프로토타입 코드 생성용 메타 프롬프트")
    estimated_tokens: int = Field(..., description="생성된 프롬프트의 대략적 토큰 수")
    ai_feedback: str


class HtmlPrototypeResponse(BaseModel):
    html: str = Field(..., description="즉시 실행 가능한 단일 HTML 프로토타입")
    ai_feedback: str
