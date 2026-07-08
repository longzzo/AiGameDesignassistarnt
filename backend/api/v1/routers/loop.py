"""마스터 코어루프 라우터 — AI는 '초기 설계'만 돕는다.

게임 한 줄 설명(+장르 힌트)을 받아 코어루프 설정 JSON(자원/수익원/강화 트랙/전투 수치)을
생성한다. 이후의 모든 계산·시뮬레이션은 프론트에서 실시간으로 수행되므로 AI는 여기서만 쓰인다.
호출 불가 시 config=None + 'API 호출 불가' 메시지(프론트는 프리셋 사용 안내).
"""
from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from api.v1.services import llm

router = APIRouter(prefix="/loop", tags=["loop"])


class LoopDesignRequest(BaseModel):
    description: str = Field(..., description="게임/루프 한 줄 설명")
    genre: Optional[str] = Field(None, description="장르 힌트 (선택)")


class LoopDesignResponse(BaseModel):
    config: Optional[dict[str, Any]] = None
    ai_feedback: str = ""


_SCHEMA_EXAMPLE = {
    "resources": [{"id": "gold", "name": "골드", "emoji": "🪙"}],
    "combat": {"base_attack": 25, "attack_speed": 1.2, "crit_chance": 0.15,
               "crit_mult": 1.8, "enemy_hp": 600, "enemy_def": 12},
    "sources": [
        {"id": "hunt", "name": "필드 사냥", "type": "kill",
         "rewards": [{"resource": "gold", "amount": 12, "chance": 0.7}]},
        {"id": "run", "name": "던전 런", "type": "cycle", "cycle_sec": 300,
         "rewards": [{"resource": "gold", "amount": 150, "chance": 1}]},
    ],
    "tracks": [
        {"id": "t1", "name": "무기 강화",
         "effect": {"stat": "attack", "mode": "pct", "value": 0.08},
         "cost": {"resource": "gold", "base": 60, "growth": 1.15}, "level": 0},
    ],
    "feedback": "이 루프의 의도/주의점 한두 문장",
}


@router.post("/design", response_model=LoopDesignResponse)
def design(payload: LoopDesignRequest) -> LoopDesignResponse:
    """AI 초안 설계. 결과 JSON은 프론트의 sanitizeConfig가 보정한다."""
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is None:
        return LoopDesignResponse(config=None, ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _via_llm(payload: LoopDesignRequest) -> LoopDesignResponse:
    system = (
        "당신은 게임 경제/코어루프 수치 기획자입니다. 입력된 게임 설명에 맞는 코어루프 초안을 "
        "설계합니다. 규칙: (1) 자원은 1~3종. (2) 수익원(sources)은 1~4개, type은 "
        "kill(전투 처치)/idle(초당 자동)/action(분당 행동, actions_per_min 필요)/"
        "cycle(주기 클리어, cycle_sec 필요) 중 게임에 맞는 것만. "
        "(3) 강화 트랙(tracks)은 3~6개, effect.stat은 attack/attack_speed/crit_chance/"
        "crit_mult/drop_chance/drop_value/idle_rate/action_rate/cycle_speed/income 중 하나, "
        "effect.mode는 add(고정 증가) 또는 pct(레벨당 비율 증가). "
        "(4) 비용은 cost.base × cost.growth^level 공식 — growth는 1.1~1.3 사이 권장. "
        "(5) 시작 10~20분 안에 첫 강화 2~3개를 살 수 있는 수치로 밸런싱. "
        "(6) 모든 name은 한국어로."
    )
    user = (
        json.dumps({"description": payload.description, "genre": payload.genre}, ensure_ascii=False)
        + "\n\n다음 구조의 JSON으로만 출력하세요 (키·타입 동일하게):\n"
        + json.dumps(_SCHEMA_EXAMPLE, ensure_ascii=False)
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=3500)
    if not isinstance(data.get("sources"), list) or not isinstance(data.get("tracks"), list):
        raise ValueError("코어루프 설계 JSON 구조가 올바르지 않습니다.")
    feedback = str(data.pop("feedback", "") or "코어루프 초안을 설계했습니다.")
    return LoopDesignResponse(
        config=data,
        ai_feedback=f"🟢 [{llm.model_tag()}] {feedback}",
    )
