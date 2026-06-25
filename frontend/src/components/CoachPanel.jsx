import { useState } from "react";
import { getCoachSuggestions } from "../api/client";

// 시뮬레이터 결과를 AI 밸런스 코치에 보내 구체적 수치 튜닝안을 받는 패널.
export default function CoachPanel({ module, inputs, summary }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(await getCoachSuggestions({ module, inputs, summary: summary || "" }));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-indigo-900">🤖 AI 밸런스 코치</span>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "분석 중…" : "튜닝안 받기"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
      {res && (
        <div className="mt-3">
          <ul className="space-y-1.5">
            {res.suggestions.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                <span className="text-indigo-500">▸</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
          {res.rationale && (
            <p className="mt-2 text-xs text-slate-500">{res.rationale}</p>
          )}
          <p className="mt-2 text-xs text-indigo-700">{res.ai_feedback}</p>
        </div>
      )}
    </section>
  );
}
