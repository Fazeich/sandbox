import { expect, test } from "@playwright/test";
import { freshWorld, item, WorldState } from "../../src/lib/survival/rules";
import { CHUNK_SIZE, generateChunk, terrainHeight } from "../../src/lib/survival/world";

test("new lives start empty, map is opt-in, and continuing retains the world", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /webgl|shader|three/i.test(message.text())) errors.push(message.text()); });
  await page.goto("./");
  await expect(page.getByRole("button", { name: "Новая жизнь", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Новая жизнь", exact: true }).click();
  await expect(page.locator(".origin-hands button")).toHaveCount(2);
  await expect(page.getByLabel("Ячейка 1: пусто", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Здоровье 100/ })).toBeVisible();
  await expect(page.getByLabel("Миникарта", { exact: true })).toHaveCount(0);
  await expect(page.locator(".origin-ui")).toHaveText("12");
  await page.keyboard.press("Digit2");
  await expect(page.getByLabel("Ячейка 2: пусто", { exact: true })).toHaveAttribute("aria-pressed", "true");
  const seed = await page.evaluate(() => JSON.parse(localStorage.getItem("origin:world:v2")!).seed);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Настройки", exact: true }).click();
  await page.locator(".origin-setting").filter({ hasText: "Миникарта" }).getByRole("switch").click();
  await expect(page.getByLabel("Миникарта", { exact: true })).toBeVisible();
  const renderDistance = page.locator(".origin-distance-setting");
  await expect(renderDistance.getByRole("button", { name: "Средняя" })).toHaveAttribute("aria-pressed", "true");
  await renderDistance.getByRole("button", { name: "Дальняя" }).click();
  await expect(renderDistance.getByRole("button", { name: "Дальняя" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("origin:settings")!).renderDistance)).toBe("far");
  await page.getByRole("button", { name: "Назад", exact: true }).click();
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("origin:world:v2")!).seed)).toBe(seed);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "В меню", exact: true }).click();
  await page.getByRole("button", { name: "Новая жизнь", exact: true }).click();
  await page.getByRole("button", { name: "Начать", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("origin:world:v2")!).seed)).not.toBe(seed);
  expect(errors).toEqual([]);
});

test("physical hand work makes a chopper without a recipe screen", async ({ page }) => {
  const state = freshWorld(424242);
  state.people.local.slots = [item("stone"), item("stone")];
  await page.addInitScript(value => localStorage.setItem("origin:world:v2", JSON.stringify(value)), state);
  await page.goto("./");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.getByLabel("Ячейка 2: Камень", { exact: true })).toBeVisible();
  for (let strike = 0; strike < 7; strike++) {
    await page.locator(".shore canvas").first().click({ button: "right", position: { x: 300, y: 200 } });
    await page.waitForTimeout(370); // Physical-action cooldown is 340ms.
  }
  await expect(page.getByLabel("Ячейка 2: Чоппер", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("origin:world:v2")!));
  expect(saved.people.local.practice.knapping).toBe(7);
  expect(saved.people.local.vitals.stamina).toBeGreaterThan(99);
  await expect(page.locator(".origin-ui")).toHaveText("12");
});

test("backpack adds 21 separate cells and physical B moves items between storage and hands", async ({ page }) => {
  const state = freshWorld(424242), person = state.people.local;
  person.bag = person.backpack = true;
  person.slots = Array.from({ length: 30 }, () => null);
  person.slots[9] = item("berry");
  await page.addInitScript(value => localStorage.setItem("origin:world:v2", JSON.stringify(value)), state);
  await page.goto("./");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(page.locator(".origin-hands button")).toHaveCount(9);
  await page.keyboard.press("KeyB");
  await expect(page.getByRole("dialog", { name: "Рюкзак" })).toBeVisible();
  await expect(page.locator(".origin-pack-grid button")).toHaveCount(21);
  await page.getByLabel("Ячейка 10: Ягоды", { exact: true }).click();
  await page.getByLabel("Ячейка 1: пусто", { exact: true }).click();
  await expect(page.getByLabel("Ячейка 1: Ягоды", { exact: true })).toBeVisible();
  await page.keyboard.press("KeyB");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.press("KeyF");
  await expect(page.getByLabel("Ячейка 1: пусто", { exact: true })).toBeVisible();
});

test("two independent browsers join one live room and receive membership updates", async ({ browser }) => {
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  try {
    const host = await hostContext.newPage(), guest = await guestContext.newPage();
    await host.goto("http://127.0.0.1:4173/portfolio/");
    await host.getByRole("button", { name: "Вместе", exact: true }).click();
    const joined = host.waitForResponse(response => response.url().endsWith("/api/coop/join") && response.request().method() === "POST");
    await host.getByRole("button", { name: "Создать мир", exact: true }).click();
    const data = await (await joined).json();
    await expect(host.locator(".origin-room")).toContainText("1/4");
    await guest.goto(`http://127.0.0.1:4173/portfolio/?room=${data.room}`);
    await guest.getByRole("button", { name: "Войти", exact: true }).click();
    await expect(guest.locator(".origin-room")).toContainText("2/4");
    await expect(host.locator(".origin-room")).toContainText("2/4");
    await expect(host.locator(".origin-hands button")).toHaveCount(2);
    await expect(guest.locator(".origin-hands button")).toHaveCount(2);
    await guest.getByRole("button", { name: "Покинуть мир", exact: true }).click();
    await expect(host.locator(".origin-room")).toContainText("1/4");
    await host.getByRole("button", { name: "Покинуть мир", exact: true }).click();
  } finally { await hostContext.close(); await guestContext.close(); }
});

test("real room authority shares geography, separates hands and prevents duplicate pickup", async ({ request }) => {
  const join = async (room = "") => {
    const response = await request.post("/api/coop/join", { data: { name: "Проверка", room } });
    expect(response.ok()).toBe(true);
    return response.json() as Promise<{ room: string; id: string; token: string; state: WorldState; peers: { id: string }[] }>;
  };
  const first = await join(), second = await join(first.room);
  expect(second.state.seed).toBe(first.state.seed);
  expect(second.peers).toHaveLength(2);
  expect(second.state.people[first.id].slots).toEqual([null, null]);
  expect(second.state.people[second.id].slots).toEqual([null, null]);
  const auth = (who: typeof first) => `room=${who.room}&id=${who.id}&token=${who.token}`;
  const origin = first.state.people[first.id].pose, cx = Math.floor(origin.x / CHUNK_SIZE), cz = Math.floor(origin.z / CHUNK_SIZE);
  const nearby = Array.from({ length: 25 }, (_, i) => generateChunk(first.state.seed, cx + i % 5 - 2, cz + Math.floor(i / 5) - 2)).flatMap(c => c.nodes);
  const stone = nearby.filter(n => n.kind === "stone").sort((a, b) => Math.hypot(a.x - origin.x, a.z - origin.z) - Math.hypot(b.x - origin.x, b.z - origin.z))[0];
  expect(stone).toBeDefined();
  for (const who of [first, second]) {
    const start = second.state.people[who.id].pose;
    const steps = Math.ceil(Math.hypot(stone.x - start.x, stone.z - start.z) / 2);
    for (let n = 1; n <= steps; n++) {
      const x = start.x + (stone.x - start.x) * n / steps, z = start.z + (stone.z - start.z) * n / steps;
      expect((await request.post(`/api/coop/pose?${auth(who)}`, { data: { pose: { x, z, y: terrainHeight(first.state.seed, x, z) + 1.7, yaw: 0 } } })).ok()).toBe(true);
    }
  }
  const pickup = async (who: typeof first) => (await request.post(`/api/coop/action?${auth(who)}`, { data: { action: { type: "pickup", id: stone.id } } })).json();
  expect((await pickup(first)).ok).toBe(true);
  expect((await pickup(second)).ok).toBe(false);
  const observer = await join(first.room);
  expect(observer.state.people[first.id].slots[0]?.kind).toBe("stone");
  expect(observer.state.people[second.id].slots).toEqual([null, null]);
  expect(observer.state.changes[stone.id].removed).toBe(true);
  await request.post(`/api/coop/leave?${auth(first)}`, { data: {} });
  const last = await join(first.room);
  expect(last.state.people[first.id]).toBeUndefined();
  expect(last.state.drops.some(d => d.item.kind === "stone")).toBe(true);
  for (const who of [second, observer, last]) await request.post(`/api/coop/leave?${auth(who)}`, { data: {} });
});
