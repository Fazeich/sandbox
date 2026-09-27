import { BEACONS } from "@/lib/expedition";
import { groundHeight } from "./world";

const DawnStones = () => {
  const beacon = BEACONS[0];
  return <group>
    {[[-5, -3], [5, -3], [-5, 3], [5, 3]].map(([dx, dz], index) => {
      const height = 2.8 + (index % 2) * 0.7;
      return <group key={index} position={[beacon.x + dx, groundHeight(beacon.x + dx, beacon.z + dz), beacon.z + dz]} rotation={[0, index * 0.3 - 0.4, index % 2 ? -0.08 : 0.08]}>
        <mesh position={[0, height / 2, 0]} castShadow><boxGeometry args={[0.7, height, 1.15]} /><meshStandardMaterial color="#8b806e" roughness={0.9} /></mesh>
        <mesh position={[0, height + 0.25, 0]} rotation={[0, Math.PI / 4, 0]}><octahedronGeometry args={[0.32]} /><meshStandardMaterial color="#d7ad69" emissive="#d7ad69" emissiveIntensity={0.18} /></mesh>
      </group>;
    })}
  </group>;
};

const GroveGate = () => {
  const beacon = BEACONS[1];
  const y = groundHeight(beacon.x, beacon.z);
  return <group position={[beacon.x, y, beacon.z]} rotation={[0, -0.55, 0]}>
    {[-4.5, 4.5].map((x) => <group key={x} position={[x, 0, 0]}>
      <mesh position={[0, 2.25, 0]} castShadow><cylinderGeometry args={[0.7, 0.95, 4.5, 7]} /><meshStandardMaterial color="#65543c" roughness={1} /></mesh>
      <mesh position={[0, 4.7, 0]}><dodecahedronGeometry args={[1.45]} /><meshStandardMaterial color="#568a68" roughness={0.95} /></mesh>
    </group>)}
    <mesh position={[0, 4.3, 0]} rotation={[0, 0, 0.08]} castShadow><boxGeometry args={[8.5, 0.55, 0.7]} /><meshStandardMaterial color="#776348" roughness={1} /></mesh>
  </group>;
};

const RidgeTower = () => {
  const beacon = BEACONS[2];
  const x = beacon.x + 5, z = beacon.z + 1;
  return <group position={[x, groundHeight(x, z), z]}>
    {[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map(([dx, dz], index) =>
      <mesh key={index} position={[dx, 2.4, dz]} rotation={[index < 2 ? -0.08 : 0.08, 0, dx > 0 ? -0.08 : 0.08]} castShadow><boxGeometry args={[0.35, 5, 0.35]} /><meshStandardMaterial color="#5d6670" /></mesh>)}
    <mesh position={[0, 4.55, 0]} castShadow><boxGeometry args={[4.2, 0.45, 4.2]} /><meshStandardMaterial color="#77838c" /></mesh>
    <mesh position={[0, 5.65, 0]} castShadow><coneGeometry args={[2.8, 1.9, 4]} /><meshStandardMaterial color="#394858" /></mesh>
  </group>;
};

const EchoColumns = () => {
  const beacon = BEACONS[3];
  return <group>
    {[-1, 0, 1].map((step) => {
      const x = beacon.x + step * 3.4, z = beacon.z + 5;
      const height = 3.2 + (1 - Math.abs(step)) * 1.8;
      return <group key={step} position={[x, groundHeight(x, z), z]}>
        <mesh position={[0, height / 2, 0]} castShadow><cylinderGeometry args={[0.38, 0.62, height, 6]} /><meshStandardMaterial color="#7d728a" roughness={0.8} /></mesh>
        <mesh position={[0, height + 0.35, 0]} rotation={[0, 0, Math.PI / 4]}><octahedronGeometry args={[0.52]} /><meshStandardMaterial color="#c69cdb" emissive="#8d61a8" emissiveIntensity={0.35} /></mesh>
      </group>;
    })}
  </group>;
};

const SunsetTerraces = () => {
  const beacon = BEACONS[4];
  return <group>
    {[0, 1, 2].map((step) => {
      const x = beacon.x - 5 + step * 1.8, z = beacon.z + 4.5;
      return <mesh key={step} position={[x, groundHeight(x, z) + 0.3 + step * 0.28, z]} castShadow receiveShadow>
        <boxGeometry args={[3.8, 0.6 + step * 0.56, 6 - step * 1.1]} />
        <meshStandardMaterial color={step === 2 ? "#ae7766" : "#806d65"} roughness={0.9} />
      </mesh>;
    })}
  </group>;
};

export const BeaconLandmarks = () => <group>
  <DawnStones />
  <GroveGate />
  <RidgeTower />
  <EchoColumns />
  <SunsetTerraces />
</group>;
