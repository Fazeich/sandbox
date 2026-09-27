import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, Group } from 'three';

const palette = {
  timber: '#927255', edge: '#624e3e', canvas: '#e9d5ac', teal: '#457e79',
  metal: '#485b58', brass: '#d49d51', light: '#ffdd94', dark: '#293c3b',
};

type Triple = [number, number, number];
type Surface = { color?: string; ghost?: boolean; emissive?: string };

function SurfaceMaterial({ color = palette.timber, ghost, emissive }: Surface) {
  return <meshStandardMaterial color={color} roughness={0.82} flatShading
    transparent={ghost} opacity={ghost ? 0.42 : 1} depthWrite={!ghost}
    emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1.5 : 0} />;
}

function Box({ at = [0, 0, 0], size, rotation, ...surface }: Surface & {
  at?: Triple; size: Triple; rotation?: Triple;
}) {
  return <mesh position={at} rotation={rotation} castShadow={!surface.ghost} receiveShadow>
    <boxGeometry args={size} /><SurfaceMaterial {...surface} />
  </mesh>;
}

function Cylinder({ at = [0, 0, 0], radius, height, color, ghost, emissive, rotation }: Surface & {
  at?: Triple; radius: number; height: number; rotation?: Triple;
}) {
  return <mesh position={at} rotation={rotation} castShadow={!ghost} receiveShadow>
    <cylinderGeometry args={[radius, radius, height, 8]} />
    <SurfaceMaterial color={color} ghost={ghost} emissive={emissive} />
  </mesh>;
}

function Lantern({ lit = true, ghost = false, color = palette.metal }: {
  lit?: boolean; ghost?: boolean; color?: string;
}) {
  return <group>
    <Cylinder at={[0, 0.04, 0]} radius={0.13} height={0.08} color={color} ghost={ghost} />
    <Cylinder at={[0, 0.19, 0]} radius={0.095} height={0.24}
      color={lit ? palette.light : palette.canvas} emissive={lit ? '#ffae48' : undefined} ghost={ghost} />
    <Cylinder at={[0, 0.34, 0]} radius={0.14} height={0.07} color={color} ghost={ghost} />
    <mesh position={[0, 0.44, 0]}>
      <torusGeometry args={[0.065, 0.013, 4, 12]} /><SurfaceMaterial color={color} ghost={ghost} />
    </mesh>
    {[-1, 1].map(side => <Box key={side} at={[side * 0.09, 0.2, 0]} size={[0.025, 0.28, 0.025]} color={color} ghost={ghost} />)}
  </group>;
}

/** A bundled, low-poly expedition avatar. Feet are at zero; local +Z is forward. */
export function Explorer({ color = palette.teal, moving = false }: {
  color?: string; moving?: boolean | { current: boolean };
}) {
  const body = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  useFrame(({ clock }) => {
    const isMoving = typeof moving === 'boolean' ? moving : moving.current;
    const stride = isMoving ? Math.sin(clock.elapsedTime * 9) * 0.5 : 0;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
    if (leftArm.current) leftArm.current.rotation.x = -stride * 0.7;
    if (rightArm.current) rightArm.current.rotation.x = stride * 0.7;
    if (body.current) body.current.position.y = isMoving ? Math.abs(stride) * 0.08 : Math.sin(clock.elapsedTime * 1.7) * 0.009;
  });
  return <group ref={body}>
    {[-1, 1].map(side => <group key={side} ref={side < 0 ? leftLeg : rightLeg} position={[side * 0.14, 0.67, 0]}>
      <Box at={[0, -0.26, 0]} size={[0.22, 0.5, 0.24]} color={palette.dark} />
      <Box at={[0, -0.56, 0.055]} size={[0.245, 0.21, 0.36]} color={palette.edge} />
      <Box at={[0, -0.49, 0]} size={[0.25, 0.065, 0.27]} color={palette.brass} />
    </group>)}
    <Box at={[0, 1.0, 0]} size={[0.57, 0.68, 0.34]} color={color} />
    <Box at={[0, 0.72, 0.015]} size={[0.59, 0.085, 0.38]} color={palette.edge} />
    <Box at={[0, 0.74, 0.22]} size={[0.1, 0.11, 0.04]} color={palette.brass} />
    <Box at={[0, 1.01, -0.27]} size={[0.45, 0.54, 0.24]} color={palette.canvas} />
    <Box at={[0, 1.16, -0.4]} size={[0.47, 0.1, 0.035]} color={palette.edge} />
    <Cylinder at={[0, 1.35, -0.27]} radius={0.11} height={0.6} color={palette.brass} rotation={[0, 0, Math.PI / 2]} />
    {[-1, 1].map(side => <group key={side}>
      <Box at={[side * 0.19, 1.08, 0.18]} size={[0.055, 0.52, 0.035]} color={palette.canvas} />
      <group ref={side < 0 ? leftArm : rightArm} position={[side * 0.38, 1.24, 0]}>
        <Box at={[0, -0.2, 0]} size={[0.2, 0.42, 0.23]} color={color} rotation={[0, 0, side * 0.1]} />
        <Box at={[side * 0.03, -0.45, 0.015]} size={[0.18, 0.18, 0.21]} color={palette.canvas} />
      </group>
    </group>)}
    <Cylinder at={[0, 1.37, 0]} radius={0.24} height={0.11} color={palette.canvas} />
    <mesh position={[0, 1.52, 0]} castShadow><sphereGeometry args={[0.245, 10, 6]} /><SurfaceMaterial color={color} /></mesh>
    <Box at={[0, 1.54, 0.209]} size={[0.34, 0.14, 0.075]} color={palette.dark} />
    <Box at={[-0.071, 1.55, 0.251]} size={[0.105, 0.07, 0.017]} color={'#acd7c5'} />
    <Box at={[0.071, 1.55, 0.251]} size={[0.105, 0.07, 0.017]} color={'#acd7c5'} />
    <Cylinder at={[0, 1.66, 0.035]} radius={0.26} height={0.055} color={palette.brass} />
    <Box at={[0, 1.67, 0.245]} size={[0.11, 0.08, 0.065]} color={palette.canvas} emissive={'#ffe9b0'} />
  </group>;
}

/** Attach to the camera at local origin. Tool swing uses refs, never React state. */
export function Hands({ mode, active = false }: { mode: 'gather' | 'build'; active?: boolean }) {
  const tool = useRef<Group>(null);
  useFrame(({ clock }, delta) => {
    if (!tool.current) return;
    const target = active ? Math.sin(clock.elapsedTime * 16) * 0.48 - 0.3 : 0;
    tool.current.rotation.x += (target - tool.current.rotation.x) * Math.min(1, delta * 16);
    tool.current.position.y = Math.sin(clock.elapsedTime * 1.8) * 0.007;
  });
  return <group ref={tool}>
    <group position={[0.34, -0.4, -0.62]} rotation={[-0.15, -0.13, -0.22]}>
      <Box at={[0, -0.15, 0.13]} size={[0.18, 0.34, 0.2]} color={palette.teal} rotation={[-0.55, 0, 0]} />
      <Box size={[0.18, 0.17, 0.19]} color={palette.canvas} />
      <Box at={[-0.065, 0.015, -0.07]} size={[0.095, 0.11, 0.12]} color={palette.brass} />
      <Cylinder at={[0, 0.14, -0.06]} radius={0.03} height={0.65} color={palette.timber} />
      <Cylinder at={[0, -0.12, -0.06]} radius={0.037} height={0.13} color={palette.edge} />
      {mode === 'gather' ? <group position={[0, 0.43, -0.06]}>
        <Box size={[0.43, 0.085, 0.09]} color={palette.metal} rotation={[0, 0, -0.12]} />
        <mesh position={[-0.24, -0.028, 0]} rotation={[0, 0, Math.PI * 0.65]}>
          <coneGeometry args={[0.055, 0.2, 4]} /><SurfaceMaterial color={palette.metal} />
        </mesh>
        <Box at={[0, 0, 0]} size={[0.11, 0.13, 0.12]} color={palette.brass} />
      </group> : <group position={[0, 0.4, -0.06]}>
        <Box size={[0.35, 0.19, 0.18]} color={palette.metal} />
        <Box size={[0.09, 0.2, 0.19]} color={palette.brass} />
        <Box at={[-0.19, 0, 0]} size={[0.045, 0.22, 0.2]} color={palette.canvas} />
      </group>}
    </group>
    {mode === 'build' && <group position={[-0.33, -0.42, -0.62]} rotation={[-0.55, 0.2, 0.15]}>
      <Box at={[0, -0.12, 0.04]} size={[0.18, 0.3, 0.19]} color={palette.teal} />
      <Box size={[0.18, 0.14, 0.17]} color={palette.canvas} />
      <Box at={[0, 0.04, -0.08]} size={[0.27, 0.34, 0.025]} color={'#658e92'} rotation={[-0.3, 0, 0]} />
      <Box at={[0, 0.05, -0.105]} size={[0.18, 0.22, 0.008]} color={'#b8d0ba'} rotation={[-0.3, 0, 0]} />
    </group>}
  </group>;
}

export type BuildPieceKind = 'floor' | 'wall' | 'lamp' | 'beacon';

/** The floor occupies 2×2; wall runs along X. All pieces are anchored at ground y=0. */
export function BuildPiece({ kind, ghost = false, valid = true }: {
  kind: BuildPieceKind; ghost?: boolean; valid?: boolean;
}) {
  const timber = ghost ? (valid ? '#88d6c2' : '#e78472') : palette.timber;
  const metal = ghost ? timber : palette.metal;
  const canvas = ghost ? timber : palette.canvas;
  if (kind === 'floor') return <group>
    <Box at={[0, 0.075, 0]} size={[1.97, 0.15, 1.97]} color={timber} ghost={ghost} />
    {[-0.6, -0.2, 0.2, 0.6].map(x => <Box key={x} at={[x, 0.156, 0]} size={[0.018, 0.008, 1.97]} color={ghost ? timber : palette.edge} ghost={ghost} />)}
    {[-0.8, 0.8].map(z => <Box key={z} at={[0, 0.14, z]} size={[1.97, 0.035, 0.085]} color={canvas} ghost={ghost} />)}
  </group>;
  if (kind === 'wall') return <group>
    {[-0.94, 0.94].map(x => <Box key={x} at={[x, 1.2, 0]} size={[0.12, 2.4, 0.15]} color={timber} ghost={ghost} />)}
    {[0.1, 1.0, 2.32].map(y => <Box key={y} at={[0, y, 0]} size={[1.9, 0.13, 0.15]} color={timber} ghost={ghost} />)}
    <Box at={[0, 0.52, 0]} size={[1.8, 0.8, 0.09]} color={canvas} ghost={ghost} />
    <Box at={[0, 1.7, 0]} size={[0.065, 1.15, 0.08]} color={timber} ghost={ghost} />
    <Box at={[0, 1.71, 0]} size={[1.85, 0.06, 0.08]} color={timber} ghost={ghost} />
  </group>;
  if (kind === 'lamp') return <group>
    <Cylinder at={[0, 0.055, 0]} radius={0.27} height={0.11} color={metal} ghost={ghost} />
    <Cylinder at={[0, 1.13, 0]} radius={0.045} height={2.2} color={timber} ghost={ghost} />
    <Box at={[0.16, 2.19, 0]} size={[0.39, 0.06, 0.07]} color={metal} ghost={ghost} />
    <group position={[0.29, 1.69, 0]}><Lantern ghost={ghost} color={metal} /></group>
  </group>;
  return <group>
    <Cylinder at={[0, 0.1, 0]} radius={0.68} height={0.2} color={metal} ghost={ghost} />
    <Cylinder at={[0, 0.25, 0]} radius={0.48} height={0.18} color={canvas} ghost={ghost} />
    {[-1, 1].map(x => [-1, 1].map(z => <Box key={`${x}:${z}`} at={[x * 0.28, 0.89, z * 0.28]} size={[0.09, 1.2, 0.09]} color={timber} ghost={ghost} />))}
    <mesh position={[0, 0.96, 0]} castShadow={!ghost}>
      <octahedronGeometry args={[0.36, 0]} /><SurfaceMaterial color={ghost ? timber : '#acedd5'} emissive={ghost ? undefined : '#64cbb3'} ghost={ghost} />
    </mesh>
    <Cylinder at={[0, 1.5, 0]} radius={0.43} height={0.11} color={metal} ghost={ghost} />
    <mesh position={[0, 1.75, 0]}><coneGeometry args={[0.47, 0.43, 4]} /><SurfaceMaterial color={ghost ? timber : palette.brass} ghost={ghost} /></mesh>
    <Cylinder at={[0, 2.1, 0]} radius={0.023} height={0.35} color={metal} ghost={ghost} />
  </group>;
}

/** The base camp groups around the origin; its entrance faces +Z. */
export function Camp({ lit = true }: { lit?: boolean }) {
  return <group>
    <group position={[-2.25, 0, -1.3]}>
      <Box at={[0, 0.075, 0]} size={[3.1, 0.15, 3.1]} color={palette.edge} />
      <Box at={[0, 0.18, 0]} size={[2.7, 0.07, 2.7]} color={palette.canvas} />
      {[-1, 1].map(side => <group key={side}>
        <mesh position={[side * 0.72, 1.13, 0]} rotation={[0, 0, side * -0.59]} castShadow receiveShadow>
          <boxGeometry args={[0.055, 2.57, 3]} /><meshStandardMaterial color={side < 0 ? '#d5b786' : '#ead5ac'} roughness={0.96} side={DoubleSide} />
        </mesh>
        <Box at={[side * 1.49, 0.16, 0]} size={[0.09, 0.25, 3.1]} color={palette.teal} />
      </group>)}
      <Cylinder at={[0, 1.22, -1.45]} radius={0.045} height={2.45} color={palette.edge} />
      <Cylinder at={[0, 1.22, 1.45]} radius={0.045} height={2.45} color={palette.edge} />
      <Box at={[0, 2.31, 0]} size={[0.09, 0.09, 3.3]} color={palette.edge} />
      <Box at={[-0.54, 0.28, -0.15]} size={[0.72, 0.12, 1.9]} color={palette.teal} />
      <Box at={[-0.54, 0.4, -0.88]} size={[0.62, 0.16, 0.35]} color={palette.canvas} />
      <group position={[0.67, 0.22, 0.55]}><Lantern lit={lit} /></group>
      {lit && <pointLight position={[0.4, 0.9, 0.45]} intensity={3} distance={4} color={'#ffc778'} />}
    </group>
    <group position={[2.0, 0, -0.9]}>
      <Box at={[0, 0.94, 0]} size={[1.7, 0.13, 0.85]} color={palette.timber} />
      {[-0.68, 0.68].map(x => [-0.3, 0.3].map(z => <Box key={`${x}:${z}`} at={[x, 0.46, z]} size={[0.11, 0.92, 0.11]} color={palette.edge} />))}
      <Box at={[0, 0.25, 0]} size={[1.5, 0.065, 0.63]} color={palette.timber} />
      <Box at={[0.16, 1.02, 0.02]} size={[0.62, 0.02, 0.52]} color={palette.canvas} rotation={[0, 0.15, 0]} />
      <Box at={[0.16, 1.035, 0.02]} size={[0.45, 0.009, 0.32]} color={'#90ad99'} rotation={[0, 0.15, 0]} />
      <Cylinder at={[-0.37, 1.07, 0.05]} radius={0.023} height={0.4} color={palette.edge} rotation={[0, 0, Math.PI / 2]} />
      <Box at={[-0.51, 1.08, 0.05]} size={[0.09, 0.09, 0.17]} color={palette.metal} />
      <group position={[0.59, 1.015, -0.17]}><Lantern lit={lit} /></group>
      <Box at={[-0.38, 0.44, 0]} size={[0.52, 0.29, 0.45]} color={palette.teal} />
      <Box at={[-0.38, 0.48, 0.24]} size={[0.09, 0.07, 0.03]} color={palette.brass} />
      <Box at={[0, 1.8, -0.48]} size={[1.5, 0.45, 0.06]} color={palette.teal} />
      {[-0.66, 0.66].map(x => <Box key={x} at={[x, 1.15, -0.5]} size={[0.06, 2.2, 0.06]} color={palette.edge} />)}
      <Box at={[0, 1.82, -0.436]} size={[0.08, 0.26, 0.018]} color={palette.canvas} />
      <Box at={[0, 1.82, -0.436]} size={[0.26, 0.08, 0.018]} color={palette.canvas} />
    </group>
    <group position={[0, 0, 1.85]}>
      <Cylinder at={[0, 0.11, 0]} radius={0.58} height={0.22} color={'#817e6b'} />
      <Cylinder at={[0, 0.225, 0]} radius={0.41} height={0.02} color={palette.dark} />
      <Cylinder at={[0, 0.28, 0]} radius={0.085} height={0.63} color={palette.edge} rotation={[0, 0, Math.PI / 2]} />
      <Cylinder at={[0, 0.3, 0]} radius={0.075} height={0.62} color={palette.edge} rotation={[Math.PI / 2, 0, 0]} />
      {lit && <>
        <mesh position={[0, 0.53, 0]}><coneGeometry args={[0.22, 0.58, 5]} /><SurfaceMaterial color={'#ffd381'} emissive={'#ff9d47'} /></mesh>
        <mesh position={[0.1, 0.46, 0.08]} rotation={[0, 0, -0.2]}><coneGeometry args={[0.13, 0.38, 5]} /><SurfaceMaterial color={'#ffe5a1'} emissive={'#ffc16a'} /></mesh>
        <pointLight position={[0, 0.8, 0]} intensity={5} distance={6} color={'#ffb768'} />
      </>}
      <Cylinder at={[-1.25, 0.28, 0.35]} radius={0.25} height={1.3} color={palette.timber} rotation={[0, 0, Math.PI / 2]} />
    </group>
  </group>;
}
