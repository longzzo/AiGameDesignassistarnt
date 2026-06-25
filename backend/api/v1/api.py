"""v1 API 집계 라우터 — 5개 모듈 라우터를 하나로 묶는다."""
from __future__ import annotations

from fastapi import APIRouter

from api.v1.routers import (
    asset,
    balance,
    coach,
    economy,
    gacha,
    gdd,
    ideation,
    level,
    lore,
    meta,
    plan,
    prototype,
    simulator,
)

api_router = APIRouter()
api_router.include_router(simulator.router)
api_router.include_router(economy.router)
api_router.include_router(gacha.router)
api_router.include_router(asset.router)
api_router.include_router(prototype.router)
api_router.include_router(ideation.router)
api_router.include_router(gdd.router)
api_router.include_router(meta.router)
api_router.include_router(coach.router)
api_router.include_router(level.router)
api_router.include_router(lore.router)
api_router.include_router(plan.router)
api_router.include_router(balance.router)
