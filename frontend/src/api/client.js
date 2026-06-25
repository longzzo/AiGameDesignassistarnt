import axios from "axios";

// 개발: Vite dev 프록시(/api -> http://127.0.0.1:8000).
// 배포: 빌드 시 VITE_API_BASE_URL(배포된 백엔드 주소)를 주입하면 그쪽으로 직접 호출한다.
//   예) VITE_API_BASE_URL=https://my-backend.onrender.com  ->  baseURL=https://my-backend.onrender.com/api/v1
const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  // gpt-5는 추론 때문에 응답이 느릴 수 있어(수십 초) 넉넉히 잡는다. 실패 시 'API 호출 불가'로 폴백.
  timeout: 120000,
  headers: { "Content-Type": "application/json" },
});

// 백엔드(FastAPI) 검증/HTTP 오류를 사람이 읽을 수 있는 메시지로 변환.
api.interceptors.response.use(
  (r) => r,
  (error) => {
    const detail = error?.response?.data?.detail;
    if (Array.isArray(detail) && detail.length) {
      const first = detail[0];
      const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : "입력값";
      error.message = `입력값 오류: '${field}' — ${first?.msg ?? "유효하지 않은 값"}`;
    } else if (typeof detail === "string") {
      error.message = detail;
    } else if (!error?.response) {
      error.message = "백엔드에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.";
    }
    return Promise.reject(error);
  }
);

export const simulateDpsTtk = (payload) =>
  api.post("/simulator/dps-ttk", payload).then((r) => r.data);

export const trackInflation = (payload) =>
  api.post("/economy/inflation", payload).then((r) => r.data);

export const runMonteCarlo = (payload) =>
  api.post("/gacha/monte-carlo", payload).then((r) => r.data);

export const loreTranslate = (payload) =>
  api.post("/asset/lore-translate", payload).then((r) => r.data);

export const generatePrompt = (payload) =>
  api.post("/prototype/prompt", payload).then((r) => r.data);

export const recommendIdeation = (payload) =>
  api.post("/ideation/recommend", payload).then((r) => r.data);

export const generateGdd = (payload) =>
  api.post("/gdd/draft", payload).then((r) => r.data);

export const getMeta = () => api.get("/meta").then((r) => r.data);

export const getCoachSuggestions = (payload) =>
  api.post("/coach/suggest", payload).then((r) => r.data);

export const generateHtmlPrototype = (payload) =>
  api.post("/prototype/html", payload).then((r) => r.data);

export const designLevel = (payload) =>
  api.post("/level/design", payload).then((r) => r.data);

export const validateLore = (payload) =>
  api.post("/lore/validate", payload).then((r) => r.data);

export const makePlan = (payload) =>
  api.post("/plan/wbs", payload).then((r) => r.data);

export const genFeatures = (payload) =>
  api.post("/plan/features", payload).then((r) => r.data);

export const compareBuilds = (payload) =>
  api.post("/balance/compare", payload).then((r) => r.data);

export const solveBalance = (payload) =>
  api.post("/balance/solve", payload).then((r) => r.data);

export default api;
