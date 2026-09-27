import { ITEMS, ItemKind, toolOf } from "./items";
import { terrainHeight } from "./world";
import type { ActionResult, Effect, Item, Person, Pose, WorldState } from "./rules";

/** Everything a hand-work rule may touch. Built by `applyAction`, always on cloned state. */
export interface Ctx {
  state: WorldState; next: WorldState; actor: string; person: Person; pose: Pose;
  heldIndex: number; otherIndex: number;
  roll(salt: string): number;
  put(value: Item): boolean;
  /** Into a free slot, otherwise onto the ground at the person's feet. */
  give(value: Item): void;
  dropAt(value: Item, x?: number, z?: number): void;
  tire(amount: number): void;
  /** Wears the item in `slot` by its per-use wear × `times`; it breaks at zero durability. */
  wear(slot: number, times?: number): void;
  ok(effect?: Effect): ActionResult;
  fail: ActionResult;
}
export const newItem = (kind: ItemKind, durability = 100): Item => ({ kind, work: 0, durability });
export const TINDER_REACH = 2.2;
/** Seconds of burning a fresh fire starts with. */
export const FIRST_FIRE_FUEL = 60;

type Rule = (c: Ctx, held: Item, other: Item) => ActionResult | undefined;
const is = (value: Item, ...kinds: ItemKind[]) => kinds.includes(value.kind);
/** Lets a rule accept its two ingredients in either hand. */
const pair = (c: Ctx, held: Item, other: Item, a: ItemKind, b: ItemKind): [Item, number, Item, number] | undefined =>
  held.kind === a && other.kind === b ? [held, c.heldIndex, other, c.otherIndex]
    : held.kind === b && other.kind === a ? [other, c.otherIndex, held, c.heldIndex] : undefined;

/**
 * Two-handed work, in priority order. The first rule that recognises the pair decides the outcome.
 * Nothing here is announced to the player; the only feedback is what physically happens.
 */
export const COMBINE_RULES: Rule[] = [
  // Oldowan knapping: cobble on cobble. A sharp flake falls off early; persistence leaves a chopper.
  (c, held, other) => {
    if (!is(held, "stone") || !is(other, "stone")) return;
    c.person.practice.knapping++; other.work++;
    if (other.work === 2) c.dropAt(newItem("flake"), c.pose.x, c.pose.z);
    if (other.work >= Math.max(3, 7 - Math.floor(c.person.practice.knapping / 10))) c.person.slots[c.otherIndex] = newItem("chopper");
    c.tire(0.08); return c.ok("strike");
  },
  // Flint takes skill: an experienced hand thins it into a hand axe, a novice only shatters it into flakes.
  (c, held, other) => {
    if (!toolOf(held.kind).hammer || !is(other, "flint")) return;
    c.person.practice.knapping++; other.work++;
    if (other.work % 3 === 0) c.dropAt(newItem("flake"), c.pose.x, c.pose.z);
    if (other.work >= 9) c.person.slots[c.otherIndex] = newItem(c.person.practice.knapping >= 25 ? "handaxe" : "flake");
    c.tire(0.1); return c.ok("strike");
  },
  // Pounding food open: nuts, shellfish, and long bones for marrow (the splinter is useful too).
  (c, held, other) => {
    if (!toolOf(held.kind).hammer || !is(other, "nut", "clam", "bone")) return;
    if (other.kind === "bone") c.dropAt(newItem("boneShard"), c.pose.x, c.pose.z);
    c.person.slots[c.otherIndex] = newItem(other.kind === "nut" ? "kernel" : other.kind === "clam" ? "clamMeat" : "marrow");
    c.tire(0.08); return c.ok("strike");
  },
  // Grinding a bone splinter against stone into a point.
  (c, held, other) => {
    if (!is(held, "stone") || !is(other, "boneShard")) return;
    other.work++; c.tire(0.06);
    if (other.work >= 4) c.person.slots[c.otherIndex] = newItem("awl");
    return c.ok("strike");
  },
  // Hand drill: spin a stick on a dry branch. Only a tinder bundle lying close by catches the ember.
  (c, held, other) => {
    const found = pair(c, held, other, "stick", "branch");
    if (!found) return;
    const [, , board] = found;
    if (c.person.vitals.stamina < 3) return c.fail;
    c.tire(0.35); board.work++;
    const need = Math.max(3, 8 - Math.floor(c.person.practice.firecraft / 2));
    if (board.work < need) return c.ok();
    c.person.practice.firecraft++;
    const tinder = c.next.drops
      .filter((drop) => drop.item.kind === "dryGrass" && Math.hypot(drop.x - c.pose.x, drop.z - c.pose.z) <= TINDER_REACH)
      .sort((a, b) => Math.hypot(a.x - c.pose.x, a.z - c.pose.z) - Math.hypot(b.x - c.pose.x, b.z - c.pose.z))[0];
    if (!tinder || terrainHeight(c.state.seed, tinder.x, tinder.z) < 0.15) { board.work = need; return c.ok(); }
    if (c.roll("ember") > Math.min(0.9, 0.3 + c.person.practice.firecraft * 0.07)) { board.work = need - 2; return c.ok(); }
    c.next.drops = c.next.drops.filter((drop) => drop.id !== tinder.id);
    c.next.fires = [...c.next.fires, { id: `fire-${c.actor}-${c.next.revision}`, x: tinder.x, z: tinder.z, fuel: FIRST_FIRE_FUEL }];
    board.work = 0; board.durability -= 25;
    const boardIndex = found[3];
    if (board.durability <= 0) c.person.slots[boardIndex] = null;
    return c.ok("strike");
  },
  // Whittling: any cutting edge turns a branch (or a quicker stick) into a pointed stick.
  (c, held, other) => {
    const cut = toolOf(held.kind).cut ?? 0;
    if (!cut || !is(other, "branch", "stick")) return;
    c.person.practice.cutting++; other.work++;
    const need = Math.max(1, (held.kind === "chopper" ? 4 : cut >= 2 ? 3 : 5) - (other.kind === "stick" ? 2 : 0));
    if (other.work >= need) c.person.slots[c.otherIndex] = newItem("spear");
    c.wear(c.heldIndex); c.tire(0.08); return c.ok("strike");
  },
  // Hafting a flake onto the pointed stick needs cord somewhere on the body to bind it.
  (c, held, other) => {
    const found = pair(c, held, other, "spear", "flake");
    if (!found) return;
    const cordIndex = c.person.slots.findIndex((slot, index) => slot?.kind === "cord" && index !== c.heldIndex && index !== c.otherIndex);
    if (cordIndex < 0) return c.fail;
    const [spear, spearIndex, , flakeIndex] = found;
    spear.work++; c.tire(0.06);
    if (spear.work < 3) return c.ok();
    c.person.slots[spearIndex] = newItem("stoneSpear"); c.person.slots[flakeIndex] = null; c.person.slots[cordIndex] = null;
    c.person.practice.weaving++; return c.ok();
  },
  // Twisting plant fibres into cord.
  (c, held, other) => {
    if (!is(held, "fiber") || !is(other, "fiber")) return;
    c.person.practice.weaving++; other.work++;
    if (other.work >= 4) { c.person.slots[c.heldIndex] = null; c.person.slots[c.otherIndex] = newItem("cord"); }
    c.tire(0.03); return c.ok();
  },
  // Lacing hide with cord: first a bag, then (with a branch for a frame) a backpack. An awl speeds it up.
  (c, held, other) => {
    const found = pair(c, held, other, "hide", "cord");
    if (!found) return;
    const person = c.person, hide = found[0];
    hide.work++; c.tire(0.05);
    if (hide.work < (person.slots.some((slot) => slot?.kind === "awl") ? 3 : 5)) return c.ok();
    if (!person.bag) { person.bag = true; person.slots[c.heldIndex] = null; person.slots[c.otherIndex] = null; while (person.slots.length < 9) person.slots.push(null); }
    else if (!person.backpack) {
      const branch = person.slots.findIndex((slot) => slot?.kind === "branch");
      if (branch < 0) return c.fail;
      person.backpack = true; person.slots[branch] = null; person.slots[c.heldIndex] = null; person.slots[c.otherIndex] = null; while (person.slots.length < 30) person.slots.push(null);
    } else return c.fail;
    person.practice.weaving += 3; return c.ok();
  },
];

/** Work with one item and a free hand. */
export const soloWork = (c: Ctx, held: Item): ActionResult => {
  // Snap the side shoots off a branch: a clean stick and a thin twig.
  if (held.kind === "branch" && c.person.slots[c.otherIndex] === null) {
    c.person.slots[c.heldIndex] = newItem("stick"); c.person.slots[c.otherIndex] = newItem("twig");
    c.tire(0.05); return c.ok();
  }
  return c.fail;
};

/** Fuel value if an item can feed a fire. Food never counts as fuel. */
export const fuelOf = (kind: ItemKind) => ITEMS[kind].food ? 0 : ITEMS[kind].fuel ?? 0;
