import { useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { designLevel } from "../../api/client";
import { usePersistentState } from "../../hooks/usePersistentState";

const JUMP_COLOR = {
  급상승: "bg-red-100 text-red-700",
  급강하: "bg-sky-100 text-sky-700",
  적정: "bg-slate-100 text-slate-500",
};

const DEFAULTS = {
  level_type: "탐험",
  duration_min: 12,
  mechanics: "",
  curve: "상승",
};
const TYPES = ["튜토리얼", "탐험", "보스"];
const CURVES = ["완만", "상승", "스파이크"];

const KIND_COLOR = {
  적: "bg-red-100 text-red-700",
  퍼즐: "bg-amber-100 text-amber-700",
  이벤트: "bg-sky-100 text-sky-700",
  보스: "bg-purple-100 text-purple-700",
  보상: "bg-emerald-100 text-emerald-700",
};

export default function LevelModule() {
  const [form, setForm] = usePersistentState("gg_level_form2", DEFAULTS);
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(
        await designLevel({
          level_type: form.level_type,
          duration_min: Number(form.duration_min) || 10,
          mechanics: form.mechanics.split(",").map((s) => s.trim()).filter(Boolean),
          curve: form.curve,
        })
      );
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">레벨 유형</span>
            <select value={form.level_type} onChange={(e) => set("level_type", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">길이(분)</span>
            <input type="number" min={1} value={form.duration_min} onChange={(e) => set("duration_min", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">사용 메커니즘 (쉼표)</span>
            <input value={form.mechanics} onChange={(e) => set("mechanics", e.target.value)} placeholder="예: 이동, 전투, 퍼즐, 은신" className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">목표 난이도 곡선</span>
            <select value={form.curve} onChange={(e) => set("curve", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              {CURVES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" onClick={run} disabled={loading} className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "설계 중…" : "레벨 설계"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
        {res && <p className="mt-2 text-sm text-indigo-900">🤖 {res.ai_feedback}</p>}
      </section>

      {!res ? (
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400">
          레벨 유형·길이·메커니즘·난이도 곡선을 정하고 '레벨 설계'를 누르면 비트 시트와 페이싱 곡선이 생성됩니다.
        </div>
      ) : (
        <>
          {/* 인텐시티(페이싱) 곡선 + 권장 곡선 오버레이 */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-700">페이싱(긴장도) 곡선</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  res.max_jump >= 25 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                }`}
                title="인접 구간 간 가장 큰 난이도 상승폭. 25 이상이면 급경사로 봅니다."
              >
                최대 난이도 점프 +{res.max_jump}
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={res.intensity_curve.map((p, i) => ({
                    t_pct: p.t_pct,
                    intensity: p.intensity,
                    recommended: res.recommended_curve?.[i]?.intensity ?? null,
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="ig" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t_pct" unit="%" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="intensity" name="실제 긴장도" stroke="#4f46e5" strokeWidth={2} fill="url(#ig)" />
                  <Line type="monotone" dataKey="recommended" name="권장(완화) 곡선" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* 구간 간 난이도 점프 진단 */}
            {res.difficulty_jumps?.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-1.5 text-xs font-semibold text-slate-500">구간 난이도 변화 (Δ긴장도)</p>
                <div className="flex flex-wrap gap-1.5">
                  {res.difficulty_jumps.map((j, i) => (
                    <span
                      key={i}
                      className={`rounded px-2 py-0.5 text-xs font-medium ${JUMP_COLOR[j.severity] || "bg-slate-100 text-slate-500"}`}
                      title={j.severity}
                    >
                      {j.from_phase}→{j.to_phase} {j.delta >= 0 ? "+" : ""}{j.delta}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* 비트 시트 */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">비트 시트</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">페이즈</th>
                    <th>구간</th>
                    <th>강도</th>
                    <th>가이드</th>
                  </tr>
                </thead>
                <tbody>
                  {res.beats.map((b) => (
                    <tr key={b.phase} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 font-semibold text-slate-700">{b.phase}</td>
                      <td className="text-slate-500">{b.start_pct}–{b.end_pct}%</td>
                      <td>
                        <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">{b.intensity}</span>
                      </td>
                      <td className="text-xs text-slate-600">{b.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* 인카운터 + 비평 */}
            <section className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-slate-700">인카운터 배치</h2>
                <ul className="space-y-2.5">
                  {res.encounters.map((e, i) => (
                    <li key={i} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-xs text-slate-400">{e.at_pct}%</span>
                        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${KIND_COLOR[e.kind] || "bg-slate-100 text-slate-600"}`}>{e.kind}</span>
                        <span className="text-slate-600">{e.detail}</span>
                      </div>
                      {(e.enemies || e.setup) && (
                        <div className="ml-12 mt-1 space-y-0.5 text-xs text-slate-500">
                          {e.enemies && <p><span className="text-slate-400">👾 구성</span> {e.enemies}</p>}
                          {e.setup && <p><span className="text-slate-400">📍 배치</span> {e.setup}</p>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <h2 className="mb-2 text-sm font-semibold text-indigo-900">🎯 레벨 디자인 비평</h2>
                <ul className="space-y-1.5">
                  {res.critique.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-indigo-500">▸</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
