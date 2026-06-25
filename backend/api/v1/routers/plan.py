"""개발 로드맵 라우터 — WBS · 역할별 주차 워크플로우 · 기능명세서 + 기능 목록 생성.

구조(WBS/스케줄/명세서)는 결정론적으로 생성하고, PM 조언·기능 목록은
GitHub Models(gpt-5)로 강화한다(토큰 없으면 규칙 기반으로 폴백).
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.plan import (
    FeatureGenRequest,
    FeatureGenResponse,
    FeatureSpec,
    PlanRequest,
    PlanResponse,
    RoleTotal,
    WbsTask,
    WeekPlan,
)
from api.v1.services import llm

router = APIRouter(prefix="/plan", tags=["plan"])


def _build_wbs(features: list[str]) -> list[WbsTask]:
    """결정론 폴백: 모든 기능에 동일한 설계→아트→구현→테스트 4단계를 적용."""
    feats = [f for f in features if f.strip()] or ["기능 A"]
    tasks: list[WbsTask] = []
    tasks.append(WbsTask(id="setup", phase="셋업", role="개발", name="프로젝트 셋업 · 환경 구성", estimate_days=2, depends_on=[], week=0))

    impl_ids: list[str] = []
    for i, f in enumerate(feats):
        d, a, c, t = f"f{i}_design", f"f{i}_art", f"f{i}_impl", f"f{i}_test"
        tasks.append(WbsTask(id=d, phase="설계", role="기획", name=f"{f} · 설계", estimate_days=1, depends_on=["setup"], feature=f, week=0))
        tasks.append(WbsTask(id=a, phase="아트", role="아트", name=f"{f} · 아트/리소스", estimate_days=2, depends_on=[d], feature=f, week=0))
        tasks.append(WbsTask(id=c, phase="개발", role="개발", name=f"{f} · 구현", estimate_days=3, depends_on=[d], feature=f, week=0))
        tasks.append(WbsTask(id=t, phase="테스트", role="QA", name=f"{f} · 단위 테스트", estimate_days=1, depends_on=[c], feature=f, week=0))
        impl_ids.append(c)

    tasks.append(WbsTask(id="integ", phase="통합", role="개발", name="기능 통합 · 연동 검증", estimate_days=max(2.0, 0.5 * len(feats)), depends_on=impl_ids, week=0))
    tasks.append(WbsTask(id="qa", phase="QA", role="QA", name="QA · 버그픽스", estimate_days=3, depends_on=["integ"], week=0))
    tasks.append(WbsTask(id="release", phase="출시", role="개발", name="출시 준비 · 배포", estimate_days=1, depends_on=["qa"], week=0))
    return tasks


# --- AI 기반 기능별 작업 분해 ------------------------------------------------

def _clamp_est(v) -> float:
    """LLM이 준 공수를 0.5~10인일로 안전하게 정규화."""
    try:
        return round(max(0.5, min(10.0, float(v))), 1)
    except (TypeError, ValueError):
        return 2.0


def _norm_role(role: str, role_names: list[str]) -> str:
    """AI가 제시한 역할을 반드시 입력된 역할 목록 안으로 매핑(스케줄 매칭 보장)."""
    role = (role or "").strip()
    if role in role_names:
        return role
    if "개발" in role_names:
        return "개발"
    return role_names[0] if role_names else "개발"


def _assemble_wbs(decomp: list[dict], features: list[str], role_names: list[str]) -> list[WbsTask]:
    """LLM 분해 결과(기능→작업 목록)를 유효한 WBS 그래프로 조립한다.

    - 역할은 _norm_role로 입력 역할 안에 가둔다.
    - 기능 내 작업은 나열 순서대로 직렬 체인(앞 작업 완료 후 다음)으로 연결해
      '테스트가 구현보다 먼저' 같은 무효 순서를 원천 차단한다.
    - setup → (기능별 작업 체인) → integ → qa → release 골격은 결정론으로 고정.
    """
    feats = [f for f in features if f.strip()] or ["기능 A"]
    by_feature: dict[str, list] = {}
    for d in decomp:
        fn = str(d.get("feature", "")).strip()
        if fn:
            by_feature[fn] = d.get("tasks", []) or []

    tasks: list[WbsTask] = [
        WbsTask(id="setup", phase="셋업", role=_norm_role("개발", role_names), name="프로젝트 셋업 · 환경 구성", estimate_days=2, depends_on=[], week=0)
    ]
    impl_ids: list[str] = []
    for i, f in enumerate(feats):
        subtasks = by_feature.get(f)
        if subtasks is None and i < len(decomp) and isinstance(decomp[i], dict):
            subtasks = decomp[i].get("tasks")
        subtasks = [s for s in (subtasks or []) if isinstance(s, dict) and str(s.get("name", "")).strip()][:6]
        if not subtasks:  # 기능 분해 실패 시 표준 4단계로 채움
            subtasks = [
                {"name": "설계", "role": "기획", "estimate_days": 1},
                {"name": "아트/리소스", "role": "아트", "estimate_days": 2},
                {"name": "구현", "role": "개발", "estimate_days": 3},
                {"name": "단위 테스트", "role": "QA", "estimate_days": 1},
            ]
        prev = "setup"
        for k, s in enumerate(subtasks):
            tid = f"f{i}_{k}"
            role = _norm_role(str(s.get("role", "개발")), role_names)
            tasks.append(WbsTask(
                id=tid,
                phase=str(s.get("phase") or role),
                role=role,
                name=f"{f} · {str(s.get('name')).strip()}",
                estimate_days=_clamp_est(s.get("estimate_days")),
                depends_on=[prev],
                feature=f,
                week=0,
            ))
            prev = tid
        impl_ids.append(prev)  # 기능의 마지막 작업이 통합으로 연결

    tasks.append(WbsTask(id="integ", phase="통합", role=_norm_role("개발", role_names), name="기능 통합 · 연동 검증", estimate_days=max(2.0, 0.5 * len(feats)), depends_on=impl_ids, week=0))
    tasks.append(WbsTask(id="qa", phase="QA", role=_norm_role("QA", role_names), name="QA · 버그픽스", estimate_days=3, depends_on=["integ"], week=0))
    tasks.append(WbsTask(id="release", phase="출시", role=_norm_role("개발", role_names), name="출시 준비 · 배포", estimate_days=1, depends_on=["qa"], week=0))
    return tasks


def _wbs_via_llm(features: list[str], roles) -> list[WbsTask]:
    role_names = [r.role for r in roles] or ["기획", "개발", "아트", "QA"]
    feats = [f for f in features if f.strip()] or ["기능 A"]
    system = (
        "당신은 게임 개발 PM입니다. 각 기능을 그 '성격'에 맞는 개발 작업으로 분해하세요. "
        "예: '사운드'는 사운드 디자인·음원 제작/소싱·오디오 통합·믹싱 QA, "
        "'멀티플레이'는 네트워크 설계·서버 구현·상태 동기화·부하 테스트처럼 "
        "기능마다 서로 다른 작업과 담당 역할이 나오게 하세요. "
        "역할(role)은 반드시 제공된 역할 목록 중에서만 사용하고, "
        "각 작업에 현실적인 estimate_days(0.5~10)를 부여하세요. 작업은 진행 순서대로 나열하세요."
    )
    user = (
        json.dumps({"roles": role_names, "features": feats}, ensure_ascii=False)
        + '\n\n각 기능당 2~5개 작업. 다음 JSON으로만 출력: '
          '{"features":[{"feature":"<기능명>","tasks":[{"name":"<작업>","role":"<역할>","estimate_days":<수>}]}]}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=1800)
    decomp = data.get("features")
    if not isinstance(decomp, list) or not decomp:
        # 형식이 어긋나면 실패로 간주 → try_ai가 None → make_plan이 표준 템플릿 WBS를 쓴다.
        raise ValueError("LLM WBS 응답 형식이 올바르지 않습니다.")
    return _assemble_wbs(decomp, feats, role_names)


def _schedule(tasks: list[WbsTask], weeks: int, role_cap: dict[str, float]):
    roles = set(t.role for t in tasks) | set(role_cap)
    load = {r: {w: 0.0 for w in range(1, weeks + 1)} for r in roles}
    placed: dict[str, int] = {}
    warnings: list[str] = []
    missing: set[str] = set()
    weekly_total_cap = sum(role_cap.values()) or 5.0

    for t in tasks:  # 의존성 순(=리스트 순)
        cap = role_cap.get(t.role, 0.0)
        if cap <= 0:
            if t.role not in missing:
                warnings.append(f"'{t.role}' 역할 인원이 없습니다. 임시로 1명 기준으로 배정했습니다.")
                missing.add(t.role)
            cap = 5.0
        min_w = 1
        for dep in t.depends_on:
            if dep in placed:
                min_w = max(min_w, placed[dep])
        target = None
        for w in range(min_w, weeks + 1):
            if load[t.role][w] + t.estimate_days <= cap or load[t.role][w] == 0:
                target = w
                break
        if target is None:
            target = weeks
            warnings.append(f"'{t.name}'이 기간 내 수용되지 못해 {weeks}주차로 밀렸습니다.")
        load[t.role][target] += t.estimate_days
        placed[t.id] = target
        t.week = target

    schedule = []
    for w in range(1, weeks + 1):
        role_load = {r: round(load[r][w], 1) for r in load if load[r][w] > 0}
        schedule.append(WeekPlan(
            week=w,
            capacity_days=round(weekly_total_cap, 1),
            planned_days=round(sum(load[r][w] for r in load), 1),
            role_load=role_load,
            tasks=[t.name for t in tasks if t.week == w],
        ))
    return schedule, warnings


def _specs(features: list[str]) -> list[FeatureSpec]:
    feats = [f for f in features if f.strip()] or ["기능 A"]
    out = []
    for i, f in enumerate(feats):
        out.append(FeatureSpec(
            feature=f,
            overview=f"{f}의 핵심 동작을 구현한다.",
            inputs="사용자 입력 / 파라미터",
            outputs="처리 결과 / 화면 렌더",
            acceptance=[
                f"정상 입력에 대해 {f}의 기대 출력이 반환된다.",
                "잘못된 입력에 대해 명확한 오류 메시지를 표시한다.",
                "결과가 UI에 올바르게 렌더되고 회귀가 없다.",
            ],
            priority="높음" if i < 2 else "중간",
        ))
    return out


@router.post("/wbs", response_model=PlanResponse)
def make_plan(payload: PlanRequest) -> PlanResponse:
    role_cap = {rc.role: rc.count * 5.0 for rc in payload.roles}
    team_size = sum(rc.count for rc in payload.roles) or 1

    # WBS 일정 자체는 결정론으로 항상 제공한다(option A: 계산은 유지).
    # gpt-5가 성공하면 기능 성격에 맞춰 작업을 분해하고, 호출 불가/실패면 표준 템플릿 WBS를 쓴다.
    wbs = llm.try_ai(lambda: _wbs_via_llm(payload.features, payload.roles))
    tailored = wbs is not None
    if wbs is None:
        wbs = _build_wbs(payload.features)
    schedule, warnings = _schedule(wbs, payload.period_weeks, role_cap)
    specs = _specs(payload.features)

    # 역할별 공수/가용 요약
    role_days: dict[str, float] = {}
    for t in wbs:
        role_days[t.role] = role_days.get(t.role, 0.0) + t.estimate_days
    role_totals = [
        RoleTotal(role=r, days=round(d, 1), capacity=round(role_cap.get(r, 0.0) * payload.period_weeks, 1))
        for r, d in sorted(role_days.items(), key=lambda x: -x[1])
    ]

    total = sum(t.estimate_days for t in wbs)
    cap_total = team_size * 5.0 * payload.period_weeks
    # PM 조언은 AI가 작성하는 부분 → 호출 불가 시 'API 호출 불가'. (역할 초과 등은 warnings로 계속 노출)
    advice = llm.try_ai(lambda: _llm_advice(payload, total, cap_total, team_size))
    if advice is None:
        advice = [llm.UNAVAILABLE_MSG]
    return PlanResponse(
        wbs=wbs,
        schedule=schedule,
        specs=specs,
        role_totals=role_totals,
        advice=advice,
        warnings=warnings,
        total_days=round(total, 1),
        capacity_days=round(cap_total, 1),
        ai_feedback=(
            f"{len(payload.features)}개 기능 · {payload.period_weeks}주 · {team_size}명({len(payload.roles)}역할) 기준 "
            f"WBS {len(wbs)}개 작업을 {'gpt-5가 기능 성격에 맞춰' if tailored else '표준 템플릿으로'} 생성했습니다."
        ),
    )


def _llm_advice(payload: PlanRequest, total: float, cap_total: float, team_size: int) -> list[str]:
    system = (
        "당신은 게임 개발 프로젝트 매니저입니다. 기능 목록·기간·역할 구성 기반 계획에 대해 "
        "실행 가능한 일정/리스크/역할 분배 조언을 제시합니다. 병목, 버퍼, 우선순위를 다루세요."
    )
    user = (
        json.dumps(
            {
                "period_weeks": payload.period_weeks,
                "roles": [{"role": r.role, "count": r.count} for r in payload.roles],
                "features": payload.features,
                "total_estimate_days": total,
                "capacity_days": cap_total,
            },
            ensure_ascii=False,
        )
        + '\n\n다음 JSON으로만 출력: {"advice": ["...", "..."]}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=1200)
    items = data.get("advice", [])
    return [f"🟢 {x}" for x in items]


# --- 기능 목록 자동 생성 ----------------------------------------------------


@router.post("/features", response_model=FeatureGenResponse)
def gen_features(payload: FeatureGenRequest) -> FeatureGenResponse:
    res = llm.try_ai(lambda: _feat_via_llm(payload))
    if res is None:
        return FeatureGenResponse(features=[], ai_feedback=llm.UNAVAILABLE_MSG)
    return res


def _feat_via_llm(payload: FeatureGenRequest) -> FeatureGenResponse:
    system = (
        "당신은 게임 프로덕트 매니저입니다. 제품 설명과 장르를 보고 개발해야 할 '기능 목록'을 "
        "구체적인 명사형 항목으로 뽑습니다. 각 항목은 개발 단위가 될 만한 크기로 만드세요."
    )
    user = (
        json.dumps({"description": payload.description, "genre": payload.genre, "count": payload.count}, ensure_ascii=False)
        + f'\n\n정확히 {payload.count}개 항목을 다음 JSON으로만 출력: {{"features": ["...", "..."]}}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=800)
    feats = [f for f in data.get("features", []) if str(f).strip()][: payload.count]
    if not feats:
        raise ValueError("기능 목록이 비었습니다.")
    return FeatureGenResponse(
        features=feats,
        ai_feedback=f"🟢 [gpt-5] 설명 기반으로 기능 {len(feats)}개를 추출했습니다.",
    )
