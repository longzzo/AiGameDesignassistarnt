import { useEffect, useState } from "react";
import { generateGdd } from "../../api/client";

const DEFAULTS = {
  genre: "",
  world: "",
  mechanics: "",
  platform: "PC / 모바일",
  audience: "",
  monetization: "",
  references: "",
};

// seed(아이데이션 카드에서 넘어온 값)가 있으면 일부 필드를 덮어쓴다.
function initFrom(seed) {
  if (!seed) return DEFAULTS;
  return {
    ...DEFAULTS,
    genre: seed.genre ?? DEFAULTS.genre,
    world: seed.world_setting ?? DEFAULTS.world,
    mechanics: Array.isArray(seed.core_mechanics)
      ? seed.core_mechanics.join(", ")
      : DEFAULTS.mechanics,
    references: Array.isArray(seed.references)
      ? seed.references.join(", ")
      : DEFAULTS.references,
    platform: seed.platform ?? DEFAULTS.platform,
    audience: seed.target_audience ?? DEFAULTS.audience,
    monetization: seed.monetization ?? DEFAULTS.monetization,
  };
}

export default function GddModule({ seed, onValidate, findings = [] }) {
  const [form, setForm] = useState(() => initFrom(seed));
  const [doc, setDoc] = useState(null);
  const [tab, setTab] = useState("doc"); // doc | prompt
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    setError("");
    setCopied(false);
    try {
      const payload = {
        genre: form.genre.trim() || "미정",
        world_setting: form.world.trim() || null,
        core_mechanics: form.mechanics.split(",").map((s) => s.trim()).filter(Boolean),
        target_platform: form.platform.trim() || "PC / 모바일",
        target_audience: form.audience.trim() || null,
        monetization: form.monetization.trim() || null,
        references: form.references.split(",").map((s) => s.trim()).filter(Boolean),
        validation_notes: findings,
      };
      setDoc(await generateGdd(payload));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  // 아이데이션에서 장르를 들고 넘어온 경우 자동 생성.
  useEffect(() => {
    if (seed) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async () => {
    if (!doc) return;
    const text = tab === "doc" ? doc.markdown : doc.meta_prompt;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* 상단: 입력 폼 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="장르" value={form.genre} onChange={(v) => set("genre", v)} placeholder="예: 탑다운 액션 파티 게임" />
          <Field label="세계관 (Lore) · 선택" value={form.world} onChange={(v) => set("world", v)} placeholder="비우면 톤 추후 확정" />
          <Field label="플랫폼" value={form.platform} onChange={(v) => set("platform", v)} />
          <Field className="md:col-span-3" label="핵심 메커니즘 (쉼표 구분)" value={form.mechanics} onChange={(v) => set("mechanics", v)} placeholder="예: 슬라임 캐릭터, 술래잡기, 시야 제한" />
          <Field label="타겟 유저 · 선택" value={form.audience} onChange={(v) => set("audience", v)} placeholder="예: 친구와 즐기는 캐주얼" />
          <Field label="수익화 · 선택" value={form.monetization} onChange={(v) => set("monetization", v)} placeholder="예: 부분유료(코스메틱)" />
          <Field label="레퍼런스 · 선택" value={form.references} onChange={(v) => set("references", v)} placeholder="예: Among Us, Fall Guys" />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "작성 중…" : "기획서 생성"}
          </button>
          {doc && <p className="text-sm text-indigo-900">🤖 {doc.ai_feedback}</p>}
          {error && <p className="text-sm text-red-600">⚠ {error}</p>}
        </div>

        {findings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">📌 검증 노트 {findings.length}건 수집됨</span>
              <button
                type="button"
                onClick={run}
                className="rounded bg-amber-500 px-2.5 py-1 font-semibold text-white hover:bg-amber-600"
              >
                노트 반영해 재생성
              </button>
            </div>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {findings.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {doc && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500">제안 밸런스로 검증:</span>
            <button
              type="button"
              onClick={() => onValidate?.("stat", doc.balance_baseline.stat)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              ⚔️ 스탯 시뮬레이터로 검증 →
            </button>
            <button
              type="button"
              onClick={() => onValidate?.("economy", doc.balance_baseline.economy)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              💰 경제 추적기로 검증 →
            </button>
            <button
              type="button"
              onClick={() => onValidate?.("gacha", doc.balance_baseline.gacha)}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              🎲 가챠 확률 검증 →
            </button>
            <span className="text-xs text-slate-400">{doc.balance_baseline.note}</span>
          </div>
        )}
      </section>

      {/* 하단: 출력 (문서 / 메타 프롬프트 탭) */}
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
          <div className="flex gap-1">
            <Tab active={tab === "doc"} onClick={() => setTab("doc")}>기획서 문서</Tab>
            <Tab active={tab === "prompt"} onClick={() => setTab("prompt")}>메타 프롬프트</Tab>
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={!doc}
            className="rounded-md border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          >
            {copied ? "복사됨 ✓" : tab === "doc" ? "마크다운 복사" : "프롬프트 복사"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {!doc ? (
            <Placeholder text="입력값을 채우고 '기획서 생성'을 누르면 GDD 초안이 이곳에 작성됩니다." />
          ) : tab === "doc" ? (
            <div className="p-5">
              <h1 className="text-xl font-bold text-slate-900">{doc.title}</h1>
              <p className="mt-1 border-l-4 border-indigo-300 bg-indigo-50 px-3 py-2 text-sm italic text-slate-700">
                {doc.one_liner}
              </p>
              <div className="mt-4 space-y-5">
                {doc.sections.map((s) => (
                  <div key={s.heading}>
                    <h2 className="text-sm font-bold text-indigo-700">{s.heading}</h2>
                    <ul className="mt-1 space-y-1">
                      {s.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-700">
                          <span className="text-indigo-400">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <pre className="h-full whitespace-pre-wrap bg-slate-950 p-5 font-mono text-[13px] leading-relaxed text-emerald-300">
              {doc.meta_prompt}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, className = "" }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
      />
    </label>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Placeholder({ text }) {
  return (
    <div className="flex h-full min-h-48 items-center justify-center p-6 text-center text-sm text-slate-400">
      {text}
    </div>
  );
}
