import { Peer, Pose } from "@/lib/survival/rules";
import { ChunkStream, findSpawn, NaturalNode, RenderDistance, RENDER_DISTANCE_OPTIONS } from "@/lib/survival/world";
import { $settings, $world } from "@/stores/sandbox/sandbox";

export interface SandboxRuntime {
  pose: Pose; pitch: number; velocityY: number; grounded: boolean;
  target: string | null; swing: number; locked: boolean; peers: Peer[];
  actionAt: number; time: number; stream: ChunkStream; nodes: NaturalNode[];
  revision: number; listeners: Set<() => void>; waterTarget: boolean;
  /** Where the world is being looked at: the player's feet in play, the drifting camera's focus in the menu. */
  view: { x: number; z: number };
}
export const createRuntime = (): SandboxRuntime => {
  const world = $world.getState(), pose = { ...(world.people.local?.pose ?? findSpawn(world.seed)) };
  const radius = RENDER_DISTANCE_OPTIONS[$settings.getState().renderDistance].radius;
  const stream = new ChunkStream(world.seed, radius); stream.update(pose.x, pose.z);
  return { pose, pitch: -0.05, velocityY: 0, grounded: true, target: null, swing: 0, locked: false, peers: [], actionAt: 0, time: 0, stream, nodes: stream.chunks.flatMap((c) => c.nodes), revision: 0, listeners: new Set(), waterTarget: false, view: { x: pose.x, z: pose.z } };
};
export const syncStream = (runtime: SandboxRuntime, seed: number, renderDistance: RenderDistance, center: { x: number; z: number } = runtime.pose) => {
  const radius = RENDER_DISTANCE_OPTIONS[renderDistance].radius;
  const reset = runtime.stream.seed !== seed;
  if (reset) runtime.stream = new ChunkStream(seed, radius);
  if (runtime.stream.update(center.x, center.z, radius) || reset) {
    runtime.nodes = runtime.stream.chunks.flatMap((c) => c.nodes); runtime.revision++; runtime.listeners.forEach((listener) => listener());
  }
};
