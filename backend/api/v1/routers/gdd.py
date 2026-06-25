"""기획서(GDD) 초안 생성 라우터.

장르/세계관/메커니즘을 받아 표준 GDD 아웃라인을 결정론적으로 채운 초안과,
LLM으로 확장할 때 쓰는 메타 프롬프트를 함께 생성한다. 운영 단계에서는 본문
생성 부분을 LLM 호출로 교체하는 지점이다.
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.gdd import (
    BalanceBaseline,
    EconomyBaseline,
    GachaBaseline,
    GddRequest,
    GddResponse,
    GddSection,
    StatBaseline,
)
from api.v1.services import llm

router = APIRouter(prefix="/gdd", tags=["gdd"])


def _baseline(genre: str, platform: str) -> BalanceBaseline:
    """장르/플랫폼 특성을 반영해 시뮬레이터 제안 시작값을 만든다."""
    g = genre.lower()
    fast = any(k in g for k in ["액션", "슈터", "파티", "로그라이트", "술래잡기", "캐주얼"])
    strategy = any(k in g for k in ["전략", "오토배틀러", "카드", "디펜스", "시뮬", "rpg"])

    stat = StatBaseline(
        base_attack=100,
        growth_rate=0.09 if fast else (0.06 if strategy else 0.08),
        attacks_per_second=2.0 if fast else (1.0 if strategy else 1.5),
        monster_hp=800 if fast else (1600 if strategy else 1000),
        monster_def=20,
        max_level=20,
    )
    mobile = "모바일" in platform
    economy = EconomyBaseline(
        initial_currency=1_000_000,
        daily_production=300 if mobile else 500,
        sink_rate=12,
        expected_dau=10_000,
        days=90,
    )
    # 수집형(가챠) 색채가 강한 장르는 더 낮은 기본 확률 + 천장을 제안.
    collectible = any(k in g for k in ["가챠", "수집", "rpg", "오토배틀러", "카드"])
    gacha = GachaBaseline(
        base_rate=0.006 if collectible else 0.02,
        pity_count=90 if collectible else 50,
        simulations=10_000,
    )
    note = (
        "장르 특성을 반영한 제안 시작값입니다. 시뮬레이터에서 조정하며 "
        "목표 TTK(초반 8~10초·후반 2~3초)와 경제 균형을 맞춰 검증하세요."
    )
    return BalanceBaseline(stat=stat, economy=economy, gacha=gacha, note=note)


def _working_title(genre: str, world: str | None) -> str:
    base = (world or genre).strip()
    head = base.split()[0] if base else "Untitled"
    return f"(가제) Project {head[:12]}"


def _to_markdown(title: str, one_liner: str, sections: list[GddSection]) -> str:
    lines = [f"# {title}", "", f"> {one_liner}", ""]
    for s in sections:
        lines.append(f"## {s.heading}")
        lines.extend(f"- {b}" for b in s.bullets)
        lines.append("")
    return "\n".join(lines).strip()


def _build_meta_prompt(req: GddRequest) -> str:
    mechanics = "\n".join(f"   - {m}" for m in req.core_mechanics if m.strip())
    world = req.world_setting or "(미정 — 적절히 제안할 것)"
    return f"""당신은 10년 차 수석 게임 시스템 기획자입니다.
아래 입력을 바탕으로 실무에 바로 쓸 수 있는 상세 기획서(GDD)를 작성하세요.

## 입력
- 장르: {req.genre}
- 세계관: {world}
- 핵심 메커니즘:
{mechanics or "   - (제안 필요)"}
- 플랫폼: {req.target_platform}
- 타겟 유저: {req.target_audience or "(제안 필요)"}
- 수익화: {req.monetization or "(제안 필요)"}

## 요구사항
1. 개요/USP, 코어 루프, 핵심 메커니즘(상호작용 포함), 진행·성장, 콘텐츠,
   수익화, 밸런싱 계획, 리스크, MVP 범위 섹션을 빠짐없이 작성합니다.
2. 각 메커니즘은 "왜 재미있는가 / 카운터플레이 / 밸런싱 변수"를 함께 기술합니다.
3. 수치가 필요한 곳은 검증 가능한 가설 형태(예: '1레벨 TTK 8초 목표')로 제시합니다.
4. 추상적 미사여구 대신 구현·검증 가능한 명세 위주로 작성합니다.

이제 완성된 기획서를 작성하세요."""


@router.post("/draft", response_model=GddResponse)
def generate_gdd(payload: GddRequest) -> GddResponse:
    """GDD 초안 생성. 본문은 gpt-5, 밸런스 베이스라인·메타 프롬프트는 결정론적.

    AI 호출이 불가능하면 본문(섹션/문서)은 'API 호출 불가'로 두고, 결정론적인
    밸런스 베이스라인과 메타 프롬프트는 그대로 제공한다(목업 본문은 보여주지 않음).
    """
    res = llm.try_ai(lambda: _via_llm(payload))
    if res is not None:
        return res
    return GddResponse(
        title="(현재 API를 호출할 수 없습니다)",
        one_liner=llm.UNAVAILABLE_MSG,
        sections=[],
        balance_baseline=_baseline(payload.genre, payload.target_platform),
        markdown="",
        meta_prompt=_build_meta_prompt(payload),
        ai_feedback=llm.UNAVAILABLE_MSG,
    )


def _via_llm(payload: GddRequest) -> GddResponse:
    # 밸런스 베이스라인과 메타 프롬프트는 결정론적으로 유지(검증 핸드오프 안정성).
    baseline = _baseline(payload.genre, payload.target_platform)
    meta_prompt = _build_meta_prompt(payload)

    system = (
        "당신은 10년 차 수석 게임 시스템 기획자입니다. 입력으로 실무용 기획서(GDD) 초안을 "
        "작성합니다. 개요, 코어 게임플레이 루프, 핵심 메커니즘, 진행·성장, 콘텐츠, 수익화, "
        "밸런싱 & 검증 계획, 리스크, MVP 범위 섹션을 포함하세요. validation_notes가 있으면 "
        "'밸런스 검증 노트' 섹션으로 반영하세요. 각 섹션은 heading(문자열)과 bullets(문자열 배열)입니다."
    )
    user = (
        json.dumps(
            {
                "genre": payload.genre,
                "world_setting": payload.world_setting,
                "core_mechanics": payload.core_mechanics,
                "target_platform": payload.target_platform,
                "target_audience": payload.target_audience,
                "monetization": payload.monetization,
                "references": payload.references,
                "validation_notes": payload.validation_notes,
            },
            ensure_ascii=False,
        )
        + '\n\n다음 JSON으로만 출력하세요: {"title": "(가제) ...", "one_liner": "...", '
        '"sections": [{"heading": "", "bullets": []}], "feedback": ""}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=4000)
    title = data.get("title") or _working_title(payload.genre, payload.world_setting)
    one_liner = data.get("one_liner") or payload.genre
    sections = [
        GddSection(heading=s["heading"], bullets=s.get("bullets", []))
        for s in data["sections"]
    ]
    markdown = _to_markdown(title, one_liner, sections)
    feedback = data.get("feedback") or "기획서 초안을 생성했습니다."
    return GddResponse(
        title=title,
        one_liner=one_liner,
        sections=sections,
        balance_baseline=baseline,
        markdown=markdown,
        meta_prompt=meta_prompt,
        ai_feedback=f"🟢 [gpt-5] {feedback}",
    )


