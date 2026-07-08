import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { usePersistentState } from "../../hooks/usePersistentState";
import { designLoop } from "../../api/client";
import {
  EFFECT_STATS, MODE_LABEL, SOURCE_TYPES, uid,
  sanitizeConfig, trackCost, effectiveStats, dpsBreakdown, incomePerMin,
  upgradePreviews, simulateSession,
} from "../../lib/loopEngine";
import { LOOP_PRESETS } from "../../lib/loopPresets";

const fmt = (n) => {
  if (!Number.isFinite(n)) return "∞";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (a >= 1e4) return (n / 1e3).toFixed(1) + "k";
  return a >= 100 ? n.toFixed(0) : a >= 1 ? n.toFixed(1) : n.toFixed(2);
};
const fmtSec = (s) => {
  if (!Number.isFinite(s)) return "도달 불가";
  if (s < 60) return `${Math.ceil(s)}초`;
  if (s < 3600) return `${Math.floor(s / 60)}분 ${Math.ceil(s % 60)}초`;
  return `${(s / 3600).toFixed(1)}시간`;
};

const COMBAT_SLIDERS = [
  { k: "base_attack", label: "기본 공격력", min: 1, max: 500, step: 1 },
  { k: "attack_speed", label: "초당 공격", min: 0.2, max: 5, step: 0.1 },
  { k: "crit_chance", label: "치명타 확률", min: 0, max: 0.95, step: 0.01, pct: true },
  { k: "crit_mult", label: "치명타 배율", min: 1, max: 5, step: 0.1 },
  { k: "enemy_hp", label: "적 HP", min: 50, max: 20000, step: 50 },
  { k: "enemy_def", label: "적 DEF", min: 0, max: 300, step: 1 },
];

const LINE_COLORS = ["#f59e0b", "#10b981", "#ec4899", "#0ea5e9"];

export default function LoopModule() {
  const [cfg, setCfgRaw] = usePersistentState("gg_loop2_cfg", sanitizeConfig(LOOP_PRESETS["RPG 사냥 파밍"].config));
  const [priority, setPriority] = usePersistentState("gg_loop2_prio", []);
  const [sim, setSim] = usePersistentState("gg_loop2_sim", { minutes: 30, auto: true });
  const [preset, setPreset] = useState("RPG 사냥 파밍");
  const [desc, setDesc] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // 구조 변경은 항상 sanitize를 통과시켜 참조 무결성 유지(자원 삭제 시 보상/비용 재매핑 등).
  const setCfg = (updater) => setCfgRaw((c) => sanitizeConfig(typeof updater === "function" ? updater(c) : updater));

  const stats = useMemo(() => effectiveStats(cfg), [cfg]);
  const combat = useMemo(() => dpsBreakdown(cfg, stats), [cfg, stats]);
  const income = useMemo(() => incomePerMin(cfg, stats), [cfg, stats]);
  const previews = useMemo(() => upgradePreviews(cfg), [cfg]);
  const session = useMemo(
    () => simulateSession(cfg, Math.max(1, Number(sim.minutes) || 30), priority, sim.auto),
    [cfg, priority, sim]
  );
  const hasKill = cfg.sources.some((s) => s.type === "kill");
  const previewOf = (id) => previews.find((p) => p.id === id);

  // ── 설정 조작 ────────────────────────────────────────────────────────
  const applyPreset = () => {
    setCfg(sanitizeConfig(LOOP_PRESETS[preset].config));
    setPriority([]);
    setAiMsg(`프리셋 '${preset}' 적용됨 — ${LOOP_PRESETS[preset].hint}`);
  };
  const runAiDesign = async () => {
    if (!desc.trim()) { setAiMsg("⚠ 게임을 한 줄로 설명해 주세요 (예: 좀비 아포칼립스에서 기지를 지키는 타워디펜스)."); return; }
    setAiLoading(true); setAiMsg("");
    try {
      const r = await designLoop({ description: desc.trim(), genre: preset });
      if (r.config) { setCfg(sanitizeConfig(r.config)); setPriority([]); }
      setAiMsg(r.ai_feedback || "");
    } catch (e) { setAiMsg(`⚠ ${e?.message ?? "요청 실패"}`); }
    finally { setAiLoading(false); }
  };

  const setCombat = (k, v) => setCfgRaw((c) => ({ ...c, combat: { ...c.combat, [k]: Number(v) } }));

  // 자원
  const addResource = () => setCfg((c) => ({ ...c, resources: [...c.resources, { id: uid("res"), name: "새 자원", emoji: "🔶" }] }));
  const patchResource = (id, p) => setCfgRaw((c) => ({ ...c, resources: c.resources.map((r) => (r.id === id ? { ...r, ...p } : r)) }));
  const delResource = (id) => setCfg((c) => (c.resources.length <= 1 ? c : { ...c, resources: c.resources.filter((r) => r.id !== id) }));

  // 수익원
  const addSource = () => setCfg((c) => ({
    ...c,
    sources: [...c.sources, { id: uid("src"), name: "새 수익원", type: "kill", actions_per_min: 10, cycle_sec: 60, rewards: [{ resource: c.resources[0].id, amount: 5, chance: 1 }] }],
  }));
  const patchSource = (id, p) => setCfgRaw((c) => ({ ...c, sources: c.sources.map((s) => (s.id === id ? { ...s, ...p } : s)) }));
  const delSource = (id) => setCfgRaw((c) => ({ ...c, sources: c.sources.filter((s) => s.id !== id) }));
  const patchReward = (sid, i, p) => setCfgRaw((c) => ({
    ...c,
    sources: c.sources.map((s) => (s.id === sid ? { ...s, rewards: s.rewards.map((r, j) => (j === i ? { ...r, ...p } : r)) } : s)),
  }));
  const addReward = (sid) => setCfgRaw((c) => ({
    ...c,
    sources: c.sources.map((s) => (s.id === sid ? { ...s, rewards: [...s.rewards, { resource: c.resources[0].id, amount: 1, chance: 1 }] } : s)),
  }));
  const delReward = (sid, i) => setCfgRaw((c) => ({
    ...c,
    sources: c.sources.map((s) => (s.id === sid ? { ...s, rewards: s.rewards.filter((_, j) => j !== i) } : s)),
  }));

  // 강화 트랙
  const addTrack = () => setCfg((c) => ({
    ...c,
    tracks: [...c.tracks, { id: uid("trk"), name: "새 강화", effect: { stat: "attack", mode: "pct", value: 0.08 }, cost: { resource: c.resources[0].id, base: 50, growth: 1.15 }, level: 0 }],
  }));
  const patchTrack = (id, p) => setCfgRaw((c) => ({ ...c, tracks: c.tracks.map((t) => (t.id === id ? { ...t, ...p } : t)) }));
  const delTrack = (id) => { setCfgRaw((c) => ({ ...c, tracks: c.tracks.filter((t) => t.id !== id) })); setPriority((p) => p.filter((x) => x !== id)); };
  const resetLevels = () => setCfgRaw((c) => ({ ...c, tracks: c.tracks.map((t) => ({ ...t, level: 0 })) }));

  const prioList = [...priority.filter((id) => cfg.tracks.some((t) => t.id === id)),
                    ...cfg.tracks.filter((t) => !priority.includes(t.id)).map((t) => t.id)];
  const movePrio = (i, d) => {
    const next = [...prioList];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setPriority(next);
  };

  const resName = (id) => cfg.resources.find((r) => r.id === id)?.name ?? id;
  const resEmoji = (id) => cfg.resources.find((r) => r.id === id)?.emoji ?? "🔶";

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto">
      {/* ── 설계 바: 프리셋 + AI 초안 ── */}
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">장르 프리셋</span>
          <select value={preset} onChange={(e) => setPreset(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm">
            {Object.keys(LOOP_PRESETS).map((k) => <option key={k}>{k}</option>)}
          </select>
          <button type="button" onClick={applyPreset}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50">
            프리셋 불러오기
          </button>
          <span className="mx-1 hidden text-slate-200 sm:inline">|</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="예: 좀비 세계에서 생존자 기지를 키우는 방치형 디펜스"
            className="min-w-[220px] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
          <button type="button" onClick={runAiDesign} disabled={aiLoading}
            className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {aiLoading ? "설계 중…" : "🤖 AI 초안 설계"}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          AI는 <b>처음 설계만</b> 도와줍니다 — 자원·수익원·강화 트랙 초안을 만들어 주고, 이후 조정은 아래에서 실시간(0초)으로 계산돼요.
        </p>
        {aiMsg && <p className="mt-1 text-xs font-medium text-indigo-800">🤖 {aiMsg}</p>}
      </section>

      {/* ── 핵심 지표 카드 ── */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="DPS" value={fmt(combat.dps)} sub={`유효딜 ${fmt(combat.effective)} × ${stats.attack_speed.toFixed(1)}/s × 크리 ${combat.critFactor.toFixed(2)}`} />
        <Stat label="TTK (1마리)" value={`${combat.ttk.toFixed(2)}s`} sub={`처치 ${fmt(combat.killsPerMin)}/분`} />
        <Stat label="치명타" value={`${(stats.crit_chance * 100).toFixed(0)}% ×${stats.crit_mult.toFixed(1)}`} sub={`기여 +${((combat.critFactor - 1) * 100).toFixed(0)}%`} />
        {cfg.resources.slice(0, 3).map((r) => (
          <Stat key={r.id} accent label={`${r.emoji} ${r.name}/시간`}
            value={fmt((income.perResource[r.id] || 0) * 60)}
            sub={`분당 ${fmt(income.perResource[r.id] || 0)}`} />
        ))}
      </section>

      <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-3">
        {/* ── 좌: 전투 + 수익원 ── */}
        <section className="flex flex-col gap-3">
          {hasKill && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-700">⚔ 전투 스탯 (kill 수익원용)</h3>
              <div className="space-y-2">
                {COMBAT_SLIDERS.map((f) => (
                  <label key={f.k} className="flex flex-col gap-0.5">
                    <span className="flex justify-between text-xs font-medium text-slate-500">
                      <span>{f.label}</span>
                      <span className="text-slate-700">{f.pct ? `${(cfg.combat[f.k] * 100).toFixed(0)}%` : cfg.combat[f.k]}</span>
                    </span>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={cfg.combat[f.k]}
                      onChange={(e) => setCombat(f.k, e.target.value)} className="accent-indigo-600" />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* 자원 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">🪙 자원 종류</h3>
              <button type="button" onClick={addResource} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">＋ 자원</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cfg.resources.map((r) => (
                <span key={r.id} className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                  <input value={r.emoji} onChange={(e) => patchResource(r.id, { emoji: e.target.value })} className="w-7 bg-transparent text-center text-sm" />
                  <input value={r.name} onChange={(e) => patchResource(r.id, { name: e.target.value })} className="w-16 bg-transparent text-xs" />
                  {cfg.resources.length > 1 && (
                    <button type="button" onClick={() => delResource(r.id)} className="text-slate-400 hover:text-red-500">×</button>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* 수익원 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">📦 수익원 ({cfg.sources.length})</h3>
              <button type="button" onClick={addSource} className="rounded-md border border-indigo-300 px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">＋ 수익원</button>
            </div>
            <div className="space-y-2.5">
              {cfg.sources.map((s) => {
                const det = income.perSource.find((x) => x.id === s.id);
                return (
                  <div key={s.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <input value={s.name} onChange={(e) => patchSource(s.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm font-medium" />
                      <select value={s.type} onChange={(e) => patchSource(s.id, { type: e.target.value })}
                        className="rounded border border-slate-200 px-1.5 py-1 text-xs">
                        {SOURCE_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                      <button type="button" onClick={() => delSource(s.id)} className="px-1 text-slate-400 hover:text-red-500">×</button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {s.type === "action" && (
                        <label className="flex items-center gap-1">분당 행동
                          <input type="number" value={s.actions_per_min} onChange={(e) => patchSource(s.id, { actions_per_min: Number(e.target.value) })}
                            className="w-14 rounded border border-slate-200 px-1 py-0.5" /></label>
                      )}
                      {s.type === "cycle" && (
                        <label className="flex items-center gap-1">사이클(초)
                          <input type="number" value={s.cycle_sec} onChange={(e) => patchSource(s.id, { cycle_sec: Number(e.target.value) })}
                            className="w-16 rounded border border-slate-200 px-1 py-0.5" /></label>
                      )}
                      <span className="text-slate-400">→ {fmt(det?.eventsPerMin ?? 0)}회/분</span>
                      <span className="font-medium text-amber-600">
                        {Object.entries(det?.rewards ?? {}).map(([rid, v]) => `${resEmoji(rid)}${fmt(v)}/분`).join(" · ")}
                      </span>
                    </div>
                    {/* 보상 목록 */}
                    <div className="mt-1.5 space-y-1">
                      {s.rewards.map((rw, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs">
                          <select value={rw.resource} onChange={(e) => patchReward(s.id, i, { resource: e.target.value })}
                            className="rounded border border-slate-200 px-1 py-0.5">
                            {cfg.resources.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                          </select>
                          <label className="flex items-center gap-1 text-slate-400">수량
                            <input type="number" step="0.1" value={rw.amount} onChange={(e) => patchReward(s.id, i, { amount: Number(e.target.value) })}
                              className="w-16 rounded border border-slate-200 px-1 py-0.5 text-slate-700" /></label>
                          <label className="flex items-center gap-1 text-slate-400">확률
                            <input type="number" step="0.05" min="0" max="1" value={rw.chance} onChange={(e) => patchReward(s.id, i, { chance: Number(e.target.value) })}
                              className="w-14 rounded border border-slate-200 px-1 py-0.5 text-slate-700" /></label>
                          {s.rewards.length > 1 && (
                            <button type="button" onClick={() => delReward(s.id, i)} className="text-slate-300 hover:text-red-500">×</button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={() => addReward(s.id)} className="text-xs text-indigo-500 hover:underline">＋ 보상 추가</button>
                    </div>
                  </div>
                );
              })}
              {cfg.sources.length === 0 && <p className="text-xs text-slate-400">수익원이 없습니다 — '＋ 수익원'으로 추가하세요.</p>}
            </div>
          </div>
        </section>

        {/* ── 중: 강화 트랙 ── */}
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">🛠 강화 트랙 ({cfg.tracks.length})</h3>
              <div className="flex gap-1.5">
                <button type="button" onClick={resetLevels} title="모든 트랙 레벨 0으로" className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100">↺ 초기화</button>
                <button type="button" onClick={addTrack} className="rounded-md border border-indigo-300 px-2 py-0.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50">＋ 트랙 추가</button>
              </div>
            </div>
            <div className="space-y-2.5">
              {cfg.tracks.map((t) => {
                const pv = previewOf(t.id);
                const statMeta = EFFECT_STATS.find((e) => e.key === t.effect.stat);
                return (
                  <div key={t.id} className="rounded-lg border border-slate-200 p-2.5">
                    <div className="flex items-center gap-1.5">
                      <input value={t.name} onChange={(e) => patchTrack(t.id, { name: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-1 text-sm font-medium" />
                      <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-bold text-indigo-700">Lv.{t.level}</span>
                      <button type="button" onClick={() => delTrack(t.id)} className="px-1 text-slate-400 hover:text-red-500">×</button>
                    </div>
                    {/* 효과 */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <select value={t.effect.stat}
                        onChange={(e) => {
                          const st = EFFECT_STATS.find((x) => x.key === e.target.value);
                          patchTrack(t.id, { effect: { ...t.effect, stat: st.key, mode: st.modes.includes(t.effect.mode) ? t.effect.mode : st.modes[0] } });
                        }}
                        className="rounded border border-slate-200 px-1 py-0.5">
                        {EFFECT_STATS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                      </select>
                      <select value={t.effect.mode} onChange={(e) => patchTrack(t.id, { effect: { ...t.effect, mode: e.target.value } })}
                        className="rounded border border-slate-200 px-1 py-0.5">
                        {statMeta.modes.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}Lv</option>)}
                      </select>
                      <input type="number" step="0.01" value={t.effect.value}
                        onChange={(e) => patchTrack(t.id, { effect: { ...t.effect, value: Number(e.target.value) } })}
                        className="w-16 rounded border border-slate-200 px-1 py-0.5" />
                      {t.effect.mode === "pct" && <span className="text-slate-400">(레벨당 +{(t.effect.value * 100).toFixed(0)}%)</span>}
                    </div>
                    {/* 비용 공식 */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      비용:
                      <select value={t.cost.resource} onChange={(e) => patchTrack(t.id, { cost: { ...t.cost, resource: e.target.value } })}
                        className="rounded border border-slate-200 px-1 py-0.5">
                        {cfg.resources.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                      </select>
                      <input type="number" value={t.cost.base} onChange={(e) => patchTrack(t.id, { cost: { ...t.cost, base: Number(e.target.value) } })}
                        className="w-16 rounded border border-slate-200 px-1 py-0.5" />
                      ×
                      <input type="number" step="0.01" value={t.cost.growth} onChange={(e) => patchTrack(t.id, { cost: { ...t.cost, growth: Number(e.target.value) } })}
                        className="w-14 rounded border border-slate-200 px-1 py-0.5" />
                      ^Lv
                    </div>
                    {/* 미리보기 + 수동 강화 */}
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 border-t border-slate-100 pt-1.5 text-xs">
                      <span className="text-slate-500">
                        다음 {fmt(pv?.cost ?? 0)} {resEmoji(t.cost.resource)} ·
                        수익 <b className={pv?.gainPct >= 0 ? "text-emerald-600" : "text-red-500"}> {pv?.gainPct >= 0 ? "+" : ""}{(pv?.gainPct ?? 0).toFixed(1)}%</b>
                        {pv?.dpsGainPct > 0.01 && <> · DPS <b className="text-indigo-600">+{pv.dpsGainPct.toFixed(1)}%</b></>}
                        <span className="text-slate-400"> · {fmtSec(pv?.affordSec)}</span>
                      </span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => patchTrack(t.id, { level: Math.max(0, t.level - 1) })}
                          className="rounded border border-slate-200 px-1.5 py-0.5 text-slate-500 hover:bg-slate-100">−1</button>
                        <button type="button" onClick={() => patchTrack(t.id, { level: t.level + 1 })}
                          className="rounded bg-indigo-600 px-2 py-0.5 font-semibold text-white hover:bg-indigo-700">＋1 강화</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {cfg.tracks.length === 0 && <p className="text-xs text-slate-400">강화 트랙이 없습니다 — '＋ 트랙 추가'로 만드세요.</p>}
            </div>
          </div>
        </section>

        {/* ── 우: 세션 시뮬레이션 ── */}
        <section className="flex flex-col gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">📈 세션 시뮬 (누적 자원 · DPS)</h3>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <label className="flex items-center gap-1">
                  <input type="number" min={1} max={480} value={sim.minutes}
                    onChange={(e) => setSim((s) => ({ ...s, minutes: Number(e.target.value) }))}
                    className="w-14 rounded border border-slate-200 px-1 py-0.5" />분
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={sim.auto} onChange={(e) => setSim((s) => ({ ...s, auto: e.target.checked }))} />
                  자동 강화
                </label>
              </div>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={session.samples} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="min" tick={{ fontSize: 10 }} unit="분" />
                  <YAxis yAxisId="res" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                  <YAxis yAxisId="dps" orientation="right" tick={{ fontSize: 10 }} tickFormatter={fmt} />
                  <Tooltip formatter={(v) => fmt(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {cfg.resources.slice(0, 3).map((r, i) => (
                    <Line key={r.id} yAxisId="res" type="monotone" dataKey={r.id} name={`누적 ${r.name}`}
                      stroke={LINE_COLORS[i]} dot={false} strokeWidth={2} />
                  ))}
                  {hasKill && <Line yAxisId="dps" type="monotone" dataKey="dps" name="DPS" stroke="#6366f1" strokeDasharray="5 3" dot={false} strokeWidth={2} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* 자동 강화 우선순위 */}
            {sim.auto && cfg.tracks.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-2">
                <p className="mb-1 text-xs font-medium text-slate-500">자동 구매 우선순위 (위부터)</p>
                <div className="space-y-1">
                  {prioList.map((id, i) => {
                    const t = cfg.tracks.find((x) => x.id === id);
                    if (!t) return null;
                    return (
                      <div key={id} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                        <span>{i + 1}. {t.name}</span>
                        <span className="flex items-center gap-1">
                          <span className="text-slate-400">×{session.purchases[id] ?? 0}회 구매</span>
                          <button type="button" onClick={() => movePrio(i, -1)} disabled={i === 0} className="px-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30">↑</button>
                          <button type="button" onClick={() => movePrio(i, 1)} disabled={i === prioList.length - 1} className="px-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30">↓</button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 세션 요약 */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm text-slate-700">
            <h3 className="mb-2 text-sm font-semibold text-indigo-900">📊 {sim.minutes}분 세션 요약</h3>
            <ul className="space-y-1">
              {cfg.resources.map((r) => (
                <li key={r.id}>
                  {r.emoji} {r.name}: 총 <b>{fmt(session.totals[r.id])}</b>
                  <span className="text-slate-500"> · 시간당 {fmt((session.income0[r.id] || 0) * 60)} → <b className="text-emerald-700">{fmt((session.incomeEnd[r.id] || 0) * 60)}</b></span>
                </li>
              ))}
              {hasKill && (
                <li>⚔ DPS {fmt(session.dps0)} → <b className="text-indigo-700">{fmt(session.dpsEnd)}</b>
                  <span className="text-slate-500"> · TTK {session.ttk0.toFixed(2)}s → {session.ttkEnd.toFixed(2)}s</span>
                </li>
              )}
              <li className="text-xs text-slate-500">
                구매: {cfg.tracks.map((t) => `${t.name} ×${session.purchases[t.id] ?? 0}`).join(" · ") || "없음"}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl border p-2.5 shadow-sm ${accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-base font-bold ${accent ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-400" title={sub}>{sub}</p>}
    </div>
  );
}
