"""에셋 파이프라인(Lore 번역) 라우터.

입력 JSON의 문자열을 GitHub Models(gpt-5-mini)로 세계관 톤을 입혀 다국어 변환한다.
AI 호출이 불가능하면 목업 대신 'API 호출 불가'로 응답한다.
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.asset import LoreTranslateRequest, LoreTranslateResponse
from api.v1.services import llm

router = APIRouter(prefix="/asset", tags=["asset"])


@router.post("/lore-translate", response_model=LoreTranslateResponse)
def lore_translate(payload: LoreTranslateRequest) -> LoreTranslateResponse:
    """세계관 기반 다국어 변환(gpt-5-mini). 호출 불가 시 'API 호출 불가'."""
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is None:
        world = (payload.world_setting or "").strip() or None
        return LoreTranslateResponse(
            world_setting=world,
            lore_applied=False,
            target_languages=payload.target_languages,
            localized={},
            ai_feedback=llm.UNAVAILABLE_MSG,
        )
    return res


def _via_llm(payload: LoreTranslateRequest) -> LoreTranslateResponse:
    world = (payload.world_setting or "").strip() or None
    system = (
        "당신은 게임 현지화 전문가입니다. 입력 JSON의 모든 문자열 값을 지정된 언어들로 "
        "번역합니다. world_setting이 주어지면 그 세계관의 톤 & 매너를 입히고, 없으면 "
        "자연스러운 번역만 합니다. JSON의 키 구조는 절대 바꾸지 마세요."
    )
    user = (
        json.dumps(
            {
                "json_data": payload.json_data,
                "world_setting": world,
                "target_languages": payload.target_languages,
            },
            ensure_ascii=False,
        )
        + '\n\n반드시 다음 형태의 JSON만 출력하세요: '
        '{"localized": {"<언어코드>": <원본과 동일한 구조의 번역본>}, "feedback": "<한 줄 요약>"}'
    )
    data = llm.chat_json(system, user, tier="mini", max_tokens=3000)
    feedback = data.get("feedback") or "현지화를 완료했습니다."
    return LoreTranslateResponse(
        world_setting=world,
        lore_applied=world is not None,
        target_languages=payload.target_languages,
        localized=data["localized"],
        ai_feedback=f"🟢 [gpt-5-mini] {feedback}",
    )
