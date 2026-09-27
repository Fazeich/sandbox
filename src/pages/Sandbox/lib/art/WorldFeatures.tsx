import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, MeshStandardMaterial,
  PointLight, SphereGeometry, TorusGeometry,
} from 'three';
import type { NaturalNode, NodeKind } from '@/lib/survival/world';
import { ItemVisual } from './PrimitiveArt';

/** Flat-shaded placeholder forms for foraging sources; gameplay reads only positions and ids. */
const materials = new Map<string, MeshStandardMaterial>();
const mat = (color: string, emissive?: string) => {
  const key = color + (emissive ?? '');
  if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness: 0.95, flatShading: true, emissive: emissive ?? '#000000', emissiveIntensity: emissive ? 1.6 : 0 }));
  return materials.get(key)!;
};
const cone = new ConeGeometry(1, 1, 7);
const blob = new DodecahedronGeometry(1, 0);
const ball = new SphereGeometry(1, 6, 5);
const log = new CylinderGeometry(1, 1, 1, 7);
const ring = new TorusGeometry(1, 0.35, 5, 10);
const leaf = new ConeGeometry(1, 1, 3);

type Vec = [number, number, number];
const Part = ({ geometry, color, at, size, rotation, emissive }: { geometry: BufferGeometry; color: string; at: Vec; size: Vec; rotation?: Vec; emissive?: string }) =>
  <mesh geometry={geometry} material={mat(color, emissive)} position={at} scale={size} rotation={rotation} castShadow receiveShadow dispose={null} />;

const TermiteMound = () => <group>
  <Part geometry={cone} color="#a8784a" at={[0, 0.55, 0]} size={[0.55, 1.1, 0.55]} />
  <Part geometry={cone} color="#b38456" at={[0.28, 0.35, 0.1]} size={[0.22, 0.7, 0.22]} />
  <Part geometry={blob} color="#9a6d42" at={[0, 0.08, 0]} size={[0.7, 0.2, 0.62]} />
</group>;

const BERRY_SPOTS: Vec[] = [[0.25, 0.42, 0.2], [-0.22, 0.5, 0.15], [0.05, 0.62, -0.22], [-0.3, 0.3, -0.12], [0.3, 0.33, -0.2], [0.02, 0.55, 0.3]];
const BerryBush = ({ red, left }: { red: boolean; left: number }) => <group>
  <Part geometry={blob} color="#4f6b3a" at={[0, 0.36, 0]} size={[0.5, 0.38, 0.46]} />
  <Part geometry={blob} color="#5d7a42" at={[0.18, 0.5, -0.08]} size={[0.3, 0.26, 0.3]} />
  {BERRY_SPOTS.slice(0, left).map((spot, i) => <Part key={i} geometry={ball} color={red ? '#c2362d' : '#3f4f8c'} at={spot} size={[0.045, 0.045, 0.045]} />)}
</group>;

const RottenLog = () => <group rotation={[0, 0, Math.PI / 2]}>
  <Part geometry={log} color="#5b4a36" at={[0.2, 0, 0]} size={[0.2, 1.6, 0.2]} />
  <Part geometry={blob} color="#6f6a3a" at={[0.36, 0.2, 0.05]} size={[0.08, 0.3, 0.12]} />
  <Part geometry={ring} color="#4a3b2b" at={[0.2, 0.8, 0]} size={[0.14, 0.14, 0.14]} rotation={[Math.PI / 2, 0, 0]} />
</group>;

const Nest = ({ eggs }: { eggs: number }) => <group>
  <Part geometry={ring} color="#8a7650" at={[0, 0.06, 0]} size={[0.16, 0.16, 0.2]} rotation={[Math.PI / 2, 0, 0]} />
  {Array.from({ length: eggs }, (_, i) => <Part key={i} geometry={ball} color="#e8dfc9" at={[(i - (eggs - 1) / 2) * 0.07, 0.07, 0]} size={[0.035, 0.045, 0.035]} />)}
</group>;

const TuberPlant = () => <group>
  {[0, 1, 2, 3, 4].map((i) => <Part key={i} geometry={leaf} color={i % 2 ? '#5f7d3c' : '#6f8f46'}
    at={[Math.cos(i * 1.26) * 0.1, 0.2, Math.sin(i * 1.26) * 0.1]} size={[0.09, 0.4, 0.02]} rotation={[Math.sin(i * 1.26) * 0.5, i * 1.26, -Math.cos(i * 1.26) * 0.5]} />)}
  <Part geometry={blob} color="#6b5234" at={[0, 0.02, 0]} size={[0.16, 0.05, 0.14]} />
</group>;

const GrassTuft = () => <group>
  {[0, 1, 2, 3, 4, 5, 6].map((i) => <Part key={i} geometry={leaf} color={i % 2 ? '#cdb97b' : '#b8a466'}
    at={[Math.cos(i) * 0.06, 0.22, Math.sin(i) * 0.06]} size={[0.03, 0.45, 0.01]} rotation={[Math.sin(i) * 0.3, i, -Math.cos(i) * 0.3]} />)}
</group>;

const ClamBed = ({ left }: { left: number }) => <group>
  {[[0, 0], [0.18, 0.1], [-0.12, 0.14]].slice(0, left).map(([x, z], i) => <group key={i} position={[x, 0, z]} rotation={[0, i * 1.9, 0]}><ItemVisual kind="clam" scale={1.4} grounded /></group>)}
</group>;

/** A natural source at local ground level; `taken` is how much of it has already been gathered. */
export function FeatureVisual({ node, taken = 0 }: { node: NaturalNode; taken?: number }) {
  const kind: NodeKind = node.kind;
  if (kind === 'termiteMound') return <TermiteMound />;
  if (kind === 'berryBush') return <BerryBush red={node.variant === 'red'} left={Math.max(0, 6 - taken)} />;
  if (kind === 'rottenLog') return <RottenLog />;
  if (kind === 'nest') return <Nest eggs={Math.max(0, (node.count ?? 1) - taken)} />;
  if (kind === 'tuberPlant') return <TuberPlant />;
  if (kind === 'grass') return <GrassTuft />;
  if (kind === 'clams') return <ClamBed left={Math.max(0, 3 - taken)} />;
  if (kind === 'mushroom') return <ItemVisual kind={node.variant === 'toxic' ? 'toadstool' : 'mushroom'} scale={1.8} grounded />;
  if (kind === 'bones') return <ItemVisual kind="bone" scale={1.4} grounded />;
  if (kind === 'flint') return <ItemVisual kind="flint" scale={1.4} grounded />;
  if (kind === 'branch') return <ItemVisual kind="branch" scale={1.2} grounded />;
  if (kind === 'stone' || kind === 'fiber' || kind === 'nut') return <ItemVisual kind={kind} scale={kind === 'stone' ? 1.5 : kind === 'fiber' ? 2.2 : 1.8} grounded />;
  return null;
}

/** Stones, sticks, flickering flame and warm light; brightness follows remaining fuel. */
export function FireVisual({ fuel }: { fuel: number }) {
  const flame = useRef<Mesh>(null), inner = useRef<Mesh>(null), light = useRef<PointLight>(null), stones = useRef<Group>(null);
  const strength = Math.min(1, 0.35 + fuel / 240);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, flicker = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 29) * 0.06;
    if (flame.current) flame.current.scale.set(0.2 * strength, 0.55 * strength * flicker, 0.2 * strength);
    if (inner.current) inner.current.scale.set(0.11 * strength, 0.35 * strength * (1.9 - flicker), 0.11 * strength);
    if (light.current) light.current.intensity = 7 * strength * flicker;
  });
  return <group>
    <group ref={stones}>{Array.from({ length: 7 }, (_, i) => <Part key={i} geometry={blob} color="#7c7d74" at={[Math.cos(i * 0.9) * 0.36, 0.05, Math.sin(i * 0.9) * 0.36]} size={[0.09, 0.07, 0.08]} />)}</group>
    {[0, 1, 2].map((i) => <Part key={i} geometry={log} color="#3b2d20" at={[0, 0.07, 0]} size={[0.035, 0.5, 0.035]} rotation={[Math.PI / 2 - 0.25, i * 1.05, 0]} />)}
    <mesh ref={flame} geometry={cone} material={mat('#f08a2e', '#e8681c')} position={[0, 0.28, 0]} dispose={null} />
    <mesh ref={inner} geometry={cone} material={mat('#ffd36b', '#ffc04a')} position={[0, 0.22, 0]} dispose={null} />
    <pointLight ref={light} color="#ffa25a" distance={9} decay={1.6} position={[0, 0.6, 0]} />
  </group>;
}
