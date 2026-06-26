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

# ── 프로바이더 스위치 ──────────────────────────────────────────────────────
# .env 의 LLM_PROVIDER 로 전환한다.
#   github (기본) = GitHub Models (openai/gpt-5, gpt-5-mini) — 배포/품질용
#   ollama        = 로컬 Ollama (qwen2.5:7b-instruct) — 무제한·오프라인 개발/테스트용
# Ollama 는 OpenAI 호환 엔드포인트(http://localhost:11434/v1)를 제공하므로 같은
# openai SDK 로 호출한다. 차이는 (1) api_key 더미, (2) max_tokens 파라미터명,
# (3) reasoning_effort 미사용 뿐이다.
_GITHUB_ENDPOINT = "https://models.github.ai/inference"
_GITHUB_MAIN = "openai/gpt-5"
_GITHUB_MINI = "openai/gpt-5-mini"

_OLLAMA_ENDPOINT = "http://localhost:11434/v1"
_OLLAMA_MODEL = "qwen2.5:7b-instruct"  # 로컬은 main/mini 동일 모델 사용

# 하위 호환: 기존에 llm.PROVIDER 를 참조하던 코드용. 표시는 provider_label() 사용 권장.
PROVIDER = "github-models"

# gpt-5는 추론(reasoning) 토큰을 소비하는 모델이라, max_completion_tokens를 너무 낮게 잡으면
# 추론이 예산을 다 써버려 실제 출력이 빈다(finish_reason=length, content=""). 그래서
#  (1) reasoning_effort를 낮춰 추론 토큰을 줄이고,
#  (2) 토큰 한도에 충분한 바닥값을 둔다.
# (Ollama 모델은 추론 모델이 아니라 이 처리가 불필요 → ollama 분기에서 생략한다.)
_REASONING_EFFORT = os.getenv("LLM_REASONING_EFFORT", "low")  # minimal | low | medium | high | "" (미전송)
_MIN_COMPLETION_TOKENS = 3000

_log = logging.getLogger("gamegoal.llm")


def _provider() -> str:
    """현재 LLM 프로바이더('github' | 'ollama'). 기본 github."""
    p = (os.getenv("LLM_PROVIDER") or "github").strip().lower()
    return "ollama" if p == "ollama" else "github"


def _is_ollama() -> bool:
    return _provider() == "ollama"


def provider_label() -> str:
    """meta 표시용 사람이 읽는 프로바이더 이름."""
    if _is_ollama():
        return f"ollama (local · {_config()['main']})"
    return "github-models"


def _token() -> str | None:
    return os.getenv("GITHUB_MODELS_TOKEN") or os.getenv("GITHUB_TOKEN")


def _config() -> dict[str, str | None]:
    if _is_ollama():
        # github용 LLM_MODEL_MAIN/MINI 와 섞이지 않게 OLLAMA_MODEL 로 분리.
        model = os.getenv("OLLAMA_MODEL", _OLLAMA_MODEL)
        return {
            "token": "ollama",  # openai SDK가 빈 api_key를 거부하므로 더미값.
            "endpoint": os.getenv("OLLAMA_ENDPOINT", _OLLAMA_ENDPOINT),
            "main": model,
            "mini": model,
        }
    return {
        "token": _token(),
        "endpoint": os.getenv("GITHUB_MODELS_ENDPOINT", _GITHUB_ENDPOINT),
        "main": os.getenv("LLM_MODEL_MAIN", _GITHUB_MAIN),
        "mini": os.getenv("LLM_MODEL_MINI", _GITHUB_MINI),
    }


def is_enabled() -> bool:
    """AI 호출 가능 설정인지. ollama=로컬 서버 가정으로 항상 True, github=토큰 존재 여부.

    (ollama 서버가 꺼져 있어도 True지만, 실제 호출은 try_ai 가 잡아 'API 호출 불가'로 폴백한다.)
    """
    if _is_ollama():
        return True
    return bool(_token())


def model_for(tier: str) -> str:
    c = _config()
    return c["mini"] if tier == "mini" else c["main"]


def model_tag(tier: str = "main") -> str:
    """ai_feedback 라벨용 짧은 모델 이름. 활성 프로바이더의 실제 모델을 반영한다.
    예: github → 'gpt-5' / 'gpt-5-mini', ollama → 'qwen2.5:7b-instruct'.
    """
    return model_for(tier).split("/", 1)[-1]


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
    kwargs: dict[str, Any] = {
        "model": model_for(tier),
        "messages": messages,
    }
    if _is_ollama():
        # Ollama(OpenAI 호환): max_tokens 사용, reasoning_effort 미지원, 추론 바닥값 불필요.
        kwargs["max_tokens"] = max_tokens
        # 로컬 소형 모델(qwen 7B 등)은 기본 temperature(~0.8)가 높아 한국어에 다른 언어
        # 토큰이 섞이고 문장이 깨진다. 낮춰서 일관성·언어 고정을 확보한다.
        kwargs["temperature"] = float(os.getenv("OLLAMA_TEMPERATURE", "0.3"))
    else:
        # gpt-5 계열: temperature 미전송(기본값), max_completion_tokens 사용.
        # 추론 토큰이 출력을 굶기지 않도록 충분한 바닥값을 보장한다.
        kwargs["max_completion_tokens"] = max(max_tokens, _MIN_COMPLETION_TOKENS)
        effort = reasoning_effort if reasoning_effort is not None else _REASONING_EFFORT
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
