"""스탯 성장 및 DPS/TTK 시뮬레이터 라우터."""
from __future__ import annotations

from fastapi import APIRouter

from api.v1.schemas.simulator import DpsTtkRequest, DpsTtkResponse, TtkPoint

router = APIRouter(prefix="/simulator", tags=["simulator"])


@router.post("/dps-ttk", response_model=DpsTtkResponse)
def simulate_dps_ttk(payload: DpsTtkRequest) -> DpsTtkResponse:
    """레벨별 공격력 성장에 따른 DPS / TTK 곡선을 계산한다."""
    chart: list[TtkPoint] = []
    for level in range(1, payload.max_level + 1):
        attack = payload.base_attack * ((1 + payload.growth_rate) ** (level - 1))
        # 방어력은 데미지를 감산하되 최소 1의 데미지는 보장한다.
        effective = max(attack - payload.monster_def, 1.0)
        dps = effective * payload.attacks_per_second
        ttk = payload.monster_hp / dps if dps > 0 else float("inf")
        chart.append(
            TtkPoint(
                level=level,
                attack=round(attack, 2),
                effective_damage=round(effective, 2),
                dps=round(dps, 2),
                ttk=round(ttk, 2),
            )
        )

    first_ttk = chart[0].ttk
    last_ttk = chart[-1].ttk
    reduction = (1 - last_ttk / first_ttk) * 100 if first_ttk else 0

    if last_ttk < 1.0:
        verdict = "고레벨 구간에서 몬스터가 거의 즉사합니다. 후반 몬스터 HP/DEF 스케일링을 상향하세요."
    elif reduction < 30:
        verdict = "레벨업 대비 체감 성장이 미미합니다. 성장률(growth_rate)을 높이거나 방어력 관통을 추가하세요."
    else:
        verdict = "초반 대비 후반 처치 속도가 건강하게 개선됩니다. 현재 성장 곡선은 양호합니다."

    feedback = (
        f"1레벨 TTK {first_ttk:.2f}초 → {payload.max_level}레벨 TTK {last_ttk:.2f}초 "
        f"(약 {reduction:.0f}% 단축). {verdict}"
    )

    return DpsTtkResponse(chart_data=chart, ai_feedback=feedback)
