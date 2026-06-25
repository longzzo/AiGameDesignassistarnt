import { useState } from "react";
import { generatePrompt, generateHtmlPrototype } from "../../api/client";

// 스펙에 명시된 기본(Default) 값.
const DEFAULT_GENRE = "탑다운 액션 파티 게임";
const DEFAULT_MECHANICS = "슬라임 캐릭터, 소셜 디덕션 기반 술래잡기, 시야 제한";

const STACK_OPTIONS = [
  "단일 HTML + Vanilla JS (Canvas)",
  "React + TypeScript",
  "Phaser 3",
  "Three.js",
  "Unity (C#)",
];

export default function PrototypeModule() {
  const [genre, setGenre] = useState(DEFAULT_GENRE);
  const [mechanics, setMechanics] = useState(DEFAULT_MECHANICS);
  const [stack, setStack] = useState(STACK_OPTIONS[0]);
  const [prompt, setPrompt] = useState("");
  const [meta, setMeta] = useState(null);
  const [html, setHtml] = useState("");
  const [view, setView] = useState("prompt"); // prompt | html
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const payload = () => ({
    genre,
    core_mechanics: mechanics.split(",").map((s) => s.trim()).filter(Boolean),
    tech_stack: stack,
  });

  const runPrompt = async () => {
    setLoading("prompt");
    setError("");
    setCopied(false);
    try {
      const res = await generatePrompt(payload());
      setPrompt(res.prompt);
      setMeta(res);
      setView("prompt");
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading("");
    }
  };

  const runHtml = async () => {
    setLoading("html");
    setError("");
    setCopied(false);
    try {
      const res = await generateHtmlPrototype(payload());
      setHtml(res.html);
      setView("html");
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading("");
    }
  };

  const copy = async () => {
    const text = view === "html" ? html : prompt;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const openHtml = () => {
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 상단: 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">장르</span>
            <input
              value={genre}
              placeholder={DEFAULT_GENRE}
              onChange={(e) => setGenre(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 md:col-span-2">
            <span className="text-xs font-medium text-slate-500">핵심 메커니즘 (쉼표 구분)</span>
            <input
              value={mechanics}
              placeholder={DEFAULT_MECHANICS}
              onChange={(e) => setMechanics(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">타겟 기술 스택</span>
            <select
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {STACK_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={runPrompt}
              disabled={loading !== ""}
              className="h-10 rounded-md bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading === "prompt" ? "생성 중…" : "메타 프롬프트 생성"}
            </button>
            <button
              type="button"
              onClick={runHtml}
              disabled={loading !== ""}
              className="h-10 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {loading === "html" ? "생성 중…" : "🎮 실행 HTML 생성"}
            </button>
            {meta && view === "prompt" && (
              <span className="self-center text-xs text-slate-500">≈ {meta.estimated_tokens} 토큰</span>
            )}
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
      </section>

      {/* 하단: 출력 (탭: 메타 프롬프트 / 실행 HTML) */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
          <div className="flex gap-1">
            <Tab active={view === "prompt"} onClick={() => setView("prompt")}>메타 프롬프트</Tab>
            <Tab active={view === "html"} onClick={() => setView("html")}>실행 HTML</Tab>
          </div>
          <div className="flex gap-2">
            {view === "html" && html && (
              <button
                type="button"
                onClick={openHtml}
                className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                새 탭에서 열기 ↗
              </button>
            )}
            <button
              type="button"
              onClick={copy}
              disabled={view === "html" ? !html : !prompt}
              className="rounded-md border border-slate-600 px-3 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40"
            >
              {copied ? "복사됨 ✓" : view === "html" ? "HTML 복사" : "복사"}
            </button>
          </div>
        </div>

        {view === "prompt" ? (
          <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap p-4 font-mono text-[13px] leading-relaxed text-emerald-300">
            {prompt || "// 폼을 채우고 '메타 프롬프트 생성'을 누르면 이곳에 결과가 출력됩니다."}
          </pre>
        ) : html ? (
          <iframe
            title="prototype-preview"
            srcDoc={html}
            sandbox="allow-scripts allow-pointer-lock"
            className="min-h-0 flex-1 w-full bg-white"
          />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-slate-500">
            '🎮 실행 HTML 생성'을 누르면 즉시 플레이 가능한 프로토타입이 이곳에 렌더링됩니다.
          </div>
        )}
      </section>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
