// 맵 제작기 — 절차적 생성 유틸 (시드 기반, 결정론적)
// 지형맵(월드/지역)은 높이맵을, 구조맵(던전/도시/실내)은 방(rooms) 배열을 생성한다.

// ── 시드 RNG (mulberry32) ────────────────────────────────────────────────
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 문자열 시드 → 숫자
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── 값 노이즈 (2D, 옥타브 합성) ──────────────────────────────────────────
function valueNoise2D(seed) {
  const rng = makeRng(seed);
  const perm = new Uint8Array(512);
  const grad = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; grad[i] = rng(); }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const at = (x, y) => grad[perm[(perm[x & 255] + (y & 255)) & 255]];
  const fade = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; // 0..1
  };
}

export function octaveNoise(seed, octaves = 4) {
  const noises = Array.from({ length: octaves }, (_, i) => valueNoise2D(seed + i * 1013));
  return (x, y) => {
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noises[i](x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5; freq *= 2;
    }
    return sum / norm;
  };
}

// ── 지형 생성 (월드맵/지역맵) ────────────────────────────────────────────
// features: { mountain, river, lake, forest } (bool)
// 반환: { size, heights: Float32Array(size*size), trees: [{x,z}], waterLevel }
export function genTerrain(seedNum, size, features) {
  const noise = octaveNoise(seedNum, 5);
  const ridge = octaveNoise(seedNum + 7777, 4);
  const rng = makeRng(seedNum + 31);
  const heights = new Float32Array(size * size);
  const scale = 8 / size; // 노이즈 주파수

  for (let z = 0; z < size; z++) {
    for (let x = 0; x < size; x++) {
      let h = noise(x * scale * size / 8, z * scale * size / 8);
      h = Math.pow(h, 1.3) * 5; // 0..~5
      if (features.mountain) {
        const r = Math.abs(ridge(x * scale * 1.2, z * scale * 1.2) - 0.5) * 2;
        h += Math.pow(1 - r, 3.5) * 4.5; // 산맥 융기 (완만)
      }
      heights[z * size + x] = h;
    }
  }
  const waterLevel = 1.15;

  // 강: 사인 곡선 경로를 따라 침식
  if (features.river) {
    const amp = size * 0.18, k = (Math.PI * 2) / size;
    for (let z = 0; z < size; z++) {
      const cx = size / 2 + Math.sin(z * k * 1.5 + seedNum % 7) * amp;
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.round(cx) + dx;
        if (x < 0 || x >= size) continue;
        const i = z * size + x;
        const depth = 1 - Math.abs(dx) / 3;
        heights[i] = Math.min(heights[i], waterLevel - 0.5 * depth);
      }
    }
  }
  // 호수: 임의 지점 원형 함몰
  if (features.lake) {
    const lx = size * (0.25 + rng() * 0.5), lz = size * (0.25 + rng() * 0.5);
    const rad = size * 0.12;
    for (let z = 0; z < size; z++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - lx, z - lz);
        if (d < rad) {
          const i = z * size + x;
          const t = 1 - d / rad;
          heights[i] = Math.min(heights[i], waterLevel - 0.8 * t);
        }
      }
    }
  }
  // 숲: 물 위·고지대 제외한 곳에 나무 배치
  const trees = [];
  if (features.forest) {
    const fnoise = octaveNoise(seedNum + 555, 3);
    for (let z = 1; z < size - 1; z += 1) {
      for (let x = 1; x < size - 1; x += 1) {
        const h = heights[z * size + x];
        if (h > waterLevel + 0.25 && h < 6 && fnoise(x * 0.12, z * 0.12) > 0.62 && rng() > 0.55) {
          trees.push({ x, z, h });
        }
      }
    }
  }
  return { size, heights, trees, waterLevel };
}

// 바이옴 색 램프: 높이 t(0..1) → [r,g,b]
export const BIOME_RAMPS = {
  초원: [[0.24, 0.42, 0.22], [0.42, 0.62, 0.30], [0.55, 0.55, 0.42], [0.92, 0.94, 0.96]],
  사막: [[0.78, 0.64, 0.38], [0.86, 0.74, 0.48], [0.72, 0.56, 0.38], [0.95, 0.90, 0.80]],
  설원: [[0.75, 0.80, 0.86], [0.88, 0.91, 0.95], [0.80, 0.84, 0.90], [1.0, 1.0, 1.0]],
  화산: [[0.18, 0.14, 0.14], [0.35, 0.24, 0.20], [0.55, 0.25, 0.12], [0.95, 0.45, 0.15]],
  늪: [[0.20, 0.28, 0.20], [0.32, 0.38, 0.24], [0.45, 0.48, 0.32], [0.70, 0.72, 0.60]],
};

export function biomeColor(biome, t) {
  const ramp = BIOME_RAMPS[biome] || BIOME_RAMPS["초원"];
  const f = Math.min(0.999, Math.max(0, t)) * (ramp.length - 1);
  const i = Math.floor(f), u = f - i;
  const a = ramp[i], b = ramp[Math.min(i + 1, ramp.length - 1)];
  return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
}

// ── 방(rooms) 생성 — 던전/도시/실내 ─────────────────────────────────────
// room = { id, x, z, w, d, h, kind }
let _id = 0;
const nid = () => "r" + (++_id) + "_" + Math.random().toString(36).slice(2, 6);

export function roomsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.z < b.z + b.d && a.z + a.d > b.z;
}

export function genDungeon(seedNum, count) {
  const rng = makeRng(seedNum);
  const rooms = [{ id: nid(), x: -2, z: -2, w: 4, d: 4, h: 1.2, kind: "방" }];
  let guard = 0;
  while (rooms.length < count && guard++ < 400) {
    const base = rooms[Math.floor(rng() * rooms.length)];
    const w = 3 + Math.floor(rng() * 4), d = 3 + Math.floor(rng() * 4);
    const dir = Math.floor(rng() * 4);
    const gap = 2 + Math.floor(rng() * 3); // 복도 길이
    let x = base.x, z = base.z;
    if (dir === 0) x = base.x + base.w + gap;           // 동
    else if (dir === 1) x = base.x - gap - w;           // 서
    else if (dir === 2) z = base.z + base.d + gap;      // 남
    else z = base.z - gap - d;                          // 북
    // 수직축 랜덤 오프셋
    if (dir < 2) z = base.z + Math.floor((rng() - 0.5) * base.d);
    else x = base.x + Math.floor((rng() - 0.5) * base.w);
    const cand = { id: nid(), x, z, w, d, h: 1 + rng() * 0.8, kind: rng() > 0.85 ? "보스방" : "방" };
    if (!rooms.some((r) => roomsOverlap(cand, r))) rooms.push(cand);
  }
  return rooms;
}

export function genCity(seedNum, count) {
  const rng = makeRng(seedNum);
  const rooms = [];
  const street = 3; // 도로 폭
  const bw = 4;     // 블록 한 변
  const side = Math.ceil(Math.sqrt(count));
  let n = 0;
  for (let gz = 0; gz < side && n < count; gz++) {
    for (let gx = 0; gx < side && n < count; gx++) {
      const x = gx * (bw + street) - (side * (bw + street)) / 2;
      const z = gz * (bw + street) - (side * (bw + street)) / 2;
      const h = 1 + Math.floor(rng() * 7) + rng();
      rooms.push({
        id: nid(), x, z,
        w: bw - Math.floor(rng() * 2), d: bw - Math.floor(rng() * 2),
        h, kind: h > 5 ? "고층" : h > 2.5 ? "건물" : "주택",
      });
      n++;
    }
  }
  return rooms;
}

export function genIndoor(seedNum, count) {
  const rng = makeRng(seedNum);
  // BSP 분할: 큰 사각형을 count개 방으로 쪼갠다.
  let leaves = [{ x: -9, z: -7, w: 18, d: 14 }];
  let guard = 0;
  while (leaves.length < count && guard++ < 200) {
    leaves.sort((a, b) => b.w * b.d - a.w * a.d);
    const r = leaves.shift();
    const vertical = r.w >= r.d;
    if (vertical && r.w >= 6) {
      const cut = 3 + Math.floor(rng() * (r.w - 5));
      leaves.push({ ...r, w: cut }, { ...r, x: r.x + cut, w: r.w - cut });
    } else if (!vertical && r.d >= 6) {
      const cut = 3 + Math.floor(rng() * (r.d - 5));
      leaves.push({ ...r, d: cut }, { ...r, z: r.z + cut, d: r.d - cut });
    } else {
      leaves.push(r); // 더 못 쪼갬
      if (leaves.every((l) => l.w < 6 && l.d < 6)) break;
    }
  }
  const KINDS = ["거실", "방", "주방", "창고", "복도", "욕실"];
  return leaves.slice(0, count).map((r, i) => ({
    id: nid(),
    x: r.x + 0.25, z: r.z + 0.25, w: r.w - 0.5, d: r.d - 0.5,
    h: 0.35, kind: KINDS[i % KINDS.length],
  }));
}

// 던전 복도(파생): 각 방을 가장 가까운 이전 방과 L자로 연결
export function deriveCorridors(rooms) {
  const segs = [];
  const cx = (r) => r.x + r.w / 2, cz = (r) => r.z + r.d / 2;
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = Infinity;
    for (let j = 0; j < i; j++) {
      const d = Math.hypot(cx(rooms[i]) - cx(rooms[j]), cz(rooms[i]) - cz(rooms[j]));
      if (d < bd) { bd = d; best = j; }
    }
    const a = rooms[best], b = rooms[i];
    const ax = cx(a), az = cz(a), bx = cx(b), bz = cz(b);
    segs.push({ x: Math.min(ax, bx), z: az - 0.5, w: Math.abs(bx - ax), d: 1 }); // 수평
    segs.push({ x: bx - 0.5, z: Math.min(az, bz), w: 1, d: Math.abs(bz - az) }); // 수직
  }
  return segs.filter((s) => s.w > 0.01 && s.d > 0.01);
}
