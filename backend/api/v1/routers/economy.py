"""경제 인플레이션 추적기 라우터."""
from __future__ import annotations

from fastapi import APIRouter

from api.v1.schemas.economy import (
    InflationPoint,
    InflationRequest,
    InflationResponse,
)

router = APIRouter(prefix="/economy", tags=["economy"])


@router.post("/inflation", response_model=InflationResponse)
def track_inflation(payload: InflationRequest) -> InflationResponse:
    """Faucet(생산)과 Sink(소모)를 시뮬레이션해 인플레이션 위험 시점을 진단한다."""
    sink_ratio = payload.sink_rate / 100.0
    daily_faucet = payload.daily_production * payload.expected_dau

    # 이론적 균형 유통량: faucet == total * sink_ratio  ->  total = faucet / sink_ratio
    equilibrium = daily_faucet / sink_ratio if sink_ratio > 0 else None

    # 인플레이션 경고 기준: 초기 유통량의 3배를 넘어서는 시점.
    warning_threshold = max(payload.initial_currency, daily_faucet) * 3

    chart: list[InflationPoint] = []
    total = payload.initial_currency
    warning_day: int | None = None

    for day in range(1, payload.days + 1):
        sink = total * sink_ratio
        total = total + daily_faucet - sink
        total = max(total, 0.0)
        per_capita = total / payload.expected_dau

        if warning_day is None and total >= warning_threshold:
            warning_day = day

        chart.append(
            InflationPoint(
                day=day,
                total_currency=round(total, 2),
                faucet=round(daily_faucet, 2),
                sink=round(sink, 2),
                per_capita=round(per_capita, 2),
            )
        )

    if sink_ratio <= 0:
        feedback = (
            "Sink(소모율)이 0%입니다. 재화가 회수되지 않아 무한 인플레이션이 발생합니다. "
            "상점/강화/수리 등 재화 소모 콘텐츠를 즉시 도입하세요."
        )
    elif warning_day is not None:
        feedback = (
            f"{warning_day}일차에 유통량이 초기 대비 3배({warning_threshold:,.0f})를 돌파합니다. "
            f"균형 유통량은 약 {equilibrium:,.0f}입니다. 소모율을 높이거나 생산량을 낮추세요."
        )
    else:
        feedback = (
            f"시뮬레이션 기간 내 위험 임계치를 넘지 않았습니다. 균형 유통량 약 "
            f"{equilibrium:,.0f} 수준에서 안정화됩니다. 경제가 건강합니다."
        )

    return InflationResponse(
        chart_data=chart,
        equilibrium_currency=round(equilibrium, 2) if equilibrium else None,
        inflation_warning_day=warning_day,
        ai_feedback=feedback,
    )
