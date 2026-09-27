import { createEvent, createStore } from "effector";
import { freshWorld, Gender, parseWorld, Peer, WorldState } from "@/lib/survival/rules";
import { DEFAULT_RENDER_DISTANCE, RenderDistance } from "@/lib/survival/world";

export type Phase = "menu" | "playing" | "paused" | "inventory";
export interface Session { mode: "solo" | "online"; status: "offline" | "connecting" | "connected" | "lost"; room: string; id: string; peers: Pick<Peer, "id" | "name" | "gender">[] }
export interface Settings { sound: boolean; quality: "high" | "low"; minimap: boolean; gender: Gender; renderDistance: RenderDistance }
const readWorld = () => { try { return parseWorld(localStorage.getItem("origin:world:v2")); } catch { return null; } };
const readSettings = (): Settings => {
  try {
    const value = JSON.parse(localStorage.getItem("origin:settings") ?? "null");
    const renderDistance: RenderDistance = value?.renderDistance === "near" || value?.renderDistance === "medium" || value?.renderDistance === "far" ? value.renderDistance : DEFAULT_RENDER_DISTANCE;
    return { sound: value?.sound !== false, quality: value?.quality === "low" ? "low" : "high", minimap: value?.minimap === true, gender: value?.gender === "female" ? "female" : "male", renderDistance };
  }
  catch { return { sound: true, quality: "high", minimap: false, gender: "male", renderDistance: DEFAULT_RENDER_DISTANCE }; }
};
export const worldChanged = createEvent<WorldState>();
export const phaseChanged = createEvent<Phase>();
export const sessionChanged = createEvent<Session>();
export const settingsChanged = createEvent<Settings>();
export const saveAvailableChanged = createEvent<boolean>();
export const readyChanged = createEvent<boolean>();
export const $ready = createStore(false).on(readyChanged, (_, value) => value);
export const $world = createStore(readWorld() ?? freshWorld()).on(worldChanged, (_, value) => value);
export const $phase = createStore<Phase>("menu").on(phaseChanged, (_, value) => value);
export const $session = createStore<Session>({ mode: "solo", status: "offline", room: "", id: "local", peers: [] }).on(sessionChanged, (_, value) => value);
export const $settings = createStore<Settings>(readSettings()).on(settingsChanged, (_, value) => value);
export const $saveAvailable = createStore(true).on(saveAvailableChanged, (_, value) => value);
export const $hasSave = createStore(Boolean(readWorld()));
const saved = createEvent();
$hasSave.on(saved, () => true);
export const actorId = () => $session.getState().mode === "online" ? $session.getState().id : "local";
export const currentPerson = () => $world.getState().people[actorId()];
export const loadSolo = () => { const savedWorld = readWorld(); if (savedWorld) worldChanged(savedWorld); return Boolean(savedWorld); };
export const newLife = () => { const world = freshWorld(undefined, $settings.getState().gender); worldChanged(world); persistSolo(world); };
export const persistSolo = (world: WorldState) => {
  try { localStorage.setItem("origin:world:v2", JSON.stringify(world)); saveAvailableChanged(true); saved(); }
  catch { saveAvailableChanged(false); }
};
settingsChanged.watch((settings) => { try { localStorage.setItem("origin:settings", JSON.stringify(settings)); } catch { /* Settings still apply in memory. */ } });
