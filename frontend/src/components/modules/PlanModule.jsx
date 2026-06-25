import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { makePlan, genFeatures } from "../../api/client";
import { usePersistentState } from "../../hooks/usePersistentState";

const DEFAULTS = {
  period_weeks: 6,
  roles: [
    { role: "기획", count: 1 },
    { role: "개발", count: 2 },
    { role: "아트", count: 1 },
    { role: "QA", count: 1 },
  ],
  features: "스탯 시뮬레이터\n경제 추적기\n가챠 검증\n에셋 파이프라인",
  start_date: "",
  desc: "",
};

const PHASE_COLOR = {
  셋업: "bg-slate-100 text-slate-600",
  설계: "bg-sky-100 text-sky-700",
  아트: "bg-pink-100 text-pink-700",
  개발: "bg-indigo-100 text-indigo-700",
  테스트: "bg-amber-100 text-amber-700",
  통합: "bg-purple-100 text-purple-700",
  QA: "bg-rose-100 text-rose-700",
  출시: "bg-emerald-100 text-emerald-700",
};
const PRIO = { 높음: "bg-red-100 text-red-700", 중간: "bg-amber-100 text-amber-700", 낮음: "bg-slate-100 text-slate-500" };
const ROLE_COLOR = { 기획: "#0ea5e9", 개발: "#6366f1", 아트: "#ec4899", QA: "#f59e0b" };
const ROLE_BADGE = { 기획: "bg-sky-100 text-sky-700", 개발: "bg-indigo-100 text-indigo-700", 아트: "bg-pink-100 text-pink-700", QA: "bg-amber-100 text-amber-700" };
const roleColor = (r) => ROLE_COLOR[r] || "#64748b";
const roleBadge = (r) => ROLE_BADGE[r] || "bg-slate-100 text-slate-600";

const csvEscape = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export default function PlanModule() {
  const [form, setForm] = usePersistentState("gg_plan_form", DEFAULTS);
  const [res, setRes] = useState(null);
  const [tab, setTab] = useState("wbs");
  const [loading, setLoading] = useState(false);
  const [featLoading, setFeatLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const roles = form.roles || DEFAULTS.roles;
  const setRole = (i, patch) => set("roles", roles.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRole = () => set("roles", [...roles, { role: "", count: 1 }]);
  const delRole = (i) => set("roles", roles.filter((_, idx) => idx !== i));

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(
        await makePlan({
          period_weeks: Number(form.period_weeks) || 1,
          roles: roles.filter((r) => r.role.trim()).map((r) => ({ role: r.role.trim(), count: Number(r.count) || 0 })),
          features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
          start_date: form.start_date || null,
        })
      );
      setTab("wbs");
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  const generateFeatures = async () => {
    if (!form.desc.trim()) {
      setError("기능을 생성할 한 줄 설명을 입력하세요.");
      return;
    }
    setFeatLoading(true);
    setError("");
    try {
      const r = await genFeatures({ description: form.desc.trim(), count: 8 });
      set("features", r.features.join("\n"));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setFeatLoading(false);
    }
  };

  // WBS → Trello CSV (작업=카드, List=주차, Labels=페이즈/역할).
  const exportCsv = () => {
    if (!res) return;
    const idToName = Object.fromEntries(res.wbs.map((t) => [t.id, t.name]));
    const header = ["List", "Title", "Description", "Labels", "Role", "Estimate(days)", "DependsOn", "Week"];
    const rows = res.wbs.map((t) => {
      const deps = (t.depends_on || []).map((d) => idToName[d] || d);
      const desc = `${t.phase} 단계 · ${t.role} · 산정 ${t.estimate_days}인일` + (deps.length ? ` · 선행: ${deps.join(", ")}` : "");
      return [`W${t.week}`, t.name, desc, `${t.phase};${t.role}`, t.role, t.estimate_days, deps.join("; "), t.week];
    });
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "wbs-trello.csv";
    a.click();
  };

  const chartData = res
    ? res.schedule.map((w) => ({ week: w.week, capacity: w.capacity_days, ...w.role_load }))
    : [];
  const chartRoles = res ? res.role_totals.map((rt) => rt.role) : [];

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex w-24 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">기간(주)</span>
            <input type="number" min={1} value={form.period_weeks ?? 6} onChange={(e) => set("period_weeks", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <label className="flex w-40 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">시작일 (선택)</span>
            <input type="date" value={form.start_date ?? ""} onChange={(e) => set("start_date", e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          {/* 역할 구성 */}
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">역할 구성 (역할 · 인원)</span>
            <div className="flex flex-wrap items-center gap-2">
              {roles.map((r, i) => (
                <div key={i} className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: roleColor(r.role) }} />
                  <input value={r.role ?? ""} onChange={(e) => setRole(i, { role: e.target.value })} className="w-16 bg-transparent text-xs focus:outline-none" />
                  <input type="number" min={0} value={r.count ?? 1} onChange={(e) => setRole(i, { count: e.target.value })} className="w-10 rounded border border-slate-200 px-1 text-xs" />
                  <button type="button" onClick={() => delRole(i)} className="text-slate-400 hover:text-red-500">×</button>
                </div>
              ))}
              <button type="button" onClick={addRole} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">＋ 역할</button>
            </div>
          </div>
        </div>

        {/* 기능 목록 + 자동 생성 */}
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">기능 목록 (한 줄에 하나)</span>
            <textarea rows={3} value={form.features ?? ""} onChange={(e) => set("features", e.target.value)} className="resize-none rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex w-72 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">✨ 설명으로 기능 자동 생성</span>
            <input value={form.desc ?? ""} onChange={(e) => set("desc", e.target.value)} placeholder="예: 슬라임 캐릭터 소셜 디덕션 술래잡기" className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
            <button type="button" onClick={generateFeatures} disabled={featLoading} className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">
              {featLoading ? "생성 중…" : "✨ 기능 목록 생성"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={run} disabled={loading} className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "생성 중…" : "로드맵 생성"}
          </button>
          {error && <p className="text-sm text-red-600">⚠ {error}</p>}
          {res && (
            <p className="text-sm text-indigo-900">🤖 {res.ai_feedback} (총 {res.total_days}/{res.capacity_days}인일)</p>
          )}
        </div>
      </section>

      {!res ? (
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-center text-sm text-slate-400">
          역할·기간·기능 목록을 넣고 '로드맵 생성'을 누르면 역할별 WBS·주차 일정·기능명세서가 만들어집니다.
        </div>
      ) : (
        <>
          {/* 역할별 요약 */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {res.role_totals.map((rt) => {
              const over = rt.days > rt.capacity && rt.capacity > 0;
              return (
                <div key={rt.role} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: roleColor(rt.role) }} />
                    <span className="text-sm font-semibold text-slate-700">{rt.role}</span>
                  </div>
                  <p className={`mt-1 text-lg font-bold ${over ? "text-red-600" : "text-slate-800"}`}>
                    {rt.days}<span className="text-xs font-normal text-slate-400"> / {rt.capacity}인일</span>
                  </p>
                </div>
              );
            })}
          </section>

          {(res.warnings.length > 0 || res.advice.length > 0) && (
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
                <h3 className="mb-1.5 text-sm font-semibold text-indigo-900">📌 PM 조언</h3>
                <ul className="space-y-1">
                  {res.advice.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-slate-700"><span className="text-indigo-500">▸</span><span>{a}</span></li>
                  ))}
                </ul>
              </div>
              {res.warnings.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <h3 className="mb-1.5 text-sm font-semibold text-red-800">⚠ 경고 ({res.warnings.length})</h3>
                  <ul className="max-h-28 space-y-1 overflow-auto">
                    {res.warnings.map((w, i) => (<li key={i} className="text-xs text-red-700">{w}</li>))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Tab active={tab === "wbs"} onClick={() => setTab("wbs")}>WBS</Tab>
              <Tab active={tab === "schedule"} onClick={() => setTab("schedule")}>주차별 일정</Tab>
              <Tab active={tab === "specs"} onClick={() => setTab("specs")}>기능명세서</Tab>
            </div>
            <button type="button" onClick={exportCsv} title="WBS를 Trello 임포트용 CSV로 내보냅니다" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              📄 CSV 내보내기 (Trello)
            </button>
          </div>

          {tab === "wbs" && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">페이즈</th>
                    <th>역할</th>
                    <th>작업</th>
                    <th>공수</th>
                    <th>주차</th>
                  </tr>
                </thead>
                <tbody>
                  {res.wbs.map((t) => (
                    <tr key={t.id} className="border-t border-slate-100">
                      <td className="py-1.5"><span className={`rounded px-2 py-0.5 text-xs font-medium ${PHASE_COLOR[t.phase] || "bg-slate-100"}`}>{t.phase}</span></td>
                      <td><span className={`rounded px-2 py-0.5 text-xs font-medium ${roleBadge(t.role)}`}>{t.role}</span></td>
                      <td className="text-slate-700">{t.name}</td>
                      <td className="text-slate-500">{t.estimate_days}일</td>
                      <td className="font-semibold text-indigo-600">W{t.week}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {tab === "schedule" && (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-sm font-semibold text-slate-700">주차별 역할 공수 (누적, 가용 대비)</h3>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="week" tickFormatter={(w) => `W${w}`} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <ReferenceLine y={chartData[0]?.capacity} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "가용", position: "right", fontSize: 11, fill: "#ef4444" }} />
                      {chartRoles.map((r) => (
                        <Bar key={r} dataKey={r} stackId="a" name={r} fill={roleColor(r)} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {res.schedule.map((w) => (
                  <div key={w.week} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">W{w.week}</span>
                      <span className={`text-xs ${w.planned_days > w.capacity_days ? "text-red-600" : "text-slate-400"}`}>{w.planned_days}/{w.capacity_days}인일</span>
                    </div>
                    {Object.keys(w.role_load).length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {Object.entries(w.role_load).map(([r, d]) => (
                          <span key={r} className={`rounded px-1.5 py-0.5 text-[11px] ${roleBadge(r)}`}>{r} {d}</span>
                        ))}
                      </div>
                    )}
                    {w.tasks.length === 0 ? (
                      <p className="text-xs text-slate-300">(여유 / 버퍼)</p>
                    ) : (
                      <ul className="space-y-0.5">{w.tasks.map((t, i) => (<li key={i} className="text-xs text-slate-600">• {t}</li>))}</ul>
                    )}
                  </div>
                ))}
              </section>
            </>
          )}

          {tab === "specs" && (
            <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {res.specs.map((s) => (
                <div key={s.feature} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-800">{s.feature}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIO[s.priority] || PRIO.중간}`}>{s.priority}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{s.overview}</p>
                  <p className="mt-2 text-xs text-slate-500">입력: {s.inputs} · 출력: {s.outputs}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">수용 기준</p>
                  <ul className="mt-1 space-y-0.5">
                    {s.acceptance.map((a, i) => (<li key={i} className="flex gap-1.5 text-xs text-slate-600"><span className="text-emerald-500">✓</span><span>{a}</span></li>))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
        active ? "border-indigo-300 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
