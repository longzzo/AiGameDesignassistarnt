import { useEffect, useState } from "react";
import Sidebar from "./components/Sidebar";
import { MODULES } from "./data/modules";
import { getMeta } from "./api/client";
import ProjectsPanel from "./components/ProjectsPanel";
import {
  usePersistentState,
  exportProject,
  importProject,
} from "./hooks/usePersistentState";
import IdeationModule from "./components/modules/IdeationModule";
import GddModule from "./components/modules/GddModule";
import LevelModule from "./components/modules/LevelModule";
import LoreModule from "./components/modules/LoreModule";
import PlanModule from "./components/modules/PlanModule";
import StatModule from "./components/modules/StatModule";
import EconomyModule from "./components/modules/EconomyModule";
import GachaModule from "./components/modules/GachaModule";
import BalanceModule from "./components/modules/BalanceModule";
import AssetModule from "./components/modules/AssetModule";
import PrototypeModule from "./components/modules/PrototypeModule";

export default function App() {
  const [active, setActive] = useState("ideation");
  // 모듈 간 핸드오프 데이터: { target, payload, ts }
  const [seed, setSeed] = useState(null);
  // 검증 단계에서 수집한 피드백(검증 노트) — 기획서로 역방향 반영. localStorage 보존.
  const [findings, setFindings] = usePersistentState("gg_findings", []);
  const addFinding = (note) =>
    setFindings((prev) => (prev.includes(note) ? prev : [...prev, note]));
  const meta = MODULES.find((m) => m.id === active);

  // 백엔드의 AI 연결 상태(Azure OpenAI vs 목업) 조회.
  const [ai, setAi] = useState(null);
  useEffect(() => {
    getMeta()
      .then(setAi)
      .catch(() => setAi({ llm_enabled: false, mode: "offline" }));
  }, []);

  // target 모듈로 이동하면서 payload 를 전달. ts 로 매번 remount → 자동 실행 유도.
  const goTo = (target, payload) => {
    setSeed({ target, payload, ts: Date.now() });
    setActive(target);
  };
  const seedFor = (id) => (seed?.target === id ? seed.payload : null);
  const keyFor = (id) => (seed?.target === id ? seed.ts : "manual");

  // 프로젝트(localStorage gg_* 키) 내보내기/불러오기.
  const doExport = () => {
    const blob = new Blob([exportProject()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "game-balance-project.json";
    a.click();
  };
  const doImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result);
        window.location.reload();
      } catch {
        alert("불러오기 실패: 올바른 프로젝트 JSON이 아닙니다.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100">
      <Sidebar active={active} onSelect={setActive} />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <span className="shrink-0 text-2xl">{meta?.icon}</span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold text-slate-800 [word-break:keep-all] sm:text-lg">{meta?.label}</h2>
            <p className="truncate text-xs text-slate-500 [word-break:keep-all]">{meta?.desc}</p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={doExport}
              title="현재 프로젝트(검증 노트·에셋 편집 등)를 JSON 파일로 저장"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:px-3"
            >
              ⬇<span className="hidden md:inline"> 내보내기</span>
            </button>
            <label className="cursor-pointer rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 sm:px-3">
              ⬆<span className="hidden md:inline"> 불러오기</span>
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={doImport}
              />
            </label>
            {ai && (
              <span
                title={
                  ai.llm_enabled
                    ? `GitHub Models 연결됨 (main: ${ai.model_main}, mini: ${ai.model_mini})`
                    : "GitHub 토큰 미설정 — AI 결과는 '현재 API를 호출할 수 없습니다'로 표시됩니다."
                }
                className={[
                  "shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold sm:px-3",
                  ai.llm_enabled
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700",
                ].join(" ")}
              >
                {ai.llm_enabled ? (
                  <>🟢<span className="hidden sm:inline"> AI 연결됨</span><span className="hidden lg:inline"> (GitHub Models)</span></>
                ) : (
                  <>🟡<span className="hidden sm:inline"> API 미연결</span></>
                )}
              </span>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {active === "ideation" && (
            <IdeationModule onBuildGdd={(p) => goTo("gdd", p)} />
          )}
          {active === "gdd" && (
            <GddModule
              key={keyFor("gdd")}
              seed={seedFor("gdd")}
              findings={findings}
              onValidate={(target, payload) => goTo(target, payload)}
            />
          )}
          {active === "stat" && (
            <StatModule key={keyFor("stat")} seed={seedFor("stat")} onCaptureFinding={addFinding} />
          )}
          {active === "economy" && (
            <EconomyModule
              key={keyFor("economy")}
              seed={seedFor("economy")}
              onCaptureFinding={addFinding}
            />
          )}
          {active === "gacha" && (
            <GachaModule key={keyFor("gacha")} seed={seedFor("gacha")} onCaptureFinding={addFinding} />
          )}
          {active === "balance" && <BalanceModule />}
          {active === "level" && <LevelModule />}
          {active === "lore" && <LoreModule />}
          {active === "plan" && <PlanModule />}
          {active === "asset" && <AssetModule />}
          {active === "prototype" && <PrototypeModule />}
        </div>
      </main>

      <ProjectsPanel />
    </div>
  );
}
