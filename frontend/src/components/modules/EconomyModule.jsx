import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { trackInflation } from "../../api/client";
import CaptureFindingButton from "../CaptureFindingButton";
import CoachPanel from "../CoachPanel";

const DEFAULTS = {
  initial_currency: 1000000,
  daily_production: 500,
  sink_rate: 12,
  expected_dau: 10000,
  days: 90,
};

const FIELDS = [
  { key: "initial_currency", label: "초기 재화" },
  { key: "daily_production", label: "1인 일일 생산량" },
  { key: "sink_rate", label: "소모율(%)" },
  { key: "expected_dau", label: "예상 DAU" },
  { key: "days", label: "시뮬 일수" },
];

const fmt = (n) =>
  n == null ? "—" : Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function EconomyModule({ seed, onCaptureFinding }) {
  const [form, setForm] = useState(() => (seed ? { ...DEFAULTS, ...seed } : DEFAULTS));
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (k, v) => setForm((f) => ({ ...f, [k]: Number(v) }));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(await trackInflation(form));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  // 기획서(GDD)에서 제안 경제값을 들고 넘어온 경우 자동 검증.
  useEffect(() => {
    if (seed) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const last = res?.chart_data?.[res.chart_data.length - 1];
  const cards = [
    { label: "현재 유통량(마지막일)", value: fmt(last?.total_currency) },
    { label: "이론적 균형 유통량", value: fmt(res?.equilibrium_currency) },
    { label: "1인당 보유 재화", value: fmt(last?.per_capita) },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 입력 폼 (가로형) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex min-w-[120px] flex-1 flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">{f.label}</span>
              <input
                type="number"
                value={form[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 shrink-0 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "추적 중…" : "인플레이션 추적"}
          </button>
        </div>
      </section>

      {/* 상단: 3개 요약 카드 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{c.value}</p>
          </div>
        ))}
      </section>

      {/* 중앙: 누적 막대 차트 */}
      <section className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">일자별 누적 유통량 / 생산·소모</h2>
        <div className="h-[calc(100%-2rem)] w-full">
          {!res ? (
            <Placeholder text="추적을 실행하면 일자별 재화 흐름이 표시됩니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={res.chart_data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="faucet" name="생산(Faucet)" stackId="flow" fill="#22c55e" />
                <Bar dataKey="sink" name="소모(Sink)" stackId="flow" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* 하단: 붉은색 경고 배너 */}
      {res?.inflation_warning_day != null ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          🚨 <strong>{res.inflation_warning_day}일차 인플레이션 경고</strong> — {res.ai_feedback}
        </div>
      ) : res ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ {res.ai_feedback}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
          경고 배너 영역 — 인플레이션 위험 감지 시 이곳에 경고가 표시됩니다.
        </div>
      )}
      {res && (
        <div className="flex justify-end">
          <CaptureFindingButton note={res.ai_feedback} onCapture={onCaptureFinding} label="경제" />
        </div>
      )}
      {res && <CoachPanel module="economy" inputs={form} summary={res.ai_feedback} />}
      {error && <p className="text-sm text-red-600">⚠ {error}</p>}
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
