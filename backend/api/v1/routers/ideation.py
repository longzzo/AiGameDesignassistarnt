"""아이데이션(장르·기능 추천) 라우터.

세계관/키워드를 GitHub Models(gpt-5)에 넘겨 장르 후보를 추천한다. AI 호출이
불가능하면(토큰 미설정/호출 제한·실패) 목업 대신 'API 호출 불가'로 응답한다.
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.ideation import (
    GenreRecommendation,
    IdeationRequest,
    IdeationResponse,
)
from api.v1.services import llm

router = APIRouter(prefix="/ideation", tags=["ideation"])


@router.post("/recommend", response_model=IdeationResponse)
def recommend(payload: IdeationRequest) -> IdeationResponse:
    """장르·기능 추천(gpt-5). 호출 불가 시 'API 호출 불가'."""
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is None:
        return IdeationResponse(recommendations=[], ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _via_llm(payload: IdeationRequest) -> IdeationResponse:
    system = (
        "당신은 10년 차 수석 게임 기획자입니다. 입력된 세계관/키워드/시드 장르에 어울리는 "
        "게임 장르 후보를 발산형으로 추천합니다. 각 후보는 적합도(0~100), 한 줄 컨셉, 근거, "
        "매칭 키워드, 핵심 차별화 기능 2~4개, 레퍼런스 게임을 포함합니다."
    )
    user = (
        json.dumps(
            {
                "world_setting": payload.world_setting,
                "keywords": payload.keywords,
                "seed_genre": payload.seed_genre,
                "count": payload.count,
            },
            ensure_ascii=False,
        )
        + f'\n\n정확히 {payload.count}개 후보를 다음 JSON으로만 출력하세요: '
        '{"recommendations": [{"genre": "", "tagline": "", "fit_score": 0, '
        '"rationale": "", "matched_keywords": [], "core_features": [], '
        '"reference_games": []}], "feedback": ""}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=3000)
    recs = [
        GenreRecommendation(
            genre=r["genre"],
            tagline=r.get("tagline", ""),
            fit_score=int(r.get("fit_score", 50)),
            rationale=r.get("rationale", ""),
            matched_keywords=r.get("matched_keywords", []),
            core_features=r.get("core_features", []),
            reference_games=r.get("reference_games", []),
        )
        for r in data["recommendations"]
    ]
    feedback = data.get("feedback") or f"{len(recs)}개 장르를 추천했습니다."
    return IdeationResponse(
        recommendations=recs,
        ai_feedback=f"🟢 [{llm.model_tag()}] {feedback}",
    )
