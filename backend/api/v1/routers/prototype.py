"""프로토타입 프롬프트 / 실행 HTML 제너레이터 라우터.

장르·메커니즘을 GitHub Models(gpt-5)로 메타 프롬프트 또는 실행 가능한 단일 HTML로
생성한다. AI 호출이 불가능하면 목업 대신 'API 호출 불가'로 응답한다.
"""
from __future__ import annotations

from fastapi import APIRouter

from api.v1.schemas.prototype import (
    HtmlPrototypeResponse,
    PromptRequest,
    PromptResponse,
)
from api.v1.services import llm

router = APIRouter(prefix="/prototype", tags=["prototype"])


@router.post("/prompt", response_model=PromptResponse)
def generate_prompt(payload: PromptRequest) -> PromptResponse:
    """메타 프롬프트 생성(gpt-5). 호출 불가 시 'API 호출 불가'."""
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is None:
        return PromptResponse(prompt=llm.UNAVAILABLE_MSG, estimated_tokens=0,
                              ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _via_llm(payload: PromptRequest) -> PromptResponse:
    system = (
        "당신은 게임 프로토타이핑에 특화된 시니어 게임플레이 엔지니어입니다. "
        "입력된 장르/메커니즘/스택으로, 즉시 실행 가능한 플레이 가능한 프로토타입을 "
        "코드 생성 AI가 만들 수 있도록 완벽하게 구조화된 한국어 메타 프롬프트를 작성합니다. "
        "개요·핵심 메커니즘·기술 요구사항·게임플레이 명세·산출물 형식 섹션을 포함하세요. "
        "프롬프트 텍스트만 출력하고 다른 설명은 붙이지 마세요."
    )
    mechanics = ", ".join(payload.core_mechanics)
    user = f"장르: {payload.genre}\n핵심 메커니즘: {mechanics}\n타겟 기술 스택: {payload.tech_stack}"
    prompt = llm.chat_text(system, user, tier="main", max_tokens=2000)
    estimated_tokens = max(1, len(prompt) // 3)
    return PromptResponse(
        prompt=prompt,
        estimated_tokens=estimated_tokens,
        ai_feedback=f"🟢 [{llm.model_tag()}] '{payload.genre}' 기준 메타 프롬프트를 생성했습니다(약 {estimated_tokens} 토큰).",
    )


@router.post("/html", response_model=HtmlPrototypeResponse)
def generate_html(payload: PromptRequest) -> HtmlPrototypeResponse:
    """실행 가능한 단일 HTML 프로토타입 생성(gpt-5). 호출 불가 시 'API 호출 불가'."""
    res = llm.try_ai(lambda: _html_via_llm(payload))
    if res is None:
        return HtmlPrototypeResponse(html="", ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _html_via_llm(payload: PromptRequest) -> HtmlPrototypeResponse:
    system = (
        "당신은 게임 프로토타이핑 엔지니어입니다. 입력된 장르/메커니즘을 반영해 "
        "외부 의존성 없이 즉시 실행 가능한 '단일 HTML 파일'을 작성합니다. CSS와 JS는 "
        "인라인으로 포함하고, requestAnimationFrame 게임 루프와 상단 CONFIG 객체를 두며, "
        "조작 안내를 화면에 표시하세요. 설명 없이 HTML 전체만 출력하세요."
    )
    mechanics = ", ".join(payload.core_mechanics)
    user = f"장르: {payload.genre}\n핵심 메커니즘: {mechanics}\n기술 스택: {payload.tech_stack}"
    # HTML 게임은 출력이 크다. 코드 생성엔 깊은 추론이 불필요하므로 reasoning을 minimal로 낮춰
    # 토큰을 출력에 몰아주고 속도도 확보한다.
    html = llm.chat_text(system, user, tier="main", max_tokens=8000, reasoning_effort="minimal")
    if html.startswith("```"):
        html = html.split("\n", 1)[-1]
        if html.endswith("```"):
            html = html[:-3]
    html = html.strip()
    # 잘렸거나 HTML이 아니면 실패로 간주 → try_ai가 None → 'API 호출 불가'.
    if len(html) < 200 or "<" not in html:
        raise ValueError("생성된 HTML이 불완전합니다.")
    return HtmlPrototypeResponse(
        html=html,
        ai_feedback=f"🟢 [{llm.model_tag()}] 메커니즘을 반영한 실행 가능한 HTML 프로토타입을 생성했습니다.",
    )
