import { useState } from "react";
import { recommendIdeation } from "../../api/client";

// 프로젝트의 진행 예시(슬라임/소셜 디덕션 파티)와 결을 맞춘 기본값.
const DEFAULTS = {
  world: "",
  keywords: "슬라임, 소셜 디덕션, 술래잡기, 시야 제한, 파티",
  seedGenre: "탑다운 액션 파티 게임",
  count: 3,
};

function scoreColor(score) {
  if (score >= 80) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-indigo-100 text-indigo-700";
  return "bg-slate-100 text-slate-500";
}

export default function IdeationModule({ onBuildGdd }) {
  const [world, setWorld] = useState(DEFAULTS.world);
  const [keywords, setKeywords] = useState(DEFAULTS.keywords);
  const [seedGenre, setSeedGenre] = useState(DEFAULTS.seedGenre);
  const [count, setCount] = useState(DEFAULTS.count);
  const [recs, setRecs] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = {
        world_setting: world.trim() || null,
        keywords: keywords.split(",").map((s) => s.trim()).filter(Boolean),
        seed_genre: seedGenre.trim() || null,
        count: Number(count),
      };
      const res = await recommendIdeation(payload);
      setRecs(res.recommendations);
      setFeedback(res.ai_feedback);
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 상단: 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <label className="flex flex-col gap-1 md:col-span-5">
            <span className="text-xs font-medium text-slate-500">
              세계관 (Lore) <span className="text-slate-400">· 선택</span>
            </span>
            <input
              value={world}
              placeholder="예: 귀여운 슬라임들이 사는 컬러풀한 파티 월드"
              onChange={(e) => setWorld(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-4">
            <span className="text-xs font-medium text-slate-500">키워드 (쉼표 구분)</span>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-500">
              시드 장르 <span className="text-slate-400">· 선택</span>
            </span>
            <input
              value={seedGenre}
              onChange={(e) => setSeedGenre(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-1">
            <span className="text-xs font-medium text-slate-500">개수</span>
            <input
              type="number"
              min={1}
              max={8}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "발상 중…" : "장르 추천 받기"}
          </button>
          {feedback && <p className="text-sm text-indigo-900">🤖 {feedback}</p>}
          {error && <p className="text-sm text-red-600">⚠ {error}</p>}
        </div>
      </section>

      {/* 하단: 추천 카드 그리드 */}
      <section className="min-h-0 flex-1 overflow-auto">
        {recs.length === 0 ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-sm text-slate-400">
            세계관/키워드를 입력하고 '장르 추천 받기'를 누르면 어울리는 장르 후보가 카드로 제안됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {recs.map((r) => (
              <article
                key={r.genre}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <header className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-800">{r.genre}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${scoreColor(r.fit_score)}`}>
                    적합도 {r.fit_score}
                  </span>
                </header>
                <p className="mt-1 text-sm text-slate-600">{r.tagline}</p>

                {r.matched_keywords?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.matched_keywords.map((k) => (
                      <span key={k} className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                        #{k}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-3 text-xs leading-relaxed text-slate-500">{r.rationale}</p>

                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-700">핵심 기능 제안</p>
                  <ul className="mt-1 space-y-1">
                    {r.core_features.map((f) => (
                      <li key={f} className="flex gap-1.5 text-xs text-slate-600">
                        <span className="text-indigo-400">▸</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {r.reference_games.map((g) => (
                    <span key={g} className="rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-500">
                      {g}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    onBuildGdd?.({
                      genre: r.genre,
                      world_setting: world.trim() || null,
                      core_mechanics: r.core_features,
                      references: r.reference_games,
                    })
                  }
                  className="mt-4 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  이 장르로 기획서 만들기 →
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
