const { test, expect } = require("@playwright/test");

async function getSnapshot(page) {
  return page.evaluate(() => window.__gameDebug.getSnapshot());
}

async function startGame(page) {
  await page.goto("/index.html");
  await page.waitForFunction(() => Boolean(window.__gameDebug));
  await page.evaluate(() => window.__gameDebug.startGame());
}

async function setEasyCurrentRow(page) {
  await page.evaluate(() =>
    window.__gameDebug.setCurrentRowForTest({
      blocks: [{ lane: 0, hp: 3, entityType: "item", rewardType: "add", rewardValue: 6 }],
    }),
  );
}

test("loads and starts a playable run", async ({ page }) => {
  await startGame(page);

  await expect(page.locator("#overlay")).toHaveClass(/hidden/);

  const snapshot = await getSnapshot(page);
  expect(snapshot.running).toBe(true);
  expect(snapshot.currentRow).not.toBeNull();
  expect(snapshot.currentRow.blocks.length).toBeGreaterThan(0);
});

test("keyboard lane switching updates game state", async ({ page }) => {
  await startGame(page);

  await page.keyboard.press("ArrowRight");
  await expect.poll(() => getSnapshot(page).then((state) => state.currentLane)).toBe(1);

  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => getSnapshot(page).then((state) => state.currentLane)).toBe(0);
});

test("current row only becomes interactive after fully entering screen", async ({ page }) => {
  await startGame(page);

  const beforeVisible = await getSnapshot(page);
  expect(beforeVisible.currentRow.fullyVisible).toBe(false);

  await expect
    .poll(() => getSnapshot(page).then((state) => state.currentRow.fullyVisible))
    .toBe(true);
});

test("breaking a block clears old bullets and advances the row", async ({ page }) => {
  await startGame(page);
  await setEasyCurrentRow(page);

  await expect
    .poll(() => getSnapshot(page).then((state) => state.currentRow.fullyVisible))
    .toBe(true);

  const initial = await getSnapshot(page);
  const targetBlock =
    initial.currentRow.blocks.find((block) => block.entityType === "item") ?? initial.currentRow.blocks[0];
  const targetLane = targetBlock.lane;
  const initialTransitionClears = initial.transitionClears;
  const laneKey = targetLane === 0 ? "ArrowLeft" : "ArrowRight";
  await page.keyboard.press(laneKey);

  await expect
    .poll(async () => {
      const snapshot = await getSnapshot(page);
      return snapshot.transitionClears > initialTransitionClears;
    })
    .toBe(true);

  const advanced = await getSnapshot(page);
  expect(advanced.transitionClears).toBeGreaterThan(initialTransitionClears);
});

test("ultimate button exposes cooldown progress and ready state", async ({ page }) => {
  await startGame(page);

  const cooldown = page.locator("#ultimate-cooldown");
  const button = page.locator("#ultimate-button");
  const hudValue = page.locator("#ultimate-value");

  await expect(cooldown).toHaveText("還要 100%");
  await expect(hudValue).toHaveText("還要 100%");
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("data-ready", "false");

  await page.evaluate(() => {
    window.__gameDebug.setUltimateChargeForTest(100);
  });

  await expect(cooldown).toHaveText("READY!");
  await expect(hudValue).toHaveText("READY!");
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute("data-ready", "true");
});
