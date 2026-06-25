"""월드 바이블 & 일관성 검증 스키마."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class LoreEntry(BaseModel):
    """월드 바이블 엔트리."""

    id: str = Field(..., description="고유 식별자")
    type: str = Field(..., description="character | faction | location | event | quest")
    name: str
    attrs: dict[str, Any] = Field(default_factory=dict, description="자유 속성")
    tags: list[str] = Field(default_factory=list, description="톤/분류 태그")
    refs: list[str] = Field(default_factory=list, description="참조하는 다른 엔트리 id 또는 name")
    order: Optional[int] = Field(None, description="event 전용: 타임라인 순서")
    requires: list[str] = Field(default_factory=list, description="quest 전용: 선행 퀘스트 id/name")


class LoreValidateRequest(BaseModel):
    entries: list[LoreEntry] = Field(..., description="검증할 월드 바이블 전체")
    world_setting: Optional[str] = Field(None, description="세계관 톤(AI 의미 검증용)")


class LoreIssue(BaseModel):
    severity: str = Field(..., description="high | medium | low")
    type: str = Field(..., description="duplicate_name | undefined_ref | quest_missing_dep | quest_cycle | timeline | semantic")
    message: str
    related: list[str] = Field(default_factory=list, description="관련 엔트리 id/name")


class LoreValidateResponse(BaseModel):
    issues: list[LoreIssue]
    summary: str
    ai_feedback: str
