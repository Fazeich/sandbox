import { createRampForChunk, inRampLane, Ramp } from "./ramps";
import { createRng } from "@/lib/random";
import { expeditionClearing } from "@/lib/expedition";
import { CHUNK_SIZE, STREAM_WINDOW_COLS, STREAM_WINDOW_ROWS } from "../constants";
import { BIOMES } from "./biomes";
import { Terrain } from "./terrain";
import { Chunk, Collider, PedestalDef, Prop, PropKind } from "./types";

const TREE_MAX = 6;
const ROCK_MAX = 7;
const GRASS_PER_CHUNK = 96;
const FLOWERS_PER_CHUNK = 32;

const chunkSeed = (seed: number, cx: number, cz: number): number =>
  (seed * 4271 + cx * 92821 + cz * 68917) >>> 0;

const rollCount = (rng: () => number, density: number, max: number): number => {
  let count = 0;

  for (let i = 0; i < max; i += 1) {
    if (rng() < density * 0.65) count += 1;
  }

  return count;
};

const PEDESTAL_CLEARANCE = 3.4;

export const generateChunk = (
  terrain: Terrain,
  seed: number,
  cx: number,
  cz: number,
  pedestals: PedestalDef[],
): Chunk => {
  const originX = cx * CHUNK_SIZE;
  const originZ = cz * CHUNK_SIZE;
  const biome = terrain.biomeAt(
    originX + CHUNK_SIZE / 2,
    originZ + CHUNK_SIZE / 2,
  );
  const config = BIOMES[biome];
  const rng = createRng(chunkSeed(seed, cx, cz));
  const props: Prop[] = [];
  const ramps: Ramp[] = [];
  const nearbyRamps: Ramp[] = [];
  for (let ix = cx - 1; ix <= cx + 1; ix += 1) for (let iz = cz - 1; iz <= cz + 1; iz += 1) {
    const ramp = createRampForChunk(terrain, seed, ix, iz);
    if (ramp) {
      nearbyRamps.push(ramp);
      if (ix === cx && iz === cz) ramps.push(ramp);
    }
  }

  const place = (kind: PropKind, variants: number): void => {
    let x = 0;
    let z = 0;
    let clear = false;

    for (let attempt = 0; attempt < 5 && !clear; attempt += 1) {
      const margin = kind === "tree" || kind === "rock" ? 1.6 : 0;
      x = originX + margin + rng() * (CHUNK_SIZE - margin * 2);
      z = originZ + margin + rng() * (CHUNK_SIZE - margin * 2);
      clear = !nearbyRamps.some((ramp) => inRampLane(ramp, x, z)) && Math.hypot(x, z) > (kind === "tree" || kind === "rock" ? 4 : 0);
      clear &&= !expeditionClearing(x, z);
      if (kind === "tree" || kind === "rock") {
        clear &&= props.every((prop) => Math.hypot(prop.x - x, prop.z - z) >
          (kind === "tree" || prop.kind === "tree" ? 2.6 : 1.6));
        // Keep the starting crate pile accessible.
        clear &&= Math.hypot(x + 4.5, z + 6.5) > 3;
      }

      for (const pedestal of pedestals) {
        const dx = x - pedestal.position.x;
        const dz = z - pedestal.position.z;

        if (dx * dx + dz * dz < PEDESTAL_CLEARANCE * PEDESTAL_CLEARANCE) {
          clear = false;
          break;
        }
      }
    }

    if (!clear) {
      return;
    }

    props.push({
      kind,
      x,
      y: terrain.heightAt(x, z),
      z,
      rotation: rng() * Math.PI * 2,
      scale: 0.8 + rng() * 0.5,
      variant: Math.floor(rng() * variants),
      biome,
    });
  };

  const trees = rollCount(rng, config.treeDensity, TREE_MAX);

  for (let i = 0; i < trees; i += 1) {
    place("tree", 3);
  }

  const rocks = rollCount(rng, config.rockDensity, ROCK_MAX);

  for (let i = 0; i < rocks; i += 1) {
    place("rock", 3);
  }

  const grass = Math.floor(rng() * config.grassDensity * GRASS_PER_CHUNK);

  for (let i = 0; i < grass; i += 1) {
    place("grass", 3);
  }

  const flowers = Math.floor(
    rng() * config.flowerDensity * FLOWERS_PER_CHUNK,
  );

  for (let i = 0; i < flowers; i += 1) {
    place("flower", 4);
  }

  // Separate random stream keeps supply piles stable when vegetation is tuned.
  const crateRng = createRng(chunkSeed(seed + 191, cx, cz));
  const startPile = cx === 0 && cz === -1;
  if (startPile || crateRng() < 0.48) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const x = startPile ? -5 : originX + 3 + crateRng() * (CHUNK_SIZE - 6);
      const z = startPile ? -7 : originZ + 3 + crateRng() * (CHUNK_SIZE - 6);
      const height = terrain.heightAt(x, z);
      const clear = !nearbyRamps.some((ramp) => inRampLane(ramp, x, z)) && pedestals.every((p) => Math.hypot(p.position.x - x, p.position.z - z) > 5) &&
        props.every((p) => p.kind !== "tree" && p.kind !== "rock" || Math.hypot(p.x - x, p.z - z) > 2.8) &&
        Math.abs(terrain.heightAt(x + 1, z + 1) - height) < 0.25;
      if ((!clear || expeditionClearing(x, z)) && !startPile) continue;
      const width = startPile || crateRng() > 0.45 ? 2 : 1;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < width; col += 1) {
          const px = x + col * 0.88, pz = z + row * 0.88;
          const floor = terrain.heightAt(px, pz);
          props.push({kind: "crate", x: px, y: floor + 0.42, z: pz, rotation: 0, scale: 1, variant: row % 2, biome});
          if (startPile) props.push({kind: "crate", x: px, y: floor + 1.26, z: pz, rotation: 0, scale: 1, variant: col % 2, biome});
        }
      }
      props.push({kind: "crate", x: x + (width - 1) * 0.44, y: height + (startPile ? 2.1 : 1.26), z: z + 0.44, rotation: 0, scale: 1, variant: 1, biome});
      break;
    }
  }
  return { cx, cz, biome, props, ramps };
};

export const generateChunks = (
  terrain: Terrain,
  seed: number,
  pedestals: PedestalDef[],
): Chunk[] => {
  const chunks: Chunk[] = [];
  const halfCols = Math.floor(STREAM_WINDOW_COLS / 2);
  const halfRows = Math.floor(STREAM_WINDOW_ROWS / 2);

  for (let cz = 0; cz < STREAM_WINDOW_ROWS; cz += 1) {
    for (let cx = 0; cx < STREAM_WINDOW_COLS; cx += 1) {
      chunks.push(
        generateChunk(terrain, seed, cx - halfCols, cz - halfRows, pedestals),
      );
    }
  }

  return chunks;
};

export const buildColliders = (
  props: Prop[],
  pedestals: PedestalDef[],
): Collider[] => {
  const colliders: Collider[] = [];

  for (const prop of props) {
    if (prop.kind === "tree") {
      colliders.push({ x: prop.x, z: prop.z, radius: 0.42 * prop.scale });
    } else if (prop.kind === "rock" && prop.scale > 1.02) {
      colliders.push({ x: prop.x, z: prop.z, radius: 0.62 * prop.scale });
    }
  }

  for (const pedestal of pedestals) {
    colliders.push({
      x: pedestal.position.x,
      z: pedestal.position.z,
      radius: Math.max(pedestal.halfW, pedestal.halfD),
    });
  }

  return colliders;
};
