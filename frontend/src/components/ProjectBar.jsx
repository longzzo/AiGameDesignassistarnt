import { useState } from "react";
import {
  listProjects,
  getActive,
  switchTo,
  createProject,
  deleteProject,
  saveCurrent,
} from "../lib/projects";

// 헤더의 프로젝트(세션) 전환/저장 바.
export default function ProjectBar() {
  const projects = listProjects();
  const active = getActive();
  const [saved, setSaved] = useState(false);

  const onSwitch = (e) => {
    const name = e.target.value;
    if (name !== active) {
      switchTo(name);
      window.location.reload();
    }
  };
  const onNew = () => {
    const name = window.prompt("새 프로젝트 이름:");
    if (name && name.trim()) {
      createProject(name.trim());
      window.location.reload();
    }
  };
  const onSave = () => {
    saveCurrent();
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  };
  const onDelete = () => {
    if (projects.length <= 1) {
      window.alert("마지막 프로젝트는 삭제할 수 없습니다.");
      return;
    }
    if (window.confirm(`'${active}' 프로젝트를 삭제할까요?`)) {
      deleteProject(active);
      window.location.reload();
    }
  };

  const btn =
    "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100";

  return (
    <div className="flex items-center gap-1">
      <select
        value={active}
        onChange={onSwitch}
        title="프로젝트 전환"
        className="max-w-[140px] rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 focus:outline-none"
      >
        {projects.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <button type="button" onClick={onNew} title="새 프로젝트" className={btn}>＋</button>
      <button type="button" onClick={onSave} title="현재 프로젝트 저장" className={btn}>
        {saved ? "✓" : "💾"}
      </button>
      <button type="button" onClick={onDelete} title="현재 프로젝트 삭제" className={btn}>🗑</button>
    </div>
  );
}
