import { useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { usePersistentState } from "../../hooks/usePersistentState";
import { combatSnapshot, upgradePreview, simulateSession } from "../../lib/loopSim";

const DEFAULTS = {
  // 전투
  base_attack: 20, atk_level: 0, growth_rate: 0.08, attacks_per_second: 1.2,
  monster_hp: 500, monster_def: 10,
  // 전리품 → 판매
  loot_chance: 0.6, loot_value: 8, sell_multiplier: 1.0, gold_level: 0,
  // 확률/치명타
  crit_chance: 0.15, crit_mult: 1.8, crit_level: 0,
  // 강화 비용 공식: cost(level) = base * growth^level
  atk_cost_base: 50, atk_cost_growth: 1.15,
  gold_cost_base: 80, gold_cost_growth: 1.18,
  crit_cost_base: 100, crit_cost_growth: 1.2,
  // 세션 시뮬레이션
  session_loops: 100, auto_buy: true,
};

const SLIDER_GROUPS = [
  {
    title: "⚔ 전투(킬 1회)", fields: [
      { k: "base_attack", label: "기본 공격력", min: 1, max: 200, step: 1 },
      { k: "growth_rate", label: "강화당 성장률", min: 0.01, max: 0.3, step: 0.01, pct: true },
      { k: "attacks_per_second", label: "초당 공격", min: 0.2, max: 5, step: 0.1 },
      { k: "monster_hp", label: "몬스터 HP", min: 50, max: 5000, step: 10 },
      { k: "monster_def", label: "몬스터 DEF", min: 0, max: 200, step: 1 },
    ],
  },
  {
    title: "💰 전리품 → 판매", fields: [
      { k: "loot_chance", label: "킬당 드랍 확률", min: 0, max: 1, step: 0.05, pct: true },
      { k: "loot_value", label: "아이템 평균 판매가", min: 1, max: 200, step: 1 },
      { k: "sell_multiplier", label: "상점 판매 배율", min: 0.2, max: 2, step: 0.05 },
    ],
  },
  {
    title: "🎲 확률/치명타", fields: [
      { k: "crit_chance", label: "기본 치명타 확률", min: 0, max: 0.9, step: 0.01, pct: true },
      { k: "crit_mult", label: "치명타 배율", min: 1, max: 5, step: 0.1 },
    ],
  },
];

const COST_FIELDS = [
  { group: "atk", label: "⚔ 공격력 강화 비용", base: "atk_cost_base", growth: "atk_cost_growth" },
  { group: "gold", label: "💰 골드 획득량 강화 비용", base: "gold_cost_base", growth: "gold_cost_growth" },
  { group: "crit", label: "🎲 확률/치명타 강화 비용", base: "crit_cost_base", growth: "crit_cost_growth" },
];

export default function LoopModule() {
  const [p, setP] = usePersistentState("gg_loop_params", DEFAULTS);
  const [priority, setPriority] = usePersistentState("gg_loop_priority", ["atk", "gold", "crit"]);
  const set = (k, v) => setP((f) => ({ ...f, [k]: Number(v) }));
  const setBool = (k, v) => setP((f) => ({ ...f, [k]: v }));

  // 슬라이더가 바뀔 때마다 즉시 재계산(순수 수식이라 디바운스 불필요).
  const snap = useMemo(() => combatSnapshot(p), [p]);
  const previews = useMemo(() => upgradePreview(p), [p]);
  const session = useMemo(
    () => simulateSession(p, Math.max(1, Number(p.session_loops) || 1), priority, p.auto_buy),
    [p, priority]
  );

  const buyOne = (track) => {
    setP((f) => ({ ...f, [`${track}_level`]: f[`${track}_level`] + 1 }));
  };

  const movePriority = (idx, dir) => {
    setPriority((arr) => {
      const next = [...arr];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  const TRACK_LABEL = { atk: "⚔ 공격력", gold: "💰 골드 획득량", crit: "🎲 확률/치명타" };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* 상단: 현재 순간 스탯 요약 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="공격력" value={snap.attack.toFixed(1)} />
        <Stat label="DPS" value={snap.dps.toFixed(1)} />
        <Stat label="TTK" value={`${snap.ttk.toFixed(2)}s`} />
        <Stat label="치명타 확률" value={`${(snap.critChance * 100).toFixed(0)}%`} />
        <Stat label="킬당 골드" value={snap.goldPerKill.toFixed(1)} accent />
        <Stat label="골드/분" value={snap.goldPerMinute.toFixed(0)} accent />
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 좌: 슬라이더 패널 */}
        <section className="flex flex-col gap-4 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
          {SLIDER_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">{g.title}</h3>
              <div className="space-y-2.5">
                {g.fields.map((f) => (
                  <label key={f.k} className="flex flex-col gap-1">
                    <span className="flex justify-between text-xs font-medium text-slate-500">
                      <span>{f.label}</span>
                      <span className="text-slate-700">{f.pct ? `${(p[f.k] * 100).toFixed(0)}%` : p[f.k]}</span>
                    </span>
                    <input type="range" min={f.min} max={f.max} step={f.step} value={p[f.k]}
                      onChange={(e) => set(f.k, e.target.value)} className="accent-indigo-600" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* 중: 강화 트랙 카드 */}
        <section className="flex flex-col gap-3 overflow-auto lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">🛠 강화 트랙 · 다음 단계 미리보기</h3>
            <div className="space-y-3">
              {previews.map((t) => (
                <div key={t.key} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">{t.label} <span className="text-xs font-normal text-slate-400">Lv.{t.level}</span></span>
                    <button type="button" onClick={() => buyOne(t.key)}
                      className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700">
                      +1강화 ({t.cost.toFixed(0)}G)
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span>골드/분 <span className={t.gainPct >= 0 ? "text-emerald-600" : "text-red-500"}>{t.gainPct >= 0 ? "+" : ""}{t.gainPct.toFixed(1)}%</span></span>
                    <span>구매까지 <span className="font-semibold text-slate-700">{Number.isFinite(t.loopsToAfford) ? `${t.loopsToAfford}킬` : "—"}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 강화 비용 공식 편집 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">📐 강화 비용 공식 (base × growth^level)</h3>
            <div className="space-y-2.5">
              {COST_FIELDS.map((c) => (
                <div key={c.group} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-xs text-slate-500">{c.label}</span>
                  <input type="number" value={p[c.base]} onChange={(e) => set(c.base, e.target.value)}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" title="기본 비용" />
                  <span className="text-xs text-slate-300">×</span>
                  <input type="number" step={0.01} value={p[c.growth]} onChange={(e) => set(c.growth, e.target.value)}
                    className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" title="레벨당 배율" />
                  <span className="text-xs text-slate-300">^Lv</span>
                </div>
              ))}
            </div>
          </div>

          {/* 자동 강화 우선순위 */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">🔁 세션 자동 강화</h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                <input type="checkbox" checked={p.auto_buy} onChange={(e) => setBool("auto_buy", e.target.checked)} />
                켜짐
              </label>
            </div>
            <p className="mb-1.5 text-xs text-slate-400">우선순위(위쪽부터 구매)</p>
            <div className="space-y-1">
              {priority.map((k, i) => (
                <div key={k} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs">
                  <span>{i + 1}. {TRACK_LABEL[k]}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => movePriority(i, -1)} disabled={i === 0} className="text-slate-400 hover:text-indigo-600 disabled:opacity-30">↑</button>
                    <button type="button" onClick={() => movePriority(i, 1)} disabled={i === priority.length - 1} className="text-slate-400 hover:text-indigo-600 disabled:opacity-30">↓</button>
                  </div>
                </div>
              ))}
            </div>
            <label className="mt-3 flex items-center justify-between text-xs font-medium text-slate-500">
              세션 반복 횟수(킬)
              <input type="number" min={1} max={2000} value={p.session_loops} onChange={(e) => set("session_loops", e.target.value)}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-xs" />
            </label>
          </div>
        </section>

        {/* 우: 세션 진행 곡선 + 요약 */}
        <section className="flex min-h-0 flex-col gap-3 lg:col-span-1">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold text-slate-700">📈 세션 진행 ({p.session_loops}킬)</h3>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={session.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="loop" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="gold" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="ttk" orientation="right" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="gold" type="monotone" dataKey="gold" name="누적 골드" stroke="#f59e0b" dot={false} strokeWidth={2} />
                  <Line yAxisId="ttk" type="monotone" dataKey="ttk" name="TTK(초)" stroke="#6366f1" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <h3 className="mb-2 text-sm font-semibold text-indigo-900">📊 세션 요약</h3>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>총 획득 골드: <b>{session.totalGold.toFixed(0)}</b> (미사용 {session.wallet.toFixed(0)})</li>
              <li>총 소요 시간: <b>{session.elapsed.toFixed(1)}초</b></li>
              <li>TTK 단축률: <b className="text-emerald-700">{session.ttkReductionPct.toFixed(1)}%</b></li>
              <li>강화 횟수: ⚔{session.bought.atk} · 💰{session.bought.gold} · 🎲{session.bought.crit}</li>
              <li>최종 강화 단계: ⚔Lv{session.final.atk_level} · 💰Lv{session.final.gold_level} · 🎲Lv{session.final.crit_level}</li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`rounded-xl border p-3 shadow-sm ${accent ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${accent ? "text-amber-700" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
