"""AI 게임 기획 & 밸런스 어시스턴트 — FastAPI 진입점."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# backend/.env 가 있으면 GitHub Models 토큰을 환경변수로 로드(없어도 무해 — 'API 호출 불가' 처리).
load_dotenv()

from api.v1.api import api_router

app = FastAPI(
    title="AI Game Design & Balance Assistant API",
    description="장르 불문 기획 명세와 밸런싱을 데이터로 검증/자동화하는 백엔드.",
    version="0.1.0",
)

# CORS 허용 출처. 기본은 로컬 개발 서버. 배포 시 ALLOWED_ORIGINS 환경변수에
# GitHub Pages 주소를 쉼표로 추가한다(예: https://<user>.github.io).
_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 모든 v1 모듈 라우터를 /api/v1 하위에 마운트.
app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {"status": "ok", "service": "ai-game-balance-assistant", "version": "0.1.0"}


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "healthy"}
