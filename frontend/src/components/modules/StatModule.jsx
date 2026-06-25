import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { simulateDpsTtk } from "../../api/client";
import CaptureFindingButton from "../CaptureFindingButton";
import CoachPanel from "../CoachPanel";

const FIELDS = [
  { key: "base_attack", label: "기본 공격력", step: 1 },
  { key: "growth_rate", label: "성장률(/Lv)", step: 0.01 },
  { key: "attacks_per_second", label: "초당 공격", step: 0.1 },
  { key: "monster_hp", label: "몬스터 HP", step: 10 },
  { key: "monster_def", label: "몬스터 DEF", step: 1 },
  { key: "max_level", label: "최대 레벨", step: 1 },
];

const DEFAULTS = {
  base_attack: 100,
  growth_rate: 0.08,
  attacks_per_second: 1.5,
  monster_hp: 1000,
  monster_def: 20,
  max_level: 20,
};

export default function StatModule({ seed, onCaptureFinding }) {
  const [form, setForm] = useState(() => (seed ? { ...DEFAULTS, ...seed } : DEFAULTS));
  const [data, setData] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // A/B 곡선 비교
  const [compare, setCompare] = useState(false);
  const [formB, setFormB] = useState({ ...DEFAULTS, growth_rate: 0.06 });

  const update = (k, v) => setForm((f) => ({ ...f, [k]: Number(v) }));
  const updateB = (k, v) => setFormB((f) => ({ ...f, [k]: Number(v) }));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await simulateDpsTtk(form);
      let merged = res.chart_data;
      if (compare) {
        const resB = await simulateDpsTtk(formB);
        const bByLevel = Object.fromEntries(
          resB.chart_data.map((d) => [d.level, d.ttk])
        );
        merged = res.chart_data.map((d) => ({ ...d, ttk_b: bByLevel[d.level] }));
      }
      setData(merged);
      setFeedback(res.ai_feedback);
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  // 기획서(GDD)에서 제안 밸런스값을 들고 넘어온 경우 자동 검증.
  useEffect(() => {
    if (seed) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 상단: 1열 긴 가로형 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {FIELDS.map((f) => (
            <label key={f.key} className="flex min-w-[110px] flex-1 flex-col gap-1">
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
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 shrink-0 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "계산 중…" : "시뮬레이션 실행"}
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          B안 비교 (대안 파라미터를 같은 차트에 겹쳐 봄)
        </label>
        {compare && (
          <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg bg-amber-50 p-3">
            <span className="self-center text-xs font-semibold text-amber-700">B안</span>
            {FIELDS.map((f) => (
              <label key={f.key} className="flex min-w-[90px] flex-1 flex-col gap-1">
                <span className="text-[11px] text-slate-500">{f.label}</span>
                <input
                  type="number"
                  step={f.step}
                  value={formB[f.key]}
                  onChange={(e) => updateB(f.key, e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-amber-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
        )}

        {feedback && (
          <div className="mt-3 flex items-start gap-2">
            <p className="flex-1 rounded-md bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
              🤖 {feedback}
            </p>
            <CaptureFindingButton note={feedback} onCapture={onCaptureFinding} label="스탯" />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">⚠ {error}</p>}
      </section>

      {/* 하단: 화면 너비를 꽉 채우는 꺾은선 그래프 */}
      <section className="min-h-0 flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">
          레벨별 TTK (Time-To-Kill) 곡선
        </h2>
        <div className="h-[calc(100%-2rem)] w-full">
          {data.length === 0 ? (
            <Placeholder text="시뮬레이션을 실행하면 레벨별 TTK 곡선이 표시됩니다." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="level" label={{ value: "Lv", position: "insideBottomRight", offset: -4 }} />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="ttk" name="TTK A(초)" stroke="#dc2626" strokeWidth={2} dot={false} />
                {compare && (
                  <Line yAxisId="left" type="monotone" dataKey="ttk_b" name="TTK B(초)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                )}
                <Line yAxisId="right" type="monotone" dataKey="dps" name="DPS A" stroke="#4f46e5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {data.length > 0 && (
        <CoachPanel module="stat" inputs={form} summary={feedback} />
      )}
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
