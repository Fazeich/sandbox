import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group } from 'three';

const moteCount = 28;
const skipRaycast = () => undefined;

function wingGeometry(side: number) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, 0, 0.12, side * 0.57, 0.02, -0.02, side * 0.44, 0.01, -0.17,
    0, 0, 0.12, side * 0.44, 0.01, -0.17, 0, 0, -0.2,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

const leftWing = wingGeometry(-1);
const rightWing = wingGeometry(1);

function Gull({ phase, radius, height }: { phase: number; radius: number; height: number }) {
  const bird = useRef<Group>(null);
  const wings = useRef<Group>(null);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    const angle = time * 0.16 + phase;
    if (bird.current) {
      bird.current.position.set(Math.cos(angle) * radius, height + Math.sin(time * 0.65 + phase) * 0.23, Math.sin(angle) * radius);
      bird.current.rotation.set(-0.06, -angle, -0.17);
    }
    if (wings.current) wings.current.rotation.z = Math.sin(time * 1.6 + phase) * 0.055;
  });
  return <group ref={bird}>
    <mesh rotation={[Math.PI / 2, 0, 0]} raycast={skipRaycast}>
      <cylinderGeometry args={[0.035, 0.058, 0.38, 5]} />
      <meshStandardMaterial color={'#e9dec3'} roughness={0.95} />
    </mesh>
    <group ref={wings} dispose={null}>
      <mesh geometry={leftWing} raycast={skipRaycast}>
        <meshStandardMaterial color={'#e9dec3'} roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh geometry={rightWing} raycast={skipRaycast}>
        <meshStandardMaterial color={'#e9dec3'} roughness={0.95} side={DoubleSide} />
      </mesh>
    </group>
  </group>;
}

/** A quiet, persistent sign of life after the first signal; never participates in picking. */
export function SignalResponse({ position }: { position: [number, number, number] }) {
  const attribute = useRef<BufferAttribute>(null);
  const positions = useMemo(() => new Float32Array(moteCount * 3), []);
  useFrame(({ clock }) => {
    const time = clock.elapsedTime;
    for (let index = 0; index < moteCount; index++) {
      const progress = (index / moteCount + time * 0.038) % 1;
      const angle = index * 2.39996 + time * 0.35 + progress * 3;
      const radius = 0.4 + Math.sin(progress * Math.PI) * 0.7;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = 0.55 + progress * 5;
      positions[index * 3 + 2] = Math.sin(angle) * radius;
    }
    if (attribute.current) attribute.current.needsUpdate = true;
  });
  return <group position={position}>
    <points raycast={skipRaycast} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute ref={attribute} attach={'attributes-position'} args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={'#ffe2a2'} size={0.043} sizeAttenuation transparent opacity={0.56} depthWrite={false} toneMapped={false} />
    </points>
    <Gull phase={0.3} radius={4.5} height={8.1} />
    <Gull phase={3.2} radius={5.6} height={8.8} />
  </group>;
}
