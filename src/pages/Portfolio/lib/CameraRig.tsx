import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { isAutoloopFrozen } from "@/lib/autoloop";
import {
  CAMERA_ALTAR_FOCUS_RAISE,
  CAMERA_BACK,
  CAMERA_BLEND,
  CAMERA_FOV,
  CAMERA_FOV_NEAR_ALTAR,
  CAMERA_HEIGHT,
  CAMERA_LOOK_BLEND,
  INTERACTION_RADIUS,
} from "./constants";
import { TownState } from "./state";
import { groundHeight, world } from "./world";

const desired = new THREE.Vector3();
const lookDesired = new THREE.Vector3();
const project = new THREE.Vector3();

export const CameraRig = ({ state }: { state: TownState }) => {
  const follow = useRef({ position: new THREE.Vector3(), look: new THREE.Vector3(), facing: state.player.facing, initialized: false });
  useFrame(({ camera, size }, delta) => {
    if (isAutoloopFrozen() || state.paused) {
      if (state.paused) state.tooltip.visible = false;
      return;
    }

    const dt = Math.min(delta, 0.05);
    const p = state.player;
    const pedestals = world.pedestals;

    let nearest = -1;
    let nearestDist = INTERACTION_RADIUS;

    for (let i = 0; i < pedestals.length; i += 1) {
      const pedestal = pedestals[i];
      const dx = p.x - pedestal.position.x;
      const dz = p.z - pedestal.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);

      if (distance < nearestDist) {
        nearestDist = distance;
        nearest = i;
      }
    }

    const inRange = !state.interacting && nearest >= 0;
    const groundY = groundHeight(p.x, p.z);

    // Smooth the orbit angle rather than cutting through the player on a U-turn.
    const tracking = follow.current;
    const playerY = Math.max(groundY, p.y);
    const speedRatio = Math.min(1, Math.abs(p.speed) / 20);
    const cameraDistance = CAMERA_BACK + speedRatio * 3.2;
    const lookAhead = 1.4 + speedRatio * 4.2;
    desired.set(p.x, playerY + CAMERA_HEIGHT + speedRatio * 1.4 + (inRange ? CAMERA_ALTAR_FOCUS_RAISE : 0), p.z);
    lookDesired.set(
      p.x + Math.sin(p.facing) * lookAhead,
      playerY + 1,
      p.z + Math.cos(p.facing) * lookAhead,
    );
    if (!tracking.initialized) {
      tracking.position.copy(desired);
      tracking.look.copy(lookDesired);
      tracking.facing = p.facing;
      tracking.initialized = true;
    } else {
      const blend = 1 - Math.exp(-CAMERA_BLEND * dt);
      const angle = p.facing - tracking.facing;
      tracking.facing += Math.atan2(Math.sin(angle), Math.cos(angle)) * blend;
      tracking.position.lerp(desired, blend);
      tracking.look.lerp(lookDesired, 1 - Math.exp(-CAMERA_LOOK_BLEND * dt));
    }
    state.cameraFacing = tracking.facing;
    camera.position.set(
      tracking.position.x - Math.sin(tracking.facing) * cameraDistance,
      tracking.position.y,
      tracking.position.z - Math.cos(tracking.facing) * cameraDistance,
    );
    camera.lookAt(tracking.look);
    const targetFov = state.interacting
      ? CAMERA_FOV - 4
      : inRange
        ? CAMERA_FOV_NEAR_ALTAR
        : CAMERA_FOV + speedRatio * 6;

    const cam = camera as THREE.PerspectiveCamera;

    cam.fov += (targetFov - cam.fov) * (1 - Math.exp(-CAMERA_BLEND * dt));
    cam.updateProjectionMatrix();

    if (inRange) {
      const pedestal = pedestals[nearest];
      const baseY = groundHeight(pedestal.position.x, pedestal.position.z);

      project
        .set(
          pedestal.position.x,
          baseY + pedestal.height + 0.7,
          pedestal.position.z,
        )
        .project(camera);

      state.tooltip.visible = true;
      state.tooltip.x = (project.x * 0.5 + 0.5) * size.width;
      state.tooltip.y = (-project.y * 0.5 + 0.5) * size.height;
      state.tooltip.label = pedestal.label;
      state.tooltip.keyHint = pedestal.keyHint;
      state.tooltip.target = pedestal.target;
      state.hoveredPedestalId = pedestal.id;
    } else {
      state.tooltip.visible = false;
      state.tooltip.target = "";
      state.hoveredPedestalId = null;
    }
  });

  return null;
};
