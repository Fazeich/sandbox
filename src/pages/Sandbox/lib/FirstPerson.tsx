import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useUnit } from "effector-react";
import * as THREE from "three";
import { NODE_TARGET_HEIGHT, terrainHeight, TREE_VARIANTS } from "@/lib/survival/world";
import { quickSlots } from "@/lib/survival/rules";
import { $world, $phase, $session, $settings, $ready, readyChanged, actorId, currentPerson, persistSolo, phaseChanged } from "@/stores/sandbox/sandbox";
import { PrimitiveHands } from "./art";
import { terrainSurfaceHeight } from "./terrain";
import { SandboxRuntime, syncStream } from "./runtime";
import { performAction, tickSolo } from "./session";

/** Metres per second of the main-menu camera drift. */
const MENU_DRIFT_SPEED = 1.15;
export const FirstPerson = ({ runtime }: { runtime: SandboxRuntime }) => {
  const { camera, gl } = useThree();
  const [phase, world, session, settings] = useUnit([$phase, $world, $session, $settings]);
  const person = world.people[session.mode === "online" ? session.id : "local"];
  const keys = useRef(new Set<string>()), drag = useRef(false), dragDistance = useRef(0);
  const hand = useRef<THREE.Group>(null), swing = useRef(false), direction = useRef(new THREE.Vector3());
  const timer = useRef(0), saveTimer = useRef(0);
  const menuCamera = useRef({ active: false, t: 0, x: 0, z: 0, y: Number.NaN, lookY: 0 });
  useEffect(() => {
    const clear = () => { keys.current.clear(); drag.current = false; runtime.pose.moving = runtime.pose.sprinting = false; };
    const interact = (pickup: boolean) => {
      const person = currentPerson();
      if ($phase.getState() !== "playing" || !person || person.sleeping || person.vitals.health <= 0 || performance.now() - runtime.actionAt < 340) return;
      runtime.actionAt = performance.now();
      if (runtime.target) void performAction({ type: pickup ? "pickup" : "use", id: runtime.target }, runtime);
      else if (runtime.waterTarget) void performAction({ type: "drink" }, runtime);
      else void performAction({ type: "eat" }, runtime);
    };
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input,select,textarea")) return;
      const phase = $phase.getState(), person = currentPerson();
      if (phase === "inventory" && (event.code === "KeyB" || event.code === "Escape")) { event.preventDefault(); phaseChanged("playing"); return; }
      if (phase !== "playing" || !person || person.sleeping || person.vitals.health <= 0) return;
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
      if (event.repeat) return;
      if (event.code === "KeyE") interact(true);
      if (event.code === "KeyF") void performAction({ type: "eat" }, runtime);
      if (event.code.startsWith("Digit")) { const slot = Number(event.code.slice(-1)) - 1; if (slot >= 0 && slot < quickSlots(person)) void performAction({ type: "select", slot }, runtime); }
      if (event.code === "KeyQ") void performAction({ type: "drop" }, runtime);
      if (event.code === "KeyB" && person.backpack) { phaseChanged("inventory"); if (document.pointerLockElement) document.exitPointerLock(); clear(); }
      if (event.code === "Escape") { phaseChanged("paused"); if (document.pointerLockElement) document.exitPointerLock(); clear(); }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const mouse = (event: MouseEvent) => {
      if ($phase.getState() !== "playing" || currentPerson()?.sleeping || (!runtime.locked && !drag.current)) return;
      runtime.pose.yaw -= event.movementX * 0.0022; runtime.pitch = Math.max(-1.4, Math.min(1.4, runtime.pitch - event.movementY * 0.0022));
      dragDistance.current += Math.abs(event.movementX) + Math.abs(event.movementY);
    };
    const pointerDown = (event: MouseEvent) => {
      if (event.button === 2) { drag.current = true; dragDistance.current = 0; }
      else if (event.button === 0) interact(false);
    };
    const pointerUp = (event: MouseEvent) => {
      if (event.button === 2 && drag.current && dragDistance.current < 6 && $phase.getState() === "playing" && !currentPerson()?.sleeping && performance.now() - runtime.actionAt > 340) { runtime.actionAt = performance.now(); void performAction({ type: "combine" }, runtime); }
      drag.current = false;
    };
    const locked = () => {
      const previous = runtime.locked; runtime.locked = document.pointerLockElement === gl.domElement;
      const person = currentPerson();
      if (previous && !runtime.locked && $phase.getState() === "playing" && person && !person.sleeping && person.vitals.health > 0) { phaseChanged("paused"); clear(); }
    };
    const blur = () => { clear(); const person = currentPerson(); if ($phase.getState() === "playing" && person && !person.sleeping && person.vitals.health > 0) phaseChanged("paused"); };
    const visibility = () => { if (document.hidden) blur(); };
    const context = (event: Event) => event.preventDefault();
    window.addEventListener("keydown", down); window.addEventListener("keyup", up); window.addEventListener("mousemove", mouse); window.addEventListener("mouseup", pointerUp); window.addEventListener("blur", blur);
    document.addEventListener("pointerlockchange", locked); document.addEventListener("visibilitychange", visibility);
    gl.domElement.addEventListener("mousedown", pointerDown); gl.domElement.addEventListener("contextmenu", context);
    return () => {
      clear(); window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("mousemove", mouse); window.removeEventListener("mouseup", pointerUp); window.removeEventListener("blur", blur);
      document.removeEventListener("pointerlockchange", locked); document.removeEventListener("visibilitychange", visibility);
      gl.domElement.removeEventListener("mousedown", pointerDown); gl.domElement.removeEventListener("contextmenu", context);
    };
  }, [runtime, gl]);
  useEffect(() => { keys.current.clear(); if (phase !== "playing") runtime.pose.moving = runtime.pose.sprinting = false; }, [phase, runtime]);
  useFrame((_, delta) => {
    if (!$ready.getState()) readyChanged(true);
    const dt = Math.min(delta, 0.05); runtime.time += dt;
    const state = $world.getState(), person = state.people[actorId()], pose = runtime.pose;
    if ($phase.getState() === "menu") {
      // A slow, endless dolly from left to right across the living world, rising over terrain and canopies.
      const m = menuCamera.current, seed = state.seed;
      if (!m.active) Object.assign(m, { active: true, t: 0, x: pose.x - 30, z: pose.z + 16, y: Number.NaN, lookY: 0 });
      m.t += dt;
      const x = m.x + m.t * MENU_DRIFT_SPEED, z = m.z + Math.sin(m.t * 0.045) * 4;
      const lookX = x + 9, lookZ = z - 28;
      const ground = (px: number, pz: number) => Math.max(0, terrainHeight(seed, px, pz));
      let clearance = Math.max(ground(x, z), ground(x + 8, z), ground(x, z - 6), ground(x + 8, z - 6)) + 4.6;
      for (const node of runtime.nodes) {
        if (node.kind !== "tree" || state.changes[node.id]?.removed || Math.abs(node.x - x - 3) > 7 || Math.abs(node.z - z) > 5) continue;
        clearance = Math.max(clearance, ground(node.x, node.z) + TREE_VARIANTS[node.treeType ?? "birch"].size * node.scale + 1.2);
      }
      const lookHeight = ground(lookX, lookZ) + 1.4;
      if (!Number.isFinite(m.y)) { m.y = clearance; m.lookY = lookHeight; }
      const ease = 1 - Math.exp(-dt * 0.7);
      m.y += (clearance - m.y) * ease; m.lookY += (lookHeight - m.lookY) * ease * 0.6;
      camera.rotation.order = "YXZ";
      camera.position.set(x, m.y + Math.sin(m.t * 0.31) * 0.15, z);
      camera.lookAt(lookX, m.lookY + Math.sin(m.t * 0.13) * 0.4, lookZ);
      runtime.view.x = x + 4; runtime.view.z = z - 16;
      syncStream(runtime, seed, settings.renderDistance, runtime.view);
      return;
    }
    menuCamera.current.active = false;
    runtime.view.x = pose.x; runtime.view.z = pose.z;
    syncStream(runtime, state.seed, settings.renderDistance);
    if (!person) return;
    timer.current += Math.min(delta, 5); saveTimer.current += Math.min(delta, 5);
    if (timer.current >= 1) { tickSolo(runtime, timer.current); timer.current = 0; }
    if (saveTimer.current >= 8) { if ($session.getState().mode === "solo") persistSolo($world.getState()); saveTimer.current = 0; }
    const held = keys.current;
    if ($phase.getState() === "playing" && !person.sleeping && person.vitals.health > 0) {
      if (held.has("ArrowLeft")) pose.yaw += dt * 1.8;
      if (held.has("ArrowRight")) pose.yaw -= dt * 1.8;
      const forward = Number(held.has("KeyW") || held.has("ArrowUp")) - Number(held.has("KeyS") || held.has("ArrowDown"));
      const sideways = Number(held.has("KeyD")) - Number(held.has("KeyA"));
      const length = Math.hypot(forward, sideways) || 1;
      const tired = Math.min(1, person.vitals.stamina / 15), swimming = terrainHeight(state.seed, pose.x, pose.z) < -0.7;
      pose.moving = forward !== 0 || sideways !== 0;
      pose.sprinting = Boolean(pose.moving && (held.has("ShiftLeft") || held.has("ShiftRight")) && person.vitals.stamina > 5);
      const speed = (swimming ? 2.1 : pose.sprinting ? 6.6 : 3.7) * (0.45 + tired * 0.55);
      const dx = (-Math.sin(pose.yaw) * forward + Math.cos(pose.yaw) * sideways) / length * speed * dt;
      const dz = (-Math.cos(pose.yaw) * forward - Math.sin(pose.yaw) * sideways) / length * speed * dt;
      const blocked = (x: number, z: number) => runtime.nodes.some((node) => {
        if (node.kind !== "tree" || state.changes[node.id]?.removed) return false;
        const trunkRadius = TREE_VARIANTS[node.treeType ?? "birch"].trunkRadius;
        return Math.hypot(x - node.x, z - node.z) < trunkRadius * node.scale;
      });
      if (!blocked(pose.x + dx, pose.z)) pose.x += dx;
      if (!blocked(pose.x, pose.z + dz)) pose.z += dz;
      const ground = Math.max(-0.85, terrainSurfaceHeight(state.seed, pose.x, pose.z));
      if (held.has("Space") && runtime.grounded && person.vitals.stamina >= 3) { runtime.velocityY = 4.6; runtime.grounded = false; held.delete("Space"); void performAction({ type: "jump" }, runtime); }
      runtime.velocityY -= dt * 16; pose.y += runtime.velocityY * dt;
      if (pose.y <= ground + 1.7) { pose.y = ground + 1.7; runtime.velocityY = 0; runtime.grounded = true; }
    } else { pose.moving = pose.sprinting = false; }
    camera.rotation.order = "YXZ"; camera.rotation.set(person.sleeping ? -0.4 : runtime.pitch, pose.yaw, person.sleeping ? 0.3 : 0);
    camera.position.set(pose.x, person.sleeping ? terrainSurfaceHeight(state.seed, pose.x, pose.z) + 0.4 : pose.y + (pose.moving && runtime.grounded ? Math.sin(runtime.time * 9) * 0.02 : 0), pose.z);
    camera.getWorldDirection(direction.current);
    const dir = direction.current; runtime.target = null;
    let best = Infinity;
    const targets = [...runtime.nodes.filter((node) => !state.changes[node.id]?.removed).map((node) => ({ id: node.id, x: state.changes[node.id]?.x ?? node.x, z: state.changes[node.id]?.z ?? node.z, height: NODE_TARGET_HEIGHT[node.kind] })), ...state.drops.map((drop) => ({ ...drop, height: 0.16 })), ...(state.fires ?? []).map((fire) => ({ id: fire.id, x: fire.x, z: fire.z, height: 0.3 }))];
    targets.forEach((target) => {
      const dx = target.x - pose.x, dz = target.z - pose.z, dy = terrainHeight(state.seed, target.x, target.z) + target.height - pose.y;
      const distance = Math.hypot(dx, dy, dz), dot = (dx * dir.x + dy * dir.y + dz * dir.z) / distance;
      if (Math.hypot(dx, dz) < 3.3 && dot > 0.86 && distance < best) { best = distance; runtime.target = target.id; }
    });
    runtime.waterTarget = terrainHeight(state.seed, pose.x - Math.sin(pose.yaw) * 1.7, pose.z - Math.cos(pose.yaw) * 1.7) < 0.12 && pose.y < 3 && runtime.pitch < -0.2;
    runtime.swing = Math.max(0, runtime.swing - dt); swing.current = runtime.swing > 0;
    if (hand.current) { hand.current.position.copy(camera.position); hand.current.quaternion.copy(camera.quaternion); }
  });
  return phase !== "menu" && person && !person.sleeping && person.vitals.health > 0 ? <group ref={hand}><PrimitiveHands item={person.slots[person.selected]?.kind ?? null} active={swing} /></group> : null;
};
