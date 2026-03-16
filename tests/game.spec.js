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

async function expectHandheldLayoutFits(page, width, height) {
  await page.setViewportSize({ width, height });
  await startGame(page);

  const metrics = await page.evaluate(() => {
    const scrollingElement = document.scrollingElement;
    const gamePanel = document.querySelector(".game-panel");
    const gameFrame = document.querySelector(".game-frame");
    const touchControls = document.querySelector(".touch-controls");
    const guide = document.querySelector(".layer-guide");

    return {
      scrollHeight: scrollingElement?.scrollHeight ?? 0,
      clientHeight: scrollingElement?.clientHeight ?? 0,
      scrollWidth: scrollingElement?.scrollWidth ?? 0,
      clientWidth: scrollingElement?.clientWidth ?? 0,
      panelBottom: gamePanel?.getBoundingClientRect().bottom ?? 0,
      frameBottom: gameFrame?.getBoundingClientRect().bottom ?? 0,
      controlsBottom: touchControls?.getBoundingClientRect().bottom ?? 0,
      controlsTop: touchControls?.getBoundingClientRect().top ?? 0,
      controlsWidth: touchControls?.getBoundingClientRect().width ?? 0,
      frameWidth: gameFrame?.getBoundingClientRect().width ?? 0,
      guideHeight: guide?.getBoundingClientRect().height ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
      handheld: document.body.dataset.handheld,
    };
  });

  expect(metrics.handheld).toBe("true");
  expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.panelBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.frameBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.controlsBottom).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.controlsTop).toBeGreaterThan(metrics.guideHeight);
  expect(metrics.controlsWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  expect(metrics.frameWidth).toBeLessThanOrEqual(metrics.viewportWidth);
}

test("loads and starts a playable run", async ({ page }) => {
  await startGame(page);

  await expect(page.locator("#overlay")).toHaveClass(/hidden/);

  const snapshot = await getSnapshot(page);
  expect(snapshot.running).toBe(true);
  expect(snapshot.currentRow).not.toBeNull();
  expect(snapshot.currentRow.blocks.length).toBeGreaterThan(0);
});

test("13-inch desktop layout prioritizes the playfield", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/index.html");
  await page.waitForFunction(() => Boolean(window.__gameDebug));

  await expect.poll(() => page.locator("body").getAttribute("data-compact-desktop")).toBe("true");

  const metrics = await page.evaluate(() => {
    const gamePanel = document.querySelector(".game-panel");
    const frame = document.querySelector(".game-frame");
    const guide = document.querySelector(".layer-guide");
    const touchControls = document.querySelector(".touch-controls");
    const playArea = document.querySelector(".play-area");

    return {
      panelHeight: gamePanel?.getBoundingClientRect().height ?? 0,
      panelWidth: gamePanel?.getBoundingClientRect().width ?? 0,
      frameHeight: frame?.getBoundingClientRect().height ?? 0,
      frameWidth: frame?.getBoundingClientRect().width ?? 0,
      frameLeft: frame?.getBoundingClientRect().left ?? 0,
      guideHeight: guide?.getBoundingClientRect().height ?? 0,
      touchHeight: touchControls?.getBoundingClientRect().height ?? 0,
      touchWidth: touchControls?.getBoundingClientRect().width ?? 0,
      touchLeft: touchControls?.getBoundingClientRect().left ?? 0,
      playAreaWidth: playArea?.getBoundingClientRect().width ?? 0,
      viewportHeight: window.innerHeight,
    };
  });

  expect(metrics.frameHeight).toBeGreaterThan(600);
  expect(metrics.panelWidth).toBeGreaterThan(600);
  expect(Math.abs(metrics.frameLeft - metrics.touchLeft)).toBeLessThan(8);
  expect(metrics.panelHeight).toBeLessThanOrEqual(metrics.viewportHeight);
  expect(metrics.guideHeight).toBeGreaterThan(30);
  expect(metrics.touchWidth).toBeGreaterThan(metrics.frameWidth * 0.92);
  expect(metrics.touchWidth).toBeLessThanOrEqual(metrics.frameWidth * 1.02);
  expect(metrics.playAreaWidth).toBeGreaterThanOrEqual(metrics.frameWidth);
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

test("layer guide shows current layer and per-layer progress", async ({ page }) => {
  await startGame(page);

  const current = page.locator("#layer-guide-current");
  const stage = page.locator("#layer-guide-stage");
  const fill = page.locator("#layer-guide-fill");
  const activeDot = page.locator('.layer-guide__dot[data-state="current"]');

  await expect(current).toHaveText("第1層");
  await expect(stage).toHaveText("1 / 20");
  await expect(activeDot).toHaveCount(1);

  const width = await fill.evaluate((node) => node.style.width);
  expect(width).not.toBe("0%");
});

test("generated non-boss rows always include at least one reward block", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => Boolean(window.__gameDebug));

  const rows = await page.evaluate(() => window.__gameDebug.sampleRowsForTest(40, 0));

  for (const row of rows) {
    expect(row.blocks.some((block) => block.entityType === "item" && block.rewardValue > 0)).toBe(true);
  }
});

test("dual reward rows preserve a clear low-risk high-reward split", async ({ page }) => {
  await page.goto("/index.html");
  await page.waitForFunction(() => Boolean(window.__gameDebug));

  const rows = await page.evaluate(() => window.__gameDebug.sampleRowsForTest(60, 0));
  const dualItemRows = rows.filter((row) => row.blocks.filter((block) => block.entityType === "item").length === 2);

  expect(dualItemRows.length).toBeGreaterThan(0);
  for (const row of dualItemRows) {
    const [a, b] = row.blocks.filter((block) => block.entityType === "item");
    expect(Math.abs(a.rewardValue - b.rewardValue) > 0.2 || a.rewardType !== b.rewardType).toBe(true);
  }
});

test("ultimate stays locked below 100 percent charge", async ({ page }) => {
  await startGame(page);

  await page.evaluate(() => {
    window.__gameDebug.setUltimateChargeForTest(80);
  });

  await expect(page.locator("#ultimate-cooldown")).toHaveText("還要 20%");
  await expect(page.locator("#ultimate-value")).toHaveText("還要 20%");
  await expect(page.locator("#ultimate-button")).toBeDisabled();
  await expect(page.locator("#ultimate-button")).toHaveAttribute("data-ready", "false");
});

test("iphone 12 viewport fits the whole game without page scrolling", async ({ page }) => {
  await expectHandheldLayoutFits(page, 390, 844);
});

test("recent iPhone viewport classes all fit without overflow", async ({ page }) => {
  const sizes = [
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 393, height: 852 },
    { width: 428, height: 926 },
    { width: 430, height: 932 },
  ];

  for (const size of sizes) {
    await expectHandheldLayoutFits(page, size.width, size.height);
  }
});
