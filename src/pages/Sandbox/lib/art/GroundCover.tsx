import { useLayoutEffect, useMemo, useRef } from "react";
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, InstancedMesh, MeshStandardMaterial, Object3D } from "three";
import { createRng } from "@/lib/random";
import { biomeAt, CHUNK_SIZE, terrainHeight, WorldChunk } from "@/lib/survival/world";
import { terrainSurfaceHeight } from "../terrain";

type Tuft = { x: number; y: number; z: number; scale: number; rotation: number; color: string };

const createTuftGeometry = () => {
  const geometry = new BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  const shades = [new Color("#80c955"), new Color("#98d75d"), new Color("#b5e267"), new Color("#72bb4e")];
  for (let blade = 0; blade < 4; blade++) {
    const angle = blade * Math.PI * 0.47;
    const width = 0.036 + (blade % 2) * 0.009;
    const height = 0.22 + (blade % 3) * 0.055;
    const lean = 0.03 + (blade % 2) * 0.025;
    const baseX = Math.sin(angle) * 0.025;
    const baseZ = Math.cos(angle) * 0.025;
    const sideX = Math.cos(angle) * width * 0.5;
    const sideZ = -Math.sin(angle) * width * 0.5;
    positions.push(
      baseX - sideX, 0, baseZ - sideZ,
      baseX + sideX, 0, baseZ + sideZ,
      baseX + Math.sin(angle) * lean, height, baseZ + Math.cos(angle) * lean,
    );
    const shade = shades[blade];
    colors.push(shade.r, shade.g, shade.b, shade.r, shade.g, shade.b, shade.r * 1.13, shade.g * 1.1, shade.b * 0.92);
  }
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
};

const tuftGeometry = createTuftGeometry();
const tuftMaterial = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 1, flatShading: true });
const tintByBiome = { forest: "#a3dc62", desert: "#efcf8c", snow: "#e7f3ee" } as const;

const createTufts = (chunks: WorldChunk[], seed: number) => {
  const tufts: Tuft[] = [];
  for (const chunk of chunks) {
    const random = createRng((seed ^ Math.imul(chunk.x, 374761393) ^ Math.imul(chunk.z, 668265263)) >>> 0);
    for (let index = 0; index < 46; index++) {
      const x = chunk.x * CHUNK_SIZE + random() * CHUNK_SIZE;
      const z = chunk.z * CHUNK_SIZE + random() * CHUNK_SIZE;
      const y = terrainSurfaceHeight(seed, x, z);
      if (y < 0.25) continue;
      const biome = biomeAt(seed, x, z);
      const probability = biome === "forest" ? 0.62 : biome === "desert" ? 0.035 : 0.08;
      if (random() > probability) continue;
      const slope = Math.hypot(terrainHeight(seed, x + 1, z) - terrainHeight(seed, x - 1, z), terrainHeight(seed, x, z + 1) - terrainHeight(seed, x, z - 1));
      if (slope > 2.1 || chunk.nodes.some((node) => Math.hypot(node.x - x, node.z - z) < (node.kind === "tree" ? 1.5 * node.scale : 0.55))) continue;
      tufts.push({ x, y, z, scale: (biome === "forest" ? 0.62 : 0.35) + random() * 0.38, rotation: random() * Math.PI, color: tintByBiome[biome] });
    }
  }
  return tufts;
};

/** Bright seeded ground-cover tufts, sparse outside the forest, in one streamed draw call. */
export function GrassInstances({ chunks, seed }: { chunks: WorldChunk[]; seed: number }) {
  const mesh = useRef<InstancedMesh>(null);
  const transform = useMemo(() => new Object3D(), []);
  const tufts = useMemo(() => createTufts(chunks, seed), [chunks, seed]);
  const capacity = Math.max(1, tufts.length);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const tint = new Color();
    tufts.forEach((tuft, index) => {
      transform.position.set(tuft.x, tuft.y, tuft.z);
      transform.rotation.set(0, tuft.rotation, 0);
      transform.scale.setScalar(tuft.scale);
      transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
      mesh.current!.setColorAt(index, tint.set(tuft.color));
    });
    mesh.current.count = tufts.length;
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [tufts, transform, capacity]);

  return <instancedMesh ref={mesh} args={[tuftGeometry, tuftMaterial, capacity]} receiveShadow dispose={null} />;
}
