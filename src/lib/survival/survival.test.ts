import { describe, expect, it } from "vitest";
import { applyAction, freshWorld, item, parseWorld, poseAllowed, quickSlots, settleDeaths, stepVitals, stepWildlife, WorldAction } from "./rules";
import { ChunkStream, findSpawn, generateChunk, RENDER_DISTANCE_OPTIONS, terrainHeight, TREE_VARIANTS } from "./world";

describe("infinite survival world", () => {
  it("has deterministic chunks per seed, different worlds per seed and dry spawns", () => {
    expect(generateChunk(123, 4, -2)).toEqual(generateChunk(123, 4, -2));
    expect(generateChunk(123, 4, -2)).not.toEqual(generateChunk(124, 4, -2));
    for (const seed of [1, 27, 1337, 424242, 4294967295]) { const spawn = findSpawn(seed); expect(terrainHeight(seed, spawn.x, spawn.z)).toBeGreaterThan(0.5); }
  });
  it("includes every tree model and favors the smaller variants", () => {
    const chunks = Array.from({ length: 1681 }, (_, index) => generateChunk(1337, index % 41 - 20, Math.floor(index / 41) - 20));
    const trees = chunks.flatMap((chunk) => chunk.nodes.filter((node) => node.kind === "tree"));
    expect(trees.length).toBeGreaterThan(0);
    expect(trees.every((tree) => tree.treeType !== undefined)).toBe(true);
    const counts = Object.fromEntries(Object.keys(TREE_VARIANTS).map((type) => [type, trees.filter((tree) => tree.treeType === type).length]));
    expect(new Set(trees.map((tree) => tree.treeType))).toEqual(new Set(Object.keys(TREE_VARIANTS)));
    expect(counts.rowanFan).toBeGreaterThan(counts.birchForked);
    expect(chunks[0]).toEqual(generateChunk(1337, -20, -20));
  });
  it("turns wildlife toward its movement and restores that heading from a save", () => {
    const seed = 1337;
    const animal = Array.from({ length: 441 }, (_, index) => generateChunk(seed, index % 21 - 10, Math.floor(index / 21) - 10))
      .flatMap((chunk) => chunk.nodes)
      .find((node) => node.kind === "animal" && terrainHeight(seed, node.x + 1.3, node.z) > 0.2 && terrainHeight(seed, node.x - 1.3, node.z) > 0.2)!;
    const fromLeft = { x: animal.x - 2, y: 0, z: animal.z, yaw: 0 };
    const fleeingRight = stepWildlife(freshWorld(seed), [fromLeft], 1);
    expect(fleeingRight.changes[animal.id].yaw).toBeCloseTo(Math.PI / 2);
    const fromRight = { ...fromLeft, x: animal.x + 4 };
    const fleeingLeft = stepWildlife(fleeingRight, [fromRight], 1);
    expect(fleeingLeft.changes[animal.id].yaw).toBeCloseTo(-Math.PI / 2);
    expect(parseWorld(JSON.stringify(fleeingLeft))?.changes[animal.id].yaw).toBeCloseTo(-Math.PI / 2);
  });
  it("streams without an island boundary and bounds cache size on long journeys", () => {
    const stream = new ChunkStream(1337); stream.update(0, 0);
    const initial = stream.chunks.find((chunk) => chunk.key === "0:0");
    stream.update(20, 0);
    expect(stream.chunks.find((chunk) => chunk.key === "0:0")).toBe(initial);
    expect(stream.chunks).toHaveLength(49);
    stream.update(20, 0, RENDER_DISTANCE_OPTIONS.near.radius);
    expect(stream.chunks).toHaveLength(25);
    stream.update(20, 0, RENDER_DISTANCE_OPTIONS.far.radius);
    expect(stream.chunks).toHaveLength(81);
    for (let step = 0; step < 100; step++) stream.update(step * 75, -step * 50);
    expect(stream.cache.size).toBeLessThanOrEqual(81);
    expect(stream.chunks).toHaveLength(81);
    stream.update(100000, -100000); expect(stream.center).toBe("5000:-5000");
    stream.update(0, 0); expect(stream.chunks.find((chunk) => chunk.key === "0:0")).toEqual(initial);
  });
});

describe("physical inventory and practice", () => {
  it("starts with only two empty hands, no learned practice or equipment", () => {
    const person = freshWorld(1337).people.local;
    expect(person.slots).toEqual([null, null]); expect(person.practice).toEqual({ knapping: 0, cutting: 0, weaving: 0, firecraft: 0, foraging: 0, fishing: 0 });
    expect(person.bag).toBe(false); expect(person.backpack).toBe(false);
  });
  it("stone cracking produces food and stone knapping requires repeated work", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.slots = [item("stone"), item("nut")];
    world = applyAction(world, "local", { type: "combine" }, pose).state;
    expect(world.people.local.slots[1]?.kind).toBe("kernel");
    world.people.local.slots[1] = item("stone");
    world = applyAction(world, "local", { type: "combine" }, pose).state;
    expect(world.people.local.slots[1]?.kind).toBe("stone");
    for (let i = 0; i < 6; i++) world = applyAction(world, "local", { type: "combine" }, pose).state;
    expect(world.people.local.slots[1]?.kind).toBe("chopper");
    expect(world.people.local.practice.knapping).toBe(7);
  });
  it("bag expands quick slots to nine and backpack adds exactly twenty-one", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.slots = [item("hide"), item("cord")];
    for (let i = 0; i < 5; i++) world = applyAction(world, "local", { type: "combine" }, pose).state;
    expect(world.people.local.bag).toBe(true); expect(quickSlots(world.people.local)).toBe(9); expect(world.people.local.slots).toHaveLength(9);
    world.people.local.slots[0] = item("hide"); world.people.local.slots[1] = item("cord"); world.people.local.slots[2] = item("branch");
    for (let i = 0; i < 5; i++) world = applyAction(world, "local", { type: "combine" }, pose).state;
    expect(world.people.local.backpack).toBe(true); expect(world.people.local.slots).toHaveLength(30); expect(quickSlots(world.people.local)).toBe(9);
    expect(applyAction(world, "local", { type: "select", slot: 9 }, pose).ok).toBe(false);
    expect(applyAction(world, "local", { type: "swap", from: 30, to: 1 }, pose).ok).toBe(false);
  });
  it("server world never lets two people pick up the same physical object", () => {
    const world = freshWorld(123); const node = generateChunk(123, 1, 1).nodes.find((n) => n.kind === "stone")!;
    expect(node).toBeDefined();
    world.people.other = { ...world.people.local, slots: [null, null] };
    const pose = { x: node.x, y: terrainHeight(123, node.x, node.z) + 1.7, z: node.z, yaw: 0 };
    const first = applyAction(world, "local", { type: "pickup", id: node.id }, pose);
    expect(first.ok).toBe(true);
    expect(applyAction(first.state, "other", { type: "pickup", id: node.id }, pose).ok).toBe(false);
    expect(first.state.people.other.slots).toEqual([null, null]);
    expect(applyAction(world, "local", { type: "pickup", id: node.id }, { ...pose, x: pose.x + 100 }).ok).toBe(false);
  });
  it("drop/pickup preserves worked items; invalid actions do not mutate state", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.slots[0] = { kind: "chopper", work: 0, durability: 54 };
    world = applyAction(world, "local", { type: "drop" }, pose).state;
    expect(world.drops[0].item.durability).toBe(54);
    world = applyAction(world, "local", { type: "pickup", id: world.drops[0].id }, pose).state;
    expect(world.people.local.slots[0]?.durability).toBe(54); expect(world.drops).toHaveLength(0);
    expect(applyAction(world, "local", { type: "unknown" } as unknown as WorldAction, pose).state).toBe(world);
  });
});

describe("long-term organism stamina", () => {
  it("walking and standing neither drain nor regenerate stamina; running drains slowly", () => {
    const person = freshWorld(1).people.local; person.vitals.stamina = 50;
    expect(stepVitals(person, 5, true, false).vitals.stamina).toBe(50);
    expect(stepVitals(person, 5, false, false).vitals.stamina).toBe(50);
    const running = stepVitals(person, 5, true, true).vitals.stamina;
    expect(running).toBeLessThan(50); expect(running).toBeGreaterThan(49);
  });
  it("sleep and food restore stamina, exhaustion blocks work and eventually damages health", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.vitals.stamina = 0;
    world.people.local.slots = [item("stone"), item("stone")];
    expect(applyAction(world, "local", { type: "combine" }, pose).ok).toBe(false);
    let exhausted = world.people.local;
    for (let i = 0; i < 15; i++) exhausted = stepVitals(exhausted, 5);
    expect(exhausted.vitals.health).toBeLessThan(100);
    world.people.local = exhausted;
    world = applyAction(world, "local", { type: "sleep" }, pose).state;
    expect(stepVitals(world.people.local, 5).vitals.stamina).toBeGreaterThan(0);
    world = applyAction(world, "local", { type: "wake" }, pose).state;
    world.people.local.slots[0] = item("kernel");
    world = applyAction(world, "local", { type: "eat" }, pose).state;
    expect(world.people.local.vitals.stamina).toBeGreaterThan(0);
  });
  it("preserves valid save capacities and rejects malformed worlds", () => {
    const world = freshWorld(42, "female");
    expect(parseWorld(JSON.stringify(world))?.people.local.gender).toBe("female");
    expect(parseWorld("garbage")).toBeNull();
    world.people.local.slots.push(null); expect(parseWorld(JSON.stringify(world))).toBeNull();
  });
});

describe("hardcore death and online authority", () => {
  it("a dying body drops everything it carried as shared loot and blocks further actions", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.slots = [{ kind: "chopper", work: 0, durability: 40 }, item("apple")];
    world.people.local.vitals.health = 0; world.people.local.sleeping = true;
    world = settleDeaths(world);
    expect(world.people.local.slots).toEqual([null, null]);
    expect(world.people.local.sleeping).toBe(false);
    expect(world.drops.map((drop) => drop.item.kind).sort()).toEqual(["apple", "chopper"]);
    expect(world.drops.find((drop) => drop.item.kind === "chopper")?.item.durability).toBe(40);
    expect(world.drops.every((drop) => Math.hypot(drop.x - pose.x, drop.z - pose.z) < 1)).toBe(true);
    expect(settleDeaths(world)).toBe(world);
    expect(applyAction(world, "local", { type: "eat" }, pose).ok).toBe(false);
  });
  it("wounds from an action settle the death in the same step, and another survivor can loot the body", () => {
    let world = freshWorld(1337); const pose = world.people.local.pose;
    world.people.local.slots = [item("rawMeat"), item("stone")]; world.people.local.vitals.health = 3;
    world.people.other = { ...world.people.local, slots: [null, null], vitals: { ...world.people.local.vitals, health: 100 } };
    world = applyAction(world, "local", { type: "eat" }, pose).state;
    expect(world.people.local.vitals.health).toBe(0);
    const stone = world.drops.find((drop) => drop.item.kind === "stone")!;
    expect(stone).toBeDefined();
    world = applyAction(world, "other", { type: "pickup", id: stone.id }, pose).state;
    expect(world.people.other.slots[0]?.kind).toBe("stone");
  });
  it("only the dead can respawn, as a fresh empty-handed survivor in the same world", () => {
    const world = freshWorld(99, "female"); const pose = world.people.local.pose;
    expect(applyAction(world, "local", { type: "respawn" }, pose).ok).toBe(false);
    world.people.local = { ...world.people.local, bag: true, slots: Array(9).fill(null), practice: { ...world.people.local.practice, knapping: 40, cutting: 3, weaving: 1 }, vitals: { ...world.people.local.vitals, health: 0 } };
    const result = applyAction(world, "local", { type: "respawn" }, pose);
    expect(result.ok).toBe(true);
    const reborn = result.state.people.local;
    expect(result.state.seed).toBe(99); expect(reborn.gender).toBe("female");
    expect(reborn.vitals.health).toBe(100); expect(reborn.bag).toBe(false); expect(reborn.slots).toEqual([null, null]);
    expect(reborn.practice).toEqual({ knapping: 0, cutting: 0, weaving: 0, firecraft: 0, foraging: 0, fishing: 0 });
    expect(terrainHeight(99, reborn.pose.x, reborn.pose.z)).toBeGreaterThan(0);
    expect(parseWorld(JSON.stringify(result.state))).not.toBeNull();
  });
  it("rejects teleports, banked idle time and flying, but tolerates normal travel and jumps", () => {
    const seed = 1337, spawn = findSpawn(seed);
    const at = (x: number, z: number, lift = 0) => ({ x, z, yaw: 0, y: Math.max(-0.85, terrainHeight(seed, x, z)) + 1.7 + lift });
    const start = at(spawn.x, spawn.z);
    expect(poseAllowed(seed, start, at(spawn.x + 1, spawn.z), 0.15)).toBe(true);
    expect(poseAllowed(seed, start, at(spawn.x + 1, spawn.z, 1.2), 0.15)).toBe(true);
    expect(poseAllowed(seed, start, at(spawn.x + 10, spawn.z), 1)).toBe(true);
    expect(poseAllowed(seed, start, at(spawn.x + 60, spawn.z), 0.15)).toBe(false);
    expect(poseAllowed(seed, start, at(spawn.x + 60, spawn.z), 600)).toBe(false);
    expect(poseAllowed(seed, start, at(spawn.x, spawn.z, 12), 0.15)).toBe(false);
    expect(poseAllowed(seed, start, { ...start, y: Number.NaN }, 0.15)).toBe(false);
  });
});
