import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { useUnit } from "effector-react";
import * as THREE from "three";
import { isAutoloopFrozen } from "@/lib/autoloop";
import { DAWN_DRIVE_UPGRADE, hasUpgrade } from "@/lib/expedition";
import { $expedition } from "@/stores/expedition/expedition";
import { PLAYER_SPAWN } from "./constants";
import { TownState } from "./state";
import { pollControls } from "./controls";
import { resolveObstacles } from "./physics";
import { stepInteraction, tryStartInteraction } from "./interaction";
import {
  CAR_RADIUS,
  CarBody,
  createCarBody,
  slopeRisk,
  stepCar,
  WHEEL_RADIUS,
} from "./carPhysics";
import { groundHeight, drivingTerrain as terrain, rampAt } from "./world";

const OVERTURN_RISK = 0.62;
const OVERTURN_SPEED = 3.2;
const OVERTURN_RESET = 2.2;

const BODY = "#e05252";
const BODY_DARK = "#c23d3d";
const CABIN = "#263449";
const WINDOW = "#101c2e";
const LIGHT = "#fff3c4";
const WHEEL = "#1f1f1f";
const WHEEL_LIGHT = "#3a3a3a";

const UP = new THREE.Vector3(0, 1, 0);
const normal = new THREE.Vector3();
const slopeQuat = new THREE.Quaternion();
const yawQuat = new THREE.Quaternion();
const flipQuat = new THREE.Quaternion();
const flipAxis = new THREE.Vector3(0, 0, 1);

const bodyMaterial = new THREE.MeshStandardMaterial({
  color: BODY,
  roughness: 0.55,
  metalness: 0.05,
});

const bodyDarkMaterial = new THREE.MeshStandardMaterial({
  color: BODY_DARK,
  roughness: 0.55,
});

const cabinMaterial = new THREE.MeshStandardMaterial({
  color: CABIN,
  roughness: 0.6,
});

const windowMaterial = new THREE.MeshStandardMaterial({
  color: WINDOW,
  roughness: 0.15,
  metalness: 0.3,
});

const lightMaterial = new THREE.MeshStandardMaterial({
  color: LIGHT,
  emissive: LIGHT,
  emissiveIntensity: 2,
  roughness: 0.3,
});

const wheelMaterial = new THREE.MeshStandardMaterial({
  color: WHEEL,
  roughness: 0.9,
});

const wheelLightMaterial = new THREE.MeshStandardMaterial({
  color: WHEEL_LIGHT,
  roughness: 0.5,
  metalness: 0.3,
});

interface CarFlip {
  active: boolean;
  angle: number;
  timer: number;
}

const Wheel = ({
  spinRef,
  steerRef,
  position,
}: {
  spinRef: React.RefObject<THREE.Group>;
  steerRef?: React.RefObject<THREE.Group>;
  position: [number, number, number];
}) => {
  const wheel = (
    <group ref={spinRef}>
      <mesh rotation={[0, 0, Math.PI / 2]} material={wheelMaterial} castShadow>
        <cylinderGeometry args={[WHEEL_RADIUS, WHEEL_RADIUS, 0.16, 16]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={wheelLightMaterial}>
        <cylinderGeometry args={[0.09, 0.09, 0.17, 10]} />
      </mesh>
    </group>
  );

  if (steerRef) {
    return <group ref={steerRef} position={position}>{wheel}</group>;
  }

  return <group position={position}>{wheel}</group>;
};

export const CarModel = ({
  state,
  onNavigate,
}: {
  state: TownState;
  onNavigate: (path: string) => void;
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const steerLRef = useRef<THREE.Group>(null);
  const steerRRef = useRef<THREE.Group>(null);
  const wheelFLRef = useRef<THREE.Group>(null);
  const wheelFRRef = useRef<THREE.Group>(null);
  const wheelRLRef = useRef<THREE.Group>(null);
  const wheelRRRef = useRef<THREE.Group>(null);
  const carRef = useRef<CarBody>(
    createCarBody(
      PLAYER_SPAWN.x,
      PLAYER_SPAWN.z,
      Math.PI,
      groundHeight(PLAYER_SPAWN.x, PLAYER_SPAWN.z),
    ),
  );
  const groundOrientation = useRef(new THREE.Quaternion());
  const flipRef = useRef<CarFlip>({ active: false, angle: 0, timer: 0 });
  const teleportRevision = useRef(state.teleportRevision);
  const navigateRef = useRef(onNavigate);
  const expedition = useUnit($expedition);
  const tuned = hasUpgrade(expedition, DAWN_DRIVE_UPGRADE);
  navigateRef.current = onNavigate;

  useFrame((_, delta) => {
    if (isAutoloopFrozen() || state.paused) {
      return;
    }

    const dt = Math.min(delta, 0.05);
    const player = state.player;
    const body = carRef.current;
    const flip = flipRef.current;

    if (stepInteraction(state, dt, navigateRef.current)) {
      return;
    }

    const ctrl = pollControls();

    if (!flip.active && ctrl.interact && tryStartInteraction(state)) {
      return;
    }

    body.heading = player.facing;

    // Let external tools (autoloop `setPlayer`) teleport the car.
    if (teleportRevision.current !== state.teleportRevision || Math.hypot(player.x - body.x, player.z - body.z) > 5) {
      teleportRevision.current = state.teleportRevision;
      flip.active = false; flip.angle = 0; flip.timer = 0;
      body.x = player.x;
      body.z = player.z;
      body.y = groundHeight(player.x, player.z);
      body.vy = 0;
      body.speed = 0;
      body.lateral = 0;
      body.airborne = false;
      body.yawRate = 0;
      body.roll = body.rollVel = body.pitch = body.pitchVel = 0;
      terrain.normalAt(body.x, body.z, normal);
      groundOrientation.current.setFromUnitVectors(UP, normal);
    }

    if (flip.active) {
      body.speed *= 1 - Math.min(1, 3 * dt);
      body.lateral = 0;
      flip.angle = Math.min(Math.PI, flip.angle + OVERTURN_SPEED * dt);
      flip.timer += dt;
    } else {
      stepCar(
        body,
        {
          throttle: ctrl.moveDir.z < 0 ? 1 : 0,
          brake: ctrl.moveDir.z > 0 ? 1 : 0,
          steer: -ctrl.moveDir.x,
          handbrake: ctrl.handbrake ? 1 : 0,
        },
        terrain,
        dt,
        tuned
          ? { engineMultiplier: 1.18, maxSpeedMultiplier: 1.15, gripMultiplier: 1.08 }
          : undefined,
      );
    }

    player.x = body.x;
    player.z = body.z;
    player.facing = body.heading;
    player.speed = body.speed;

    const hit = resolveObstacles(player, CAR_RADIUS);
    const beforeX = player.x;
    const beforeZ = player.z;

    if (hit || player.x !== beforeX || player.z !== beforeZ) {
      body.speed *= 0.25;
      body.lateral *= 0.3;
    }

    body.x = player.x;
    body.z = player.z;

    terrain.normalAt(body.x, body.z, normal);

    if (!flip.active && !body.airborne && !rampAt(body.x, body.z) && slopeRisk(normal, body.speed) > OVERTURN_RISK) {
      flip.active = true;
      flip.timer = 0;
    }

    if (flip.active && flip.timer > OVERTURN_RESET && flip.angle > Math.PI * 0.9) {
      const downhill = Math.hypot(normal.x, normal.z) || 1;

      body.x += (normal.x / downhill) * 1.6;
      body.z += (normal.z / downhill) * 1.6;
      body.speed = 0;
      body.lateral = 0;
      body.vy = 0;
      body.y = groundHeight(body.x, body.z);
      body.airborne = false;
      flip.active = false;
      flip.angle = 0;
      flip.timer = 0;

      player.x = body.x;
      player.z = body.z;
      player.speed = 0;
      body.x = player.x;
      body.z = player.z;
    }

    player.y = body.y;

    if (rootRef.current) {
      yawQuat.setFromAxisAngle(UP, body.heading);
      if (!body.airborne) {
        slopeQuat.setFromUnitVectors(UP, normal);
        groundOrientation.current.slerp(slopeQuat, 1 - Math.exp(-10 * dt));
      }
      flipQuat.setFromAxisAngle(flipAxis, flip.angle);

      rootRef.current.position.set(body.x, body.y, body.z);
      rootRef.current.quaternion
        .copy(groundOrientation.current)
        .multiply(yawQuat)
        .multiply(flipQuat);
    }

    if (bodyRef.current) {
      bodyRef.current.rotation.z = body.roll;
      bodyRef.current.rotation.x = body.pitch;
    }

    if (steerLRef.current) {
      steerLRef.current.rotation.y = body.steer;
    }

    if (steerRRef.current) {
      steerRRef.current.rotation.y = body.steer;
    }

    for (const ref of [wheelFLRef, wheelFRRef, wheelRLRef, wheelRRRef]) {
      if (ref.current) {
        ref.current.rotation.x = body.wheelSpin;
      }
    }
  });

  return (
    <group
      ref={rootRef}
      position={[
        PLAYER_SPAWN.x,
        groundHeight(PLAYER_SPAWN.x, PLAYER_SPAWN.z),
        PLAYER_SPAWN.z,
      ]}
    >
      <group ref={bodyRef}>
        <Wheel spinRef={wheelRLRef} position={[0.55, WHEEL_RADIUS, -0.66]} />
        <Wheel spinRef={wheelRRRef} position={[-0.55, WHEEL_RADIUS, -0.66]} />
        <Wheel spinRef={wheelFLRef} steerRef={steerLRef} position={[0.55, WHEEL_RADIUS, 0.66]} />
        <Wheel spinRef={wheelFRRef} steerRef={steerRRef} position={[-0.55, WHEEL_RADIUS, 0.66]} />

        <mesh material={bodyMaterial} position={[0, 0.42, 0]} castShadow>
          <boxGeometry args={[1.3, 0.3, 1.35]} />
        </mesh>

        <mesh material={bodyMaterial} position={[0, 0.56, 0.36]} castShadow>
          <boxGeometry args={[1.1, 0.24, 0.62]} />
        </mesh>

        <mesh material={cabinMaterial} position={[0, 0.82, -0.2]} castShadow>
          <boxGeometry args={[0.8, 0.4, 0.6]} />
        </mesh>

        <mesh material={windowMaterial} position={[0, 0.9, 0.14]}>
          <boxGeometry args={[0.62, 0.22, 0.04]} />
        </mesh>

        <mesh material={windowMaterial} position={[0, 0.9, -0.54]}>
          <boxGeometry args={[0.62, 0.22, 0.04]} />
        </mesh>

        <mesh material={windowMaterial} position={[0.4, 0.9, -0.2]}>
          <boxGeometry args={[0.04, 0.22, 0.56]} />
        </mesh>

        <mesh material={windowMaterial} position={[-0.4, 0.9, -0.2]}>
          <boxGeometry args={[0.04, 0.22, 0.56]} />
        </mesh>

        <mesh material={lightMaterial} position={[0.32, 0.42, 0.69]}>
          <boxGeometry args={[0.14, 0.1, 0.04]} />
        </mesh>

        <mesh material={lightMaterial} position={[-0.32, 0.42, 0.69]}>
          <boxGeometry args={[0.14, 0.1, 0.04]} />
        </mesh>

        <mesh material={bodyDarkMaterial} position={[0, 0.32, -0.7]} castShadow>
          <boxGeometry args={[1.2, 0.12, 0.06]} />
        </mesh>
        {tuned && <>
          <mesh material={lightMaterial} position={[0, 0.59, 0.55]}><boxGeometry args={[0.72, 0.035, 0.08]} /></mesh>
          <mesh material={lightMaterial} position={[0, 0.58, -0.68]}><boxGeometry args={[1.05, 0.06, 0.12]} /></mesh>
        </>}
      </group>
    </group>
  );
};
