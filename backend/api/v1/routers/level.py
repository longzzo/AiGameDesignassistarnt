"""레벨 디자인 설계 라우터.

비트 시트·인텐시티 곡선·인카운터 배치는 결정론적으로 생성하고, '비평'만
GitHub Models(gpt-5)로 강화한다(토큰 없으면 규칙 기반 비평으로 폴백).
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.level import (
    Beat,
    DifficultyJump,
    Encounter,
    IntensityPoint,
    LevelDesignRequest,
    LevelDesignResponse,
)
from api.v1.services import llm

# 난이도 상승폭이 이 값을 넘으면 '급상승'으로 진단한다.
_JUMP_THRESHOLD = 25

router = APIRouter(prefix="/level", tags=["level"])

# 유형별 페이즈 템플릿: (시작%, 끝%, 기본 긴장도, 한 줄 가이드)
_TEMPLATE = {
    "튜토리얼": [
        (0, 15, 15, "조작/목표를 안전하게 학습. 실패 처벌 최소화."),
        (15, 45, 30, "새 메커니즘을 1개씩 분리해 도입."),
        (45, 70, 45, "배운 것을 결합하는 약한 도전."),
        (70, 82, 40, "작은 반전으로 응용 유도."),
        (82, 95, 60, "졸업 시험: 모든 메커니즘 종합."),
        (95, 100, 20, "성취 확인 + 다음 단계 예고."),
    ],
    "탐험": [
        (0, 10, 20, "분위기/목표 제시. 길잡이 단서 배치."),
        (10, 28, 35, "탐험 보상으로 전진 동기 부여."),
        (28, 55, 55, "본 도전 구간: 적/기믹 밀도 상승."),
        (55, 70, 48, "반전/숨은 길로 페이스 환기."),
        (70, 90, 88, "클라이맥스 조우(미니보스/대규모)."),
        (90, 100, 25, "회복 + 보상 + 다음 레벨 훅."),
    ],
    "보스": [
        (0, 8, 30, "보스 등장 연출. 패턴 예고."),
        (8, 20, 45, "1페이즈: 기본 패턴 학습."),
        (20, 45, 60, "2페이즈: 패턴 가속/추가."),
        (45, 60, 55, "체크포인트/숨고르기 페이즈."),
        (60, 92, 95, "최종 페이즈: 광폭화 클라이맥스."),
        (92, 100, 30, "처치 연출 + 보상."),
    ],
}
_CURVE_MULT = {"완만": 0.85, "상승": 1.0, "스파이크": 1.2}


def _clamp(v: int) -> int:
    return max(0, min(100, v))


def _build(req: LevelDesignRequest):
    tmpl = _TEMPLATE.get(req.level_type, _TEMPLATE["탐험"])
    mult = _CURVE_MULT.get(req.curve, 1.0)

    beats: list[Beat] = []
    curve: list[IntensityPoint] = [IntensityPoint(t_pct=0, intensity=_clamp(int(tmpl[0][2] * mult * 0.6)))]
    for (start, end, base, note), phase in zip(tmpl, ["도입", "학습", "도전", "반전", "클라이맥스", "보상"]):
        inten = _clamp(int(base * mult))
        beats.append(Beat(phase=phase, start_pct=start, end_pct=end, intensity=inten, note=note))
        curve.append(IntensityPoint(t_pct=(start + end) // 2, intensity=inten))
    curve.append(IntensityPoint(t_pct=100, intensity=beats[-1].intensity))

    # 인카운터: 페이즈 중심에 배치.
    kinds = {"도입": "이벤트", "학습": "퍼즐", "도전": "적", "반전": "이벤트", "클라이맥스": "보스", "보상": "보상"}
    mech = req.mechanics or ["전투"]
    encounters = [
        Encounter(
            at_pct=(b.start_pct + b.end_pct) // 2,
            kind=kinds.get(b.phase, "적"),
            detail=f"{b.phase} 구간 — {mech[i % len(mech)]} 중심 ({b.intensity} 강도)",
        )
        for i, b in enumerate(beats)
    ]
    return beats, curve, encounters


def _diagnose(beats: list[Beat]) -> tuple[list[DifficultyJump], int]:
    """인접 비트 간 긴장도 변화를 정량 진단한다."""
    jumps: list[DifficultyJump] = []
    max_jump = 0
    for a, b in zip(beats, beats[1:]):
        d = b.intensity - a.intensity
        if d >= _JUMP_THRESHOLD:
            sev = "급상승"
        elif d <= -_JUMP_THRESHOLD:
            sev = "급강하"
        else:
            sev = "적정"
        jumps.append(DifficultyJump(from_phase=a.phase, to_phase=b.phase, delta=d, severity=sev))
        max_jump = max(max_jump, d)
    return jumps, max_jump


def _recommended_curve(curve: list[IntensityPoint]) -> list[IntensityPoint]:
    """급경사를 완화한 권장 곡선(이웃 평균 1패스 스무딩). 양끝점은 유지."""
    vals = [p.intensity for p in curve]
    if len(vals) < 3:
        return [IntensityPoint(t_pct=p.t_pct, intensity=p.intensity) for p in curve]
    out = [curve[0]]
    for i in range(1, len(curve) - 1):
        sm = round(0.25 * vals[i - 1] + 0.5 * vals[i] + 0.25 * vals[i + 1])
        out.append(IntensityPoint(t_pct=curve[i].t_pct, intensity=_clamp(sm)))
    out.append(curve[-1])
    return out


@router.post("/design", response_model=LevelDesignResponse)
def design(payload: LevelDesignRequest) -> LevelDesignResponse:
    # 레벨 구조·페이싱 곡선·난이도 진단은 결정론으로 항상 생성한다(option A: 계산 유지).
    beats, curve, encounters = _build(payload)
    jumps, max_jump = _diagnose(beats)
    recommended = _recommended_curve(curve)

    # 비평·인카운터 상세(적 구성·배치)는 gpt-5가 작성하는 부분 → 호출 불가 시 'API 호출 불가'.
    enriched = llm.try_ai(lambda: _llm_enrich(payload, beats, encounters))
    if enriched is None:
        critique = [llm.UNAVAILABLE_MSG]  # 인카운터는 골격(enemies/setup 없음) 그대로 유지
    else:
        critique = enriched["critique"]
        encounters = enriched["encounters"]

    # 난이도 급상승 경고는 결정론적 진단 → AI 유무와 무관하게 항상 비평 맨 앞에 덧붙인다.
    steep = [j for j in jumps if j.severity == "급상승"]
    if steep:
        worst = max(steep, key=lambda j: j.delta)
        critique = [
            f"⚠ '{worst.from_phase}→{worst.to_phase}' 난이도가 +{worst.delta} 급상승합니다. "
            f"직전에 학습/회복 비트를 끼워 점프를 20 이하로 분할하세요."
        ] + critique

    return LevelDesignResponse(
        beats=beats,
        intensity_curve=curve,
        encounters=encounters,
        difficulty_jumps=jumps,
        recommended_curve=recommended,
        max_jump=max_jump,
        critique=critique,
        ai_feedback=(
            f"'{payload.level_type}' 레벨({payload.duration_min}분, {payload.curve}형) 구조를 생성했습니다. "
            f"최대 난이도 점프 +{max_jump}."
        ),
    )


def _assemble_encounters(skeleton: list[Encounter], ai_list) -> list[Encounter]:
    """AI 인카운터 상세를 골격(위치·종류)에 안전하게 병합한다.

    위치(at_pct)와 종류(kind)는 결정론 골격을 유지하고, detail/enemies/setup만 AI 값으로 채운다.
    개수가 안 맞거나 키가 비면 해당 슬롯은 골격 값을 그대로 쓴다.
    """
    if not isinstance(ai_list, list):
        return skeleton
    out: list[Encounter] = []
    for i, base in enumerate(skeleton):
        item = ai_list[i] if i < len(ai_list) and isinstance(ai_list[i], dict) else {}
        detail = str(item.get("detail") or "").strip() or base.detail
        enemies = str(item.get("enemies") or "").strip() or None
        setup = str(item.get("setup") or "").strip() or None
        out.append(Encounter(at_pct=base.at_pct, kind=base.kind, detail=detail, enemies=enemies, setup=setup))
    return out


def _llm_enrich(payload: LevelDesignRequest, beats: list[Beat], encounters: list[Encounter]) -> dict:
    """비평 + 인카운터 상세화를 한 번의 호출로 생성."""
    system = (
        "당신은 10년 차 레벨 디자이너입니다. 두 가지를 만드세요. "
        "(1) critique: 난이도 곡선·학습 모멘트·페이싱·보상 배치·인지 부하 관점의 실행 가능한 비평. "
        "(2) encounters: 주어진 각 인카운터 슬롯(순서·종류 고정)을 그 레벨의 메커니즘과 강도에 맞춰 "
        "구체화. enemies는 적/오브젝트 구성(예: '고블린 3 + 궁수 2'), setup은 배치·전술·기믹"
        "(예: '좌측 고지대 점거, 협곡으로 유도'), detail은 한 줄 요약. 슬롯 개수와 순서를 그대로 맞추세요."
    )
    slots = [{"at_pct": e.at_pct, "kind": e.kind, "phase_hint": e.detail} for e in encounters]
    user = (
        json.dumps(
            {
                "level_type": payload.level_type,
                "duration_min": payload.duration_min,
                "mechanics": payload.mechanics,
                "curve": payload.curve,
                "beats": [b.model_dump() for b in beats],
                "encounter_slots": slots,
            },
            ensure_ascii=False,
        )
        + '\n\n다음 JSON으로만 출력: '
          '{"critique": ["..."], "encounters": [{"detail":"...","enemies":"...","setup":"..."}]}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=2500)
    items = data.get("critique", [])
    critique = [f"🟢 {x}" for x in items]
    enriched_enc = _assemble_encounters(encounters, data.get("encounters"))
    return {"critique": critique, "encounters": enriched_enc}
