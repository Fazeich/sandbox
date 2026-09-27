import * as THREE from "three";
import { biomeSurfaceWeightsAt, CHUNK_SIZE, terrainHeight } from "@/lib/survival/world";

const GRID_SPACING = 1;
const NORMAL_SAMPLE_DISTANCE = 0.5;

type TerrainVertex = {
  position: [number, number, number];
  normal: [number, number, number];
  uv: [number, number];
  biomeWeights: [number, number, number, number];
};

const terrainVertex = (seed: number, worldX: number, worldZ: number, originX: number, originZ: number): TerrainVertex => {
  const height = terrainHeight(seed, worldX, worldZ);
  const delta = NORMAL_SAMPLE_DISTANCE;
  const dx = terrainHeight(seed, worldX + delta, worldZ) - terrainHeight(seed, worldX - delta, worldZ);
  const dz = terrainHeight(seed, worldX, worldZ + delta) - terrainHeight(seed, worldX, worldZ - delta);
  const nx = -dx / (2 * delta);
  const ny = 1;
  const nz = -dz / (2 * delta);
  const length = Math.hypot(nx, ny, nz) || 1;

  return {
    position: [worldX - originX - CHUNK_SIZE / 2, height, worldZ - originZ - CHUNK_SIZE / 2],
    normal: [nx / length, ny / length, nz / length],
    uv: [worldX * 0.15, worldZ * 0.15],
    biomeWeights: biomeSurfaceWeightsAt(seed, worldX, worldZ),
  };
};

/** Samples the same 1m triangle grid used by the rendered mesh. */
export const terrainSurfaceHeight = (seed: number, x: number, z: number): number => {
  const cellX = Math.floor(x / GRID_SPACING) * GRID_SPACING;
  const cellZ = Math.floor(z / GRID_SPACING) * GRID_SPACING;
  const tx = (x - cellX) / GRID_SPACING;
  const tz = (z - cellZ) / GRID_SPACING;
  const a = terrainHeight(seed, cellX, cellZ);
  const b = terrainHeight(seed, cellX, cellZ + GRID_SPACING);
  const c = terrainHeight(seed, cellX + GRID_SPACING, cellZ + GRID_SPACING);
  const d = terrainHeight(seed, cellX + GRID_SPACING, cellZ);

  return tx <= tz
    ? a * (1 - tz) + b * (tz - tx) + c * tx
    : a * (1 - tx) + c * tz + d * (tx - tz);
};

/** Builds a continuous, smooth-shaded terrain surface for one streamed chunk. */
export const buildTerrainGeometry = (seed: number, chunkX: number, chunkZ: number): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const terrainWeights: number[] = [];
  const cells = Math.round(CHUNK_SIZE / GRID_SPACING);
  const originX = chunkX * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;
  const vertices = Array.from({ length: cells + 1 }, (_, z) =>
    Array.from({ length: cells + 1 }, (_, x) =>
      terrainVertex(seed, originX + x * GRID_SPACING, originZ + z * GRID_SPACING, originX, originZ),
    ),
  );

  for (let z = 0; z < cells; z += 1) {
    for (let x = 0; x < cells; x += 1) {
      const a = vertices[z][x];
      const b = vertices[z + 1][x];
      const c = vertices[z + 1][x + 1];
      const d = vertices[z][x + 1];
      for (const vertex of [a, b, c, a, c, d]) {
        positions.push(...vertex.position);
        normals.push(...vertex.normal);
        uvs.push(...vertex.uv);
        colors.push(1, 1, 1);
        terrainWeights.push(...vertex.biomeWeights);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aBiomeWeights", new THREE.Float32BufferAttribute(terrainWeights, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};
