"""밸런스 랩 라우터.

- C. /balance/compare : 여러 빌드의 DPS·TTK를 한 표로 비교하고 OP/약캐를 자동 판정.
- A. /balance/solve   : 목표 수치(예: 후반 TTK 3초)를 주면 파라미터를 역산(Goal-Seek).

탐색은 결정론적 이분법으로 수행하고, 해석/조언만 GitHub Models(gpt-5)로 강화한다
(토큰 없으면 규칙 기반 해석으로 폴백).
"""
from __future__ import annotations

import json
import random
from statistics import mean, median

from fastapi import APIRouter, HTTPException

from api.v1.schemas.balance import (
    BuildResult,
    CompareRequest,
    CompareResponse,
    SolveRequest,
    SolveResponse,
    SolveTracePoint,
)
from api.v1.services import llm

router = APIRouter(prefix="/balance", tags=["balance"])

_BIG = 1e12  # inf 대용 유한값(이분법 안정용)


def _attack_at(base_attack: float, growth: float, level: int) -> float:
    return base_attack * ((1 + growth) ** (level - 1))


# --- C. 빌드 비교 ----------------------------------------------------------

@router.post("/compare", response_model=CompareResponse)
def compare(payload: CompareRequest) -> CompareResponse:
    raw = []
    for b in payload.builds:
        atk = _attack_at(b.base_attack, b.growth_rate, payload.level)
        eff = max(atk - payload.monster_def, 1.0)
        dps = eff * b.attacks_per_second
        ttk = payload.monster_hp / dps if dps > 0 else _BIG
        raw.append((b.label, atk, dps, ttk))

    med = median(sorted(r[2] for r in raw)) or 1.0
    results: list[BuildResult] = []
    for label, atk, dps, ttk in raw:
        idx = dps / med
        verdict = "OP" if idx >= 1.25 else ("약함" if idx <= 0.8 else "균형")
        results.append(BuildResult(
            label=label,
            attack=round(atk, 1),
            dps=round(dps, 1),
            ttk=round(ttk, 2),
            dps_index=round(idx, 2),
            verdict=verdict,
        ))

    op = [r.label for r in results if r.verdict == "OP"]
    weak = [r.label for r in results if r.verdict == "약함"]
    spread = max(r.dps for r in results) / max(min(r.dps for r in results), 0.01)
    parts = [f"{payload.level}레벨 기준 중위 DPS {med:.0f}, 빌드 간 DPS 격차 {spread:.1f}배."]
    if op:
        parts.append(f"상향 의심(OP): {', '.join(op)} — 하향 또는 코스트 상승 검토.")
    if weak:
        parts.append(f"약세: {', '.join(weak)} — 상향 또는 유틸 보강 검토.")
    if not op and not weak:
        parts.append("모든 빌드가 중위 대비 ±20% 안으로 균형적입니다.")

    return CompareResponse(
        results=results,
        median_dps=round(med, 1),
        level=payload.level,
        ai_feedback=" ".join(parts),
    )


# --- A. Goal-Seek 솔버 -----------------------------------------------------

def _sim_stat(p: dict) -> dict:
    ba = float(p.get("base_attack", 100)); gr = float(p.get("growth_rate", 0.08))
    aps = float(p.get("attacks_per_second", 1.5)); hp = float(p.get("monster_hp", 1000))
    df = float(p.get("monster_def", 20)); ml = int(p.get("max_level", 20))

    def ttk_at(level: int) -> float:
        atk = _attack_at(ba, gr, level)
        dps = max(atk - df, 1.0) * aps
        return hp / dps if dps > 0 else _BIG

    first, last = ttk_at(1), ttk_at(ml)
    return {"late_ttk": last, "first_ttk": first,
            "reduction_pct": (1 - last / first) * 100 if first else 0.0}


def _sim_economy(p: dict) -> dict:
    sr = float(p.get("sink_rate", 12)) / 100.0
    faucet = float(p.get("daily_production", 500)) * float(p.get("expected_dau", 1000))
    dau = float(p.get("expected_dau", 1000)); init = float(p.get("initial_currency", 0))
    days = int(p.get("days", 90))
    equilibrium = faucet / sr if sr > 0 else _BIG
    total = init; warn = None; thr = max(init, faucet) * 3
    for d in range(1, days + 1):
        total = max(total + faucet - total * sr, 0.0)
        if warn is None and total >= thr:
            warn = d
    return {"equilibrium": equilibrium,
            "equilibrium_per_capita": equilibrium / dau if dau else equilibrium,
            "warning_day": float(warn if warn else days + 1),
            "final_per_capita": total / dau if dau else total}


def _sim_gacha(p: dict) -> dict:
    base_rate = float(p.get("base_rate", 0.006)); pity = int(p.get("pity_count", 90))
    ff = bool(p.get("fifty_fifty", False)); sims = int(p.get("simulations", 2000))
    rng = random.Random(42); pulls: list[int] = []; pity_hits = 0
    for _ in range(sims):
        n = 0; since = 0; guaranteed = False; used = False
        while True:
            n += 1; since += 1
            is5 = since >= pity or rng.random() < base_rate
            if not is5:
                continue
            if since >= pity:
                used = True
            since = 0
            if not ff or guaranteed or rng.random() < 0.5:
                break
            guaranteed = True
        pulls.append(n)
        if used:
            pity_hits += 1
    pulls.sort()
    return {"pity_rate": pity_hits / sims * 100, "mean_pulls": mean(pulls),
            "median_pulls": float(median(pulls))}


_SIMS = {"stat": _sim_stat, "economy": _sim_economy, "gacha": _sim_gacha}

_DEFAULT_BOUNDS = {
    "growth_rate": (0.0, 0.5),
    "base_attack": (10.0, 2000.0),
    "attacks_per_second": (0.2, 10.0),
    "monster_hp": (50.0, 100000.0),
    "monster_def": (0.0, 500.0),
    "sink_rate": (0.0, 95.0),
    "daily_production": (10.0, 100000.0),
    "expected_dau": (10.0, 1000000.0),
    "base_rate": (0.001, 0.05),
    "pity_count": (10.0, 200.0),
}


def _finite(v) -> float:
    try:
        v = float(v)
    except (TypeError, ValueError):
        return _BIG
    return max(-_BIG, min(_BIG, v))


@router.post("/solve", response_model=SolveResponse)
def solve(payload: SolveRequest) -> SolveResponse:
    module = payload.module
    if module not in _SIMS:
        raise HTTPException(status_code=400, detail="module은 stat | economy | gacha 중 하나여야 합니다.")
    sim = _SIMS[module]
    base = dict(payload.base_params or {})
    vp = payload.vary_param
    mk = payload.target_metric
    target = float(payload.target_value)

    if payload.bounds and len(payload.bounds) == 2:
        lo, hi = float(payload.bounds[0]), float(payload.bounds[1])
    else:
        lo, hi = _DEFAULT_BOUNDS.get(vp, (0.0, 1.0))

    def metric(x: float) -> float:
        p = dict(base); p[vp] = x
        out = sim(p)
        if mk not in out:
            raise HTTPException(status_code=400, detail=f"'{mk}'는 {module}에서 지원하지 않는 지표입니다.")
        return _finite(out[mk])

    tol = max(abs(target) * 0.01, 0.05)
    trace: list[SolveTracePoint] = []

    fa = metric(lo) - target
    fb = metric(hi) - target
    best_x = lo if abs(fa) <= abs(fb) else hi
    best_err = min(abs(fa), abs(fb))
    success = False

    if best_err <= tol:
        success = True
    elif (fa > 0) == (fb > 0):
        # 목표가 탐색 범위 밖 — 가장 가까운 끝점을 반환
        success = False
    else:
        a, b, faa, fbb = lo, hi, fa, fb
        for i in range(40):
            mid = (a + b) / 2.0
            fm = metric(mid) - target
            trace.append(SolveTracePoint(iter=i + 1, param=round(mid, 5), metric=round(fm + target, 3)))
            if abs(fm) < best_err:
                best_err, best_x = abs(fm), mid
            if abs(fm) <= tol:
                success = True
                break
            if (fm > 0) == (faa > 0):
                a, faa = mid, fm
            else:
                b, fbb = mid, fm

    achieved = metric(best_x)
    # 탐색 결과·요약(suggestions)은 결정론으로 항상 제공한다(option A: 계산 유지).
    suggestions = _rule_suggestions(payload, best_x, achieved, success, lo, hi)
    # AI 해석(부작용·함께 점검할 변수)은 gpt-5가 작성 → 호출 불가 시 'API 호출 불가'.
    ai_feedback = llm.try_ai(lambda: _llm_explain(payload, best_x, achieved, success))
    if ai_feedback is None:
        ai_feedback = llm.UNAVAILABLE_MSG
    return SolveResponse(
        module=module,
        vary_param=vp,
        target_metric=mk,
        target_value=target,
        found_param=round(best_x, 5),
        achieved_metric=round(achieved, 3),
        success=success,
        bounds=[lo, hi],
        trace=trace,
        suggestions=suggestions,
        ai_feedback=ai_feedback,
    )


def _rule_suggestions(payload: SolveRequest, x: float, achieved: float, ok: bool, lo: float, hi: float) -> list[str]:
    vp, mk, tgt = payload.vary_param, payload.target_metric, payload.target_value
    if ok:
        head = f"✅ {vp} = {x:.4g} 으로 설정하면 {mk}가 약 {achieved:.4g}로, 목표({tgt:.4g})에 도달합니다."
    else:
        head = (f"⚠ 탐색 범위 [{lo:.4g}, {hi:.4g}] 안에서는 목표({tgt:.4g})에 도달하지 못했습니다. "
                f"가장 근접한 값은 {vp} = {x:.4g} (→ {mk} {achieved:.4g})입니다.")
    tips = [head]
    if not ok:
        tips.append("탐색 범위를 넓히거나, 다른 파라미터를 함께 조정하면 목표에 도달할 수 있습니다.")
    tips.append(f"역산된 {vp} 값을 해당 시뮬레이터 폼에 넣어 전체 곡선/분포로 교차 검증하세요.")
    return tips


def _llm_explain(payload: SolveRequest, x: float, achieved: float, ok: bool) -> str:
    system = (
        "당신은 게임 밸런스 전문가입니다. 목표 수치를 맞추기 위해 역산된 파라미터 결과를 보고, "
        "그 값이 플레이 경험에 주는 의미와 부작용, 함께 점검할 변수만 2~3문장으로 간결히 설명하세요."
    )
    user = json.dumps({
        "module": payload.module, "target_metric": payload.target_metric,
        "target_value": payload.target_value, "vary_param": payload.vary_param,
        "found_param": round(x, 5), "achieved_metric": round(achieved, 3),
        "reached_target": ok,
    }, ensure_ascii=False) + '\n\n다음 JSON으로만 출력: {"explanation": "..."}'
    data = llm.chat_json(system, user, tier="main", max_tokens=600)
    exp = data.get("explanation", "").strip()
    return f"🟢 {exp}" if exp else _rule_suggestions(payload, x, achieved, ok, 0, 0)[0]
