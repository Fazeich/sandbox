/**
 * Every physical thing a person can hold. Data only: names are for accessibility labels,
 * never shown as hints. Behaviour lives in `rules.ts` / `recipes.ts`.
 */
export const ITEM_KINDS = [
  // Raw materials
  "stone", "flint", "branch", "stick", "twig", "fiber", "dryGrass", "bone", "hide",
  // Worked tools and products
  "flake", "chopper", "handaxe", "boneShard", "awl", "spear", "hardSpear", "stoneSpear", "cord", "bag", "backpack",
  // Food
  "nut", "kernel", "apple", "blueberry", "redberry", "mushroom", "toadstool", "termites", "grubs",
  "egg", "cookedEgg", "clam", "clamMeat", "marrow", "tuber", "roastedTuber",
  "rawMeat", "cookedMeat", "fish", "cookedFish", "rotten",
] as const;
export type ItemKind = typeof ITEM_KINDS[number];

export interface Food {
  hunger: number; thirst?: number; stamina?: number; health?: number;
  /** Illness added when eaten; `sickChance` < 1 makes it a gamble (raw animal food). */
  sickness?: number; sickChance?: number;
}
/** What an item can do when it meets the world. Higher is better; absent means "cannot". */
export interface ToolPower {
  hit?: number;   // wounding animals, smashing logs
  chop?: number;  // felling trees
  cut?: number;   // shaping wood, butchering
  dig?: number;   // prying tubers out of the ground
  probe?: boolean; // thin enough to fish termites out of a mound
  fish?: number;  // base chance per thrust into water
  hammer?: boolean; // percussion: knapping, cracking, pounding
}
/** `spoils`: seconds until fresh food turns to rot (freshness is tracked in `durability`). */
export interface ItemDef { name: string; food?: Food; tool?: ToolPower; fuel?: number; cooksTo?: ItemKind; wear?: number; spoils?: number }

export const ITEMS: Record<ItemKind, ItemDef> = {
  stone: { name: "Камень", tool: { hit: 1, hammer: true, dig: 1 } },
  flint: { name: "Кремень", tool: { hit: 1, hammer: true } },
  branch: { name: "Ветка", tool: { hit: 1 }, fuel: 150 },
  stick: { name: "Палка", tool: { hit: 1, dig: 2 }, fuel: 90, wear: 3 },
  twig: { name: "Прутик", tool: { probe: true }, fuel: 30, wear: 12 },
  fiber: { name: "Волокна" },
  dryGrass: { name: "Сухая трава", tool: { probe: true }, fuel: 40, wear: 25 },
  bone: { name: "Кость", tool: { hit: 1 } },
  hide: { name: "Шкура" },
  flake: { name: "Отщеп", tool: { cut: 3 }, wear: 8 },
  chopper: { name: "Чоппер", tool: { hit: 2, chop: 1, cut: 1, dig: 1 }, wear: 2 },
  handaxe: { name: "Рубило", tool: { hit: 2, chop: 2, cut: 2, dig: 2, hammer: true }, wear: 1 },
  boneShard: { name: "Осколок кости", tool: { cut: 1 }, wear: 10 },
  awl: { name: "Шило" },
  spear: { name: "Заострённая палка", tool: { hit: 3, dig: 3, fish: 0.12 }, wear: 2 },
  hardSpear: { name: "Обожжённое копьё", tool: { hit: 4, dig: 3, fish: 0.18 }, wear: 1 },
  stoneSpear: { name: "Копьё с наконечником", tool: { hit: 5, dig: 2, fish: 0.26 }, wear: 1 },
  cord: { name: "Шнур" },
  bag: { name: "Сумка" },
  backpack: { name: "Рюкзак" },
  nut: { name: "Орех" },
  kernel: { name: "Ядро ореха", food: { hunger: 15, stamina: 2 } },
  apple: { name: "Яблоко", food: { hunger: 12, thirst: 3, stamina: 1.2 }, spoils: 3600 },
  blueberry: { name: "Синие ягоды", food: { hunger: 6, thirst: 1.5, stamina: 0.6 }, spoils: 1500 },
  redberry: { name: "Красные ягоды", food: { hunger: 4, thirst: 1, sickness: 45 }, spoils: 1500 },
  mushroom: { name: "Гриб", food: { hunger: 7, stamina: 0.5 }, spoils: 1200 },
  toadstool: { name: "Пёстрый гриб", food: { hunger: 3, health: -6, sickness: 80 }, spoils: 1200 },
  termites: { name: "Термиты", food: { hunger: 7, stamina: 1.5 }, spoils: 900 },
  grubs: { name: "Личинки", food: { hunger: 9, stamina: 1.5 }, spoils: 900 },
  egg: { name: "Яйцо", food: { hunger: 9, thirst: 1, stamina: 1, sickness: 20, sickChance: 0.1 }, spoils: 2400, cooksTo: "cookedEgg" },
  cookedEgg: { name: "Печёное яйцо", food: { hunger: 14, stamina: 2 }, spoils: 1800 },
  clam: { name: "Ракушка" },
  clamMeat: { name: "Мясо моллюска", food: { hunger: 8, thirst: 1, stamina: 1, sickness: 25, sickChance: 0.25 }, spoils: 420 },
  marrow: { name: "Костный мозг", food: { hunger: 20, stamina: 3 }, spoils: 900 },
  tuber: { name: "Клубень", food: { hunger: 7, thirst: 1, stamina: 0.5 }, spoils: 7200, cooksTo: "roastedTuber" },
  roastedTuber: { name: "Печёный клубень", food: { hunger: 20, stamina: 2 }, spoils: 2400 },
  rawMeat: { name: "Сырое мясо", food: { hunger: 24, stamina: 3, health: -4, sickness: 30, sickChance: 0.35 }, spoils: 600, cooksTo: "cookedMeat" },
  cookedMeat: { name: "Жареное мясо", food: { hunger: 36, stamina: 4 }, spoils: 1800 },
  fish: { name: "Рыба", food: { hunger: 14, stamina: 1.5, sickness: 20, sickChance: 0.2 }, spoils: 480, cooksTo: "cookedFish" },
  cookedFish: { name: "Жареная рыба", food: { hunger: 26, stamina: 3 }, spoils: 1500 },
  // Whatever food was, left too long. Filling enough to tempt the starving.
  rotten: { name: "Гниль", food: { hunger: 5, sickness: 55, sickChance: 0.85 } },
};

export const ITEM_NAMES = Object.fromEntries(ITEM_KINDS.map((kind) => [kind, ITEMS[kind].name])) as Record<ItemKind, string>;
export const isItemKind = (value: unknown): value is ItemKind => typeof value === "string" && Object.prototype.hasOwnProperty.call(ITEMS, value);
export const toolOf = (kind: ItemKind | undefined): ToolPower => (kind ? ITEMS[kind].tool : undefined) ?? {};
