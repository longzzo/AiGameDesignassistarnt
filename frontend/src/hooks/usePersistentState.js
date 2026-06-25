import { useEffect, useState } from "react";

// localStorage에 자동 저장/복원되는 useState. seed 핸드오프가 없는 모듈에 사용.
export function usePersistentState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* 저장 실패는 무시(쿼터 등) */
    }
  }, [key, value]);

  return [value, setValue];
}

// 프로젝트 스냅샷 export/import — gg_ 접두 키 전체를 직렬화한다.
export function exportProject() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("gg_")) data[k] = localStorage.getItem(k);
  }
  return JSON.stringify({ app: "ai-game-balance", saved_at: new Date().toISOString(), data }, null, 2);
}

export function importProject(json) {
  const parsed = JSON.parse(json);
  const data = parsed?.data ?? parsed;
  Object.entries(data).forEach(([k, v]) => {
    if (k.startsWith("gg_")) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  });
}
