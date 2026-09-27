import { memo, useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useFrame } from "@react-three/fiber";
import { useUnit } from "effector-react";
import * as THREE from "three";
import { CHUNK_SIZE, RENDER_DISTANCE_OPTIONS, WorldChunk } from "@/lib/survival/world";
import { Gender } from "@/lib/survival/rules";
import { $world, $session, $settings } from "@/stores/sandbox/sandbox";
import { FeatureVisual, FireVisual, ForestInstances, GrassInstances, ItemVisual, PrimitivePerson, WildAnimal } from "./art";
import { SandboxRuntime } from "./runtime";
import { buildTerrainGeometry, terrainSurfaceHeight } from "./terrain";
import { terrainMaterial } from "./materials";
import { VolumetricFog } from "./VolumetricFog";
import { SkyAtmosphere } from "./SkyAtmosphere";

const GroundChunk = memo(({ chunk, seed }: { chunk: WorldChunk; seed: number }) => {
  const geometry = useMemo(() => buildTerrainGeometry(seed, chunk.x, chunk.z), [chunk.x, chunk.z, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const position: [number, number, number] = [chunk.x * CHUNK_SIZE + CHUNK_SIZE / 2, 0, chunk.z * CHUNK_SIZE + CHUNK_SIZE / 2];
  return <mesh position={position} geometry={geometry} material={terrainMaterial} receiveShadow dispose={null} />;
});
GroundChunk.displayName = "GroundChunk";

const RemotePerson = ({ id, gender, bag, backpack, runtime }: { id: string; gender: Gender; bag?: boolean; backpack?: boolean; runtime: SandboxRuntime }) => {
  const root = useRef<THREE.Group>(null), moving = useRef(false), initialized = useRef(false);
  const target = useRef(new THREE.Vector3());
  useFrame((_, delta) => {
    const peer = runtime.peers.find((p) => p.id === id);
    if (!root.current || !peer) return;
    target.current.set(peer.x, peer.y - 1.7, peer.z);
    if (!initialized.current) { root.current.position.copy(target.current); initialized.current = true; }
    moving.current = root.current.position.distanceToSquared(target.current) > 0.005;
    root.current.position.lerp(target.current, 1 - Math.exp(-12 * delta)); root.current.rotation.y = peer.yaw + Math.PI;
  });
  return <group ref={root}><PrimitivePerson gender={gender} bag={bag} backpack={backpack} moving={moving} /></group>;
};

const WorldDeer = ({ x, z, yaw, dead, seed }: { x: number; z: number; yaw: number; dead: boolean; seed: number }) => {
  const root = useRef<THREE.Group>(null);
  const moving = useRef(false);
  const initialized = useRef(false);
  useFrame((_, delta) => {
    const group = root.current;
    if (!group) return;
    if (!initialized.current) {
      group.position.set(x, terrainSurfaceHeight(seed, x, z), z);
      group.rotation.y = yaw;
      initialized.current = true;
    }
    if (dead) {
      moving.current = false;
      group.position.set(x, terrainSurfaceHeight(seed, x, z), z);
      return;
    }
    const dx = x - group.position.x, dz = z - group.position.z;
    moving.current = Math.hypot(dx, dz) > 0.02;
    const alpha = 1 - Math.exp(-5 * delta);
    group.position.x += dx * alpha;
    group.position.z += dz * alpha;
    group.position.y = terrainSurfaceHeight(seed, group.position.x, group.position.z);
    const turn = Math.atan2(Math.sin(yaw - group.rotation.y), Math.cos(yaw - group.rotation.y));
    group.rotation.y += Math.max(-2.8 * delta, Math.min(2.8 * delta, turn));
  });
  return <group ref={root}><WildAnimal moving={moving} dead={dead} /></group>;
};

export const Island = ({ runtime }: { runtime: SandboxRuntime }) => {
  const [world, session, settings] = useUnit([$world, $session, $settings]);
  const subscribe = useCallback((listener: () => void) => { runtime.listeners.add(listener); return () => { runtime.listeners.delete(listener); }; }, [runtime]);
  const snapshot = useCallback(() => runtime.revision, [runtime]);
  useSyncExternalStore(subscribe, snapshot);
  const sea = useRef<THREE.Mesh>(null), sun = useRef<THREE.DirectionalLight>(null), sunTarget = useRef(new THREE.Object3D());
  const fog = RENDER_DISTANCE_OPTIONS[settings.renderDistance];
  useFrame(() => {
    if (sea.current) sea.current.position.set(runtime.view.x, 0, runtime.view.z);
    if (sun.current) { sun.current.position.set(runtime.view.x + 25, 50, runtime.view.z - 36); sunTarget.current.position.set(runtime.view.x, 0, runtime.view.z); sunTarget.current.updateMatrixWorld(); sun.current.target = sunTarget.current; }
  });
  const trees = useMemo(() => runtime.nodes.filter((node) => node.kind === "tree" && !world.changes[node.id]?.removed).map((node) => ({
    x: node.x, y: terrainSurfaceHeight(world.seed, node.x, node.z), z: node.z, scale: node.scale, treeType: node.treeType ?? "birch", applesPicked: world.changes[node.id]?.applesPicked,
  })), [runtime.nodes, world.changes, world.seed]);
  return <>
    <color attach="background" args={["#b8d6d9"]} /><fog attach="fog" args={["#b8d6d9", fog.fogNear, fog.fogFar]} />
    <SkyAtmosphere quality={settings.quality} />
    <hemisphereLight args={["#e2e9df", "#52634f", 1.55]} />
    <directionalLight ref={sun} position={[25, 50, -36]} color="#fff0cf" intensity={1.85} castShadow={settings.quality === "high"} shadow-mapSize={[2048, 2048]} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={35} shadow-camera-bottom={-35} shadow-camera-far={130} shadow-normalBias={0.07} />
    {runtime.stream.chunks.map((chunk) => <GroundChunk key={`${world.seed}:${chunk.key}`} chunk={chunk} seed={world.seed} />)}
    <mesh ref={sea} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1500, 1500]} /><meshStandardMaterial color="#779b93" roughness={0.28} metalness={0.22} transparent opacity={0.85} /></mesh>
    <GrassInstances chunks={runtime.stream.chunks} seed={world.seed} />
    <ForestInstances trees={trees} />
    {runtime.nodes.filter((node) => node.kind !== "tree" && !world.changes[node.id]?.removed).map((node) => {
      const change = world.changes[node.id], x = change?.x ?? node.x, z = change?.z ?? node.z;
      if (node.kind === "animal") return <WorldDeer key={node.id} x={x} z={z} yaw={change?.yaw ?? node.x} dead={Boolean(change?.dead)} seed={world.seed} />;
      if (node.kind === "tree") return null;
      return <group key={node.id} position={[x, terrainSurfaceHeight(world.seed, x, z), z]} rotation={[0, node.x, 0]} scale={node.kind === "stone" || node.kind === "fiber" || node.kind === "nut" ? 1 : node.scale}>
        <FeatureVisual node={node} taken={change?.taken} />
      </group>;
    })}
    {(world.fires ?? []).filter((fire) => Math.hypot(fire.x - runtime.view.x, fire.z - runtime.view.z) < 60).map((fire) => <group key={fire.id} position={[fire.x, terrainSurfaceHeight(world.seed, fire.x, fire.z), fire.z]}><FireVisual fuel={fire.fuel} /></group>)}
    {world.drops.filter((d) => Math.hypot(d.x - runtime.view.x, d.z - runtime.view.z) < 50).map((drop) => <group key={drop.id} position={[drop.x, terrainSurfaceHeight(world.seed, drop.x, drop.z), drop.z]}><ItemVisual kind={drop.item.kind} grounded /></group>)}
    {session.peers.filter((p) => p.id !== session.id).map((peer) => <RemotePerson key={peer.id} id={peer.id} gender={peer.gender} bag={world.people[peer.id]?.bag} backpack={world.people[peer.id]?.backpack} runtime={runtime} />)}
    <VolumetricFog chunks={runtime.stream.chunks} seed={world.seed} quality={settings.quality} fogNear={fog.fogNear} fogFar={fog.fogFar} />
  </>;
};
