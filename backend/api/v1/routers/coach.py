"""AI 밸런스 코치 라우터.

시뮬레이터(스탯/경제/가챠) 결과를 받아 GitHub Models(gpt-5)로 구체적 수치 튜닝안을
제시한다. AI 호출이 불가능하면 목업 대신 'API 호출 불가'로 응답한다.
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.coach import CoachRequest, CoachResponse
from api.v1.services import llm

router = APIRouter(prefix="/coach", tags=["coach"])


@router.post("/suggest", response_model=CoachResponse)
def suggest(payload: CoachRequest) -> CoachResponse:
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is None:
        return CoachResponse(module=payload.module, suggestions=[], rationale="",
                             ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _via_llm(payload: CoachRequest) -> CoachResponse:
    system = (
        "당신은 10년 차 게임 밸런스 전문가입니다. 시뮬레이션 결과를 보고 '구체적인 수치 변경'을 "
        "제안합니다. 모호한 표현 대신 '성장률 0.08→0.06', '몬스터 HP 1.4배' 처럼 실행 가능한 "
        "튜닝안을 제시하세요. 입력값을 근거로 3~5개 제안을 만드세요."
    )
    user = (
        json.dumps(
            {"module": payload.module, "inputs": payload.inputs, "summary": payload.summary},
            ensure_ascii=False,
        )
        + '\n\n다음 JSON으로만 출력: {"suggestions": ["..."], "rationale": "..."}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=1500)
    return CoachResponse(
        module=payload.module,
        suggestions=data.get("suggestions", []),
        rationale=data.get("rationale", ""),
        ai_feedback="🟢 [gpt-5] 시뮬레이션 결과를 분석해 튜닝안을 제시했습니다.",
    )
