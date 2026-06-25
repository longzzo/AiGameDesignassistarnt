"""월드 바이블 일관성 검증 라우터.

규칙 기반 검사는 토큰 없이도 항상 동작하고(중복 이름·미정의 참조·퀘스트 의존성·
타임라인), 의미적 모순(플롯 홀·톤 불일치)은 GitHub Models(gpt-5)로 추가 검출한다.
"""
from __future__ import annotations

import json

from fastapi import APIRouter

from api.v1.schemas.lore import (
    LoreEntry,
    LoreIssue,
    LoreValidateRequest,
    LoreValidateResponse,
)
from api.v1.services import llm

router = APIRouter(prefix="/lore", tags=["lore"])


def _rule_checks(entries: list[LoreEntry]) -> list[LoreIssue]:
    issues: list[LoreIssue] = []
    ids = {e.id for e in entries}
    names = {e.name for e in entries}
    by_key = {e.id: e for e in entries}
    by_name = {e.name: e for e in entries}

    def known(ref: str) -> bool:
        return ref in ids or ref in names

    # 1) 중복 이름(같은 type 내 동일 name).
    seen: dict[tuple[str, str], list[str]] = {}
    for e in entries:
        seen.setdefault((e.type, e.name), []).append(e.id)
    for (etype, name), id_list in seen.items():
        if len(id_list) > 1:
            issues.append(LoreIssue(
                severity="medium", type="duplicate_name",
                message=f"{etype} '{name}'가 {len(id_list)}번 중복 정의됨.",
                related=id_list,
            ))

    # 2) 미정의 참조.
    for e in entries:
        for ref in e.refs:
            if not known(ref):
                issues.append(LoreIssue(
                    severity="high", type="undefined_ref",
                    message=f"'{e.name}'가 존재하지 않는 '{ref}'를 참조합니다.",
                    related=[e.id, ref],
                ))

    # 3) 퀘스트 선행 의존성 + 4) 순환 의존성.
    quests = [e for e in entries if e.type == "quest"]
    quest_ids = {q.id for q in quests} | {q.name for q in quests}
    # name/id → quest id 정규화
    norm = {}
    for q in quests:
        norm[q.id] = q.id
        norm[q.name] = q.id
    graph: dict[str, list[str]] = {q.id: [] for q in quests}
    for q in quests:
        for dep in q.requires:
            if dep not in quest_ids:
                issues.append(LoreIssue(
                    severity="high", type="quest_missing_dep",
                    message=f"퀘스트 '{q.name}'의 선행 '{dep}'를 찾을 수 없습니다.",
                    related=[q.id, dep],
                ))
            else:
                graph[q.id].append(norm[dep])

    # 순환 탐지(DFS).
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {q.id: WHITE for q in quests}

    def dfs(node: str, path: list[str]) -> bool:
        color[node] = GRAY
        for nxt in graph.get(node, []):
            if color.get(nxt) == GRAY:
                cyc = path[path.index(nxt):] + [nxt] if nxt in path else [node, nxt]
                issues.append(LoreIssue(
                    severity="high", type="quest_cycle",
                    message="퀘스트 선행 관계에 순환이 있습니다: " + " → ".join(by_key[i].name if i in by_key else i for i in cyc),
                    related=cyc,
                ))
                return True
            if color.get(nxt) == WHITE and dfs(nxt, path + [nxt]):
                return True
        color[node] = BLACK
        return False

    for q in quests:
        if color[q.id] == WHITE:
            dfs(q.id, [q.id])

    # 5) 타임라인: event order 중복.
    events = [e for e in entries if e.type == "event" and e.order is not None]
    order_seen: dict[int, list[str]] = {}
    for e in events:
        order_seen.setdefault(e.order, []).append(e.id)
    for order, id_list in order_seen.items():
        if len(id_list) > 1:
            issues.append(LoreIssue(
                severity="low", type="timeline",
                message=f"타임라인 순서 {order}에 사건이 {len(id_list)}개 겹칩니다.",
                related=id_list,
            ))

    return issues


def _llm_issues(payload: LoreValidateRequest) -> list[LoreIssue]:
    system = (
        "당신은 게임 내러티브 감수자입니다. 월드 바이블 엔트리들을 보고 규칙으로는 잡기 어려운 "
        "'의미적 모순'을 찾습니다. 설정 충돌, 플롯 홀, 캐릭터 동기 모순, 톤 불일치 등. "
        "각 이슈는 severity(high/medium/low), message, related(관련 name 배열)를 포함합니다."
    )
    user = (
        json.dumps(
            {
                "world_setting": payload.world_setting,
                "entries": [e.model_dump() for e in payload.entries],
            },
            ensure_ascii=False,
        )
        + '\n\n다음 JSON으로만 출력: {"issues": [{"severity": "", "message": "", "related": []}]}'
    )
    data = llm.chat_json(system, user, tier="main", max_tokens=2000)
    return [
        LoreIssue(
            severity=i.get("severity", "medium"),
            type="semantic",
            message="🟢 " + i.get("message", ""),
            related=i.get("related", []),
        )
        for i in data.get("issues", [])
    ]


@router.post("/validate", response_model=LoreValidateResponse)
def validate(payload: LoreValidateRequest) -> LoreValidateResponse:
    # 규칙 기반 일관성 검사는 결정론으로 항상 수행한다(option A: 계산 유지).
    rule_issues = _rule_checks(payload.entries)
    # 의미적 모순(플롯 홀·톤)은 gpt-5가 검사하는 부분 → 호출 불가 시 검사하지 않고 안내만 한다.
    ai_issues = llm.try_ai(lambda: _llm_issues(payload))
    semantic_done = ai_issues is not None
    issues = rule_issues + (ai_issues or [])

    highs = sum(1 for i in issues if i.severity == "high")
    if not issues:
        summary = f"엔트리 {len(payload.entries)}개 검증 — 규칙 충돌이 발견되지 않았습니다."
    else:
        summary = f"엔트리 {len(payload.entries)}개에서 이슈 {len(issues)}건(심각 {highs}건) 발견."

    if semantic_done:
        feedback = "규칙 + AI 의미 검증 완료(플롯 홀·톤 포함)."
    else:
        feedback = f"규칙 기반 검증 완료. AI 의미 검증: {llm.UNAVAILABLE_MSG}"
    return LoreValidateResponse(issues=issues, summary=summary, ai_feedback=feedback)
