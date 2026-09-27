import { APPLE_TREE_FRUIT_COUNT, CHUNK_SIZE, findSpawn, generateChunk, getNode, NODE_CAPACITY, NaturalNode, randomSeed, terrainHeight, TREE_TWIGS } from "./world";
import { isItemKind, ITEM_NAMES, ITEMS, ItemKind, toolOf } from "./items";
import { COMBINE_RULES, Ctx, fuelOf, newItem, soloWork } from "./recipes";

export { ITEM_NAMES, ITEMS };
export type { ItemKind };
export type Gender = "male" | "female";
export interface Item { kind: ItemKind; work: number; durability: number }
export interface Vitals { health: number; hunger: number; thirst: number; stamina: number }
export interface Pose { x: number; y: number; z: number; yaw: number; moving?: boolean; sprinting?: boolean }
/** Skill is never shown; it only makes the same work quicker or more reliable. */
export const PRACTICE_KEYS = ["knapping", "cutting", "weaving", "firecraft", "foraging", "fishing"] as const;
export type Practice = Record<typeof PRACTICE_KEYS[number], number>;
/** `sickness` 0–100: food poisoning and gut infections; it drains water and food and, when severe, health. */
export interface Person { gender: Gender; slots: (Item | null)[]; selected: number; bag: boolean; backpack: boolean; sleeping: boolean; exhaustedFor: number; sickness: number; vitals: Vitals; practice: Practice; pose: Pose }
export interface Peer extends Pose { id: string; name: string; color: string; gender: Gender }
export interface Drop { id: string; item: Item; x: number; z: number }
/** A lit fire. `fuel` is seconds left; it goes out at zero. */
export interface Fire { id: string; x: number; z: number; fuel: number }
export interface NodeChange { removed?: boolean; hits?: number; dead?: boolean; skinned?: boolean; applesPicked?: number; taken?: number; x?: number; z?: number; yaw?: number }
export interface WorldState { version: 2; seed: number; revision: number; changes: Record<string, NodeChange>; drops: Drop[]; fires: Fire[]; people: Record<string, Person> }
export type WorldAction = { type: "pickup" | "use"; id: string } | { type: "combine" | "eat" | "drink" | "drop" | "jump" | "sleep" | "wake" | "respawn" } | { type: "select"; slot: number } | { type: "swap"; from: number; to: number };
export type Effect = "strike" | "soft" | "eat";
export type ActionResult = { state: WorldState; ok: boolean; effect?: Effect };

export const REACH = 3.3;
export const FIRE_WARMTH_RADIUS = 4.5;
export const MAX_FIRE_FUEL = 900;
export const item = (kind: ItemKind): Item => newItem(kind);
export const quickSlots = (person: Person) => person.bag ? 9 : 2;
const freshPractice = (): Practice => Object.fromEntries(PRACTICE_KEYS.map((key) => [key, 0])) as Practice;
export const freshPerson = (seed: number, gender: Gender = "male"): Person => ({ gender, slots: [null, null], selected: 0, bag: false, backpack: false, sleeping: false, exhaustedFor: 0, sickness: 0, vitals: { health: 100, hunger: 100, thirst: 100, stamina: 100 }, practice: freshPractice(), pose: findSpawn(seed) });
export const freshWorld = (seed = randomSeed(), gender: Gender = "male"): WorldState => ({ version: 2, seed, revision: 0, changes: {}, drops: [], fires: [], people: { local: freshPerson(seed, gender) } });
const clamp = (v: number) => Math.max(0, Math.min(100, v));
export const isDead = (person: Person | undefined) => !person || person.vitals.health <= 0;
/** Deterministic per-action randomness: the server and every replay agree on the outcome. */
const rollFor = (state: WorldState, actor: string, salt: string) => {
  let h = (2166136261 ^ state.seed) >>> 0;
  for (const char of `${state.revision}|${actor}|${salt}`) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
/** Fastest legitimate horizontal speed in m/s (sprint is 6.6); the rest is network jitter headroom. */
export const MAX_TRAVEL_SPEED = 12;
/**
 * Server-side movement sanity check. Travel budget grows with time since the last accepted pose,
 * but is capped so an idle client cannot bank seconds and then teleport. Height must stay near the
 * ground (jumping, swimming and mesh/heightfield differences fit inside the tolerance).
 */
export const poseAllowed = (seed: number, previous: Pose, next: Pose, elapsedSeconds: number): boolean => {
  if (![next.x, next.y, next.z, next.yaw].every(Number.isFinite)) return false;
  const budget = Math.max(3, Math.min(2, Math.max(0, elapsedSeconds)) * MAX_TRAVEL_SPEED);
  if (Math.hypot(next.x - previous.x, next.z - previous.z) > budget) return false;
  const eye = Math.max(-0.85, terrainHeight(seed, next.x, next.z)) + 1.7;
  return next.y >= eye - 1.5 && next.y <= eye + 3;
};
/**
 * Hardcore death: whatever the body carried falls where it died and becomes loot for anyone.
 * Worn containers (bag/backpack) are lost with the body. Returns the same object when nothing changed.
 */
export const settleDeaths = (state: WorldState): WorldState => {
  let next = state;
  for (const [id, person] of Object.entries(state.people)) {
    if (person.vitals.health > 0 || (!person.sleeping && person.slots.every((slot) => slot === null))) continue;
    if (next === state) next = { ...state, people: { ...state.people }, drops: [...state.drops] };
    person.slots.forEach((value, index) => {
      if (!value) return;
      const angle = index * 2.39996;
      next.drops.push({ id: `body-${id}-${state.revision}-${index}`, item: { ...value }, x: person.pose.x + Math.cos(angle) * 0.6, z: person.pose.z + Math.sin(angle) * 0.6 });
    });
    next.people[id] = { ...person, sleeping: false, slots: person.slots.map(() => null) };
  }
  return next;
};
export const nearFire = (state: WorldState, pose: Pose, radius = FIRE_WARMTH_RADIUS) =>
  (state.fires ?? []).some((fire) => Math.hypot(fire.x - pose.x, fire.z - pose.z) <= radius);
/** Burns fuel; spent fires disappear. Returns the same object when there is nothing burning. */
export const stepFires = (state: WorldState, seconds: number): WorldState => {
  if (!state.fires?.length) return state;
  return { ...state, fires: state.fires.map((fire) => ({ ...fire, fuel: fire.fuel - Math.max(0, seconds) })).filter((fire) => fire.fuel > 0) };
};
/** Food ages wherever it is; at zero freshness it is simply rot. Non-perishables are returned untouched. */
export const spoilItem = (value: Item, seconds: number): Item => {
  const life = ITEMS[value.kind].spoils;
  if (!life || seconds <= 0) return value;
  const durability = value.durability - seconds * 100 / life;
  return durability > 0 ? { ...value, durability } : newItem("rotten");
};
const spoilSlots = (slots: (Item | null)[], seconds: number) => slots.some((slot) => slot && ITEMS[slot.kind].spoils) ? slots.map((slot) => slot && spoilItem(slot, seconds)) : slots;
/** Everything that changes on its own, without a person: fires burn down, dropped food rots. */
export const stepMatter = (state: WorldState, seconds: number): WorldState => {
  const burning = stepFires(state, seconds);
  if (!state.drops.some((drop) => ITEMS[drop.item.kind].spoils)) return burning;
  return { ...burning, drops: state.drops.map((drop) => ITEMS[drop.item.kind].spoils ? { ...drop, item: spoilItem(drop.item, seconds) } : drop) };
};
export const stepVitals = (person: Person, seconds: number, moving = false, sprinting = false, warm = false): Person => {
  if (person.vitals.health <= 0) return person;
  const dt = Math.max(0, Math.min(5, seconds)), v = person.vitals, sick = person.sickness ?? 0;
  const hunger = clamp(v.hunger - dt * ((moving ? 0.043 : 0.025) + (sick > 0 ? 0.03 : 0)));
  const thirst = clamp(v.thirst - dt * ((sprinting ? 0.11 : 0.055) + (sick > 0 ? 0.06 : 0)));
  const stamina = clamp(v.stamina + dt * (person.sleeping ? (warm ? 0.33 : 0.22) : sprinting && moving ? -0.055 : 0));
  const exhaustedFor = stamina === 0 ? person.exhaustedFor + dt : 0;
  const harm = (hunger === 0 ? 0.04 : 0) + (thirst === 0 ? 0.075 : 0) + (exhaustedFor > 60 ? 0.025 : 0) + (sick > 50 ? 0.03 : 0);
  const heal = hunger > 65 && thirst > 65 && sick === 0 ? (warm ? 0.05 : 0.025) : 0;
  const health = clamp(v.health + dt * (harm ? -harm : heal));
  return { ...person, slots: spoilSlots(person.slots, dt), exhaustedFor, sickness: Math.max(0, sick - dt * 0.08), vitals: { health, hunger, thirst, stamina } };
};
/** Every accepted action also resolves deaths it caused (wounds from hunting, raw meat, a hand in the fire…). */
export const applyAction = (state: WorldState, actor: string, action: WorldAction, pose: Pose): ActionResult => {
  const result = applyRawAction(state, actor, action, pose);
  return result.ok ? { ...result, state: settleDeaths(result.state) } : result;
};

const berryOf = (node: NaturalNode): ItemKind => node.variant === "red" ? "redberry" : "blueberry";
/** What a loose natural object becomes in the hand. */
const LOOSE: Partial<Record<NaturalNode["kind"], (node: NaturalNode) => ItemKind>> = {
  stone: () => "stone", flint: () => "flint", fiber: () => "fiber", nut: () => "nut", branch: () => "branch",
  grass: () => "dryGrass", bones: () => "bone", mushroom: (node) => node.variant === "toxic" ? "toadstool" : "mushroom",
};

const applyRawAction = (state: WorldState, actor: string, action: WorldAction, pose: Pose): ActionResult => {
  const source = state.people[actor];
  const fail = { state, ok: false };
  if (source && action?.type === "respawn") {
    // Only the dead may start over; everything learned and carried stays behind.
    if (!isDead(source)) return fail;
    const reborn = freshPerson(state.seed, source.gender);
    const angle = (state.revision % 16) * Math.PI / 8;
    reborn.pose = { ...reborn.pose, x: reborn.pose.x + Math.cos(angle) * 1.5, z: reborn.pose.z + Math.sin(angle) * 1.5 };
    return { state: { ...state, revision: state.revision + 1, people: { ...state.people, [actor]: reborn } }, ok: true, effect: "soft" };
  }
  if (!source || source.vitals.health <= 0 || !action || typeof action !== "object" || ![pose.x, pose.y, pose.z].every(Number.isFinite)) return fail;
  const person: Person = { ...source, slots: source.slots.map((it) => it ? { ...it } : null), vitals: { ...source.vitals }, practice: { ...freshPractice(), ...source.practice }, sickness: source.sickness ?? 0, pose: { ...pose } };
  const next: WorldState = { ...state, people: { ...state.people, [actor]: person }, changes: { ...state.changes }, drops: [...state.drops], fires: [...(state.fires ?? [])], revision: state.revision + 1 };
  const heldIndex = person.selected, otherIndex = person.selected === 0 ? 1 : 0;
  const held = person.slots[heldIndex];
  const put = (value: Item) => { const at = person.slots.findIndex((slot) => slot === null); if (at < 0) return false; person.slots[at] = value; return true; };
  const dropAt = (value: Item, x = pose.x - Math.sin(pose.yaw), z = pose.z - Math.cos(pose.yaw)) => { next.drops.push({ id: `drop-${actor}-${next.revision}-${next.drops.length}`, item: value, x, z }); };
  const accept = (effect: Effect = "soft") => ({ state: next, ok: true, effect });
  const c: Ctx = {
    state, next, actor, person, pose, heldIndex, otherIndex, fail,
    roll: (salt) => rollFor(state, actor, salt), put, dropAt,
    give: (value) => { if (!put(value)) dropAt(value, pose.x, pose.z); },
    tire: (amount) => { person.vitals.stamina = clamp(person.vitals.stamina - amount); },
    wear: (slot, times = 1) => {
      const worn = person.slots[slot]; if (!worn) return;
      worn.durability -= (ITEMS[worn.kind].wear ?? 1) * times;
      if (worn.durability <= 0) person.slots[slot] = null;
    },
    ok: accept,
  };
  if (action.type === "wake") { person.sleeping = false; return accept(); }
  if (person.sleeping) return fail;
  if (action.type === "sleep") { if (terrainHeight(state.seed, pose.x, pose.z) < 0.2) return fail; person.sleeping = true; return accept(); }
  if (action.type === "select") {
    if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot >= quickSlots(person)) return fail;
    person.selected = action.slot; return accept();
  }
  if (action.type === "swap") {
    if (![action.from, action.to].every((i) => Number.isInteger(i) && i >= 0 && i < person.slots.length)) return fail;
    [person.slots[action.from], person.slots[action.to]] = [person.slots[action.to], person.slots[action.from]]; return accept();
  }
  if (action.type === "drop") { if (!held) return fail; person.slots[heldIndex] = null; dropAt(held); return accept(); }
  if (action.type === "jump") { if (person.vitals.stamina < 3) return fail; person.vitals.stamina = clamp(person.vitals.stamina - 0.2); return accept(); }
  if (action.type === "drink") {
    // Reach actual water at the hands' position; lakes and rivers are not inventory abstractions.
    const x = pose.x - Math.sin(pose.yaw) * 1.7, z = pose.z - Math.cos(pose.yaw) * 1.7;
    if (terrainHeight(state.seed, x, z) > 0.12 || pose.y > 3) return fail;
    if (!held) {
      person.vitals.thirst = clamp(person.vitals.thirst + 22);
      // Untreated water is usually fine. Usually.
      if (c.roll("water") < 0.04) person.sickness = clamp(person.sickness + 15);
      return accept("eat");
    }
    const spear = toolOf(held.kind).fish;
    if (!spear || person.vitals.stamina < 2) return fail;
    c.tire(0.3); person.practice.fishing++; c.wear(heldIndex);
    if (c.roll("fish") < Math.min(0.7, spear + person.practice.fishing * 0.02)) c.give(newItem("fish"));
    return accept("strike");
  }
  if (action.type === "eat") {
    const food = held ? ITEMS[held.kind].food : undefined;
    if (!held || !food) return fail;
    const v = person.vitals;
    v.hunger = clamp(v.hunger + food.hunger); v.thirst = clamp(v.thirst + (food.thirst ?? 0));
    v.stamina = clamp(v.stamina + (food.stamina ?? 0)); v.health = clamp(v.health + (food.health ?? 0));
    if (food.sickness && (food.sickChance === undefined || c.roll("food") < food.sickChance)) person.sickness = clamp(person.sickness + food.sickness);
    person.slots[heldIndex] = null; return accept("eat");
  }
  if (action.type === "combine") {
    if (!held || person.vitals.stamina < 1) return fail;
    const other = person.slots[otherIndex];
    if (!other) return soloWork(c, held);
    for (const rule of COMBINE_RULES) { const result = rule(c, held, other); if (result) return result; }
    return fail;
  }
  if (action.type === "pickup") {
    if (person.vitals.stamina <= 0) return fail;
    person.vitals.stamina = clamp(person.vitals.stamina - 0.015);
    const dropped = state.drops.find((d) => d.id === action.id);
    if (dropped) { if (Math.hypot(dropped.x - pose.x, dropped.z - pose.z) > REACH || !put({ ...dropped.item })) return fail; next.drops = next.drops.filter((d) => d.id !== dropped.id); return accept(); }
    const node = getNode(state.seed, action.id);
    if (!node || state.changes[node.id]?.removed || Math.hypot(node.x - pose.x, node.z - pose.z) > REACH) return fail;
    const change = { ...state.changes[node.id] }, taken = change.taken ?? 0;
    if (node.kind === "tree") {
      const picked = change.applesPicked ?? 0;
      if (node.treeType !== "appleOak" || picked >= APPLE_TREE_FRUIT_COUNT || !put(item("apple"))) return fail;
      next.changes[node.id] = { ...change, applesPicked: picked + 1 };
      return accept();
    }
    if (node.kind === "berryBush") {
      if (taken >= NODE_CAPACITY.berryBush! || !put(item(berryOf(node)))) return fail;
      next.changes[node.id] = { ...change, taken: taken + 1 }; return accept();
    }
    if (node.kind === "nest" || node.kind === "clams") {
      const capacity = node.kind === "nest" ? node.count ?? 1 : NODE_CAPACITY.clams!;
      if (!put(item(node.kind === "nest" ? "egg" : "clam"))) return fail;
      next.changes[node.id] = taken + 1 >= capacity ? { removed: true } : { ...change, taken: taken + 1 }; return accept();
    }
    const loose = LOOSE[node.kind];
    if (!loose || !put(item(loose(node)))) return fail;
    next.changes[node.id] = { removed: true }; return accept();
  }
  if (action.type === "use") {
    if (person.vitals.stamina < 1) return fail;
    if (typeof action.id === "string" && action.id.startsWith("fire-")) return tendFire(c, action.id, held);
    const original = getNode(state.seed, action.id);
    const movement = original ? state.changes[original.id] : undefined;
    const node = original ? { ...original, x: movement?.x ?? original.x, z: movement?.z ?? original.z } : undefined;
    if (!node || state.changes[node.id]?.removed || Math.hypot(node.x - pose.x, node.z - pose.z) > REACH) return fail;
    const changed: NodeChange = { ...state.changes[node.id] }, taken = changed.taken ?? 0;
    const tool = toolOf(held?.kind);
    const save = (effect: Effect = "strike") => { next.changes[node.id] = changed; return accept(effect); };
    if (node.kind === "tree") {
      if (held && tool.chop) {
        changed.hits = (changed.hits ?? 0) + 1;
        if (changed.hits >= (tool.chop >= 2 ? 3 : 5)) { changed.removed = true; dropAt(item("branch"), node.x, node.z); dropAt(item("branch"), node.x + 0.5, node.z + 0.5); }
        c.wear(heldIndex, 1.5); c.tire(0.12); return save();
      }
      const picked = changed.applesPicked ?? 0;
      if (node.treeType === "appleOak" && picked < APPLE_TREE_FRUIT_COUNT) {
        if (!put(item("apple"))) return fail;
        changed.applesPicked = picked + 1; return save("soft");
      }
      // Bare hands can still snap a few thin twigs off low branches.
      if (held || taken >= TREE_TWIGS || !put(item("twig"))) return fail;
      changed.taken = taken + 1; c.tire(0.03); return save("soft");
    }
    if (node.kind === "animal") {
      if (changed.dead) {
        if (!held || !tool.cut) return fail;
        if (!changed.skinned) { changed.skinned = true; dropAt(item("hide"), node.x, node.z); }
        else {
          changed.removed = true; dropAt(item("rawMeat"), node.x, node.z); dropAt(item("bone"), node.x + 0.4, node.z);
          if (tool.cut >= 2) dropAt(item("rawMeat"), node.x - 0.4, node.z + 0.3);
        }
        person.practice.cutting++; c.wear(heldIndex, 2); c.tire(0.12); return save();
      }
      // A deer kicks back at anything but a killing blow; bare hands only get you hurt.
      if (held && !tool.hit) return fail;
      changed.hits = (changed.hits ?? 0) + (held ? tool.hit ?? 0 : 0);
      if (changed.hits >= 6) changed.dead = true;
      else person.vitals.health = clamp(person.vitals.health - (held && tool.hit ? 2 : 4));
      if (held) c.wear(heldIndex, 2);
      c.tire(0.12); return save();
    }
    if (node.kind === "berryBush") {
      if (held || taken >= NODE_CAPACITY.berryBush! || !put(item(berryOf(node)))) return fail;
      changed.taken = taken + 1; return save("soft");
    }
    if (node.kind === "termiteMound") {
      if (taken >= NODE_CAPACITY.termiteMound!) return fail;
      c.tire(0.05);
      // A bare hand in the mound only gets bitten. A thin probe, patiently, brings termites out clinging to it.
      if (!held) { person.vitals.health = clamp(person.vitals.health - 1); return accept("soft"); }
      if (!tool.probe) return fail;
      c.wear(heldIndex); person.practice.foraging++;
      if (c.roll("termites") > Math.min(0.9, 0.3 + person.practice.foraging * 0.06)) return accept("soft");
      changed.taken = taken + 1; c.give(item("termites")); return save("soft");
    }
    if (node.kind === "rottenLog") {
      // Tearing soft wood apart for grubs; anything hard makes it quicker.
      const power = held ? Math.max(1, (tool.hit ?? 0) + (tool.hammer ? 1 : 0)) : 1;
      changed.hits = (changed.hits ?? 0) + power; c.tire(held ? 0.1 : 0.15);
      if (held) c.wear(heldIndex, 0.5);
      if (Math.floor(changed.hits / 4) > taken) {
        changed.taken = taken + 1; c.give(item("grubs")); person.practice.foraging++;
        if (changed.taken >= NODE_CAPACITY.rottenLog!) { changed.removed = true; dropAt(item("branch"), node.x, node.z); }
      }
      return save();
    }
    if (node.kind === "tuberPlant") {
      // Hands can dig, slowly and at a cost; a pointed stick is the first real advantage.
      const dig = held ? tool.dig ?? 0 : 1;
      if (!dig) return fail;
      changed.hits = (changed.hits ?? 0) + dig; c.tire(held ? 0.2 : 0.4);
      if (held) c.wear(heldIndex);
      if (changed.hits >= 6) { changed.removed = true; c.give(item("tuber")); person.practice.foraging++; }
      return save();
    }
    return fail;
  }
  return fail;
};

/** Hands near a fire: feed it, cook, harden a point in it — or get burned. */
const tendFire = (c: Ctx, id: string, held: Item | null): ActionResult => {
  const fire = c.next.fires.find((candidate) => candidate.id === id);
  if (!fire || Math.hypot(fire.x - c.pose.x, fire.z - c.pose.z) > REACH) return c.fail;
  const person = c.person;
  if (!held) { person.vitals.health = clamp(person.vitals.health - 3); return c.ok("soft"); }
  const cooked = ITEMS[held.kind].cooksTo;
  if (cooked) {
    held.work++;
    // Cooking kills what is in the food, but it cannot make old food fresh again.
    if (held.work >= 2) person.slots[c.heldIndex] = { ...item(cooked), durability: held.durability };
    return c.ok("soft");
  }
  if (held.kind === "spear") {
    held.work++;
    if (held.work >= 3) person.slots[c.heldIndex] = item("hardSpear");
    return c.ok("soft");
  }
  const fuel = fuelOf(held.kind);
  if (!fuel) return c.fail;
  c.next.fires = c.next.fires.map((candidate) => candidate.id === id ? { ...candidate, fuel: Math.min(MAX_FIRE_FUEL, candidate.fuel + fuel) } : candidate);
  person.slots[c.heldIndex] = null;
  return c.ok("soft");
};

export const parseWorld = (raw: string | null): WorldState | null => {
  try {
    const value = JSON.parse(raw ?? "null") as WorldState;
    if (value?.version !== 2 || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 4294967295 || !value.people?.local || !value.changes || typeof value.changes !== "object" || Array.isArray(value.changes) || !Array.isArray(value.drops)) return null;
    // Legacy saves: the old generic "berry" became apples.
    for (const person of Object.values(value.people)) for (const slot of person.slots ?? []) if (slot && String(slot.kind) === "berry") slot.kind = "apple";
    for (const drop of value.drops) if (drop?.item && String(drop.item.kind) === "berry") drop.item.kind = "apple";
    const person = value.people.local;
    person.sleeping = person.sleeping === true;
    person.exhaustedFor = Number.isFinite(person.exhaustedFor) ? Math.max(0, person.exhaustedFor) : 0;
    person.sickness = Number.isFinite(person.sickness) ? clamp(person.sickness) : 0;
    if (!["male", "female"].includes(person.gender) || typeof person.bag !== "boolean" || typeof person.backpack !== "boolean" || person.backpack && !person.bag) return null;
    if (!Array.isArray(person.slots) || person.slots.length !== (person.backpack ? 30 : person.bag ? 9 : 2) || person.slots.some((slot) => slot !== null && (!slot || !isItemKind(slot.kind) || !Number.isFinite(slot.work) || !Number.isFinite(slot.durability)))) return null;
    if (!Number.isInteger(person.selected) || person.selected < 0 || person.selected >= quickSlots(person) || !person.vitals || ![person.vitals.health, person.vitals.hunger, person.vitals.thirst, person.vitals.stamina].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) return null;
    if (!person.pose || ![person.pose.x, person.pose.y, person.pose.z, person.pose.yaw].every(Number.isFinite) || !person.practice || !Object.values(person.practice).every((n) => Number.isFinite(n) && n >= 0)) return null;
    person.practice = { ...freshPractice(), ...person.practice };
    const count = (n: unknown, max: number) => Number.isFinite(n) ? Math.max(0, Math.min(max, n as number)) : 0;
    const changes: WorldState["changes"] = {};
    for (const [id, change] of Object.entries(value.changes)) if (getNode(value.seed, id) && change && typeof change === "object") changes[id] = { removed: change.removed === true, dead: change.dead === true, skinned: change.skinned === true, hits: count(change.hits, 100), applesPicked: count(change.applesPicked, APPLE_TREE_FRUIT_COUNT), taken: count(change.taken, 100), x: Number.isFinite(change.x) ? change.x : undefined, z: Number.isFinite(change.z) ? change.z : undefined, yaw: Number.isFinite(change.yaw) ? change.yaw : undefined };
    const drops = value.drops.filter((d) => d && typeof d.id === "string" && d.id.length < 100 && [d.x, d.z].every(Number.isFinite) && d.item && isItemKind(d.item.kind) && Number.isFinite(d.item.work) && Number.isFinite(d.item.durability));
    const fires = (Array.isArray(value.fires) ? value.fires : []).filter((f) => f && typeof f.id === "string" && f.id.startsWith("fire-") && f.id.length < 100 && [f.x, f.z, f.fuel].every(Number.isFinite) && f.fuel > 0).map((f) => ({ id: f.id, x: f.x, z: f.z, fuel: Math.min(MAX_FIRE_FUEL, f.fuel) }));
    return { ...value, revision: Number.isSafeInteger(value.revision) && value.revision >= 0 ? value.revision : 0, changes, drops, fires, people: { local: person } };
  } catch { return null; }
};

export const stepWildlife = (state: WorldState, poses: Pose[], seconds: number): WorldState => {
  const changes = { ...state.changes }, visited = new Set<string>();
  for (const pose of poses) {
    const cx = Math.floor(pose.x / CHUNK_SIZE), cz = Math.floor(pose.z / CHUNK_SIZE);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const node of generateChunk(state.seed, cx + dx, cz + dz).nodes) {
        if (node.kind !== "animal" || visited.has(node.id) || changes[node.id]?.dead || changes[node.id]?.removed) continue;
        visited.add(node.id);
        const old = changes[node.id], x = old?.x ?? node.x, z = old?.z ?? node.z;
        const near = poses.filter((p) => Math.hypot(p.x - x, p.z - z) < 8).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
        const vx = near ? x - near.x : node.x - x, vz = near ? z - near.z : node.z - z;
        const length = Math.hypot(vx, vz);
        if (length < 0.1) continue;
        const speed = near ? 1.3 : 0.25, step = Math.min(length, speed * seconds);
        const nextX = x + vx / length * step, nextZ = z + vz / length * step;
        if (terrainHeight(state.seed, nextX, nextZ) > 0.2 && Math.hypot(nextX - node.x, nextZ - node.z) < 18) changes[node.id] = { ...old, x: nextX, z: nextZ, yaw: Math.atan2(nextX - x, nextZ - z) };
      }
    }
  }
  return { ...state, changes };
};
