const { test, expect } = require("@playwright/test");

const PAGE = "file:///Users/davidle/Documents/portoflio/index.html";

const hrefAt = (page, x, y) =>
  page.evaluate(
    ({ x, y }) => {
      const anchor = document.elementFromPoint(x, y)?.closest("a");
      return anchor ? anchor.getAttribute("href") : null;
    },
    { x, y }
  );

test("clicking anywhere on a card opens that project", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });
  const cards = page.locator(".project-card");
  await expect(cards).toHaveCount(6);

  const failures = [];

  for (let index = 0; index < 6; index += 1) {
    const card = cards.nth(index);
    await card.scrollIntoViewIfNeeded();

    const cover = card.locator("a.project-cover");
    await expect(cover).toHaveCount(1);
    const expected = await cover.getAttribute("href");

    const box = await card.boundingBox();
    if (!box) {
      failures.push({ index, reason: "no bounding box" });
      continue;
    }

    const probes = [
      ["image", box.x + box.width / 2, box.y + box.height * 0.2],
      ["text", box.x + box.width / 2, box.y + box.height * 0.72],
      ["corner", box.x + box.width - 20, box.y + box.height - 20],
    ];

    for (const [name, x, y] of probes) {
      const href = await hrefAt(page, x, y);
      if (href !== expected) failures.push({ index, name, href, expected });
    }
  }

  expect(failures).toEqual([]);
});

test("source links stay clickable above the card cover", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });

  const links = page.locator(".project-card .project-links a");
  await expect(links).toHaveCount(7); /* six source links + the Abstract Generator metrics link */

  const failures = [];
  const total = await links.count();

  for (let index = 0; index < total; index += 1) {
    const link = links.nth(index);
    await link.scrollIntoViewIfNeeded();
    const expected = await link.getAttribute("href");
    const box = await link.boundingBox();
    const href = box ? await hrefAt(page, box.x + box.width / 2, box.y + box.height / 2) : null;
    if (href !== expected) failures.push({ text: await link.textContent(), href, expected });
  }

  expect(failures).toEqual([]);
});

test("every project card shows a loaded screenshot", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "load" });
  await page.locator("#projects").scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const broken = await page.evaluate(() =>
    [...document.querySelectorAll(".project-media img")]
      .filter((img) => !img.complete || img.naturalWidth === 0)
      .map((img) => img.getAttribute("src"))
  );

  expect(broken).toEqual([]);
});

test("theme toggle switches modes and persists", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });

  const wasLight = await page.evaluate(() => document.documentElement.classList.contains("light"));
  await page.click("#theme-toggle");
  const isLight = await page.evaluate(() => document.documentElement.classList.contains("light"));
  expect(isLight).toBe(!wasLight);

  const saved = await page.evaluate(() => localStorage.getItem("theme"));
  expect(saved).toBe(isLight ? "light" : "dark");

  await page.reload({ waitUntil: "domcontentloaded" });
  const afterReload = await page.evaluate(() => document.documentElement.classList.contains("light"));
  expect(afterReload).toBe(isLight);
});

test("console responds to commands", async ({ page }) => {
  await page.goto(PAGE, { waitUntil: "domcontentloaded" });

  await page.click("#console-toggle");
  await expect(page.locator("#console")).toHaveClass(/open/);

  await page.fill("#console-input", "whoami");
  await page.press("#console-input", "Enter");
  await expect(page.locator("#console-output")).toContainText("David Le");

  await page.fill("#console-input", "bogus");
  await page.press("#console-input", "Enter");
  await expect(page.locator("#console-output")).toContainText("Command not found");

  await page.fill("#console-input", "clear");
  await page.press("#console-input", "Enter");
  await expect(page.locator(".console-line")).toHaveCount(0);
});
