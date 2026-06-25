// 명명된 다중 프로젝트(세션) 저장 — localStorage gg_* 키 스냅샷 기반.
// 전환/생성/삭제 후에는 호출 측에서 페이지를 새로고침해 모듈이 새 값으로 재초기화된다.

const PROJECTS_KEY = "gg_projects";
const ACTIVE_KEY = "gg_active";
const DEFAULT_NAME = "기본 프로젝트";

function read(key, fallback) {
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

function getProjects() {
  return read(PROJECTS_KEY, {});
}
function setProjects(p) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(p));
}

export function getActive() {
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_NAME;
}

export function listProjects() {
  const names = Object.keys(getProjects());
  const active = getActive();
  return names.includes(active) ? names : [active, ...names];
}

// [{ name, savedAt }] 최근 저장순. 아직 저장 안 된 활성 프로젝트도 포함.
export function getProjectsMeta() {
  const p = getProjects();
  const active = getActive();
  const arr = Object.entries(p).map(([name, v]) => ({ name, savedAt: v?.savedAt || 0 }));
  if (!arr.find((x) => x.name === active)) arr.unshift({ name: active, savedAt: Date.now() });
  arr.sort((a, b) => b.savedAt - a.savedAt);
  return arr;
}

// 메타 키를 제외한 실제 작업 데이터 키.
function workingKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("gg_") && k !== PROJECTS_KEY && k !== ACTIVE_KEY) keys.push(k);
  }
  return keys;
}

function snapshot() {
  const data = {};
  workingKeys().forEach((k) => {
    data[k] = localStorage.getItem(k);
  });
  return data;
}
function clearWorking() {
  workingKeys().forEach((k) => localStorage.removeItem(k));
}
function load(data) {
  Object.entries(data || {}).forEach(([k, v]) => localStorage.setItem(k, v));
}

export function saveCurrent() {
  const p = getProjects();
  p[getActive()] = { savedAt: Date.now(), data: snapshot() };
  setProjects(p);
}

export function switchTo(name) {
  saveCurrent();
  clearWorking();
  load(getProjects()[name]?.data);
  localStorage.setItem(ACTIVE_KEY, name);
}

export function createProject(name) {
  saveCurrent();
  clearWorking();
  const p = getProjects();
  p[name] = { savedAt: Date.now(), data: {} };
  setProjects(p);
  localStorage.setItem(ACTIVE_KEY, name);
}

export function deleteProject(name) {
  const p = getProjects();
  delete p[name];
  setProjects(p);
  if (getActive() === name) {
    clearWorking();
    localStorage.setItem(ACTIVE_KEY, DEFAULT_NAME);
    load(p[DEFAULT_NAME]?.data);
  }
}
