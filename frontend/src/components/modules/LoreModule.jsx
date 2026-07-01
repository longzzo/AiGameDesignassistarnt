import { useState } from "react";
import { validateLore } from "../../api/client";
import { usePersistentState } from "../../hooks/usePersistentState";

// 분류: 세계관(캐릭터/진영/장소) · 스토리(사건) · 퀘스트
const CATS = {
  world: {
    label: "세계관",
    icon: "🌍",
    sub: [
      { type: "character", label: "캐릭터" },
      { type: "faction", label: "진영" },
      { type: "location", label: "장소" },
    ],
  },
  story: { label: "스토리", icon: "📜" },
  quest: { label: "퀘스트", icon: "⚔️" },
};
const TAB_ORDER = ["world", "story", "quest"];

const SAMPLE = [
  { id: "n1", type: "character", name: "아린", refs: ["붉은성채"], requires: [], order: null },
  { id: "n3", type: "faction", name: "여명회", refs: [], requires: [], order: null },
  { id: "n2", type: "location", name: "붉은성채", refs: [], requires: [], order: null },
  { id: "n4", type: "event", name: "대화재", refs: [], requires: [], order: 1 },
  { id: "n5", type: "event", name: "재건", refs: [], requires: [], order: 2 },
  { id: "n6", type: "quest", name: "첫 임무", refs: [], requires: [], order: null },
  { id: "n7", type: "quest", name: "둘째 임무", refs: [], requires: ["첫 임무"], order: null },
];

const SEV = {
  high: { label: "심각", cls: "border-red-300 bg-red-50 text-red-800" },
  medium: { label: "주의", cls: "border-amber-300 bg-amber-50 text-amber-800" },
  low: { label: "경미", cls: "border-slate-300 bg-slate-50 text-slate-600" },
};

const genId = () => "n" + Math.random().toString(36).slice(2, 8);
const toList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function LoreModule() {
  const [entries, setEntries] = usePersistentState("gg_lore_entries2", []);
  const [world, setWorld] = usePersistentState("gg_lore_world", "");
  const [tab, setTab] = useState("world");
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const patchId = (id, p) => setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const removeId = (id) => setEntries((es) => es.filter((e) => e.id !== id));
  const addOfType = (type) =>
    setEntries((es) => [
      ...es,
      {
        id: genId(),
        type,
        name: "",
        refs: [],
        requires: [],
        order: type === "event" ? Math.max(0, ...es.filter((x) => x.type === "event").map((x) => x.order || 0)) + 1 : null,
      },
    ]);

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      setRes(await validateLore({ entries, world_setting: world.trim() || null }));
    } catch (e) {
      setError(e?.message ?? "요청 실패");
    } finally {
      setLoading(false);
    }
  };

  // 이슈 → 분류 매핑 (분류별로 따로 확인).
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
  const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
  const catOf = (iss) => {
    if (iss.type === "quest_missing_dep" || iss.type === "quest_cycle") return "quest";
    if (iss.type === "timeline") return "story";
    const types = (iss.related || []).map((r) => (byId[r] || byName[r])?.type).filter(Boolean);
    if (types.includes("event")) return "story";
    if (types.includes("quest")) return "quest";
    return "world";
  };
  const issuesByCat = { world: [], story: [], quest: [] };
  (res?.issues || []).forEach((i) => issuesByCat[catOf(i)].push(i));
  const countByCat = (c) =>
    c === "world"
      ? entries.filter((e) => CATS.world.sub.some((s) => s.type === e.type)).length
      : c === "story"
      ? entries.filter((e) => e.type === "event").length
      : entries.filter((e) => e.type === "quest").length;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* 설정 바 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">세계관 톤 (선택 · AI 의미 검증용)</span>
            <input value={world} onChange={(e) => setWorld(e.target.value)} placeholder="예: 멸망 직전의 증기기관 판타지" className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>
          <button type="button" onClick={run} disabled={loading} className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {loading ? "검증 중…" : "일관성 검증"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">⚠ {error}</p>}
        {res && <p className="mt-2 text-sm text-indigo-900">🤖 {res.summary} {res.ai_feedback}</p>}
      </section>

      {/* 분류 탭 */}
      <div className="flex gap-2">
        {TAB_ORDER.map((c) => {
          const issn = issuesByCat[c].length;
          const active = tab === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={[
                "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors",
                active ? "border-indigo-300 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              ].join(" ")}
            >
              <span>{CATS[c].icon} {CATS[c].label}</span>
              <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/25" : "bg-slate-100 text-slate-500"}`}>{countByCat(c)}</span>
              {res && issn > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{issn}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 에디터 (활성 분류) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {tab === "world" && (
            <div className="space-y-4">
              {CATS.world.sub.map((s) => (
                <div key={s.type}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-700">{s.label}</h3>
                    <button type="button" onClick={() => addOfType(s.type)} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">＋ {s.label}</button>
                  </div>
                  <div className="space-y-2">
                    {entries.filter((e) => e.type === s.type).map((e) => (
                      <EntryCard key={e.id} e={e} onPatch={(p) => patchId(e.id, p)} onRemove={() => removeId(e.id)} />
                    ))}
                    {entries.filter((e) => e.type === s.type).length === 0 && (
                      <p className="text-xs text-slate-400">아직 {s.label} 엔트리가 없습니다.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "story" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">스토리 사건 (타임라인 순)</h3>
                <button type="button" onClick={() => addOfType("event")} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">＋ 사건</button>
              </div>
              <div className="space-y-2">
                {[...entries.filter((e) => e.type === "event")].sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9)).map((e) => (
                  <EntryCard key={e.id} e={e} onPatch={(p) => patchId(e.id, p)} onRemove={() => removeId(e.id)} showOrder />
                ))}
                {entries.filter((e) => e.type === "event").length === 0 && <p className="text-xs text-slate-400">아직 사건이 없습니다.</p>}
              </div>
            </div>
          )}

          {tab === "quest" && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">퀘스트 (선행 의존성)</h3>
                <button type="button" onClick={() => addOfType("quest")} className="rounded-md border border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100">＋ 퀘스트</button>
              </div>
              <div className="space-y-2">
                {entries.filter((e) => e.type === "quest").map((e) => (
                  <EntryCard key={e.id} e={e} onPatch={(p) => patchId(e.id, p)} onRemove={() => removeId(e.id)} showRequires />
                ))}
                {entries.filter((e) => e.type === "quest").length === 0 && <p className="text-xs text-slate-400">아직 퀘스트가 없습니다.</p>}
              </div>
            </div>
          )}
        </section>

        {/* 이슈 (활성 분류만) */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            검출된 이슈 · {CATS[tab].label}
          </h2>
          {!res ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-center text-sm text-slate-400">
              '일관성 검증'을 누르면 분류별로 이슈가 표시됩니다.
            </div>
          ) : issuesByCat[tab].length === 0 ? (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
              ✅ {CATS[tab].label}에서 충돌이 발견되지 않았습니다.
            </div>
          ) : (
            <ul className="space-y-2">
              {issuesByCat[tab].map((iss, i) => {
                const sev = SEV[iss.severity] || SEV.low;
                return (
                  <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${sev.cls}`}>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-bold">{sev.label}</span>
                      <span className="text-xs opacity-70">{iss.type}</span>
                    </div>
                    <p className="mt-1">{iss.message}</p>
                    {iss.related?.length > 0 && <p className="mt-1 text-xs opacity-70">관련: {iss.related.join(", ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function EntryCard({ e, onPatch, onRemove, showOrder, showRequires }) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="flex items-center gap-2">
        <input
          value={e.name}
          onChange={(ev) => onPatch({ name: ev.target.value })}
          placeholder="이름"
          className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        {showOrder && (
          <input
            type="number"
            value={e.order ?? ""}
            onChange={(ev) => onPatch({ order: ev.target.value === "" ? null : Number(ev.target.value) })}
            placeholder="순서"
            title="타임라인 순서"
            className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
          />
        )}
        <button type="button" onClick={onRemove} className="px-1.5 text-sm text-slate-400 hover:text-red-500" title="삭제">×</button>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          value={(e.refs || []).join(", ")}
          onChange={(ev) => onPatch({ refs: toList(ev.target.value) })}
          placeholder="참조 (쉼표): 다른 엔트리 이름"
          className="min-w-[120px] flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
        />
        {showRequires && (
          <input
            value={(e.requires || []).join(", ")}
            onChange={(ev) => onPatch({ requires: toList(ev.target.value) })}
            placeholder="선행 퀘스트 (쉼표)"
            className="min-w-[120px] flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs"
          />
        )}
      </div>
    </div>
  );
}
