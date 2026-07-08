import { MODULES } from "../data/modules";
import GuidePanel from "./GuidePanel";

export default function Sidebar({ active, onSelect }) {
  return (
    <aside className="flex h-full w-16 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 md:w-56 lg:w-64 xl:w-72">
      <div className="border-b border-slate-800 px-2 py-4 md:px-5 md:py-6">
        {/* 좁은 화면: 아이콘만 / md 이상: 풀 타이틀 */}
        <div className="text-center text-2xl md:hidden">🎮</div>
        <h1 className="hidden text-lg font-bold leading-tight md:block">
          AI Game Balance
          <span className="block text-sm font-normal text-slate-400">
            기획 & 밸런스 어시스턴트
          </span>
        </h1>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2 md:p-3">
        {MODULES.map((m) => {
          const isActive = m.id === active;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              title={m.label}
              className={[
                "flex w-full items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors md:items-start md:justify-start md:px-3 md:py-3",
                isActive
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-300 hover:bg-slate-800",
              ].join(" ")}
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <span className="hidden min-w-0 md:block">
                <span className="block truncate text-sm font-semibold">
                  {m.label}
                </span>
                <span
                  className={[
                    "block truncate text-xs",
                    isActive ? "text-indigo-100" : "text-slate-500",
                  ].join(" ")}
                >
                  {m.desc}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      {/* 가이드는 우측 패널(📖 탭)로 이동 — 우측 패널이 없는 md~lg 구간에서만 폴백 표시 */}
      <div className="hidden md:block lg:hidden">
        <GuidePanel moduleId={active} />
      </div>
      <div className="hidden border-t border-slate-800 px-5 py-3 text-[11px] text-slate-600 md:block">
        MVP · FastAPI + React
      </div>
    </aside>
  );
}
