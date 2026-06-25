import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { runMonteCarlo } from "../../api/client";
import CaptureFindingButton from "../CaptureFindingButton";
import CoachPanel from "../CoachPanel";

const DEFAULTS = { base_rate: 0.006, pity_count: 90, simulations: 10000, fifty_fifty: false };

const FIELDS = [
  { key: "base_rate", label: "기본 확률 (0~1)", step: 0.001 },
  { key: "pity_count", label: "천장 횟수", step: 1 },
  { key: "simulations", label: "시뮬레이션 횟수", step: 1000 },
];

export default function GachaModule({ seed, onCaptureFinding }) {
  const [form, setForm] = useState(() => (seed ? { ...DEFAULTS, ...seed } : DEFAULTS));
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: Number(v) }));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(await runMonteCarlo(form));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  // 기획서(GDD)에서 제안 가챠값을 들고 넘어온 경우 자동 검증.
  useEffect(() => {
    if (seed) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = res
    ? [
        { label: "평균", value: `${res.mean_pulls}회` },
        { label: "중위값", value: `${res.median_pulls}회` },
        { label: "상위 25%", value: `${res.p25_pulls}회` },
        { label: "상위 75%", value: `${res.p75_pulls}회` },
        { label: "상위 90%", value: `${res.p90_pulls}회` },
        { label: "천장 도달률", value: `${res.pity_hit_rate}%` },
      ]
    : [];

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-10">
      {/* 좌측 3 : 입력 폼 */}
      <section className="lg:col-span-3 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">시뮬레이션 설정</h2>
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">{f.label}</span>
            <input
              type="number"
              step={f.step}
              value={form[f.key]}
              onChange={(e) => update(f.key, e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.fifty_fifty}
            onChange={(e) => setForm((f) => ({ ...f, fifty_fifty: e.target.checked }))}
            className="h-4 w-4 rounded border-slate-300"
          />
          50/50 천장 (원신식 픽업)
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-auto h-10 rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "시뮬레이션 중…" : "몬테카를로 실행"}
        </button>
        {error && <p className="text-sm text-red-600">⚠ {error}</p>}
      </section>

      {/* 우측 7 : 통계 텍스트 + 히스토그램 */}
      <section className="lg:col-span-7 flex min-h-0 flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {stats.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-400">통계</p>
                  <p className="text-lg font-bold text-slate-300">—</p>
                </div>
              ))
            : stats.map((s) => (
                <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <p className="text-xs text-slate-500">{s.label}</p>
                  <p className="text-lg font-bold text-slate-800">{s.value}</p>
                </div>
              ))}
        </div>

        <div className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">획득 횟수 분포 (히스토그램)</h2>
          <div className="h-[calc(100%-2rem)] w-full">
            {!res ? (
              <Placeholder text="실행하면 첫 획득까지 걸린 횟수의 분포가 표시됩니다." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={res.distribution} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="유저 수" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {res?.ai_feedback && (
          <div className="flex items-start gap-2">
            <p className="flex-1 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">🤖 {res.ai_feedback}</p>
            <CaptureFindingButton note={res.ai_feedback} onCapture={onCaptureFinding} label="가챠" />
          </div>
        )}
        {res && <CoachPanel module="gacha" inputs={form} summary={res.ai_feedback} />}
      </section>
    </div>
  );
}

function Placeholder({ text }) {
  return (
    <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-sm text-slate-400">
      {text}
    </div>
  );
}
