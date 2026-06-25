"""LLM 서비스 계층 — GitHub Models 연동 (OpenAI 호환).

이 프로젝트는 Anthropic/Azure가 아니라 **GitHub Models**를 사용한다.
모델 라우팅:
  - main = openai/gpt-5        (프롬프트 생성, 시뮬레이션 피드백, 기획/발상)
  - mini = openai/gpt-5-mini   (단순 반복, 번역)

토큰(GITHUB_MODELS_TOKEN 또는 GITHUB_TOKEN)이 있으면 실제 호출, 없으면 호출을
시도하지 않아 각 라우터가 결정론적 목업으로 폴백한다.

필요 환경변수:
  GITHUB_MODELS_TOKEN     GitHub PAT (models 스코프). GITHUB_TOKEN 으로도 인식.
  GITHUB_MODELS_ENDPOINT  (선택) 기본값 https://models.github.ai/inference
  LLM_MODEL_MAIN          (선택) 기본값 openai/gpt-5
  LLM_MODEL_MINI          (선택) 기본값 openai/gpt-5-mini
"""
from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from typing import Any, Callable

PROVIDER = "github-models"
_DEFAULT_ENDPOINT = "https://models.github.ai/inference"
_DEFAULT_MAIN = "openai/gpt-5"
_DEFAULT_MINI = "openai/gpt-5-mini"

# gpt-5는 추론(reasoning) 토큰을 소비하는 모델이라, max_completion_tokens를 너무 낮게 잡으면
# 추론이 예산을 다 써버려 실제 출력이 빈다(finish_reason=length, content=""). 그래서
#  (1) reasoning_effort를 낮춰 추론 토큰을 줄이고,
#  (2) 토큰 한도에 충분한 바닥값을 둔다.
_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT", "low")  # minimal | low | medium | high | "" (미전송)
_MIN_COMPLETION_TOKENS = 3000

_log = logging.getLogger("gamegoal.llm")


def _token() -> str | None:
    return os.getenv("GITHUB_MODELS_TOKEN") or os.getenv("GITHUB_TOKEN")


def _config() -> dict[str, str | None]:
    return {
        "token": _token(),
        "endpoint": os.getenv("GITHUB_MODELS_ENDPOINT", _DEFAULT_ENDPOINT),
        "main": os.getenv("LLM_MODEL_MAIN", _DEFAULT_MAIN),
        "mini": os.getenv("LLM_MODEL_MINI", _DEFAULT_MINI),
    }


def is_enabled() -> bool:
    """토큰이 있으면 True (실제 호출 가능)."""
    return bool(_token())


def model_for(tier: str) -> str:
    c = _config()
    return c["mini"] if tier == "mini" else c["main"]


@lru_cache(maxsize=1)
def _client():
    # openai 패키지는 실제 호출이 필요할 때만 import (폴백만 쓸 때 의존성 불필요).
    from openai import OpenAI

    c = _config()
    return OpenAI(
        base_url=c["endpoint"],
        api_key=c["token"],
        timeout=100.0,    # gpt-5는 느림. 단, 재시도는 끄서 느린 호출이 2배로 늘지 않게.
        max_retries=0,    # 실패 시 즉시 목업 폴백(이중 지연 방지)
    )


# AI 호출이 불가능할 때(토큰 없음/레이트리밋/실패) AI가 작성하는 결과 자리에 표시할 문구.
# 목업(가짜 데이터)을 보여주지 않고 이 메시지로 대체한다. 결정론적 계산은 그대로 유지한다.
UNAVAILABLE_MSG = "현재 API를 호출할 수 없습니다. (토큰 미설정이거나 호출 제한·실패) 잠시 후 다시 시도하세요."


def try_ai(primary: Callable[[], Any]) -> Any | None:
    """AI 호출을 시도. 토큰이 없거나 호출이 실패하면 None을 반환한다.

    호출부는 None일 때 '현재 API를 호출할 수 없습니다'로 처리한다(목업 대체 아님).
    """
    if not is_enabled():
        return None
    try:
        return primary()
    except Exception as exc:  # noqa: BLE001 - 어떤 실패든 'API 호출 불가'로 처리
        _log.warning("LLM 호출 실패 → 'API 호출 불가' 처리: %s", exc)
        return None


def _strip_code_fence(text: str) -> str:
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1]  # 첫 줄(```json) 제거
        if t.endswith("```"):
            t = t[:-3]
    return t.strip()


def _create(messages: list[dict], *, tier: str, max_tokens: int, json_mode: bool, reasoning_effort: str | None = None):
    effort = reasoning_effort if reasoning_effort is not None else _REASONING_EFFORT
    kwargs: dict[str, Any] = {
        "model": model_for(tier),
        "messages": messages,
        # gpt-5 계열: temperature 미전송(기본값), max_completion_tokens 사용.
        # 추론 토큰이 출력을 굶기지 않도록 충분한 바닥값을 보장한다.
        "max_completion_tokens": max(max_tokens, _MIN_COMPLETION_TOKENS),
    }
    if effort:
        kwargs["reasoning_effort"] = effort
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    return _client().chat.completions.create(**kwargs)


def chat_text(system: str, user: str, *, tier: str = "main", max_tokens: int = 2000,
              reasoning_effort: str | None = None) -> str:
    """일반 텍스트 응답."""
    resp = _create(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        tier=tier,
        max_tokens=max_tokens,
        json_mode=False,
        reasoning_effort=reasoning_effort,
    )
    content = (resp.choices[0].message.content or "").strip()
    if not content:
        # gpt-5가 추론(reasoning)에 토큰을 다 써 출력이 빈 경우 → 실패로 간주해 폴백을 유도.
        raise ValueError("LLM 텍스트 응답이 비어 있습니다(추론 토큰 소진 가능). 토큰 한도를 높이세요.")
    return content


def chat_json(system: str, user: str, *, tier: str = "main", max_tokens: int = 3000,
              reasoning_effort: str | None = None) -> dict[str, Any]:
    """JSON 응답을 파싱해 dict로 반환. 프롬프트에 'json' 단어가 있어야 함."""
    resp = _create(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        tier=tier,
        max_tokens=max_tokens,
        json_mode=True,
        reasoning_effort=reasoning_effort,
    )
    content = (resp.choices[0].message.content or "").strip()
    if not content:
        raise ValueError("LLM JSON 응답이 비어 있습니다(추론 토큰 소진 가능). 토큰 한도를 높이세요.")
    raw = _strip_code_fence(content)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start == -1 or end == -1:
            raise
        data = json.loads(raw[start : end + 1])
    if not data:
        # 빈 {} 도 추론 소진/실패 신호 → 폴백 유도.
        raise ValueError("LLM이 빈 JSON을 반환했습니다. 폴백합니다.")
    return data
