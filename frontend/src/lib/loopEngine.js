// 마스터 코어루프 엔진 — 장르 불문 범용 수익/성장 루프 계산기.
// 모든 것이 데이터다:
//   자원(resources)  : 골드·젬·목재… 사용자가 자유롭게 추가
//   수익원(sources)  : kill(전투 처치) | idle(초당 자동) | action(행동 반복) | cycle(런/웨이브 주기)
//   강화(tracks)     : 어떤 스탯이든 올릴 수 있는 트랙을 무제한 추가 (효과 + 비용공식 분리)
// 전투 DPS/TTK 공식은 기존 스탯/밸런스 모듈과 동일:
//   attack → effective = max(attack - def, 1) → dps = eff × aps × (1 + crit%×(critMult-1)) → ttk = hp/dps

let _seq = 0;
export const uid = (p = "id") => `${p}${++_seq}_${Math.random().toString(36).slice(2, 6)}`;

// 강화 효과가 올릴 수 있는 스탯 목록 (UI 셀렉트에 그대로 사용)
export const EFFECT_STATS = [
  { key: "attack",       label: "공격력",           modes: ["add", "pct"] },
  { key: "attack_speed", label: "공격 속도",         modes: ["add", "pct"] },
  { key: "crit_chance",  label: "치명타 확률(+%p)",  modes: ["add"] },
  { key: "crit_mult",    label: "치명타 배율",       modes: ["add"] },
  { key: "drop_chance",  label: "드랍 확률(배수)",   modes: ["pct"] },
  { key: "drop_value",   label: "전리품 가치(배수)", modes: ["pct"] },
  { key: "idle_rate",    label: "자동 생산량(배수)", modes: ["pct"] },
  { key: "action_rate",  label: "행동 속도(배수)",   modes: ["pct"] },
  { key: "cycle_speed",  label: "사이클 속도(배수)", modes: ["pct"] },
  { key: "income",       label: "모든 수익(배수)",   modes: ["pct"] },
];
export const MODE_LABEL = { add: "+고정", pct: "+%/" };

export const SOURCE_TYPES = [
  { key: "kill",   label: "⚔ 전투 처치", hint: "DPS·TTK로 분당 처치 수를 계산" },
  { key: "idle",   label: "🕐 자동 생산", hint: "초당 자동으로 자원 획득 (방치형)" },
  { key: "action", label: "👆 행동 반복", hint: "분당 N회 행동(퀘스트·채집·탭)" },
  { key: "cycle",  label: "🔄 런/웨이브", hint: "한 사이클(런·웨이브·던전) 클리어마다 보상" },
];

export const CRIT_CAP = 0.95;

// ── 기본 설정 골격 ──────────────────────────────────────────────────────
export function emptyConfig() {
  return {
    resources: [{ id: "gold", name: "골드", emoji: "🪙" }],
    combat: { base_attack: 20, attack_speed: 1.2, crit_chance: 0.1, crit_mult: 1.8, enemy_hp: 500, enemy_def: 10 },
    sources: [],
    tracks: [],
  };
}

// AI/프리셋/저장본에서 온 설정을 안전하게 보정(누락 채움·타입 강제).
export function sanitizeConfig(raw) {
  const base = emptyConfig();
  if (!raw || typeof raw !== "object") return base;
  const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

  const resources = (Array.isArray(raw.resources) && raw.resources.length ? raw.resources : base.resources)
    .slice(0, 6)
    .map((r, i) => ({
      id: String(r?.id || r?.name || `res${i}`).slice(0, 24),
      name: String(r?.name || r?.id || `자원${i + 1}`).slice(0, 20),
      emoji: String(r?.emoji || "🪙").slice(0, 4),
    }));
  const resIds = new Set(resources.map((r) => r.id));
  const firstRes = resources[0].id;

  const combat = {
    base_attack: num(raw.combat?.base_attack, 20),
    attack_speed: num(raw.combat?.attack_speed, 1.2),
    crit_chance: Math.min(CRIT_CAP, Math.max(0, num(raw.combat?.crit_chance, 0.1))),
    crit_mult: Math.max(1, num(raw.combat?.crit_mult, 1.8)),
    enemy_hp: Math.max(1, num(raw.combat?.enemy_hp, 500)),
    enemy_def: Math.max(0, num(raw.combat?.enemy_def, 10)),
  };

  const sources = (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 8).map((s, i) => ({
    id: String(s?.id || uid("src")),
    name: String(s?.name || `수익원${i + 1}`).slice(0, 24),
    type: ["kill", "idle", "action", "cycle"].includes(s?.type) ? s.type : "kill",
    actions_per_min: Math.max(0, num(s?.actions_per_min, 10)),
    cycle_sec: Math.max(1, num(s?.cycle_sec, 60)),
    rewards: (Array.isArray(s?.rewards) && s.rewards.length ? s.rewards : [{ resource: firstRes, amount: 5, chance: 1 }])
      .slice(0, 4)
      .map((rw) => ({
        resource: resIds.has(rw?.resource) ? rw.resource : firstRes,
        amount: Math.max(0, num(rw?.amount, 1)),
        chance: Math.min(1, Math.max(0, num(rw?.chance, 1))),
      })),
  }));

  const statKeys = new Set(EFFECT_STATS.map((e) => e.key));
  const tracks = (Array.isArray(raw.tracks) ? raw.tracks : []).slice(0, 12).map((t, i) => {
    const stat = statKeys.has(t?.effect?.stat) ? t.effect.stat : "attack";
    const allowed = EFFECT_STATS.find((e) => e.key === stat).modes;
    const mode = allowed.includes(t?.effect?.mode) ? t.effect.mode : allowed[0];
    return {
      id: String(t?.id || uid("trk")),
      name: String(t?.name || `강화${i + 1}`).slice(0, 24),
      effect: { stat, mode, value: Math.max(0, num(t?.effect?.value, mode === "pct" ? 0.1 : 5)) },
      cost: {
        resource: resIds.has(t?.cost?.resource) ? t.cost.resource : firstRes,
        base: Math.max(0.01, num(t?.cost?.base, 50)),
        growth: Math.max(1, num(t?.cost?.growth, 1.15)),
      },
      level: Math.max(0, Math.floor(num(t?.level, 0))),
    };
  });

  return { resources, combat, sources, tracks };
}

export const trackCost = (t, level = t.level) => t.cost.base * Math.pow(t.cost.growth, level);

// ── 유효 스탯 계산 (기본값 + 모든 트랙 효과 합성) ────────────────────────
export function effectiveStats(cfg) {
  const s = {
    attack: cfg.combat.base_attack,
    attack_speed: cfg.combat.attack_speed,
    crit_chance: cfg.combat.crit_chance,
    crit_mult: cfg.combat.crit_mult,
    drop_chance: 1, drop_value: 1, idle_rate: 1, action_rate: 1, cycle_speed: 1, income: 1,
  };
  for (const t of cfg.tracks) {
    if (t.level <= 0) continue;
    const { stat, mode, value } = t.effect;
    if (mode === "add") s[stat] += value * t.level;
    else s[stat] *= 1 + value * t.level; // pct: 레벨당 +value(비율) 복리 아님, 단리 배수
  }
  s.crit_chance = Math.min(CRIT_CAP, s.crit_chance);
  s.crit_mult = Math.max(1, s.crit_mult);
  return s;
}

// ── DPS 분해 (전투 수익원용) ────────────────────────────────────────────
export function dpsBreakdown(cfg, stats = effectiveStats(cfg)) {
  const effective = Math.max(stats.attack - cfg.combat.enemy_def, 1);
  const baseDps = effective * stats.attack_speed;
  const critFactor = 1 + stats.crit_chance * (stats.crit_mult - 1);
  const dps = baseDps * critFactor;
  const ttk = cfg.combat.enemy_hp / Math.max(dps, 0.0001);
  return {
    attack: stats.attack, effective, attack_speed: stats.attack_speed,
    baseDps, critChance: stats.crit_chance, critMult: stats.crit_mult, critFactor,
    dps, ttk, killsPerMin: 60 / Math.max(ttk, 0.0001),
  };
}

// ── 수익 계산: 자원별 분당 수익 + 수익원별 상세 ─────────────────────────
export function incomePerMin(cfg, stats = effectiveStats(cfg)) {
  const perResource = Object.fromEntries(cfg.resources.map((r) => [r.id, 0]));
  const perSource = [];
  const combat = dpsBreakdown(cfg, stats);

  for (const src of cfg.sources) {
    let eventsPerMin = 0;
    if (src.type === "kill") eventsPerMin = combat.killsPerMin;
    else if (src.type === "idle") eventsPerMin = 60 * stats.idle_rate; // 초당 1이벤트 기준 × 배수
    else if (src.type === "action") eventsPerMin = src.actions_per_min * stats.action_rate;
    else if (src.type === "cycle") eventsPerMin = 60 / Math.max(src.cycle_sec / stats.cycle_speed, 0.5);

    const detail = { id: src.id, name: src.name, type: src.type, eventsPerMin, rewards: {} };
    for (const rw of src.rewards) {
      const chance = Math.min(1, rw.chance * (src.type === "kill" ? stats.drop_chance : 1));
      const amount = rw.amount * (src.type === "kill" ? stats.drop_value : 1);
      const gain = eventsPerMin * chance * amount * stats.income;
      detail.rewards[rw.resource] = (detail.rewards[rw.resource] || 0) + gain;
      if (rw.resource in perResource) perResource[rw.resource] += gain;
    }
    perSource.push(detail);
  }
  return { perResource, perSource, combat };
}

// ── 강화 미리보기: 다음 1레벨의 비용·수익 개선율·도달 시간 ───────────────
export function upgradePreviews(cfg) {
  const now = incomePerMin(cfg);
  return cfg.tracks.map((t) => {
    const cost = trackCost(t);
    const next = {
      ...cfg,
      tracks: cfg.tracks.map((x) => (x.id === t.id ? { ...x, level: x.level + 1 } : x)),
    };
    const after = incomePerMin(next);
    const resId = t.cost.resource;
    const nowRate = now.perResource[resId] || 0;
    const totalNow = Object.values(now.perResource).reduce((a, b) => a + b, 0);
    const totalAfter = Object.values(after.perResource).reduce((a, b) => a + b, 0);
    const gainPct = totalNow > 0 ? (totalAfter / totalNow - 1) * 100 : 0;
    const dpsGainPct = now.combat.dps > 0 ? (after.combat.dps / now.combat.dps - 1) * 100 : 0;
    return {
      id: t.id, cost, gainPct, dpsGainPct,
      affordSec: nowRate > 0 ? (cost / nowRate) * 60 : Infinity,
    };
  });
}

// ── 세션 시뮬레이션: T분 동안 1초 틱, 자동 강화(우선순위) ────────────────
export function simulateSession(cfg0, minutes, priority, autoBuy) {
  const cfg = { ...cfg0, tracks: cfg0.tracks.map((t) => ({ ...t })) };
  const totalSec = Math.max(10, Math.round(minutes * 60));
  const sampleEvery = Math.max(1, Math.floor(totalSec / 200));
  const wallet = Object.fromEntries(cfg.resources.map((r) => [r.id, 0]));
  const totals = Object.fromEntries(cfg.resources.map((r) => [r.id, 0]));
  const purchases = Object.fromEntries(cfg.tracks.map((t) => [t.id, 0]));

  let inc = incomePerMin(cfg);
  const income0 = { ...inc.perResource };
  const dps0 = inc.combat.dps, ttk0 = inc.combat.ttk;
  const order = [...priority.filter((id) => cfg.tracks.some((t) => t.id === id)),
                 ...cfg.tracks.filter((t) => !priority.includes(t.id)).map((t) => t.id)];
  const samples = [];

  for (let sec = 1; sec <= totalSec; sec++) {
    for (const r of cfg.resources) {
      const g = (inc.perResource[r.id] || 0) / 60;
      wallet[r.id] += g; totals[r.id] += g;
    }
    if (autoBuy) {
      let again = true;
      while (again) {
        again = false;
        for (const id of order) {
          const t = cfg.tracks.find((x) => x.id === id);
          const c = trackCost(t);
          if (wallet[t.cost.resource] >= c) {
            wallet[t.cost.resource] -= c;
            t.level += 1; purchases[id] += 1;
            inc = incomePerMin(cfg); // 스탯 변동 시에만 재계산
            again = true; break;
          }
        }
      }
    }
    if (sec % sampleEvery === 0 || sec === totalSec) {
      samples.push({
        min: Math.round((sec / 60) * 10) / 10,
        dps: Math.round(inc.combat.dps * 10) / 10,
        ttk: Math.round(inc.combat.ttk * 100) / 100,
        ...Object.fromEntries(cfg.resources.map((r) => [r.id, Math.round(totals[r.id])])),
      });
    }
  }
  return {
    samples, purchases, wallet, totals,
    income0, incomeEnd: { ...inc.perResource },
    dps0, dpsEnd: inc.combat.dps, ttk0, ttkEnd: inc.combat.ttk,
    finalTracks: cfg.tracks,
  };
}
