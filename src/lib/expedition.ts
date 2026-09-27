export const BEACON_COST = 3;
export const CAMP = { x: -3, z: 0, name: "Лагерь" };
export const DAWN_BEACON_ID = "dawn";
export const DAWN_DRIVE_UPGRADE = "dawn-drive";
export const BEACONS = [
  { id: "dawn", name: "Рассвет", landmark: "Солнечные камни", x: 18, z: -22, color: "#ffc76b" },
  { id: "grove", name: "Тихая роща", landmark: "Живые ворота", x: -42, z: -48, color: "#8aebbc" },
  { id: "ridge", name: "Дальний хребет", landmark: "Сторожевая башня", x: 64, z: -78, color: "#a9c5ff" },
  { id: "echo", name: "Долина эха", landmark: "Камертонные колонны", x: -78, z: 38, color: "#e4b4ff" },
  { id: "sunset", name: "Закатный берег", landmark: "Закатные террасы", x: 62, z: 64, color: "#ffab91" },
];
export const CRYSTALS = BEACONS.flatMap((beacon) =>
  [0, 1, 2, 3].map((index) => ({ id: `${beacon.id}-${index}`, x: beacon.x + Math.cos(index * Math.PI / 2) * 7, z: beacon.z + Math.sin(index * Math.PI / 2) * 7 })),
);
export const expeditionClearing = (x: number, z: number) =>
  BEACONS.some((point) => Math.hypot(point.x - x, point.z - z) < 9) ||
  CRYSTALS.some((point) => Math.hypot(point.x - x, point.z - z) < 4) ||
  Math.hypot(CAMP.x - x, CAMP.z - z) < 4 || Math.hypot(x, z) < 4;
export interface Expedition {
  collected: string[];
  restored: string[];
  discovered: string[];
  upgrades: string[];
  completed: boolean;
}
export const freshExpedition = (): Expedition => ({ collected: [], restored: [], discovered: [], upgrades: [], completed: false });
export const energyLeft = (save: Expedition) => save.collected.length - save.restored.length * BEACON_COST;
export const hasUpgrade = (save: Expedition, id: string) => save.upgrades.includes(id);
export const canRestoreBeacon = (save: Expedition, id: string) =>
  save.discovered.includes(id) && !save.restored.includes(id) && energyLeft(save) >= BEACON_COST;
export type ExpeditionAction =
  | { type: "collect" | "discover" | "restore"; id: string }
  | { type: "complete" };
export const advanceExpedition = (save: Expedition, action: ExpeditionAction): Expedition => {
  if (action.type === "complete") return save.restored.length === BEACONS.length && !save.completed ? { ...save, completed: true } : save;
  const { id, type } = action;
  if (type === "collect") return CRYSTALS.some((item) => item.id === id) && !save.collected.includes(id) ? { ...save, collected: [...save.collected, id] } : save;
  if (!BEACONS.some((item) => item.id === id)) return save;
  if (type === "discover") return save.discovered.includes(id) ? save : { ...save, discovered: [...save.discovered, id] };
  if (!canRestoreBeacon(save, id)) return save;
  return id === DAWN_BEACON_ID
    ? { ...save, restored: [...save.restored, id], upgrades: save.upgrades.includes(DAWN_DRIVE_UPGRADE) ? save.upgrades : [...save.upgrades, DAWN_DRIVE_UPGRADE] }
    : { ...save, restored: [...save.restored, id] };
};
export const parseExpedition = (raw: string | null): Expedition => {
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || !Array.isArray(value.collected) || !Array.isArray(value.restored) || !Array.isArray(value.discovered)) return freshExpedition();
    let save = freshExpedition();
    for (const id of value.collected) save = advanceExpedition(save, { type: "collect", id });
    // Version 2 used three drive-through gates instead of Dawn crystals. Seed the
    // equivalent energy so an already restored beacon remains restored after migration.
    if (value.restored.includes(DAWN_BEACON_ID) && Array.isArray(value.dawnGates)) {
      for (const crystal of CRYSTALS.filter((item) => item.id.startsWith(`${DAWN_BEACON_ID}-`)).slice(0, BEACON_COST)) {
        save = advanceExpedition(save, { type: "collect", id: crystal.id });
      }
    }
    for (const id of value.discovered) save = advanceExpedition(save, { type: "discover", id });
    for (const id of value.restored) save = advanceExpedition(save, { type: "restore", id });
    if (value.completed === true) save = advanceExpedition(save, { type: "complete" });
    return save;
  } catch { return freshExpedition(); }
};
