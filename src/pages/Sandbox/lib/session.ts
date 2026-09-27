import { applyAction, Gender, nearFire, Peer, Pose, settleDeaths, stepMatter, stepVitals, stepWildlife, WorldAction, WorldState } from "@/lib/survival/rules";
import { $world, $phase, $session, $settings, actorId, worldChanged, persistSolo, sessionChanged } from "@/stores/sandbox/sandbox";
import { SandboxRuntime, syncStream } from "./runtime";
import { playSound } from "./audio";

interface Credentials { room: string; id: string; token: string }
let credentials: Credentials | undefined;
let events: EventSource | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let generation = 0, pendingAction = false;
const endpoint = (path: string, session = credentials) => `/api/coop/${path}${session ? `?${new URLSearchParams({ ...session })}` : ""}`;
const request = async (path: string, body: unknown, session = credentials) => {
  const response = await fetch(endpoint(path, session), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(6000) });
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Сервер недоступен");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Соединение прервано");
  return data;
};
export const disconnectRoom = () => {
  generation++; events?.close(); events = undefined; clearInterval(heartbeat); heartbeat = undefined; pendingAction = false;
  if (credentials) void fetch(endpoint("leave"), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", keepalive: true }).catch(() => undefined);
  credentials = undefined; sessionChanged({ mode: "solo", status: "offline", room: "", id: "local", peers: [] });
};
export const connectRoom = async (name: string, room: string, gender: Gender, runtime: SandboxRuntime) => {
  disconnectRoom(); const run = generation;
  sessionChanged({ mode: "online", status: "connecting", room, id: "", peers: [] });
  try {
    const data: Credentials & { state: WorldState; peers: Peer[] } = await request("join", { name, room, gender });
    if (run !== generation) { void request("leave", {}, data).catch(() => undefined); return false; }
    credentials = { room: data.room, id: data.id, token: data.token };
    const updatePeers = (peers: Peer[]) => {
      runtime.peers = peers.filter((peer) => peer.id !== data.id);
      const session = $session.getState();
      if (session.peers.map((p) => p.id).join() !== peers.map((p) => p.id).join()) sessionChanged({ ...session, peers: peers.map(({ id, name: peerName, gender: sex }) => ({ id, name: peerName, gender: sex })) });
    };
    Object.assign(runtime.pose, data.state.people[data.id].pose); runtime.pitch = -0.05; runtime.velocityY = 0;
    worldChanged(data.state); syncStream(runtime, data.state.seed, $settings.getState().renderDistance);
    sessionChanged({ mode: "online", status: "connected", room: data.room, id: data.id, peers: [] }); updatePeers(data.peers);
    events = new EventSource(endpoint("events"));
    events.addEventListener("world", (event) => { if (run === generation) { const world = JSON.parse(event.data); worldChanged(world.state); updatePeers(world.peers); } });
    events.addEventListener("peers", (event) => { if (run === generation) updatePeers(JSON.parse(event.data)); });
    events.onopen = () => { if (run === generation) sessionChanged({ ...$session.getState(), status: "connected" }); };
    events.onerror = () => { if (run === generation) sessionChanged({ ...$session.getState(), status: "lost" }); };
    let sending = false;
    heartbeat = setInterval(() => {
      if (sending || run !== generation) return; sending = true;
      void request("pose", { pose: runtime.pose }).then((reply: { ok?: boolean; pose?: Pose }) => {
        if (run !== generation) return;
        // The server rejected an impossible move: return to its authoritative position.
        if (reply.ok === false && reply.pose) snapTo(runtime, reply.pose);
        if ($session.getState().status === "lost" && events?.readyState === EventSource.OPEN) sessionChanged({ ...$session.getState(), status: "connected" });
      }).catch(() => { if (run === generation) sessionChanged({ ...$session.getState(), status: "lost" }); }).finally(() => { sending = false; });
    }, 150);
    return true;
  } catch (error) { if (run === generation) { disconnectRoom(); throw error; } return false; }
};
const snapTo = (runtime: SandboxRuntime, pose: Pose) => {
  Object.assign(runtime.pose, { x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw }); runtime.velocityY = 0;
};
export const performAction = async (action: WorldAction, runtime: SandboxRuntime): Promise<boolean> => {
  if (pendingAction) return false;
  const session = $session.getState();
  if (session.mode === "online" && session.status !== "connected") return false;
  pendingAction = true;
  try {
    const result = session.mode === "online" ? await request("action", { action }) : applyAction($world.getState(), actorId(), action, runtime.pose);
    if (!result.ok) return false;
    if (session.mode === "solo") { worldChanged(result.state); persistSolo(result.state); }
    if (action.type === "respawn") {
      const pose: Pose | undefined = result.pose ?? (session.mode === "solo" ? result.state.people[actorId()]?.pose : undefined);
      if (pose) { snapTo(runtime, pose); runtime.pitch = -0.05; }
      return true;
    }
    if (!["select", "swap", "wake", "sleep"].includes(action.type)) {
      runtime.swing = 0.6;
      if ($settings.getState().sound) playSound(result.effect === "strike" ? "build" : "gather");
    }
    return true;
  } catch { return false; }
  finally { pendingAction = false; }
};
export const tickSolo = (runtime: SandboxRuntime, seconds: number) => {
  if ($session.getState().mode !== "solo" || $phase.getState() !== "playing") return;
  const world = $world.getState(), person = world.people.local;
  if (!person) return;
  const next = stepVitals({ ...person, pose: { ...runtime.pose } }, seconds, runtime.pose.moving, runtime.pose.sprinting, nearFire(world, runtime.pose));
  const settled = settleDeaths(stepMatter({ ...world, people: { ...world.people, local: next } }, seconds));
  worldChanged(stepWildlife(settled, [runtime.pose], seconds));
  if (settled.people.local !== next) persistSolo($world.getState());
};
