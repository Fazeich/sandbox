import { describe, expect, it } from "vitest";
import { applyAction, freshWorld, item, nearFire, parseWorld, Pose, spoilItem, stepFires, stepMatter, stepVitals, WorldAction, WorldState } from "./rules";
import { EXTRA_NODE_INDEX, generateChunk, NaturalNode, NodeKind, terrainHeight } from "./world";
import { ITEM_KINDS, ITEMS } from "./items";

const SEED = 1337;
const chunks = Array.from({ length: 900 }, (_, i) => generateChunk(SEED, i % 30 - 15, Math.floor(i / 30) - 15));
const nodes = chunks.flatMap((chunk) => chunk.nodes);
const find = (kind: NodeKind, test: (node: NaturalNode) => boolean = () => true) => nodes.find((node) => node.kind === kind && test(node))!;
const at = (x: number, z: number, yaw = 0): Pose => ({ x, z, yaw, y: Math.max(-0.85, terrainHeight(SEED, x, z)) + 1.7 });
const near = (node: NaturalNode) => at(node.x + 0.5, node.z);
/** Runs an action; the state only advances when it is accepted. Stamina is topped up so long loops test the rule, not fatigue. */
const act = (world: WorldState, action: WorldAction, pose: Pose, who = "local") => {
  world.people[who].vitals.stamina = 100;
  const result = applyAction(world, who, action, pose);
  return { world: result.ok ? result.state : world, ok: result.ok };
};
const hands = (world: WorldState) => world.people.local.slots.map((slot) => slot?.kind ?? null);
const repeat = (world: WorldState, action: WorldAction, pose: Pose, times: number) => { for (let i = 0; i < times; i++) world = act(world, action, pose).world; return world; };

describe("a world full of useful things", () => {
  it("scatters every kind of forage deterministically, after the original objects", () => {
    for (const kind of ["flint", "branch", "grass", "berryBush", "mushroom", "termiteMound", "rottenLog", "nest", "bones", "clams", "tuberPlant"] as NodeKind[]) expect(find(kind)).toBeDefined();
    expect(nodes.filter((node) => ["flint", "grass", "termiteMound"].includes(node.kind)).every((node) => Number(node.id.split(":")[2]) >= EXTRA_NODE_INDEX)).toBe(true);
    expect(find("berryBush", (n) => n.variant === "red")).toBeDefined(); expect(find("berryBush", (n) => n.variant === "blue")).toBeDefined();
    expect(find("mushroom", (n) => n.variant === "toxic")).toBeDefined(); expect(find("mushroom", (n) => n.variant === "edible")).toBeDefined();
    const clams = find("clams"); expect(terrainHeight(SEED, clams.x, clams.z)).toBeLessThan(0.31);
    expect(generateChunk(SEED, 3, -4)).toEqual(generateChunk(SEED, 3, -4));
  });
  it("describes every item and gives every food a real effect", () => {
    for (const kind of ITEM_KINDS) { expect(ITEMS[kind].name.length).toBeGreaterThan(0); if (ITEMS[kind].food) expect(ITEMS[kind].food!.hunger).toBeGreaterThan(0); }
    for (const kind of ITEM_KINDS) if (ITEMS[kind].cooksTo) expect(ITEMS[ITEMS[kind].cooksTo!].food!.hunger).toBeGreaterThan(ITEMS[kind].food!.hunger);
  });
  it("loose things go straight into the hand; nests and clam beds run out; bushes empty", () => {
    let world = freshWorld(SEED);
    const grass = find("grass");
    world = act(world, { type: "pickup", id: grass.id }, near(grass)).world;
    expect(hands(world)[0]).toBe("dryGrass"); expect(world.changes[grass.id].removed).toBe(true);
    const nest = find("nest", (n) => (n.count ?? 0) >= 2);
    world = freshWorld(SEED); world.people.local.bag = true; world.people.local.slots = Array(9).fill(null);
    world = repeat(world, { type: "pickup", id: nest.id }, near(nest), 5);
    expect(hands(world).filter((kind) => kind === "egg")).toHaveLength(nest.count!); expect(world.changes[nest.id].removed).toBe(true);
    const bush = find("berryBush");
    world = freshWorld(SEED); world.people.local.bag = true; world.people.local.slots = Array(9).fill(null);
    world = repeat(world, { type: "pickup", id: bush.id }, near(bush), 9);
    expect(hands(world).filter(Boolean)).toHaveLength(6);
    const mushroom = find("mushroom", (n) => n.variant === "toxic");
    world = act(freshWorld(SEED), { type: "pickup", id: mushroom.id }, near(mushroom)).world;
    expect(hands(world)[0]).toBe("toadstool");
  });
});

describe("stone and wood", () => {
  it("knapping cobbles sheds a sharp flake that whittles faster than a chopper", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("stone"), item("stone")];
    world = repeat(world, { type: "combine" }, pose, 2);
    const flake = world.drops.find((drop) => drop.item.kind === "flake")!;
    expect(flake).toBeDefined();
    world.people.local.slots = [item("flake"), item("branch")];
    world = repeat(world, { type: "combine" }, pose, 3);
    expect(hands(world)).toEqual(["flake", "spear"]);
    expect(world.people.local.slots[0]!.durability).toBeLessThan(100);
  });
  it("a free hand strips a branch into a stick and a twig; bare hands snap twigs off trees", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("branch"), null];
    world = act(world, { type: "combine" }, pose).world;
    expect(hands(world)).toEqual(["stick", "twig"]);
    const tree = find("tree", (n) => n.treeType !== "appleOak");
    world = freshWorld(SEED);
    world = act(world, { type: "use", id: tree.id }, near(tree)).world;
    expect(hands(world)[0]).toBe("twig");
  });
  it("flint shatters in a novice's hands and becomes a hand axe for a practised knapper", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("stone"), item("flint")];
    world = repeat(world, { type: "combine" }, pose, 9);
    expect(hands(world)).toEqual(["stone", "flake"]);
    expect(world.drops.filter((drop) => drop.item.kind === "flake").length).toBeGreaterThanOrEqual(2);
    world.people.local.slots = [item("stone"), item("flint")]; world.people.local.practice.knapping = 30;
    world = repeat(world, { type: "combine" }, pose, 9);
    expect(hands(world)).toEqual(["stone", "handaxe"]);
    const tree = find("tree");
    world.people.local.slots = [item("handaxe"), null];
    world = repeat(world, { type: "use", id: tree.id }, near(tree), 3);
    expect(world.changes[tree.id].removed).toBe(true);
  });
  it("hafting a flake onto a spear needs cord somewhere on the body", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("spear"), item("flake")];
    expect(act(world, { type: "combine" }, pose).ok).toBe(false);
    world.people.local.bag = true; world.people.local.slots = [item("spear"), item("flake"), item("cord"), null, null, null, null, null, null];
    world = repeat(world, { type: "combine" }, pose, 3);
    expect(hands(world).slice(0, 3)).toEqual(["stoneSpear", null, null]);
  });
});

describe("food the hard way", () => {
  it("bones give marrow and a splinter that grinds into an awl, which speeds up sewing", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("stone"), item("bone")];
    world = act(world, { type: "combine" }, pose).world;
    expect(hands(world)).toEqual(["stone", "marrow"]);
    expect(world.drops.some((drop) => drop.item.kind === "boneShard")).toBe(true);
    world.people.local.slots = [item("stone"), item("boneShard")];
    world = repeat(world, { type: "combine" }, pose, 4);
    expect(hands(world)).toEqual(["stone", "awl"]);
    world.people.local.bag = false; world.people.local.slots = [item("hide"), item("cord")];
    const withoutAwl = repeat(world, { type: "combine" }, pose, 3);
    expect(withoutAwl.people.local.bag).toBe(false);
  });
  it("termites need a thin probe and patience; a bare hand only gets bitten", () => {
    const mound = find("termiteMound"), pose = near(mound);
    let world = freshWorld(SEED);
    world = act(world, { type: "use", id: mound.id }, pose).world;
    expect(world.people.local.vitals.health).toBe(99);
    world.people.local.bag = true; world.people.local.slots = [item("twig"), ...Array(8).fill(null)];
    for (let i = 0; i < 40 && !hands(world).includes("termites"); i++) { world.people.local.slots[0] = item("twig"); world = act(world, { type: "use", id: mound.id }, pose).world; }
    expect(hands(world)).toContain("termites");
    world.people.local.slots[0] = item("stone");
    expect(act(world, { type: "use", id: mound.id }, pose).ok).toBe(false);
  });
  it("digging a tuber by hand takes three times the effort of a pointed stick", () => {
    const plant = find("tuberPlant"), pose = near(plant);
    const byHand = repeat(freshWorld(SEED), { type: "use", id: plant.id }, pose, 5);
    expect(byHand.changes[plant.id].removed).toBeFalsy();
    expect(hands(act(byHand, { type: "use", id: plant.id }, pose).world)[0]).toBe("tuber");
    const withSpear = freshWorld(SEED); withSpear.people.local.slots = [item("spear"), null];
    expect(hands(repeat(withSpear, { type: "use", id: plant.id }, pose, 2))[1]).toBe("tuber");
  });
  it("a rotten log yields grubs until it falls apart", () => {
    const log = find("rottenLog"), pose = near(log);
    let world = freshWorld(SEED); world.people.local.bag = true; world.people.local.slots = [item("stone"), ...Array(8).fill(null)];
    world = repeat(world, { type: "use", id: log.id }, pose, 6);
    expect(hands(world).filter((kind) => kind === "grubs")).toHaveLength(3);
    expect(world.changes[log.id].removed).toBe(true);
    expect(world.drops.some((drop) => drop.item.kind === "branch")).toBe(true);
  });
  it("a flake butchers better than a chopper", () => {
    const deer = find("animal"), pose = near(deer);
    const butcher = (tool: "flake" | "chopper") => {
      let world = freshWorld(SEED); world.changes[deer.id] = { dead: true, skinned: true };
      world.people.local.slots = [item(tool), null];
      world = act(world, { type: "use", id: deer.id }, pose).world;
      return world.drops.filter((drop) => drop.item.kind === "rawMeat").length;
    };
    expect(butcher("flake")).toBe(2); expect(butcher("chopper")).toBe(1);
  });
  it("poisonous food makes you sick; sickness drains the body and can kill", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("redberry"), null];
    world = act(world, { type: "eat" }, pose).world;
    expect(world.people.local.sickness).toBe(45);
    const healthy = stepVitals(freshWorld(SEED).people.local, 5), sick = stepVitals(world.people.local, 5);
    expect(sick.vitals.thirst).toBeLessThan(healthy.vitals.thirst);
    let person = { ...world.people.local, sickness: 100 };
    for (let i = 0; i < 12; i++) person = stepVitals(person, 5);
    expect(person.vitals.health).toBeLessThan(100);
    for (let i = 0; i < 400; i++) person = stepVitals(person, 5);
    expect(person.sickness).toBe(0);
    world.people.local.slots = [item("toadstool"), null]; world.people.local.sickness = 0;
    world = act(world, { type: "eat" }, pose).world;
    expect(world.people.local.sickness).toBe(80); expect(world.people.local.vitals.health).toBeLessThan(100);
  });
});

describe("fire", () => {
  const drill = (world: WorldState, pose: Pose, limit = 80) => {
    for (let i = 0; i < limit && !world.fires.length; i++) world = act(world, { type: "combine" }, pose).world;
    return world;
  };
  it("a hand drill without tinder close by only warms the wood", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("stick"), item("branch")];
    world = drill(world, pose, 30);
    expect(world.fires).toHaveLength(0); expect(world.people.local.practice.firecraft).toBeGreaterThan(0);
  });
  it("tinder on the ground catches; fire cooks, hardens points, burns bare hands and needs feeding", () => {
    let world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("dryGrass"), null];
    world = act(world, { type: "drop" }, pose).world;
    world.people.local.slots = [item("stick"), item("branch")];
    for (let attempt = 0; attempt < 6 && !world.fires.length; attempt++) { world.people.local.slots[1] = item("branch"); world = drill(world, pose); }
    expect(world.fires).toHaveLength(1);
    expect(world.drops.some((drop) => drop.item.kind === "dryGrass")).toBe(false);
    const fire = world.fires[0];
    expect(nearFire(world, pose)).toBe(true);
    world.people.local.slots = [item("rawMeat"), null];
    world = repeat(world, { type: "use", id: fire.id }, pose, 2);
    expect(hands(world)[0]).toBe("cookedMeat");
    world.people.local.slots = [item("spear"), null];
    world = repeat(world, { type: "use", id: fire.id }, pose, 3);
    expect(hands(world)[0]).toBe("hardSpear");
    world.people.local.slots = [item("branch"), null];
    const before = world.fires[0].fuel;
    world = act(world, { type: "use", id: fire.id }, pose).world;
    expect(world.fires[0].fuel).toBeGreaterThan(before); expect(hands(world)[0]).toBeNull();
    world = act(world, { type: "use", id: fire.id }, pose).world;
    expect(world.people.local.vitals.health).toBe(97);
    expect(stepFires(world, 10_000).fires).toHaveLength(0);
    const sleeper = { ...world.people.local, sleeping: true, vitals: { ...world.people.local.vitals, stamina: 10 } };
    expect(stepVitals(sleeper, 5, false, false, true).vitals.stamina).toBeGreaterThan(stepVitals(sleeper, 5).vitals.stamina);
    const saved = parseWorld(JSON.stringify(world));
    expect(saved?.fires).toHaveLength(1);
  });
});

describe("water", () => {
  it("a spear thrust into water sometimes brings up a fish", () => {
    let shore: Pose | undefined;
    for (const node of nodes) {
      for (let a = 0; a < 16 && !shore; a++) {
        const pose = at(node.x, node.z, a * Math.PI / 8);
        if (terrainHeight(SEED, pose.x, pose.z) > 0.2 && terrainHeight(SEED, pose.x - Math.sin(pose.yaw) * 1.7, pose.z - Math.cos(pose.yaw) * 1.7) < 0.1) shore = pose;
      }
      if (shore) break;
    }
    expect(shore).toBeDefined();
    let world = freshWorld(SEED);
    world.people.local.vitals.thirst = 50;
    world = act(world, { type: "drink" }, shore!).world;
    expect(world.people.local.vitals.thirst).toBe(72);
    world.people.local.slots = [item("stoneSpear"), null];
    for (let i = 0; i < 40 && hands(world)[1] !== "fish"; i++) world = act(world, { type: "drink" }, shore!).world;
    expect(hands(world)[1]).toBe("fish");
    world.people.local.slots = [item("stone"), null];
    expect(act(world, { type: "drink" }, shore!).ok).toBe(false);
  });
});

describe("saves", () => {
  it("older saves without fires, sickness or new skills still load", () => {
    const world = freshWorld(SEED) as unknown as Record<string, unknown>;
    delete world.fires;
    const person = (world.people as Record<string, Record<string, unknown>>).local;
    delete person.sickness; person.practice = { knapping: 4, cutting: 1, weaving: 0 };
    const loaded = parseWorld(JSON.stringify(world))!;
    expect(loaded.fires).toEqual([]); expect(loaded.people.local.sickness).toBe(0);
    expect(loaded.people.local.practice).toEqual({ knapping: 4, cutting: 1, weaving: 0, firecraft: 0, foraging: 0, fishing: 0 });
  });
});

describe("food does not keep", () => {
  it("meat rots in the hand and on the ground; stones and tools never do", () => {
    const person = freshWorld(SEED).people.local;
    person.slots = [item("rawMeat"), item("chopper")];
    let aged = person;
    for (let i = 0; i < 60; i++) aged = stepVitals(aged, 5);
    expect(aged.slots[0]!.kind).toBe("rawMeat"); expect(aged.slots[0]!.durability).toBeLessThan(55);
    for (let i = 0; i < 70; i++) aged = stepVitals(aged, 5);
    expect(aged.slots[0]!.kind).toBe("rotten"); expect(aged.slots[1]).toEqual(item("chopper"));
    let world = freshWorld(SEED); world.drops = [{ id: "d1", item: item("fish"), x: 0, z: 0 }, { id: "d2", item: item("stone"), x: 1, z: 0 }];
    for (let i = 0; i < 500; i++) world = stepMatter(world, 1);
    expect(world.drops.map((drop) => drop.item.kind)).toEqual(["rotten", "stone"]);
    expect(spoilItem(item("nut"), 99999)).toEqual(item("nut"));
  });
  it("rot is edible but almost always poisonous, and cooking keeps the age of the food", () => {
    const world = freshWorld(SEED); const pose = world.people.local.pose;
    world.people.local.slots = [item("rotten"), null]; world.people.local.vitals.hunger = 40;
    let sick = 0;
    for (let i = 0; i < 20; i++) { world.revision = i; if (applyAction(world, "local", { type: "eat" }, pose).state.people.local.sickness > 0) sick++; }
    expect(sick).toBeGreaterThan(12);
    world.fires = [{ id: "fire-t", x: pose.x + 1, z: pose.z, fuel: 100 }];
    world.people.local.slots = [{ ...item("rawMeat"), durability: 30 }, null];
    let state: WorldState = world;
    for (let i = 0; i < 2; i++) state = applyAction(state, "local", { type: "use", id: "fire-t" }, pose).state;
    expect(state.people.local.slots[0]!.kind).toBe("cookedMeat"); expect(state.people.local.slots[0]!.durability).toBe(30);
  });
});
