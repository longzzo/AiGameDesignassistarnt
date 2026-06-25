import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { compareBuilds, solveBalance } from "../../api/client";
import { usePersistentState } from "../../hooks/usePersistentState";

// --- C. 빌드 비교 설정 ---
const DEFAULT_BUILDS = [
  { label: "광전사", base_attack: 140, growth_rate: 0.09, attacks_per_second: 1.2 },
  { label: "표준 검사", base_attack: 100, growth_rate: 0.08, attacks_per_second: 1.5 },
  { label: "단검 도적", base_attack: 55, growth_rate: 0.07, attacks_per_second: 3.0 },
];
const COMPARE_DEFAULTS = { level: 15, monster_hp: 3000, monster_def: 40 };

const VERDICT_COLOR = {
  OP: "bg-red-100 text-red-700",
  약함: "bg-amber-100 text-amber-700",
  균형: "bg-emerald-100 text-emerald-700",
};
const VERDICT_FILL = { OP: "#ef4444", 약함: "#f59e0b", 균형: "#10b981" };

// --- A. Goal-Seek 설정 (모듈별 지표/파라미터/기본 입력) ---
const SOLVE_CONFIG = {
  stat: {
    metrics: [
      { key: "late_ttk", label: "후반 TTK(초)", def: 3 },
      { key: "reduction_pct", label: "TTK 단축률(%)", def: 60 },
    ],
    params: [
      { key: "growth_rate", label: "성장률" },
      { key: "base_attack", label: "기본 공격력" },
      { key: "monster_hp", label: "몬스터 HP" },
    ],
    base: [
      { key: "base_attack", label: "기본 공격력", def: 100, step: 1 },
      { key: "growth_rate", label: "성장률", def: 0.08, step: 0.01 },
      { key: "attacks_per_second", label: "초당 공격", def: 1.5, step: 0.1 },
      { key: "monster_hp", label: "몬스터 HP", def: 1000, step: 50 },
      { key: "monster_def", label: "몬스터 DEF", def: 20, step: 1 },
      { key: "max_level", label: "최대 레벨", def: 20, step: 1 },
    ],
  },
  economy: {
    metrics: [
      { key: "warning_day", label: "인플레 경고일(일)", def: 60 },
      { key: "equilibrium_per_capita", label: "1인 균형 보유량", def: 5000 },
    ],
    params: [
      { key: "sink_rate", label: "소모율(%)" },
      { key: "daily_production", label: "1인 일일 생산" },
    ],
    base: [
      { key: "daily_production", label: "1인 일일 생산", def: 500, step: 10 },
      { key: "expected_dau", label: "예상 DAU", def: 1000, step: 100 },
      { key: "sink_rate", label: "소모율(%)", def: 12, step: 1 },
      { key: "initial_currency", label: "초기 유통량", def: 0, step: 100 },
      { key: "days", label: "시뮬 일수", def: 90, step: 10 },
    ],
  },
  gacha: {
    metrics: [
      { key: "pity_rate", label: "천장 사용률(%)", def: 25 },
      { key: "mean_pulls", label: "평균 뽑기 수", def: 60 },
    ],
    params: [
      { key: "base_rate", label: "기본 확률" },
      { key: "pity_count", label: "천장 횟수" },
    ],
    base: [
      { key: "base_rate", label: "기본 확률", def: 0.006, step: 0.001 },
      { key: "pity_count", label: "천장 횟수", def: 90, step: 1 },
      { key: "simulations", label: "시뮬 횟수", def: 2000, step: 500 },
    ],
  },
};
const MODULE_LABEL = { stat: "스탯 / TTK", economy: "경제", gacha: "가챠" };

function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export default function BalanceModule() {
  const [tab, setTab] = useState("solve");
  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1 text-sm font-medium">
        <button
          type="button"
          onClick={() => setTab("solve")}
          className={`flex-1 rounded-md px-3 py-1.5 ${tab === "solve" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
        >
          🎯 목표 역산 (Goal-Seek)
        </button>
        <button
          type="button"
          onClick={() => setTab("compare")}
          className={`flex-1 rounded-md px-3 py-1.5 ${tab === "compare" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
        >
          ⚖️ 빌드 비교
        </button>
      </div>
      {tab === "solve" ? <SolveTab /> : <CompareTab />}
    </div>
  );
}

// =========================== A. Goal-Seek ===========================
function SolveTab() {
  const [module, setModule] = usePersistentState("gg_solve_module", "stat");
  const [form, setForm] = usePersistentState("gg_solve_form", {});
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cfg = SOLVE_CONFIG[module];
  // 현재 모듈에 맞는 선택값(없으면 기본).
  const metricKey = form[`${module}_metric`] ?? cfg.metrics[0].key;
  const paramKey = form[`${module}_param`] ?? cfg.params[0].key;
  const target = form[`${module}_target`] ?? cfg.metrics.find((m) => m.key === metricKey)?.def ?? 0;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const baseVal = (b) => form[`${module}_${b.key}`] ?? b.def;

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const base_params = {};
      cfg.base.forEach((b) => {
        base_params[b.key] = num(baseVal(b), b.def);
      });
      const data = await solveBalance({
        module,
        target_metric: metricKey,
        target_value: num(target, 0),
        vary_param: paramKey,
        base_params,
      });
      setRes(data);
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  const metricLabel = cfg.metrics.find((m) => m.key === metricKey)?.label ?? metricKey;
  const paramLabel = cfg.params.find((p) => p.key === paramKey)?.label ?? paramKey;

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">
          목표 수치를 정하면 파라미터를 <b>역산</b>합니다. 예: “후반 TTK 3초”를 만드는 성장률을 자동으로 찾아줍니다.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">대상 모듈</span>
            <select
              value={module}
              onChange={(e) => { setModule(e.target.value); setRes(null); }}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {Object.keys(SOLVE_CONFIG).map((m) => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">목표 지표</span>
            <select
              value={metricKey}
              onChange={(e) => set(`${module}_metric`, e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {cfg.metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">목표값</span>
            <input
              type="number"
              value={target ?? ""}
              onChange={(e) => set(`${module}_target`, e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">역산할 파라미터</span>
            <select
              value={paramKey}
              onChange={(e) => set(`${module}_param`, e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {cfg.params.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "역산 중…" : "🎯 목표값 역산"}
          </button>
        </div>

        {/* 고정 입력값 */}
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-1.5 text-xs font-semibold text-slate-500">고정 입력값 (역산 파라미터는 자동으로 탐색됨)</p>
          <div className="flex flex-wrap gap-2">
            {cfg.base.map((b) => (
              <label key={b.key} className={`flex w-32 flex-col gap-0.5 ${b.key === paramKey ? "opacity-40" : ""}`}>
                <span className="text-[11px] text-slate-500">{b.label}{b.key === paramKey ? " (역산)" : ""}</span>
                <input
                  type="number"
                  step={b.step ?? 1}
                  disabled={b.key === paramKey}
                  value={baseVal(b) ?? ""}
                  onChange={(e) => set(`${module}_${b.key}`, e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
                />
              </label>
            ))}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
      </section>

      {res && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-xs text-slate-500">역산된 {paramLabel}</p>
              <p className="text-3xl font-bold text-indigo-700">{res.found_param}</p>
            </div>
            <div className="text-slate-300">→</div>
            <div>
              <p className="text-xs text-slate-500">{metricLabel} (목표 {res.target_value})</p>
              <p className="text-2xl font-semibold text-slate-700">{res.achieved_metric}</p>
            </div>
            <span className={`ml-auto rounded-full px-3 py-1 text-xs font-semibold ${res.success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
              {res.success ? "✅ 목표 도달" : "⚠ 범위 내 미도달"}
            </span>
          </div>

          <p className="mt-3 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">🤖 {res.ai_feedback}</p>

          <ul className="mt-3 space-y-1.5">
            {res.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-indigo-500">▸</span><span>{s}</span></li>
            ))}
          </ul>

          {res.trace?.length > 1 && (
            <div className="mt-4">
              <p className="mb-1 text-xs font-semibold text-slate-500">수렴 과정 ({res.trace.length}회 탐색)</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={res.trace} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="iter" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <ReferenceLine y={res.target_value} stroke="#10b981" strokeDasharray="5 4" label={{ value: "목표", fontSize: 11, fill: "#10b981" }} />
                    <Line type="monotone" dataKey="metric" name={metricLabel} stroke="#4f46e5" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// =========================== C. 빌드 비교 ===========================
function CompareTab() {
  const [builds, setBuilds] = usePersistentState("gg_compare_builds", DEFAULT_BUILDS);
  const [cfg, setCfg] = usePersistentState("gg_compare_cfg", COMPARE_DEFAULTS);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setBuild = (i, k, v) => setBuilds((bs) => bs.map((b, j) => (j === i ? { ...b, [k]: v } : b)));
  const addBuild = () => setBuilds((bs) => [...bs, { label: `빌드 ${bs.length + 1}`, base_attack: 100, growth_rate: 0.08, attacks_per_second: 1.5 }]);
  const removeBuild = (i) => setBuilds((bs) => (bs.length > 2 ? bs.filter((_, j) => j !== i) : bs));
  const setC = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await compareBuilds({
        level: num(cfg.level, 15),
        monster_hp: num(cfg.monster_hp, 3000),
        monster_def: num(cfg.monster_def, 40),
        builds: builds.map((b) => ({
          label: b.label || "빌드",
          base_attack: num(b.base_attack, 100),
          growth_rate: num(b.growth_rate, 0.08),
          attacks_per_second: num(b.attacks_per_second, 1.5),
        })),
      });
      setRes(data);
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">
          여러 무기/직업 빌드의 DPS·TTK를 같은 조건에서 비교하고 <b>OP·약캐를 자동 판정</b>합니다.
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="flex w-24 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">비교 레벨</span>
            <input type="number" value={cfg.level ?? 15} onChange={(e) => setC("level", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">몬스터 HP</span>
            <input type="number" value={cfg.monster_hp ?? 3000} onChange={(e) => setC("monster_hp", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="flex w-24 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">몬스터 DEF</span>
            <input type="number" value={cfg.monster_def ?? 40} onChange={(e) => setC("monster_def", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <button type="button" onClick={run} disabled={loading} className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "비교 중…" : "⚖️ 빌드 비교"}
          </button>
        </div>

        {/* 빌드 입력 */}
        <div className="space-y-1.5">
          <div className="flex gap-2 px-1 text-[11px] font-medium text-slate-400">
            <span className="w-32">이름</span>
            <span className="w-24">기본 공격력</span>
            <span className="w-24">성장률</span>
            <span className="w-24">초당 공격</span>
          </div>
          {builds.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={b.label ?? ""} onChange={(e) => setBuild(i, "label", e.target.value)} className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="number" value={b.base_attack ?? 100} onChange={(e) => setBuild(i, "base_attack", e.target.value)} className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="number" step={0.01} value={b.growth_rate ?? 0.08} onChange={(e) => setBuild(i, "growth_rate", e.target.value)} className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
              <input type="number" step={0.1} value={b.attacks_per_second ?? 1.5} onChange={(e) => setBuild(i, "attacks_per_second", e.target.value)} className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none" />
              <button type="button" onClick={() => removeBuild(i)} disabled={builds.length <= 2} className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30">×</button>
            </div>
          ))}
          <button type="button" onClick={addBuild} className="rounded-md border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50">＋ 빌드 추가</button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
      </section>

      {res && (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 text-sm text-indigo-900">🤖 {res.ai_feedback}</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1">빌드</th>
                  <th>공격력</th>
                  <th>DPS</th>
                  <th>TTK</th>
                  <th>중위 대비</th>
                  <th>판정</th>
                </tr>
              </thead>
              <tbody>
                {res.results.map((b, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold text-slate-700">{b.label}</td>
                    <td className="text-slate-500">{b.attack}</td>
                    <td className="font-medium text-slate-700">{b.dps}</td>
                    <td className="text-slate-500">{b.ttk}s</td>
                    <td className="text-slate-500">×{b.dps_index}</td>
                    <td><span className={`rounded px-2 py-0.5 text-xs font-semibold ${VERDICT_COLOR[b.verdict] || "bg-slate-100 text-slate-600"}`}>{b.verdict}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-700">DPS 비교 ({res.level}레벨 기준 · 점선=중위 {res.median_dps})</h2>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={res.results} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <ReferenceLine y={res.median_dps} stroke="#64748b" strokeDasharray="5 4" />
                  <Bar dataKey="dps" name="DPS">
                    {res.results.map((b, i) => <Cell key={i} fill={VERDICT_FILL[b.verdict] || "#6366f1"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
