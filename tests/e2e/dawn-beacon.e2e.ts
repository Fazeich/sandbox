import { expect, test } from "@playwright/test";

test("Dawn crystals restore the beacon and award the drive upgrade", async ({ page }) => {
  await page.goto("?autoloop=1&seed=424242");
  await page.waitForFunction(() => window.__autoloop !== undefined);

  const visit = async (x: number, z: number) => {
    await page.evaluate(([nextX, nextZ]) => window.__autoloop?.setPlayer({ x: nextX, z: nextZ }), [x, z]);
    await page.waitForTimeout(120);
  };

  await visit(25, -22);
  await visit(18, -15);
  await visit(11, -22);
  await expect(page.locator("body")).toContainText("3 энергии");
  await visit(18, -22);
  await page.keyboard.press("f");

  await expect(page.locator("body")).toContainText("Форсированный привод:");
  await expect(page.locator("body")).toContainText("тяга +18%, скорость +15%");
});
