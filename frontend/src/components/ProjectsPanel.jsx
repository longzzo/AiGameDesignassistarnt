import { useState } from "react";
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

// 우측 레일: 저장된 프로젝트(세션)를 옆에 띄워 두고 전환.
export default function ProjectsPanel() {
  const [open, setOpen] = useState(true);
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

  if (!open) {
    return (
      <aside className="hidden w-10 shrink-0 flex-col items-center border-l border-slate-200 bg-white py-3 xl:flex">
        <button type="button" onClick={() => setOpen(true)} title="프로젝트 패널 열기" className="text-slate-400 hover:text-slate-700">
          🗂️
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-slate-200 bg-white xl:flex">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
        <span className="text-sm font-bold text-slate-800">🗂️ 프로젝트</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onSave} title="현재 저장" className="rounded p-1 text-xs text-slate-500 hover:bg-slate-100">
            {saved ? "✓" : "💾"}
          </button>
          <button type="button" onClick={() => setOpen(false)} title="접기" className="rounded p-1 text-slate-400 hover:bg-slate-100">
            »
          </button>
        </div>
      </div>

      <div className="p-2">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
        >
          ＋ 새 프로젝트
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
    </aside>
  );
}
