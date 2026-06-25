import { useState } from "react";
import { loreTranslate } from "../../api/client";
import { usePersistentState } from "../../hooks/usePersistentState";

const SAMPLE = {
  item_001: { name: "Rusty Sword", desc: "A basic blade for novice adventurers." },
  item_002: { name: "Health Potion", desc: "Restores a small amount of HP." },
};

export default function AssetModule() {
  const [raw, setRaw] = usePersistentState("gg_asset_raw", JSON.stringify(SAMPLE, null, 2));
  const [world, setWorld] = usePersistentState("gg_asset_world", "멸망 직전의 증기기관 판타지 세계, 비장하고 고풍스러운 어조");
  const [langs, setLangs] = usePersistentState("gg_asset_langs", "ko, en, ja");
  const [output, setOutput] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const run = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const json_data = JSON.parse(raw);
      const target_languages = langs.split(",").map((s) => s.trim()).filter(Boolean);
      if (target_languages.length === 0) {
        setError("최소 1개 언어를 입력하세요 (예: ko, en).");
        return;
      }
      // 세계관은 선택 입력: 비어 있으면 null을 보내 순수 번역 모드로 동작.
      const res = await loreTranslate({
        json_data,
        world_setting: world.trim() || null,
        target_languages,
      });
      setOutput(JSON.stringify(res.localized, null, 2));
      setFeedback(res.ai_feedback);
    } catch (e) {
      setError(e?.message?.includes("JSON") ? "입력 JSON 형식이 올바르지 않습니다." : e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 설정 바 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-[3] flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">
              세계관 (Lore) <span className="text-slate-400">· 선택 (비우면 순수 번역)</span>
            </span>
            <input
              value={world}
              placeholder="예: 멸망 직전의 증기기관 판타지 — 비워두면 Lore 없이 번역만"
              onChange={(e) => setWorld(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">타겟 언어 (쉼표구분)</span>
            <input
              value={langs}
              onChange={(e) => setLangs(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 shrink-0 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "변환 중…" : "Lore 변환 실행"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
        {feedback && <p className="mt-2 text-sm text-indigo-900">🤖 {feedback}</p>}
      </section>

      {/* 5 : 5 에디터 */}
      <section className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
        {/* 좌: 원본 JSON */}
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">원본 JSON (입력)</h2>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* 우: 다국어 JSON + 복사 */}
        <div className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">다국어 JSON (AI 결과)</h2>
            <button
              type="button"
              onClick={copy}
              disabled={!output}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              {copied ? "복사됨 ✓" : "복사"}
            </button>
          </div>
          <textarea
            value={output}
            readOnly
            placeholder="변환 결과가 이곳에 표시됩니다."
            spellCheck={false}
            className="min-h-0 flex-1 resize-none rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 focus:outline-none"
          />
        </div>
      </section>
    </div>
  );
}
