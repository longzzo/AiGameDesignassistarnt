import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { usePersistentState } from "../../hooks/usePersistentState";
import {
  hashSeed, makeRng, genTerrain, genDungeon, genCity, genIndoor,
  deriveCorridors, biomeColor, BIOME_RAMPS,
} from "../../lib/mapgen";

// ── 상수 ──────────────────────────────────────────────────────────────
const MAP_TYPES = ["던전", "실내", "도시/마을", "지역맵", "월드맵"];
const isTerrain = (t) => t === "월드맵" || t === "지역맵";
const BIOMES = Object.keys(BIOME_RAMPS);
const FEATURES = [
  { key: "mountain", label: "⛰ 산" },
  { key: "river", label: "🌊 강" },
  { key: "lake", label: "💧 호수" },
  { key: "forest", label: "🌲 숲" },
];
const KIND_COLOR = {
  방: 0x6366f1, 보스방: 0xdc2626, 고층: 0x475569, 건물: 0x64748b, 주택: 0x94a3b8,
  거실: 0x818cf8, 주방: 0xf59e0b, 창고: 0xa8a29e, 복도: 0xcbd5e1, 욕실: 0x38bdf8,
};
const DIRS = [
  { key: "N", label: "⬆ 북", dx: 0, dz: -1 },
  { key: "S", label: "⬇ 남", dx: 0, dz: 1 },
  { key: "W", label: "⬅ 서", dx: -1, dz: 0 },
  { key: "E", label: "➡ 동", dx: 1, dz: 0 },
];

const DEFAULT_PARAMS = {
  mapType: "던전", biome: "초원", seed: "gamegoal",
  roomCount: 8, terrainSize: 48,
  features: { mountain: true, river: true, lake: false, forest: true },
};

export default function MapModule() {
  const [params, setParams] = usePersistentState("gg_map_params", DEFAULT_PARAMS);
  const [rooms, setRooms] = usePersistentState("gg_map_rooms", []);
  const [heightsArr, setHeightsArr] = usePersistentState("gg_map_heights", null); // {size, data:[], waterLevel, trees}
  const [selectedId, setSelectedId] = useState(null);
  const [brush, setBrush] = useState("select"); // select | raise | lower
  const [msg, setMsg] = useState("");

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));
  const terrainMode = isTerrain(params.mapType);
  const selected = rooms.find((r) => r.id === selectedId) || null;

  // ── 생성 ────────────────────────────────────────────────────────────
  const generate = () => {
    const seedNum = hashSeed(params.seed + "|" + params.mapType);
    setSelectedId(null);
    setMsg("");
    if (terrainMode) {
      const size = params.mapType === "월드맵" ? 64 : 44;
      const t = genTerrain(seedNum, size, params.features);
      setHeightsArr({ size: t.size, data: Array.from(t.heights), waterLevel: t.waterLevel, trees: t.trees });
      setRooms([]);
    } else {
      const gen = params.mapType === "던전" ? genDungeon : params.mapType === "도시/마을" ? genCity : genIndoor;
      setRooms(gen(seedNum, Number(params.roomCount) || 6));
      setHeightsArr(null);
    }
  };

  const reseed = () => {
    const s = Math.random().toString(36).slice(2, 8);
    set("seed", s);
    // seed 상태 반영 후 생성되도록 다음 틱에
    setTimeout(() => generateWith(s), 0);
  };
  const generateWith = (seed) => {
    const seedNum = hashSeed(seed + "|" + params.mapType);
    setSelectedId(null);
    if (terrainMode) {
      const size = params.mapType === "월드맵" ? 64 : 44;
      const t = genTerrain(seedNum, size, params.features);
      setHeightsArr({ size: t.size, data: Array.from(t.heights), waterLevel: t.waterLevel, trees: t.trees });
      setRooms([]);
    } else {
      const gen = params.mapType === "던전" ? genDungeon : params.mapType === "도시/마을" ? genCity : genIndoor;
      setRooms(gen(seedNum, Number(params.roomCount) || 6));
      setHeightsArr(null);
    }
  };

  // ── 방 편집 ─────────────────────────────────────────────────────────
  const addRoom = (dir) => {
    if (!selected) return;
    const gap = params.mapType === "던전" ? 2 : params.mapType === "도시/마을" ? 3 : 0.5;
    const w = selected.w, d = selected.d;
    const cand = {
      id: "r" + Math.random().toString(36).slice(2, 8),
      x: selected.x + dir.dx * (w + gap),
      z: selected.z + dir.dz * (d + gap),
      w, d, h: selected.h, kind: selected.kind,
    };
    if (rooms.some((r) => r.x < cand.x + cand.w && r.x + r.w > cand.x && r.z < cand.z + cand.d && r.z + r.d > cand.z)) {
      setMsg("⚠ 그 방향에는 이미 방이 있어 추가할 수 없습니다.");
      return;
    }
    setMsg("");
    setRooms((rs) => [...rs, cand]);
    setSelectedId(cand.id);
  };
  const delRoom = () => {
    if (!selected) return;
    setRooms((rs) => rs.filter((r) => r.id !== selected.id));
    setSelectedId(null);
  };
  const resizeRoom = (k, v) => {
    if (!selected) return;
    setRooms((rs) => rs.map((r) => (r.id === selected.id ? { ...r, [k]: Number(v) } : r)));
  };
  const renameKind = (v) => {
    if (!selected) return;
    setRooms((rs) => rs.map((r) => (r.id === selected.id ? { ...r, kind: v } : r)));
  };

  // ── 내보내기 ────────────────────────────────────────────────────────
  const exportJson = () => {
    const payload = terrainMode
      ? { map_type: params.mapType, biome: params.biome, seed: params.seed, features: params.features, terrain: heightsArr }
      : { map_type: params.mapType, biome: params.biome, seed: params.seed, rooms };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `map-${params.mapType}-${params.seed}.json`;
    a.click();
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* 상단 설정 바 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">맵 유형</span>
            <select value={params.mapType} onChange={(e) => set("mapType", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              {MAP_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">바이옴</span>
            <select value={params.biome} onChange={(e) => set("biome", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none">
              {BIOMES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>

          {terrainMode ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">지형 요소</span>
              <div className="flex gap-1.5">
                {FEATURES.map((f) => (
                  <button key={f.key} type="button"
                    onClick={() => set("features", { ...params.features, [f.key]: !params.features[f.key] })}
                    className={[
                      "rounded-md border px-2.5 py-2 text-xs font-medium",
                      params.features[f.key]
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 bg-white text-slate-400",
                    ].join(" ")}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <label className="flex w-40 flex-col gap-1">
              <span className="text-xs font-medium text-slate-500">방/건물 개수: {params.roomCount}</span>
              <input type="range" min={2} max={30} value={params.roomCount}
                onChange={(e) => set("roomCount", e.target.value)} className="accent-indigo-600" />
            </label>
          )}

          <label className="flex w-28 flex-col gap-1">
            <span className="text-xs font-medium text-slate-500">시드</span>
            <input value={params.seed} onChange={(e) => set("seed", e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
          </label>

          <button type="button" onClick={generate}
            className="h-10 rounded-md bg-indigo-600 px-6 text-sm font-semibold text-white hover:bg-indigo-700">
            🧱 맵 생성
          </button>
          <button type="button" onClick={reseed} title="랜덤 시드로 다시 생성"
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100">
            🎲 랜덤
          </button>
          <button type="button" onClick={exportJson} disabled={!rooms.length && !heightsArr}
            className="h-10 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40">
            ⬇ JSON
          </button>
        </div>

        {/* 지형 브러시 / 방 편집 안내 */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {terrainMode ? (
            <>
              <span className="text-xs font-semibold text-slate-500">브러시:</span>
              {[
                { k: "select", label: "🖐 카메라" },
                { k: "raise", label: "⬆ 높이기" },
                { k: "lower", label: "⬇ 낮추기" },
              ].map((b) => (
                <button key={b.k} type="button" onClick={() => setBrush(b.k)}
                  className={[
                    "rounded-md border px-3 py-1.5 text-xs font-medium",
                    brush === b.k ? "border-indigo-300 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}>
                  {b.label}
                </button>
              ))}
              <span className="text-xs text-slate-400">지형을 클릭·드래그하면 높낮이가 바뀝니다 (카메라 모드에서는 회전/줌)</span>
            </>
          ) : (
            <span className="text-xs text-slate-400">
              🖱 방을 클릭해 선택 → 아래 패널에서 크기 조절·방향 추가·삭제 · 드래그로 카메라 회전 · 휠 줌
            </span>
          )}
          {msg && <span className="text-xs font-medium text-amber-600">{msg}</span>}
        </div>
      </section>

      {/* 3D 뷰 + 편집 패널 */}
      <div className="flex min-h-0 flex-1 gap-3">
        <ThreeView
          className="min-w-0 flex-1"
          rooms={rooms}
          heightsArr={heightsArr}
          biome={params.biome}
          mapType={params.mapType}
          selectedId={selectedId}
          onSelect={setSelectedId}
          brush={terrainMode ? brush : "select"}
          onBrush={(idx, dir) => {
            setHeightsArr((h) => {
              if (!h) return h;
              const data = h.data.slice();
              const size = h.size;
              const cx = idx % size, cz = Math.floor(idx / size);
              for (let dz = -2; dz <= 2; dz++) {
                for (let dx = -2; dx <= 2; dx++) {
                  const x = cx + dx, z = cz + dz;
                  if (x < 0 || x >= size || z < 0 || z >= size) continue;
                  const fall = Math.max(0, 1 - Math.hypot(dx, dz) / 2.8);
                  data[z * size + x] = Math.max(0, data[z * size + x] + dir * 0.5 * fall);
                }
              }
              return { ...h, data };
            });
          }}
        />

        {/* 방 편집 패널 */}
        {!terrainMode && (
          <aside className="flex w-60 shrink-0 flex-col gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700">🛠 방 편집</h3>
            {!selected ? (
              <p className="text-xs text-slate-400">
                3D 뷰에서 방을 클릭하면 여기서 편집할 수 있습니다.
                {rooms.length === 0 && " 먼저 '맵 생성'을 누르세요."}
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-500">이름/용도</span>
                  <input value={selected.kind} onChange={(e) => renameKind(e.target.value)}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
                </label>
                {[
                  { k: "w", label: "가로", min: 1, max: 20, step: 0.5 },
                  { k: "d", label: "세로", min: 1, max: 20, step: 0.5 },
                  { k: "h", label: "높이", min: 0.2, max: 12, step: 0.2 },
                ].map((s) => (
                  <label key={s.k} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-slate-500">
                      {s.label}: {Number(selected[s.k]).toFixed(1)}
                    </span>
                    <input type="range" min={s.min} max={s.max} step={s.step} value={selected[s.k]}
                      onChange={(e) => resizeRoom(s.k, e.target.value)} className="accent-indigo-600" />
                  </label>
                ))}
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">방향으로 방 추가</p>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <span />
                    <DirBtn d={DIRS[0]} onClick={addRoom} />
                    <span />
                    <DirBtn d={DIRS[2]} onClick={addRoom} />
                    <span className="self-center text-xs text-slate-300">＋</span>
                    <DirBtn d={DIRS[3]} onClick={addRoom} />
                    <span />
                    <DirBtn d={DIRS[1]} onClick={addRoom} />
                    <span />
                  </div>
                </div>
                <button type="button" onClick={delRoom}
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">
                  🗑 이 방 삭제
                </button>
              </>
            )}
            <div className="mt-auto border-t border-slate-100 pt-2 text-xs text-slate-400">
              방 {rooms.length}개 · 시드 {params.seed}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function DirBtn({ d, onClick }) {
  return (
    <button type="button" onClick={() => onClick(d)}
      className="rounded-md border border-slate-300 px-1 py-1.5 text-xs text-slate-600 hover:bg-indigo-50 hover:text-indigo-600">
      {d.label}
    </button>
  );
}

// ── three.js 뷰 ────────────────────────────────────────────────────────
function ThreeView({ className, rooms, heightsArr, biome, mapType, selectedId, onSelect, brush, onBrush }) {
  const hostRef = useRef(null);
  const stateRef = useRef({}); // { renderer, scene, camera, controls, group, raycaster }
  const propsRef = useRef({});
  propsRef.current = { rooms, heightsArr, biome, mapType, selectedId, onSelect, brush, onBrush };

  // 1회 초기화
  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 80, 220);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    camera.position.set(28, 30, 28);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.05;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(30, 50, 20);
    scene.add(sun);

    const group = new THREE.Group();
    scene.add(group);

    const raycaster = new THREE.Raycaster();
    stateRef.current = { renderer, scene, camera, controls, group, raycaster };

    // 리사이즈 (숨김 탭 → 표시 시 0→실크기 전환 대응)
    const ro = new ResizeObserver(() => {
      const w = host.clientWidth, h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    // 포인터: 선택 / 지형 브러시
    let painting = false;
    const pick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const p = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(p, camera);
      return raycaster.intersectObjects(group.children, true);
    };
    const onDown = (e) => {
      const { brush: br, onSelect: sel, onBrush: paint, heightsArr: ha } = propsRef.current;
      const hits = pick(e);
      if (br !== "select" && ha) {
        painting = true;
        controls.enabled = false;
        const hit = hits.find((h) => h.object.userData.terrain);
        if (hit) paint(hit.object.userData.idxAt(hit.point), br === "raise" ? 1 : -1);
        return;
      }
      const hit = hits.find((h) => h.object.userData.roomId);
      sel(hit ? hit.object.userData.roomId : null);
    };
    const onMove = (e) => {
      if (!painting) return;
      const { brush: br, onBrush: paint } = propsRef.current;
      const hit = pick(e).find((h) => h.object.userData.terrain);
      if (hit) paint(hit.object.userData.idxAt(hit.point), br === "raise" ? 1 : -1);
    };
    const onUp = () => { painting = false; controls.enabled = true; };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    let raf;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      controls.dispose();
      renderer.dispose();
      host.contains(renderer.domElement) && host.removeChild(renderer.domElement);
    };
  }, []);

  // 콘텐츠 리빌드 (rooms/heights/biome/selection 변경 시)
  useEffect(() => {
    const st = stateRef.current;
    if (!st.group) return;
    const g = st.group;
    // 기존 메시 정리
    while (g.children.length) {
      const c = g.children.pop();
      c.geometry?.dispose?.();
      if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
      else c.material?.dispose?.();
      g.remove(c);
    }

    if (heightsArr) buildTerrain(g, heightsArr, biome);
    else if (rooms.length) buildRooms(g, rooms, mapType, biome, selectedId);
    else buildEmptyHint(g, biome);
  }, [rooms, heightsArr, biome, mapType, selectedId]);

  return <div ref={hostRef} className={`${className} overflow-hidden rounded-xl border border-slate-200 bg-slate-100`} />;
}

// 빈 상태: 바닥판만
function buildEmptyHint(g, biome) {
  const [r, gr, b] = biomeColor(biome, 0.25);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(r, gr, b) })
  );
  plane.rotation.x = -Math.PI / 2;
  g.add(plane);
  const grid = new THREE.GridHelper(40, 20, 0xffffff, 0xffffff);
  grid.material.opacity = 0.25;
  grid.material.transparent = true;
  g.add(grid);
}

// 지형 빌드
function buildTerrain(g, ha, biome) {
  const { size, data, waterLevel, trees } = ha;
  const geo = new THREE.PlaneGeometry(size, size, size - 1, size - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  let maxH = 0.001;
  for (let i = 0; i < data.length; i++) maxH = Math.max(maxH, data[i]);
  for (let i = 0; i < pos.count; i++) {
    const h = data[i] ?? 0;
    pos.setY(i, h);
    const [r, gr, b] = biomeColor(biome, h / maxH);
    colors[i * 3] = r; colors[i * 3 + 1] = gr; colors[i * 3 + 2] = b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  // 클릭 지점 → 높이 배열 인덱스
  mesh.userData.terrain = true;
  mesh.userData.idxAt = (pt) => {
    const x = Math.round(Math.min(size - 1, Math.max(0, pt.x + size / 2)));
    const z = Math.round(Math.min(size - 1, Math.max(0, pt.z + size / 2)));
    return z * size + x;
  };
  g.add(mesh);

  // 물
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.55 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterLevel;
  g.add(water);

  // 나무 (InstancedMesh)
  if (trees?.length) {
    const trunkG = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 5);
    const leafG = new THREE.ConeGeometry(0.45, 1.1, 6);
    const trunkM = new THREE.MeshLambertMaterial({ color: 0x7c5a3a });
    const leafM = new THREE.MeshLambertMaterial({ color: 0x2f6b3a });
    const trunks = new THREE.InstancedMesh(trunkG, trunkM, trees.length);
    const leaves = new THREE.InstancedMesh(leafG, leafM, trees.length);
    const m = new THREE.Matrix4();
    trees.forEach((t, i) => {
      const wx = t.x - size / 2, wz = t.z - size / 2;
      const h = ha.data[t.z * size + t.x] ?? t.h;
      m.setPosition(wx, h + 0.25, wz); trunks.setMatrixAt(i, m);
      m.setPosition(wx, h + 1.0, wz); leaves.setMatrixAt(i, m);
    });
    g.add(trunks, leaves);
  }
}

// 방(던전/도시/실내) 빌드
function buildRooms(g, rooms, mapType, biome, selectedId) {
  // 바닥
  const [r, gr, b] = biomeColor(biome, 0.25);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  rooms.forEach((rm) => {
    minX = Math.min(minX, rm.x); maxX = Math.max(maxX, rm.x + rm.w);
    minZ = Math.min(minZ, rm.z); maxZ = Math.max(maxZ, rm.z + rm.d);
  });
  const pad = 6, gw = maxX - minX + pad * 2, gd = maxZ - minZ + pad * 2;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(gw, gd),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(r, gr, b) })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(minX + (maxX - minX) / 2, -0.02, minZ + (maxZ - minZ) / 2);
  g.add(ground);

  // 던전 복도
  if (mapType === "던전") {
    const corrM = new THREE.MeshLambertMaterial({ color: 0xcbd5e1 });
    deriveCorridors(rooms).forEach((s) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.12, s.d), corrM);
      c.position.set(s.x + s.w / 2, 0.06, s.z + s.d / 2);
      g.add(c);
    });
  }

  rooms.forEach((rm) => {
    const isSel = rm.id === selectedId;
    const color = KIND_COLOR[rm.kind] ?? 0x6366f1;
    const mat = new THREE.MeshLambertMaterial({
      color,
      emissive: isSel ? 0xf59e0b : 0x000000,
      emissiveIntensity: isSel ? 0.55 : 0,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(rm.w, rm.h, rm.d), mat);
    box.position.set(rm.x + rm.w / 2, rm.h / 2, rm.z + rm.d / 2);
    box.userData.roomId = rm.id;
    g.add(box);
    // 윤곽선
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(box.geometry),
      new THREE.LineBasicMaterial({ color: isSel ? 0xf59e0b : 0x1e293b })
    );
    edge.position.copy(box.position);
    g.add(edge);
  });
}
