import { useState } from "react";

// 시뮬레이터의 AI 피드백을 '검증 노트'로 기획서에 모으는 버튼.
export default function CaptureFindingButton({ note, onCapture, label }) {
  const [done, setDone] = useState(false);
  if (!onCapture || !note) return null;

  return (
    <button
      type="button"
      onClick={() => {
        onCapture(`[${label}] ${note}`);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      title="이 검증 결과를 기획서(GDD)의 검증 노트로 보냅니다."
      className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
    >
      {done ? "메모됨 ✓" : "📌 기획서에 메모"}
    </button>
  );
}
