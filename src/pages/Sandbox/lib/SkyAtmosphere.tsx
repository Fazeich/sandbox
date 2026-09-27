import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const skyVertex = `
varying vec3 vDirection;
void main() {
  vDirection = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFragment = `
varying vec3 vDirection;
const vec3 sunDirection = vec3(0.375, 0.750, -0.545);
void main() {
  vec3 direction = normalize(vDirection);
  float altitude = smoothstep(-0.16, 0.85, direction.y);
  vec3 horizon = vec3(0.69, 0.82, 0.84);
  vec3 blue = mix(vec3(0.28, 0.54, 0.78), vec3(0.10, 0.30, 0.63), smoothstep(0.35, 1.0, direction.y));
  vec3 color = mix(horizon, blue, altitude);
  float facingSun = max(dot(direction, sunDirection), 0.0);
  color = mix(color, vec3(1.0, 0.79, 0.56), pow(facingSun, 7.0) * (1.0 - altitude * 0.38) * 0.58);
  color += vec3(1.0, 0.80, 0.60) * pow(facingSun, 90.0) * 0.20;
  color += vec3(1.0, 0.95, 0.78) * smoothstep(0.9995, 0.99985, facingSun) * 0.68;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}`;

const cloudVertex = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}`;

const cloudFragment = `
uniform vec3 uCenter;
uniform vec3 uRadii;
uniform float uSeed;
uniform float uTime;
varying vec3 vWorldPosition;
float hash(vec3 point) {
  return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise(vec3 point) {
  vec3 cell = floor(point);
  vec3 blend = fract(point);
  blend = blend * blend * (3.0 - 2.0 * blend);
  float bottom = mix(mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), blend.x),
    mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), blend.x), blend.y);
  float top = mix(mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), blend.x),
    mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0, 1.0, 1.0)), blend.x), blend.y);
  return mix(bottom, top, blend.z);
}
float density(vec3 point) {
  float leftLobe = 1.0 - length((point - vec3(-0.31, -0.14, 0.08)) * vec3(1.45, 1.30, 1.28));
  float rightLobe = 1.0 - length((point - vec3(0.32, 0.08, -0.13)) * vec3(1.55, 1.24, 1.20));
  float middleLobe = 1.0 - length((point - vec3(0.0, -0.20, 0.16)) * vec3(1.16, 1.55, 1.60));
  float body = max(leftLobe, max(rightLobe, middleLobe));
  vec3 drift = vec3(uTime * 0.008, 0.0, uTime * 0.004);
  float billows = noise(point * 3.1 + vec3(uSeed, uSeed * 0.37, uSeed * 0.71) + drift);
  float detail = sin(point.x * 17.0 + point.z * 9.0 + uSeed) * sin(point.z * 15.0 - point.y * 12.0);
  float shape = body + (billows - 0.5) * 0.50 + detail * 0.055;
  return smoothstep(0.08, 0.38, shape) * smoothstep(-1.0, -0.68, point.y) * (1.0 - smoothstep(0.63, 1.0, point.y));
}
void main() {
  vec3 origin = (cameraPosition - uCenter) / uRadii;
  vec3 direction = normalize(vWorldPosition - cameraPosition) / uRadii;
  vec3 safeDirection = sign(direction) * max(abs(direction), vec3(0.00001));
  vec3 nearSide = (-vec3(1.0) - origin) / safeDirection;
  vec3 farSide = (vec3(1.0) - origin) / safeDirection;
  vec3 nearBounds = min(nearSide, farSide);
  vec3 farBounds = max(nearSide, farSide);
  float start = max(0.0, max(nearBounds.x, max(nearBounds.y, nearBounds.z)));
  float end = min(length(vWorldPosition - cameraPosition), min(farBounds.x, min(farBounds.y, farBounds.z)));
  if (end <= start) discard;
  float stepLength = (end - start) / float(CLOUD_STEPS);
  vec3 color = vec3(0.0);
  float opacity = 0.0;
  for (int i = 0; i < CLOUD_STEPS; i++) {
    vec3 point = origin + direction * (start + (float(i) + 0.5) * stepLength);
    float amount = density(point);
    float sampleOpacity = 1.0 - exp(-amount * stepLength * 0.18);
    float light = clamp(0.49 + point.y * 0.27 + point.x * 0.08, 0.26, 0.88);
    vec3 shade = mix(vec3(0.39, 0.55, 0.66), vec3(1.0, 0.97, 0.90), light);
    color += (1.0 - opacity) * sampleOpacity * shade;
    opacity += (1.0 - opacity) * sampleOpacity;
    if (opacity > 0.97) break;
  }
  if (opacity < 0.008) discard;
  gl_FragColor = vec4(color / opacity, opacity * 0.92);
  #include <colorspace_fragment>
}`;

type CloudLayout = { x: number; y: number; z: number; width: number; height: number; depth: number; seed: number };
const cloudLayouts: CloudLayout[] = [
  { x: -75, y: 30, z: -95, width: 30, height: 8, depth: 16, seed: 2.4 },
  { x: 0, y: 34, z: -106, width: 37, height: 9, depth: 18, seed: 7.1 },
  { x: 78, y: 39, z: -91, width: 28, height: 9, depth: 18, seed: 11.6 },
  { x: 112, y: 29, z: -20, width: 34, height: 7, depth: 17, seed: 16.2 },
  { x: 93, y: 38, z: 62, width: 31, height: 10, depth: 19, seed: 21.7 },
  { x: 27, y: 31, z: 103, width: 38, height: 8, depth: 17, seed: 27.3 },
  { x: -63, y: 37, z: 95, width: 29, height: 10, depth: 18, seed: 33.9 },
  { x: -109, y: 32, z: 21, width: 35, height: 8, depth: 17, seed: 39.5 },
  { x: -38, y: 43, z: -66, width: 19, height: 6, depth: 12, seed: 45.1 },
  { x: 63, y: 45, z: -42, width: 22, height: 7, depth: 13, seed: 50.8 },
  { x: 53, y: 42, z: 53, width: 20, height: 6, depth: 13, seed: 56.4 },
  { x: -69, y: 44, z: 46, width: 21, height: 7, depth: 12, seed: 62.0 },
];

const Cloud = ({ layout, steps }: { layout: CloudLayout; steps: number }) => {
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(() => ({
    uCenter: { value: new THREE.Vector3() },
    uRadii: { value: new THREE.Vector3(layout.width, layout.height, layout.depth) },
    uSeed: { value: layout.seed },
    uTime: { value: 0 },
  }), [layout]);
  useFrame(({ camera, clock }) => {
    if (!mesh.current) return;
    mesh.current.position.set(camera.position.x + layout.x, camera.position.y + layout.y, camera.position.z + layout.z);
    uniforms.uCenter.value.copy(mesh.current.position);
    uniforms.uTime.value = clock.elapsedTime;
  });
  return <mesh ref={mesh} scale={[layout.width, layout.height, layout.depth]} frustumCulled={false}>
    <boxGeometry args={[2, 2, 2]} />
    <shaderMaterial vertexShader={cloudVertex} fragmentShader={`#define CLOUD_STEPS ${steps}\n${cloudFragment}`} uniforms={uniforms} transparent side={THREE.BackSide} depthWrite={false} toneMapped={false} />
  </mesh>;
};

export const SkyAtmosphere = ({ quality }: { quality: "low" | "high" }) => {
  const sky = useRef<THREE.Mesh>(null);
  useFrame(({ camera }) => { if (sky.current) sky.current.position.copy(camera.position); });
  return <>
    <mesh ref={sky} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[190, 48, 32]} />
      <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} side={THREE.BackSide} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    {cloudLayouts.filter((_, index) => quality === "high" || index % 2 === 0).map((layout) => <Cloud key={layout.seed} layout={layout} steps={quality === "high" ? 14 : 8} />)}
  </>;
};
