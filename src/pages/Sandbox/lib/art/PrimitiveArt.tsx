import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry,
  Float32BufferAttribute, Group, MeshStandardMaterial,
  SphereGeometry, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { ItemKind } from '@/lib/survival/items';
import { propMaterialTexture } from '../materials';
import { AppleModel } from './AppleModel';
import { DeerModel } from './DeerModel';
import { RockModel } from './RockModel';

export type PrimitiveItemKind = ItemKind;
type Motion = boolean | { current: boolean };
type Vector = [number, number, number];
const movingNow = (value: Motion) => typeof value === 'boolean' ? value : value.current;
const skin = '#b98769';
const darkSkin = '#a9765c';
const cloth = '#514d43';
const hair = '#332e27';
const unitSphere = new SphereGeometry(1, 8, 6);
const unitBox = new BoxGeometry(1, 1, 1);
const materials = new Map<string, MeshStandardMaterial>();

function material(color: string) {
  if (!materials.has(color)) materials.set(color, new MeshStandardMaterial({
    color: color === skin ? '#ffffff' : color,
    map: color === skin ? propMaterialTexture('skin') : undefined,
    roughness: 0.95,
    flatShading: true,
  }));
  return materials.get(color)!;
}

function Form({ at = [0, 0, 0], size, color, shape = 'box', rotation }: {
  at?: Vector; size: Vector; color: string; shape?: 'round' | 'limb' | 'box'; rotation?: Vector;
}) {
  return <mesh position={at} scale={size} rotation={rotation} castShadow receiveShadow
    geometry={shape === 'round' ? unitSphere : unitBox}
    material={material(color)} dispose={null} />;
}

function itemPart(source: BufferGeometry, color: string, at: Vector, size: Vector = [1, 1, 1], rotation: Vector = [0, 0, 0]) {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (geometry !== source) source.dispose();
  geometry.scale(...size);
  geometry.rotateX(rotation[0]); geometry.rotateY(rotation[1]); geometry.rotateZ(rotation[2]);
  geometry.translate(...at);
  if (!geometry.getAttribute('uv')) {
    const positions = geometry.getAttribute('position');
    const uvs = new Float32Array(positions.count * 2);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      minX = Math.min(minX, positions.getX(i)); maxX = Math.max(maxX, positions.getX(i));
      minZ = Math.min(minZ, positions.getZ(i)); maxZ = Math.max(maxZ, positions.getZ(i));
    }
    for (let i = 0; i < positions.count; i += 1) {
      uvs[i * 2] = (positions.getX(i) - minX) / Math.max(0.001, maxX - minX);
      uvs[i * 2 + 1] = (positions.getZ(i) - minZ) / Math.max(0.001, maxZ - minZ);
    }
    geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  }
  const shade = new Color(color);
  const colors = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < colors.length; i += 3) {
    colors[i] = shade.r; colors[i + 1] = shade.g; colors[i + 2] = shade.b;
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}

function merged(parts: BufferGeometry[]) {
  const result = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!result) throw new Error('Primitive asset geometry merge failed');
  return result;
}

function rock(color: string, at: Vector, size: Vector) {
  return itemPart(new BoxGeometry(1, 1, 1), color, at, size, [0, 0.3, 0]);
}

function stick(color: string, at: Vector, radius: number, length: number, rotation: Vector) {
  return itemPart(new CylinderGeometry(radius * 0.75, radius, length, 5), color, at, [1, 1, 1], rotation);
}

const hide = new BufferGeometry();
const outline = [[-0.21, -0.55], [0.2, -0.51], [0.21, -0.28], [0.51, -0.38], [0.43, -0.12], [0.29, 0.02], [0.47, 0.4], [0.2, 0.36], [0.12, 0.52], [-0.15, 0.49], [-0.23, 0.31], [-0.49, 0.4], [-0.3, 0.02], [-0.44, -0.23], [-0.47, -0.4], [-0.23, -0.31]];
const hideVertices: number[] = [];
outline.forEach((point, index) => {
  const next = outline[(index + 1) % outline.length];
  hideVertices.push(0, 0.07, 0, point[0], 0.02, point[1], next[0], 0.02, next[1]);
});
hide.setAttribute('position', new Float32BufferAttribute(hideVertices, 3));
hide.computeVertexNormals();

const itemGeometries: Record<Exclude<PrimitiveItemKind, 'apple'>, BufferGeometry> = {
  stone: merged([rock('#8e9186', [0, 0.14, 0], [0.24, 0.18, 0.19])]),
  chopper: merged([
    rock('#59625c', [0, 0.17, 0], [0.18, 0.25, 0.085]),
    rock('#b1b2a2', [-0.04, 0.23, 0.025], [0.13, 0.17, 0.035]),
  ]),
  branch: merged([
    stick('#796448', [0, 0.055, 0], 0.045, 1.05, [0, 0.15, Math.PI / 2]),
    stick('#796448', [-0.19, 0.08, -0.07], 0.022, 0.32, [Math.PI / 2, 0, 0.8]),
    rock('#b7a17a', [0.49, 0.055, 0], [0.025, 0.036, 0.035]),
  ]),
  spear: merged([
    stick('#89714f', [0, 0.04, 0], 0.032, 1.95, [0, 0, -Math.PI / 2]),
    itemPart(new ConeGeometry(0.03, 0.25, 5), '#c4ab7c', [1.08, 0.04, 0], [1, 1, 1], [0, 0, -Math.PI / 2]),
    stick('#5f543a', [-0.22, 0.04, 0], 0.035, 0.22, [0, 0, Math.PI / 2]),
  ]),
  fiber: merged(Array.from({ length: 7 }, (_, i) => stick(i % 2 ? '#b6ad79' : '#82916a',
    [(i - 3) * 0.027, 0.035 + (i % 2) * 0.018, 0], 0.012, 0.46 + i * 0.021, [Math.PI / 2, 0.05 * (i - 3), 0]))),
  cord: merged([0, 1, 2].map(i => itemPart(new TorusGeometry(0.12 + i * 0.017, 0.015, 4, 13), '#a3926d', [0, 0.026 + i * 0.017, 0], [1, 1, 1], [Math.PI / 2, 0, 0]))),
  nut: merged([
    rock('#815b35', [0, 0.075, 0], [0.1, 0.085, 0.095]),
    itemPart(new TorusGeometry(0.07, 0.006, 3, 8), '#b3935c', [0, 0.075, 0], [1, 1.1, 1]),
  ]),
  kernel: merged([rock('#e1ce99', [0, 0.032, 0], [0.072, 0.032, 0.043])]),
  rawMeat: merged([
    rock('#aa6256', [0, 0.085, 0], [0.22, 0.11, 0.15]),
    rock('#d6af97', [0.11, 0.12, 0.04], [0.08, 0.055, 0.105]),
  ]),
  hide: merged([itemPart(hide, '#a18865', [0, 0, 0])]),
  bag: merged([
    rock('#9a7e54', [0, 0.17, 0], [0.2, 0.22, 0.16]),
    itemPart(new CylinderGeometry(0.07, 0.15, 0.13, 7), '#b49a6c', [0, 0.32, 0]),
    itemPart(new TorusGeometry(0.07, 0.013, 4, 9), '#584c34', [0, 0.38, 0], [1, 1, 1], [Math.PI / 2, 0, 0]),
  ]),
  backpack: merged([
    rock('#93734e', [0, 0.3, 0], [0.3, 0.37, 0.21]),
    rock('#b39668', [0, 0.56, 0.02], [0.28, 0.1, 0.2]),
    ...[-1, 1].map(side => itemPart(new TorusGeometry(0.14, 0.02, 4, 10), '#554b38', [side * 0.15, 0.32, -0.16], [0.8, 1.7, 1])),
    stick('#554b38', [0, 0.34, 0.18], 0.016, 0.52, [0, 0, 0]),
  ]),
  flint: merged([rock('#3f4448', [0, 0.1, 0], [0.19, 0.14, 0.15]), rock('#d9d3c0', [0.05, 0.13, 0.04], [0.09, 0.07, 0.08])]),
  flake: merged([itemPart(new ConeGeometry(0.07, 0.16, 3), '#6b6f6a', [0, 0.012, 0], [1, 1, 0.25], [Math.PI / 2, 0, 0])]),
  handaxe: merged([itemPart(new ConeGeometry(0.1, 0.26, 5), '#4a4f53', [0, 0.03, 0], [1, 1, 0.35], [Math.PI / 2, 0, 0]), rock('#c9c3b0', [0, 0.04, 0.06], [0.07, 0.03, 0.06])]),
  stick: merged([stick('#8a7352', [0, 0.04, 0], 0.03, 0.95, [0, 0, Math.PI / 2])]),
  twig: merged([stick('#7c6a4c', [0, 0.02, 0], 0.01, 0.45, [0, 0, Math.PI / 2]), stick('#7c6a4c', [0.08, 0.03, 0.03], 0.006, 0.12, [0.9, 0, Math.PI / 2])]),
  dryGrass: merged(Array.from({ length: 9 }, (_, i) => stick(i % 3 ? '#cdb97b' : '#b39f62',
    [(i - 4) * 0.02, 0.03 + (i % 2) * 0.012, 0], 0.01, 0.4 + (i % 4) * 0.04, [Math.PI / 2, 0.08 * (i - 4), 0]))),
  bone: merged([stick('#e6dcc4', [0, 0.035, 0], 0.03, 0.46, [0, 0, Math.PI / 2]), rock('#eee6d2', [0.24, 0.04, 0], [0.07, 0.07, 0.09]), rock('#eee6d2', [-0.24, 0.04, 0], [0.07, 0.07, 0.09])]),
  boneShard: merged([itemPart(new ConeGeometry(0.025, 0.2, 4), '#e6dcc4', [0, 0.02, 0], [1, 1, 1], [0, 0, Math.PI / 2])]),
  awl: merged([itemPart(new ConeGeometry(0.018, 0.22, 5), '#f1ead8', [0, 0.02, 0], [1, 1, 1], [0, 0, Math.PI / 2])]),
  hardSpear: merged([
    stick('#6d5536', [0, 0.04, 0], 0.032, 1.95, [0, 0, -Math.PI / 2]),
    itemPart(new ConeGeometry(0.03, 0.25, 5), '#2e2418', [1.08, 0.04, 0], [1, 1, 1], [0, 0, -Math.PI / 2]),
  ]),
  stoneSpear: merged([
    stick('#89714f', [0, 0.04, 0], 0.032, 1.95, [0, 0, -Math.PI / 2]),
    itemPart(new ConeGeometry(0.05, 0.2, 3), '#5d6264', [1.1, 0.04, 0], [1, 1, 0.4], [0, 0, -Math.PI / 2]),
    itemPart(new TorusGeometry(0.036, 0.012, 3, 8), '#a3926d', [0.95, 0.04, 0], [1, 1, 1], [0, Math.PI / 2, 0]),
  ]),
  blueberry: merged([[0, 0], [0.05, 0.02], [-0.04, 0.03], [0.01, -0.05], [-0.03, -0.03]].map(([x, z]) => rock('#3f4f8c', [x, 0.025, z], [0.04, 0.04, 0.04]))),
  redberry: merged([[0, 0], [0.05, 0.02], [-0.04, 0.03], [0.01, -0.05], [-0.03, -0.03]].map(([x, z]) => rock('#c2362d', [x, 0.025, z], [0.04, 0.04, 0.04]))),
  mushroom: merged([stick('#e9e0c8', [0, 0.05, 0], 0.025, 0.1, [0, 0, 0]), itemPart(new SphereGeometry(0.07, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#9a6a3e', [0, 0.09, 0])]),
  toadstool: merged([stick('#f2eee0', [0, 0.05, 0], 0.022, 0.1, [0, 0, 0]), itemPart(new SphereGeometry(0.075, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#c23b2a', [0, 0.09, 0]), rock('#f6f1e1', [0.03, 0.14, 0.02], [0.018, 0.012, 0.018])]),
  termites: merged([[0, 0], [0.03, 0.02], [-0.02, 0.03], [0.01, -0.03]].map(([x, z]) => rock('#d9c9a6', [x, 0.01, z], [0.03, 0.012, 0.012]))),
  grubs: merged([[0, 0], [0.05, 0.03], [-0.04, 0.02]].map(([x, z]) => itemPart(new TorusGeometry(0.02, 0.011, 4, 7, Math.PI * 1.4), '#efe3c3', [x, 0.012, z], [1, 1, 1], [Math.PI / 2, 0, 0]))),
  egg: merged([itemPart(new SphereGeometry(0.05, 8, 6), '#e8dfc9', [0, 0.05, 0], [1, 1.3, 1])]),
  cookedEgg: merged([itemPart(new SphereGeometry(0.05, 8, 6), '#9c7a4e', [0, 0.05, 0], [1, 1.3, 1])]),
  clam: merged([itemPart(new SphereGeometry(0.07, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#8b8a86', [0, 0.005, 0], [1, 0.45, 0.8])]),
  clamMeat: merged([rock('#e2a58d', [0, 0.02, 0], [0.07, 0.03, 0.05])]),
  marrow: merged([rock('#f0d9b0', [0, 0.02, 0], [0.09, 0.035, 0.05])]),
  tuber: merged([rock('#8f6a45', [0, 0.05, 0], [0.18, 0.08, 0.09]), rock('#7e5d3d', [0.08, 0.05, 0.03], [0.07, 0.06, 0.06])]),
  roastedTuber: merged([rock('#4d3624', [0, 0.05, 0], [0.18, 0.08, 0.09]), rock('#d9b27a', [0.03, 0.08, 0.02], [0.08, 0.02, 0.05])]),
  cookedMeat: merged([rock('#6e3f2a', [0, 0.085, 0], [0.22, 0.11, 0.15]), rock('#a8764f', [0.11, 0.12, 0.04], [0.08, 0.055, 0.105])]),
  fish: merged([itemPart(new SphereGeometry(0.08, 8, 5), '#7d9aa3', [0, 0.05, 0], [2.2, 0.8, 0.6]), itemPart(new ConeGeometry(0.06, 0.1, 3), '#6b8790', [-0.2, 0.05, 0], [1, 1, 0.3], [0, 0, Math.PI / 2])]),
  rotten: merged([rock('#5a5a3a', [0, 0.05, 0], [0.19, 0.07, 0.13]), rock('#7b7a4a', [0.06, 0.08, 0.03], [0.07, 0.04, 0.06]), rock('#3d3b2a', [-0.06, 0.07, -0.02], [0.06, 0.035, 0.05])]),
  cookedFish: merged([itemPart(new SphereGeometry(0.08, 8, 5), '#8a6440', [0, 0.05, 0], [2.2, 0.8, 0.6]), itemPart(new ConeGeometry(0.06, 0.1, 3), '#6e4f33', [-0.2, 0.05, 0], [1, 1, 0.3], [0, 0, Math.PI / 2])]),
};

const itemBounds = new Map<Exclude<PrimitiveItemKind, 'apple'>, { minY: number; height: number }>();
for (const [kind, geometry] of Object.entries(itemGeometries) as Array<[Exclude<PrimitiveItemKind, 'apple'>, BufferGeometry]>) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  itemBounds.set(kind, { minY: bounds.min.y, height: bounds.max.y - bounds.min.y });
}

/** Vertical offset that seats a loose item on the ground, with optional partial burial. */
function itemGroundOffset(kind: Exclude<PrimitiveItemKind, 'apple'>, scale = 1, buryFraction = 0): number {
  const bounds = itemBounds.get(kind)!;
  return (-bounds.minY - bounds.height * Math.max(0, Math.min(1, buryFraction))) * scale;
}

const itemMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true, side: 2 });
const texturedItemMaterials = new Map<PrimitiveItemKind, MeshStandardMaterial>();
const itemTextureKinds: Partial<Record<PrimitiveItemKind, 'stone' | 'wood' | 'skin'>> = {
  stone: 'stone', chopper: 'stone', flint: 'stone', handaxe: 'stone',
  branch: 'wood', spear: 'wood', stick: 'wood', hardSpear: 'wood', stoneSpear: 'wood',
  hide: 'skin', bag: 'wood', backpack: 'wood',
};

const itemMaterialFor = (kind: PrimitiveItemKind): MeshStandardMaterial => {
  const textureKind = itemTextureKinds[kind];
  if (!textureKind) return itemMaterial;
  if (!texturedItemMaterials.has(kind)) texturedItemMaterials.set(kind, new MeshStandardMaterial({
    vertexColors: true,
    map: propMaterialTexture(textureKind),
    roughness: 0.94,
    flatShading: true,
    side: 2,
  }));
  return texturedItemMaterials.get(kind)!;
};

/** Loose objects rest at local ground level; callers own picking and collision. */
export function ItemVisual({ kind, scale = 1, grounded = false }: { kind: PrimitiveItemKind; scale?: number; grounded?: boolean }) {
  if (kind === 'stone') return <RockModel scale={scale} grounded={grounded} />;
  if (kind === 'apple') return <AppleModel scale={scale} grounded={grounded} />;
  return <mesh geometry={itemGeometries[kind]} material={itemMaterialFor(kind)} scale={scale}
    position={grounded ? [0, itemGroundOffset(kind, scale), 0] : undefined} castShadow receiveShadow dispose={null} />;
}

/** Adult proportions, bare feet and a modest minimal underwear layer; local +Z forward. */
export function PrimitivePerson({ gender, moving = false, bag = false, backpack = false }: {
  gender: 'male' | 'female'; moving?: Motion; bag?: boolean; backpack?: boolean;
}) {
  const body = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const female = gender === 'female';
  useFrame(({ clock }) => {
    const walking = movingNow(moving);
    const stride = walking ? Math.sin(clock.elapsedTime * 8) * 0.48 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.62;
    if (rightArm.current) rightArm.current.rotation.x = stride * 0.62;
    if (body.current) body.current.position.y = walking ? Math.abs(stride) * 0.045 : Math.sin(clock.elapsedTime * 1.5) * 0.004;
  });
  return <group ref={body}>
    <Form at={[0, 1.15, 0]} size={[female ? 0.235 : 0.27, 0.31, 0.145]} color={skin} />
    <Form at={[0, 0.94, 0]} size={[female ? 0.21 : 0.2, 0.24, 0.135]} color={skin} />
    <Form at={[0, 0.82, 0]} size={[0.225, 0.14, 0.155]} color={cloth} />
    <Form at={[0, 1.43, 0]} size={[0.07, 0.13, 0.075]} color={skin} shape={'limb'} />
    <Form at={[0, 1.62, 0.005]} size={[0.132, 0.19, 0.135]} color={skin} />
    <Form at={[0, 1.72, -0.015]} size={[0.136, 0.112, 0.14]} color={hair} />
    <Form at={[0, 1.61, 0.132]} size={[0.027, 0.035, 0.035]} color={skin} />
    {[-1, 1].map(side => <group key={side}>
      <Form at={[side * 0.136, 1.61, 0]} size={[0.025, 0.047, 0.028]} color={darkSkin} />
      <Form at={[side * 0.049, 1.665, 0.121]} size={[0.019, 0.009, 0.008]} color={hair} shape={'box'} />
      <group position={[side * 0.115, 0.84, 0]} ref={side < 0 ? leftLeg : rightLeg}>
        <Form at={[0, -0.1, 0]} size={[0.11, 0.17, 0.137]} color={cloth} />
        <Form at={[0, -0.24, 0]} size={[0.085, 0.34, 0.09]} color={skin} shape={'limb'} />
        <Form at={[0, -0.41, 0.015]} size={[0.075, 0.08, 0.077]} color={skin} />
        <Form at={[0, -0.59, -0.005]} size={[0.062, 0.33, 0.068]} color={skin} shape={'limb'} />
        <Form at={[0, -0.78, 0.07]} size={[0.075, 0.055, 0.135]} color={skin} />
      </group>
      <group position={[side * (female ? 0.26 : 0.29), 1.32, 0]} ref={side < 0 ? leftArm : rightArm} rotation={[0, 0, side * 0.065]}>
        <Form at={[0, -0.135, 0]} size={[0.072, 0.3, 0.076]} color={skin} shape={'limb'} />
        <Form at={[0, -0.39, 0.018]} size={[0.052, 0.27, 0.061]} color={skin} shape={'limb'} />
        <Form at={[0, -0.565, 0.024]} size={[0.058, 0.086, 0.041]} color={skin} />
      </group>
    </group>)}
    {female && <>
      <Form at={[0, 1.255, 0.014]} size={[0.241, 0.105, 0.152]} color={cloth} />
      {[-1, 1].map(side => <Form key={side} at={[side * 0.14, 1.35, 0.022]} size={[0.045, 0.15, 0.22]} color={cloth} shape={'box'} rotation={[0, 0, side * 0.15]} />)}
      <Form at={[0, 1.56, -0.123]} size={[0.126, 0.17, 0.055]} color={hair} />
    </>}
    {bag && <>
      <group position={[0.26, 0.65, 0.04]}><ItemVisual kind={'bag'} scale={0.72} /></group>
      <Form at={[0.11, 1.065, 0.153]} size={[0.025, 0.67, 0.028]} color={'#69563c'} shape={'box'} rotation={[0, 0, 0.47]} />
    </>}
    {backpack && <>
      <group position={[0, 0.8, -0.26]} rotation={[0, Math.PI, 0]}><ItemVisual kind={'backpack'} scale={0.88} /></group>
      {[-1, 1].map(side => <Form key={side} at={[side * 0.15, 1.135, 0.145]} size={[0.033, 0.45, 0.03]} color={'#69563c'} shape={'box'} />)}
    </>}
  </group>;
}

/** Camera-local bare hands. No item is equipped by default. */
export function PrimitiveHands({ item = null, active = false }: {
  item?: PrimitiveItemKind | null; active?: Motion;
}) {
  const held = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!held.current) return;
    const swing = movingNow(active) ? Math.sin(clock.elapsedTime * 13) * 0.16 : 0;
    held.current.rotation.x += (0.22 + swing - held.current.rotation.x) * Math.min(1, delta * 15);
    held.current.position.y = -0.3 + Math.sin(clock.elapsedTime * 1.8) * 0.006;
  });
  if (!item) return null;
  const longItem = item === 'branch' || item === 'stick' || item === 'spear' || item === 'hardSpear' || item === 'stoneSpear';
  const itemScale = item === 'backpack' || item === 'hide' ? 0.4 : item === 'spear' || item === 'hardSpear' || item === 'stoneSpear' ? 0.48 : item === 'branch' || item === 'stick' ? 0.58 : 0.72;
  return <group ref={held} position={[0.36, -0.3, -0.68]} rotation={[0.22, -0.18, longItem ? -0.78 : -0.12]}>
    <ItemVisual kind={item} scale={itemScale} />
  </group>;
}

/** Textured low-poly deer asset with ref-driven gait and an inert carcass pose. */
export function WildAnimal({ moving = false, dead = false }: { moving?: Motion; dead?: boolean }) {
  return <DeerModel moving={moving} dead={dead} />;
}
