import { useState } from "react";
import { GUIDES } from "../data/guides";
import { MODULES } from "../data/modules";
import {
  getProjectsMeta,
  getActive,
  switchTo,
  createProject,
  deleteProject,
  saveCurrent,
} from "../lib/projects";

function ago(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "방금";
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return `${Math.floor(s / 86400)}일 전`;
}

// 우측 레일: 📖 사용 가이드(기본, 크게)와 🗂 프로젝트 전환을 탭으로 제공.
export default function ProjectsPanel({ moduleId }) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState("guide"); // guide | projects

  if (!open) {
    return (
      <aside className="hidden w-10 shrink-0 flex-col items-center gap-3 border-l border-slate-200 bg-white py-3 lg:flex">
        <button type="button" onClick={() => { setTab("guide"); setOpen(true); }} title="가이드 열기" className="text-lg text-slate-400 hover:text-indigo-600">📖</button>
        <button type="button" onClick={() => { setTab("projects"); setOpen(true); }} title="프로젝트 열기" className="text-lg text-slate-400 hover:text-indigo-600">🗂️</button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-200 bg-white lg:flex xl:w-80 2xl:w-96">
      <div className="flex items-center border-b border-slate-200 px-2 py-2">
        <div className="flex flex-1 gap-1">
          <TabBtn active={tab === "guide"} onClick={() => setTab("guide")}>📖 가이드</TabBtn>
          <TabBtn active={tab === "projects"} onClick={() => setTab("projects")}>🗂 프로젝트</TabBtn>
        </div>
        <button type="button" onClick={() => setOpen(false)} title="접기" className="rounded p-1 text-slate-400 hover:bg-slate-100">»</button>
      </div>

      {tab === "guide" ? <GuideBody moduleId={moduleId} /> : <ProjectsBody />}
    </aside>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
        active ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── 📖 가이드: 현재 모듈의 사용법을 크고 길게 ─────────────────────────────
function GuideBody({ moduleId }) {
  const guide = GUIDES[moduleId];
  const meta = MODULES.find((m) => m.id === moduleId);
  if (!guide) {
    return <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-400">이 모듈의 가이드가 아직 없습니다.</div>;
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">{meta?.icon}</span>
        <div>
          <h2 className="text-base font-bold text-slate-800">{meta?.label}</h2>
          <p className="text-xs text-slate-400">{meta?.desc}</p>
        </div>
      </div>

      <section>
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-500">무엇을 하나요</h3>
        <p className="text-sm leading-relaxed text-slate-700">{guide.what}</p>
      </section>

      <section className="mt-4">
        <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-indigo-500">이렇게 해보세요</h3>
        <ol className="space-y-2">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-600">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>

      {guide.detail?.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-indigo-500">지표 읽는 법</h3>
          <dl className="space-y-2">
            {guide.detail.map(([term, desc], i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <dt className="text-sm font-semibold text-slate-800">{term}</dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{desc}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
        <p className="text-[13px] leading-relaxed text-slate-700">
          <span className="font-bold text-amber-600">💡 TIP </span>
          {guide.tip}
        </p>
      </section>
    </div>
  );
}

// ── 🗂 프로젝트: 저장된 프로젝트(세션) 전환 ───────────────────────────────
function ProjectsBody() {
  const [saved, setSaved] = useState(false);
  const projects = getProjectsMeta();
  const active = getActive();

  const onNew = () => {
    const name = window.prompt("새 프로젝트 이름:");
    if (name && name.trim()) {
      createProject(name.trim());
      window.location.reload();
    }
  };
  const onOpen = (name) => {
    if (name !== active) {
      switchTo(name);
      window.location.reload();
    }
  };
  const onSave = () => {
    saveCurrent();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  const onDelete = (e, name) => {
    e.stopPropagation();
    if (projects.length <= 1) {
      window.alert("마지막 프로젝트는 삭제할 수 없습니다.");
      return;
    }
    if (window.confirm(`'${name}' 프로젝트를 삭제할까요?`)) {
      deleteProject(name);
      window.location.reload();
    }
  };

  return (
    <>
      <div className="flex gap-2 p-2">
        <button
          type="button"
          onClick={onNew}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          ＋ 새 프로젝트
        </button>
        <button type="button" onClick={onSave} title="현재 저장" className="rounded-lg border border-slate-200 px-3 text-sm text-slate-500 hover:bg-slate-100">
          {saved ? "✓" : "💾"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-1 py-1 text-xs font-medium text-slate-400">최근 항목</p>
        <ul className="space-y-1">
          {projects.map((p) => {
            const isActive = p.name === active;
            return (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => onOpen(p.name)}
                  className={[
                    "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition-colors",
                    isActive ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className={`block text-xs ${isActive ? "text-indigo-100" : "text-slate-400"}`}>
                      {isActive ? "사용 중" : ago(p.savedAt)}
                    </span>
                  </span>
                  <span
                    onClick={(e) => onDelete(e, p.name)}
                    title="삭제"
                    className={[
                      "ml-1 shrink-0 rounded px-1 opacity-0 group-hover:opacity-100",
                      isActive ? "text-indigo-100 hover:text-white" : "text-slate-400 hover:text-red-500",
                    ].join(" ")}
                  >
                    ×
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
