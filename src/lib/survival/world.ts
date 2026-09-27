import { createRng } from "../random";

export const CHUNK_SIZE = 20;
export const RENDER_DISTANCE_OPTIONS = {
  near: { label: "Близкая", radius: 2, fogNear: 25, fogFar: 58 },
  medium: { label: "Средняя", radius: 3, fogNear: 42, fogFar: 92 },
  far: { label: "Дальняя", radius: 4, fogNear: 66, fogFar: 140 },
} as const;
export type RenderDistance = keyof typeof RENDER_DISTANCE_OPTIONS;
export const DEFAULT_RENDER_DISTANCE: RenderDistance = "medium";
export const VIEW_RADIUS = RENDER_DISTANCE_OPTIONS[DEFAULT_RENDER_DISTANCE].radius;
export const WATER_LEVEL = 0;
const CHUNK_CACHE_LIMIT = 81;
export type NodeKind = "tree" | "stone" | "fiber" | "nut" | "animal"
  | "flint" | "branch" | "grass" | "berryBush" | "mushroom" | "termiteMound" | "rottenLog" | "nest" | "bones" | "clams" | "tuberPlant";
/** Aim height above ground for targeting each kind of natural object. */
export const NODE_TARGET_HEIGHT: Record<NodeKind, number> = {
  tree: 1.3, animal: 0.7, termiteMound: 0.75, berryBush: 0.45, rottenLog: 0.25, tuberPlant: 0.25,
  stone: 0.16, fiber: 0.16, nut: 0.16, flint: 0.16, branch: 0.12, grass: 0.2, mushroom: 0.1, nest: 0.12, bones: 0.1, clams: 0.08,
};
/** How many things a renewable-looking source yields before it is spent (per node, never regrows yet). */
export const NODE_CAPACITY: Partial<Record<NodeKind, number>> = { berryBush: 6, termiteMound: 6, clams: 3, rottenLog: 3 };
export const TREE_TWIGS = 3;
export type TreeType = "birch" | "oak" | "oakWide" | "appleOak" | "oakSpreading" | "birchForked" | "rowanFan" | "oakWindswept";
export const APPLE_TREE_FRUIT_COUNT = 5;
/** Approximate maximum modeled dimension in metres; smaller trees receive higher spawn weights. */
export const TREE_VARIANTS: Record<TreeType, { size: number; trunkRadius: number }> = {
  rowanFan: { size: 5.42, trunkRadius: 0.25 },
  oakWindswept: { size: 6.50, trunkRadius: 0.32 },
  oakSpreading: { size: 6.51, trunkRadius: 0.38 },
  oak: { size: 6.8, trunkRadius: 0.32 },
  oakWide: { size: 7.2, trunkRadius: 0.42 },
  appleOak: { size: 7.6, trunkRadius: 0.54 },
  birch: { size: 7.75, trunkRadius: 0.25 },
  birchForked: { size: 8.43, trunkRadius: 0.21 },
};
export type BiomeId = "desert" | "forest" | "snow";
/** `variant`: berry bush "blue" | "red", mushroom "edible" | "toxic"; `count`: eggs in a nest. */
export interface NaturalNode { id: string; kind: NodeKind; x: number; z: number; scale: number; treeType?: TreeType; variant?: string; count?: number }
/** First index of the second generation pass; keeps ids of the original objects stable across versions. */
export const EXTRA_NODE_INDEX = 100;
export interface WorldChunk { key: string; x: number; z: number; nodes: NaturalNode[] }
const hash = (x: number, z: number, seed: number) => { let n = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const smooth = (n: number) => n * n * (3 - 2 * n);
const noise = (x: number, z: number, seed: number) => {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed), c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const terrainHeight = (seed: number, x: number, z: number): number => {
  const broad = noise(x * 0.007, z * 0.007, seed) * 9;
  const hills = noise(x * 0.025, z * 0.025, seed + 91) * 4;
  const detail = noise(x * 0.09, z * 0.09, seed + 313) * 0.5;
  const basin = noise(x * 0.014 + 25, z * 0.014 - 31, seed + 18);
  return broad + hills + detail - 4.5 - Math.max(0, basin - 0.55) * 15;
};
const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const biomeRegionWeightsAt = (seed: number, x: number, z: number): [number, number, number] => {
  const height = terrainHeight(seed, x, z);
  const temperature = noise(x * 0.0035 + 31.7, z * 0.0035 - 18.2, seed + 131);
  const moisture = noise(x * 0.009, z * 0.009, seed + 65);
  const snow = Math.max(1 - smoothstep(0.18, 0.36, temperature), smoothstep(7.4, 10.2, height));
  const desert = Math.max(1 - smoothstep(0.32, 0.48, moisture), smoothstep(0.70, 0.84, temperature)) * (1 - snow);
  const forest = Math.max(0, 1 - snow - desert);
  const total = forest + desert + snow || 1;
  return [forest / total, desert / total, snow / total];
};
export const biomeAt = (seed: number, x: number, z: number): BiomeId => {
  const [forest, desert, snow] = biomeRegionWeightsAt(seed, x, z);
  return snow >= desert && snow >= forest ? "snow" : desert >= forest ? "desert" : "forest";
};

/** Continuous soil coverage variation on forest ground, from grass (0) to earth (1). */
export const forestSoilBlendAt = (seed: number, x: number, z: number): number =>
  smoothstep(0.58, 0.78, noise(x * 0.035, z * 0.035, seed + 177));

/** Smooth grass/earth/sand/snow coverage. The returned weights always sum to one. */
export const biomeSurfaceWeightsAt = (seed: number, x: number, z: number): [number, number, number, number] => {
  const [forestWeight, desertWeight, snowWeight] = biomeRegionWeightsAt(seed, x, z);
  const soil = forestSoilBlendAt(seed, x, z);
  return [forestWeight * (1 - soil), forestWeight * soil, desertWeight, snowWeight];
};

const treeTypeAt = (seed: number, cx: number, cz: number, index: number): TreeType => {
  const roll = hash(cx * 67 + index, cz * 131 - index, seed + 547);
  const variants = Object.entries(TREE_VARIANTS) as Array<[TreeType, { size: number; trunkRadius: number }]>;
  const total = variants.reduce((sum, [, variant]) => sum + 1 / variant.size ** 2, 0);
  let threshold = roll * total;
  for (const [type, variant] of variants) {
    threshold -= 1 / variant.size ** 2;
    if (threshold < 0) return type;
  }
  return variants[variants.length - 1][0];
};
export const generateChunk = (seed: number, cx: number, cz: number): WorldChunk => {
  const rng = createRng(Math.floor(hash(cx, cz, seed) * 4294967295));
  const nodes: NaturalNode[] = [];
  const biome = biomeAt(seed, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
  const kinds: Array<NodeKind | null> = biome === "forest"
    ? ["tree", "tree", "tree", "tree", "tree", "stone", "stone", "fiber", "fiber", "nut", "nut", null, "animal"]
    : biome === "snow"
      ? ["tree", "tree", "stone", "stone", "stone", "fiber", "nut", null, "animal"]
      : ["stone", "stone", "stone", "stone", "fiber", "fiber", "nut", null, "animal"];
  kinds.forEach((kind, index) => {
    if (!kind) return;
    const x = cx * CHUNK_SIZE + 2 + rng() * (CHUNK_SIZE - 4), z = cz * CHUNK_SIZE + 2 + rng() * (CHUNK_SIZE - 4);
    const treeType = kind === "tree" ? treeTypeAt(seed, cx, cz, index) : undefined;
    const scale = 0.8 + rng() * 0.15;
    if (terrainHeight(seed, x, z) < 0.3 || kind === "animal" && rng() > 0.4 || nodes.some((node) => Math.hypot(node.x - x, node.z - z) < 2)) return;
    nodes.push({ id: `${cx}:${cz}:${index}`, kind, x, z, scale, ...(treeType ? { treeType } : {}) });
  });
  addForage(seed, cx, cz, biome, nodes);
  return { key: `${cx}:${cz}`, x: cx, z: cz, nodes };
};
/** Small useful things lying around: a separate random stream so the original objects never shift. */
const FORAGE: Record<BiomeId, NodeKind[]> = {
  forest: ["branch", "branch", "branch", "grass", "berryBush", "berryBush", "mushroom", "mushroom", "termiteMound", "rottenLog", "nest", "bones", "tuberPlant", "tuberPlant", "flint", "clams", "clams"],
  desert: ["branch", "grass", "grass", "grass", "termiteMound", "termiteMound", "bones", "bones", "flint", "tuberPlant", "clams", "clams", "nest"],
  snow: ["branch", "branch", "grass", "bones", "bones", "flint", "berryBush", "rottenLog", "clams", "nest"],
};
const addForage = (seed: number, cx: number, cz: number, biome: BiomeId, nodes: NaturalNode[]) => {
  const rng = createRng(Math.floor(hash(cx + 7919, cz - 104729, seed) * 4294967295));
  FORAGE[biome].forEach((kind, offset) => {
    if (rng() > 0.62) return;
    const shore = kind === "clams";
    // Clams live on the waterline; everything else on dry land. A few tries per object.
    for (let attempt = 0; attempt < (shore ? 8 : 2); attempt++) {
      const x = cx * CHUNK_SIZE + 1 + rng() * (CHUNK_SIZE - 2), z = cz * CHUNK_SIZE + 1 + rng() * (CHUNK_SIZE - 2), h = terrainHeight(seed, x, z);
      if (shore ? h < 0.02 || h > 0.3 : h < 0.3) continue;
      if (nodes.some((node) => Math.hypot(node.x - x, node.z - z) < (node.kind === "tree" ? 1.6 : 1.2))) continue;
      const node: NaturalNode = { id: `${cx}:${cz}:${EXTRA_NODE_INDEX + offset}`, kind, x, z, scale: 0.85 + rng() * 0.3 };
      if (kind === "berryBush") node.variant = rng() < 0.42 ? "red" : "blue";
      if (kind === "mushroom") node.variant = rng() < 0.4 ? "toxic" : "edible";
      if (kind === "nest") node.count = 1 + Math.floor(rng() * 3);
      nodes.push(node);
      return;
    }
  });
};

export const getNode = (seed: number, id: string): NaturalNode | undefined => {
  if (typeof id !== "string" || !/^-?\d+:-?\d+:\d+$/.test(id)) return undefined;
  const [x, z] = id.split(":").map(Number);
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) return undefined;
  return generateChunk(seed, x, z).nodes.find((node) => node.id === id);
};
export const findSpawn = (seed: number) => {
  // New seeds have different geography; prefer dry ground, never manufacture a camp or starter kit.
  for (let ring = 0; ring < 60; ring++) {
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + (seed % 100) * 0.01;
      const x = Math.cos(angle) * ring * 16, z = Math.sin(angle) * ring * 16;
      const h = terrainHeight(seed, x, z);
      if (h > 0.8 && h < 4 && terrainHeight(seed, x + 1, z) > 0.5) return { x, y: h + 1.7, z, yaw: (seed % 628) * 0.01 };
    }
  }
  return { x: 0, y: Math.max(1.7, terrainHeight(seed, 0, 0) + 1.7), z: 0, yaw: 0 };
};
export const randomSeed = () => {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 4294967296);
};

/** Sliding active window, with a bounded cache. World coordinates themselves have no boundary. */
export class ChunkStream {
  readonly cache = new Map<string, WorldChunk>();
  chunks: WorldChunk[] = [];
  center = "";
  constructor(readonly seed: number, public radius: number = VIEW_RADIUS) {}
  update(x: number, z: number, radius = this.radius): boolean {
    radius = Math.max(0, Math.min(RENDER_DISTANCE_OPTIONS.far.radius, Math.floor(radius)));
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), center = `${cx}:${cz}`;
    if (center === this.center && radius === this.radius) return false;
    this.radius = radius;
    this.center = center; this.chunks = [];
    for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
      const key = `${cx + dx}:${cz + dz}`;
      let chunk = this.cache.get(key);
      if (!chunk) { chunk = generateChunk(this.seed, cx + dx, cz + dz); this.cache.set(key, chunk); }
      this.chunks.push(chunk);
    }
    if (this.cache.size > CHUNK_CACHE_LIMIT) {
      const activeKeys = new Set(this.chunks.map((chunk) => chunk.key));
      const ordered = Array.from(this.cache.values()).sort((a, b) => (Math.abs(b.x - cx) + Math.abs(b.z - cz)) - (Math.abs(a.x - cx) + Math.abs(a.z - cz)));
      for (const chunk of ordered) { if (this.cache.size <= CHUNK_CACHE_LIMIT) break; if (!activeKeys.has(chunk.key)) this.cache.delete(chunk.key); }
    }
    return true;
  }
}
