import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BufferGeometry, Color, Float32BufferAttribute, ShaderMaterial, Vector2 } from "three";
import { createRng } from "@/lib/random";
import { biomeAt, CHUNK_SIZE, terrainHeight, WorldChunk } from "@/lib/survival/world";

const vertexShader = `
attribute float aSize;
attribute float aOpacity;
attribute float aSeed;
attribute vec3 aTint;
uniform float uViewportHeight;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
varying vec3 vTint;
varying float vOpacity;
varying float vSeed;
void main() {
  vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
  float distanceToCamera = length(viewPosition.xyz);
  float nearFade = smoothstep(3.0, max(10.0, uFogNear * 0.5), distanceToCamera);
  float farFade = 1.0 - smoothstep(uFogFar * 0.88, uFogFar + 22.0, distanceToCamera);
  vOpacity = aOpacity * nearFade * farFade;
  vTint = aTint;
  vSeed = aSeed + uTime * 0.025;
  float pixelsPerUnit = uViewportHeight * projectionMatrix[1][1] * 0.5 / max(-viewPosition.z, 0.1);
  gl_PointSize = clamp(aSize * pixelsPerUnit, 1.0, 220.0);
  gl_Position = projectionMatrix * viewPosition;
}
`;

const fragmentShader = `
uniform float uTime;
varying vec3 vTint;
varying float vOpacity;
varying float vSeed;
float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
    mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), blend.x), blend.y);
}
float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += noise(point) * amplitude;
    point = point * 2.03 + 13.7;
    amplitude *= 0.5;
  }
  return value;
}
void main() {
  vec2 point = gl_PointCoord * 2.0 - 1.0;
  vec2 drift = vec2(uTime * 0.009, -uTime * 0.006);
  float broad = fbm(point * 3.0 + vec2(vSeed, vSeed * 1.73) + drift);
  float detail = fbm(point * 7.0 - vec2(vSeed * 0.63, vSeed) - drift * 1.8);
  float raggedRadius = length(point) + (broad - 0.48) * 0.42 + (detail - 0.5) * 0.16;
  float billow = 1.0 - smoothstep(0.48, 1.03, raggedRadius);
  float wisps = 0.68 + 0.32 * smoothstep(0.22, 0.76, detail + broad * 0.24);
  float alpha = vOpacity * billow * wisps;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(vTint, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const createFogGeometry = (chunks: WorldChunk[], seed: number, puffsPerChunk: number) => {
  const count = chunks.length * puffsPerChunk;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacities = new Float32Array(count);
  const seeds = new Float32Array(count);
  const tints = new Float32Array(count * 3);
  const color = new Color();
  let index = 0;
  for (const chunk of chunks) {
    const random = createRng((seed ^ Math.imul(chunk.x, 668265263) ^ Math.imul(chunk.z, 374761393) ^ 0x5f3759df) >>> 0);
    for (let puff = 0; puff < puffsPerChunk; puff++, index++) {
      const x = chunk.x * CHUNK_SIZE + random() * CHUNK_SIZE;
      const z = chunk.z * CHUNK_SIZE + random() * CHUNK_SIZE;
      const y = terrainHeight(seed, x, z) + 0.8 + random() * 7.2;
      const biome = biomeAt(seed, x, z);
      const base = biome === "snow" ? "#dcecff" : biome === "forest" ? "#c9e9ce" : "#f5e3c5";
      color.set(base).lerp(new Color("#d9d0bd"), random() * 0.18);
      positions.set([x, y, z], index * 3);
      tints.set([color.r, color.g, color.b], index * 3);
      sizes[index] = 6.5 + random() * 9;
      opacities[index] = 0.055 + random() * 0.045;
      seeds[index] = random() * 97;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aOpacity", new Float32BufferAttribute(opacities, 1));
  geometry.setAttribute("aSeed", new Float32BufferAttribute(seeds, 1));
  geometry.setAttribute("aTint", new Float32BufferAttribute(tints, 3));
  geometry.computeBoundingSphere();
  return geometry;
};

/** World-anchored, animated noise puffs layer over distance fog for soft 3D mist. */
export function VolumetricFog({ chunks, seed, quality, fogNear, fogFar }: {
  chunks: WorldChunk[]; seed: number; quality: "high" | "low"; fogNear: number; fogFar: number;
}) {
  const material = useRef<ShaderMaterial>(null);
  const drawingBuffer = useMemo(() => new Vector2(), []);
  const puffsPerChunk = quality === "high" ? 12 : 7;
  const geometry = useMemo(() => createFogGeometry(chunks, seed, puffsPerChunk), [chunks, seed, puffsPerChunk]);
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uViewportHeight: { value: 1 },
    uFogNear: { value: fogNear },
    uFogFar: { value: fogFar },
  }), [fogFar, fogNear]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock, gl }) => {
    if (!material.current) return;
    gl.getDrawingBufferSize(drawingBuffer);
    material.current.uniforms.uTime.value = clock.elapsedTime;
    material.current.uniforms.uViewportHeight.value = drawingBuffer.y;
    material.current.uniforms.uFogNear.value = fogNear;
    material.current.uniforms.uFogFar.value = fogFar;
  });

  return <points geometry={geometry} frustumCulled>
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
      transparent depthTest depthWrite={false} toneMapped={false} />
  </points>;
}
