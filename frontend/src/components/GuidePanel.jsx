import { useState } from "react";
import { GUIDES } from "../data/guides";

// 사이드바 좌측 하단의 초보자용 가이드 패널. 현재 모듈에 맞는 설명을 보여준다.
export default function GuidePanel({ moduleId }) {
  const [open, setOpen] = useState(true);
  const guide = GUIDES[moduleId];
  if (!guide) return null;

  return (
    <div className="border-t border-slate-800 bg-slate-900/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
      >
        <span>💡 사용 가이드</span>
        <span className="text-slate-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="max-h-72 overflow-y-auto px-4 pb-4 text-[11px] leading-relaxed text-slate-400">
          <p className="text-slate-300">{guide.what}</p>

          <p className="mt-3 font-semibold text-slate-400">이렇게 해보세요</p>
          <ol className="mt-1 space-y-1">
            {guide.steps.map((s, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-indigo-400">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 rounded-md bg-slate-800/70 px-2.5 py-2 text-slate-300">
            <span className="font-semibold text-amber-300">TIP </span>
            {guide.tip}
          </p>
        </div>
      )}
    </div>
  );
}
