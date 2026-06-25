"""가챠/드랍률 몬테카를로 검증 라우터."""
from __future__ import annotations

import random
from statistics import mean, median

from fastapi import APIRouter

from api.v1.schemas.gacha import (
    HistogramBucket,
    MonteCarloRequest,
    MonteCarloResponse,
)

router = APIRouter(prefix="/gacha", tags=["gacha"])


def _percentile(sorted_values: list[int], pct: float) -> float:
    """정렬된 리스트에서 백분위 값을 선형 보간으로 구한다."""
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * pct
    lo = int(k)
    hi = min(lo + 1, len(sorted_values) - 1)
    if lo == hi:
        return float(sorted_values[lo])
    return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * (k - lo)


@router.post("/monte-carlo", response_model=MonteCarloResponse)
def run_monte_carlo(payload: MonteCarloRequest) -> MonteCarloResponse:
    """첫 획득까지 필요한 뽑기 횟수를 몬테카를로로 시뮬레이션한다."""
    rng = random.Random(42)  # 재현 가능한 결과를 위한 고정 시드
    pulls_to_first: list[int] = []
    pity_hits = 0
    ff = payload.fifty_fifty

    for _ in range(payload.simulations):
        pulls = 0  # 전체 뽑기 수
        since = 0  # 마지막 5성 이후 뽑기 수(천장 카운터)
        guaranteed = False  # 50/50 패배로 다음 5성 픽업 확정 여부
        used_pity = False
        while True:
            pulls += 1
            since += 1
            is_5star = since >= payload.pity_count or rng.random() < payload.base_rate
            if not is_5star:
                continue
            if since >= payload.pity_count:
                used_pity = True
            since = 0  # 5성 획득 → 천장 카운터 리셋
            # 50/50 비활성: 첫 5성이 곧 성공. 활성: 픽업이어야 성공.
            if not ff or guaranteed or rng.random() < 0.5:
                break
            guaranteed = True  # 50/50 패배 → 다음 5성은 픽업 확정
        pulls_to_first.append(pulls)
        if used_pity:
            pity_hits += 1

    pulls_to_first.sort()

    # 히스토그램 버킷 생성 (천장 길이에 비례한 폭).
    bucket_count = 10
    span = max(payload.pity_count, max(pulls_to_first))
    width = max(1, -(-span // bucket_count))  # ceil 나눗셈
    buckets: list[HistogramBucket] = []
    for i in range(bucket_count):
        start = i * width + 1
        end = (i + 1) * width
        cnt = sum(1 for v in pulls_to_first if start <= v <= end)
        buckets.append(
            HistogramBucket(
                range_start=start,
                range_end=end,
                count=cnt,
                label=f"{start}-{end}",
            )
        )

    avg = mean(pulls_to_first)
    med = median(pulls_to_first)
    pity_rate = pity_hits / payload.simulations * 100

    if pity_rate > 50:
        verdict = "절반 이상의 유저가 천장에 의존합니다. 기본 확률이 체감상 매우 낮게 느껴집니다."
    elif pity_rate > 15:
        verdict = "상당수 유저가 천장을 경험합니다. 천장은 안전망으로 잘 작동하고 있습니다."
    else:
        verdict = "대부분 천장 전에 획득합니다. 확률 구조가 비교적 관대합니다."

    target = "픽업 획득" if ff else "첫 획득"
    mode_tag = " (50/50 천장 모델)" if ff else ""
    feedback = (
        f"{payload.simulations:,}회 시뮬레이션 결과 평균 {avg:.1f}회, 중위값 {med:.0f}회에 {target}. "
        f"천장 사용률 {pity_rate:.1f}%.{mode_tag} {verdict}"
    )

    return MonteCarloResponse(
        simulations=payload.simulations,
        mean_pulls=round(avg, 2),
        median_pulls=round(med, 2),
        p25_pulls=round(_percentile(pulls_to_first, 0.25), 2),
        p75_pulls=round(_percentile(pulls_to_first, 0.75), 2),
        p90_pulls=round(_percentile(pulls_to_first, 0.90), 2),
        pity_hit_rate=round(pity_rate, 2),
        distribution=buckets,
        ai_feedback=feedback,
    )
