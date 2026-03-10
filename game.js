const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const leftButton = document.getElementById("left-button");
const rightButton = document.getElementById("right-button");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const scoreValue = document.getElementById("score-value");
const stageValue = document.getElementById("stage-value");
const hintValue = document.getElementById("hint-value");
const comboValue = document.getElementById("combo-value");

const W = canvas.width;
const H = canvas.height;
const LANES = [W * 0.3, W * 0.7];
const BLOCK_WIDTH = 132;
const BLOCK_HEIGHT = 88;
const HALF_BLOCK_HEIGHT = BLOCK_HEIGHT / 2;
const PLAYER_Y = H - 110;
const PLAYER_COLLISION_Y = PLAYER_Y - 4;
const TOTAL_ROWS = 10;
const ROW_SPEED = 2.35;
const ROW_START_Y = -70;
const PREVIEW_Y = 128;
const BULLET_SPEED = 11;
const FIRE_INTERVAL = 8;
const BULLET_DAMAGE = 3;
const MISS_PENALTY = 10;
const COMBO_REWARD = 8;
const BOSS_REWARD = { type: "mul", value: 2 };

const HINTS = [
  "先選要賺的那一邊，再持續壓住同跑道",
  "低血量方塊適合保守過排",
  "乘法方塊稀有，值得提前切道",
  "雙方塊排只要打爆一個就過關",
  "漏接會直接斷連擊，別貪太晚",
  "Boss 也要打到 0，不能只撐到線前",
];

const state = {
  running: false,
  troop: 12,
  combo: 0,
  rowsCompleted: 0,
  currentLane: 0,
  currentRow: null,
  nextRow: null,
  currentRowY: ROW_START_Y,
  bullets: [],
  fireCooldown: 0,
  flashFrames: 0,
  message: "",
  bossActive: false,
  boss: null,
  floaters: [],
  backgroundDrift: 0,
};

function roundedRectPath(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.arcTo(x + width, y, x + width, y + safeRadius, safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.arcTo(x + width, y + height, x + width - safeRadius, y + height, safeRadius);
  context.lineTo(x + safeRadius, y + height);
  context.arcTo(x, y + height, x, y + height - safeRadius, safeRadius);
  context.lineTo(x, y + safeRadius);
  context.arcTo(x, y, x + safeRadius, y, safeRadius);
  context.closePath();
}

function clampTroop(value) {
  return Math.max(0, Math.round(value));
}

function applyReward(current, reward) {
  if (reward.type === "mul") {
    return Math.round(current * reward.value);
  }
  return current + reward.value;
}

function formatReward(reward) {
  const number = Number.isInteger(reward.value) ? reward.value : reward.value.toFixed(1);
  return reward.type === "mul" ? `×${number}` : `+${number}`;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createReward(depth, highValue = false) {
  if (highValue) {
    if (Math.random() < 0.55) {
      return { type: "mul", value: Number((1.8 + depth * 0.04 + Math.random() * 0.4).toFixed(1)) };
    }
    return { type: "add", value: 12 + depth * 2 + Math.floor(Math.random() * 8) };
  }

  if (Math.random() < 0.22) {
    return { type: "mul", value: Number((1.3 + depth * 0.03 + Math.random() * 0.3).toFixed(1)) };
  }
  return { type: "add", value: 5 + depth * 2 + Math.floor(Math.random() * 6) };
}

function createBlock(lane, hp, reward) {
  return {
    lane,
    hp,
    maxHp: hp,
    rewardType: reward.type,
    rewardValue: reward.value,
    reward,
    state: "falling",
    hitFlash: 0,
    breakFrames: 0,
  };
}

function createSingleRow(index, lane) {
  const easyHp = 6 + index;
  return {
    index,
    hint: randomChoice(HINTS),
    blocks: [createBlock(lane, easyHp, createReward(index, false))],
  };
}

function createDualRow(index) {
  const lowLane = Math.random() < 0.5 ? 0 : 1;
  const highLane = lowLane === 0 ? 1 : 0;
  const lowHp = 6 + index + Math.floor(Math.random() * 3);
  const highHp = lowHp + 5 + Math.floor(Math.random() * 4);
  return {
    index,
    hint: randomChoice(HINTS),
    blocks: [
      createBlock(lowLane, lowHp, createReward(index, false)),
      createBlock(highLane, highHp, createReward(index + 1, true)),
    ],
  };
}

function createRow(index) {
  // First three rows always expose a very reachable option.
  if (index === 0) return createSingleRow(index, 0);
  if (index === 1) return createSingleRow(index, 1);
  if (index === 2) return createDualRow(index);

  const roll = Math.random();
  if (roll < 0.3) return createSingleRow(index, 0);
  if (roll < 0.6) return createSingleRow(index, 1);
  return createDualRow(index);
}

function createBoss() {
  return {
    hp: 90,
    maxHp: 90,
    rewardType: BOSS_REWARD.type,
    rewardValue: BOSS_REWARD.value,
    reward: BOSS_REWARD,
    state: "falling",
    y: -88,
    hitFlash: 0,
  };
}

function setOverlay(kicker, title, text, buttonText) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  restartButton.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function getCurrentHint() {
  if (state.bossActive) return "Boss 完整進場後才可受擊";
  if (state.currentRow) return state.currentRow.hint;
  return "選門開始";
}

function updateHud() {
  scoreValue.textContent = `${state.troop}`;
  const stage = state.bossActive ? TOTAL_ROWS : Math.min(state.rowsCompleted + 1, TOTAL_ROWS);
  stageValue.textContent = `${stage} / ${TOTAL_ROWS}`;
  hintValue.textContent = getCurrentHint();
  comboValue.textContent = `${state.combo}`;
}

function spawnBullet() {
  state.bullets.push({
    lane: state.currentLane,
    x: LANES[state.currentLane],
    y: PLAYER_Y - 36,
  });
}

function resetCombatState() {
  state.bullets = [];
  state.fireCooldown = 0;
  state.flashFrames = 0;
}

function pushFloater(text, x, y, color = "#ffffff") {
  state.floaters.push({
    text,
    x,
    y,
    color,
    life: 42,
    maxLife: 42,
  });
}

function startGame() {
  state.running = true;
  state.troop = 12;
  state.combo = 0;
  state.rowsCompleted = 0;
  state.currentLane = 0;
  state.currentRow = createRow(0);
  state.nextRow = createRow(1);
  state.currentRowY = ROW_START_Y;
  state.bossActive = false;
  state.boss = createBoss();
  state.message = "選門開始";
  resetCombatState();
  state.backgroundDrift = 0;
  updateHud();
  hideOverlay();
}

function finishGame(win, kicker, text) {
  state.running = false;
  setOverlay(kicker, win ? "Boss 被清空了" : "隊伍被打穿", text, "再玩一次");
}

function moveLane(direction) {
  if (!state.running) return;
  state.currentLane = Math.max(0, Math.min(1, state.currentLane + direction));
}

function rewardCombo() {
  if (state.combo > 0 && state.combo % 3 === 0) {
    state.troop += COMBO_REWARD;
    state.message += `  連擊獎勵 +${COMBO_REWARD}`;
  }
}

function completeCurrentRow() {
  resetCombatState();
  state.flashFrames = 14;
  state.rowsCompleted += 1;

  if (state.rowsCompleted >= TOTAL_ROWS) {
    state.currentRow = null;
    state.nextRow = null;
    state.bossActive = true;
    state.boss = createBoss();
    updateHud();
    return;
  }

  state.currentRow = state.nextRow;
  state.nextRow = createRow(state.rowsCompleted + 1);
  state.currentRowY = ROW_START_Y;
  updateHud();
}

function applyBlockReward(block) {
  state.troop = clampTroop(applyReward(state.troop, block.reward));
  state.combo += 1;
  state.message = `${block.lane === 0 ? "左" : "右"}方塊破壞 ${formatReward(block.reward)}`;
  block.state = "broken";
  block.breakFrames = 14;
  pushFloater(formatReward(block.reward), LANES[block.lane], state.currentRowY - 18, "#fef3c7");
  rewardCombo();
  updateHud();
  completeCurrentRow();
}

function missCurrentRow() {
  if (!state.currentRow) return;
  state.combo = 0;
  state.troop = clampTroop(state.troop - MISS_PENALTY);
  state.message = `MISS -${MISS_PENALTY}`;
  pushFloater(`MISS -${MISS_PENALTY}`, W / 2, PLAYER_COLLISION_Y - 20, "#ef476f");
  for (const block of state.currentRow.blocks) {
    if (block.state === "falling") block.state = "missed";
  }
  updateHud();
  if (state.troop <= 0) {
    finishGame(false, "失敗", "你漏掉了當前排，隊伍被打穿。");
    return;
  }
  completeCurrentRow();
}

function isFullyVisible(centerY, halfHeight) {
  return centerY - halfHeight >= 0 && centerY + halfHeight <= H;
}

function updateBullets() {
  state.fireCooldown -= 1;
  if (state.fireCooldown <= 0) {
    spawnBullet();
    state.fireCooldown = FIRE_INTERVAL;
  }

  state.bullets = state.bullets.filter((bullet) => bullet.y > -40);
  for (const bullet of state.bullets) {
    bullet.x = LANES[bullet.lane];
    bullet.y -= BULLET_SPEED;
  }
}

function hitCurrentRow() {
  if (!state.currentRow || !isFullyVisible(state.currentRowY, HALF_BLOCK_HEIGHT)) return;

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    const block = state.currentRow.blocks.find((item) => item.lane === bullet.lane && item.state === "falling");
    if (!block) continue;

    const dx = Math.abs(bullet.x - LANES[block.lane]);
    const dy = Math.abs(bullet.y - state.currentRowY);
    if (dx < BLOCK_WIDTH / 2 && dy < HALF_BLOCK_HEIGHT) {
      block.hp = Math.max(0, block.hp - BULLET_DAMAGE);
      block.hitFlash = 4;
      state.message = `${block.lane === 0 ? "左" : "右"}方塊 -${BULLET_DAMAGE}`;
      pushFloater(`-${BULLET_DAMAGE}`, LANES[block.lane], state.currentRowY - 8, "#ffffff");
      state.bullets.splice(i, 1);
      if (block.hp <= 0) {
        applyBlockReward(block);
        return;
      }
    }
  }
}

function hitBoss() {
  if (!state.boss || state.boss.state !== "falling") return;
  if (!isFullyVisible(state.boss.y, 74)) return;

  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = state.bullets[i];
    const dx = Math.abs(bullet.x - W / 2);
    const dy = Math.abs(bullet.y - state.boss.y);
    if (dx < 96 && dy < 74) {
      state.boss.hp = Math.max(0, state.boss.hp - BULLET_DAMAGE);
      state.boss.hitFlash = 5;
      state.message = `Boss -${BULLET_DAMAGE}`;
      pushFloater(`-${BULLET_DAMAGE}`, W / 2, state.boss.y - 18, "#fef3c7");
      state.bullets.splice(i, 1);
      if (state.boss.hp <= 0) {
        state.boss.state = "broken";
        resetCombatState();
        state.troop = clampTroop(applyReward(state.troop, state.boss.reward));
        state.message = `Boss 擊破 ${formatReward(state.boss.reward)}`;
        pushFloater(formatReward(state.boss.reward), W / 2, state.boss.y - 36, "#ffd166");
        updateHud();
        finishGame(true, "勝利", `你帶著 ${state.troop} 單位火力突破終點。`);
        return;
      }
    }
  }
}

function updateCurrentRow() {
  if (!state.currentRow) return;

  state.currentRowY += ROW_SPEED;
  for (const block of state.currentRow.blocks) {
    if (block.hitFlash > 0) block.hitFlash -= 1;
    if (block.breakFrames > 0) block.breakFrames -= 1;
  }

  hitCurrentRow();

  if (state.running && isFullyVisible(state.currentRowY, HALF_BLOCK_HEIGHT) && state.currentRowY >= PLAYER_COLLISION_Y) {
    const success = state.currentRow.blocks.some((block) => block.state === "broken");
    if (!success) {
      missCurrentRow();
    }
  }
}

function updateBoss() {
  if (!state.bossActive || !state.boss || state.boss.state !== "falling") return;

  state.boss.y += ROW_SPEED;
  if (state.boss.hitFlash > 0) state.boss.hitFlash -= 1;
  hitBoss();

  if (state.running && isFullyVisible(state.boss.y, 74) && state.boss.y >= PLAYER_COLLISION_Y) {
    state.combo = 0;
    state.troop = clampTroop(state.troop - 20);
    state.message = "Boss 衝撞 -20";
    updateHud();
    finishGame(false, "失敗", "Boss 沒有在撞線前被打爆。");
  }
}

function update() {
  state.floaters = state.floaters.filter((floater) => floater.life > 0);
  for (const floater of state.floaters) {
    floater.life -= 1;
    floater.y -= 0.9;
  }

  if (!state.running) return;

  if (state.flashFrames > 0) state.flashFrames -= 1;
  state.backgroundDrift += 0.8;
  updateBullets();

  if (state.bossActive) {
    updateBoss();
  } else {
    updateCurrentRow();
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, W, H);

  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#8ecae6");
  gradient.addColorStop(1, "#d7f5cf");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.22)";
  for (let i = 0; i < 8; i += 1) {
    const y = (i * 120 + state.backgroundDrift) % (H + 120) - 120;
    ctx.beginPath();
    ctx.ellipse(90 + i * 18, y, 64, 22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(20,33,61,0.15)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 0);
  ctx.lineTo(W * 0.5, H);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 6;
  ctx.setLineDash([22, 22]);
  ctx.beginPath();
  ctx.moveTo(W * 0.5, 0);
  ctx.lineTo(W * 0.5, H);
  ctx.stroke();
  ctx.setLineDash([]);
}

function getBlockColors(block) {
  if (block.rewardType === "mul") {
    return { fill: "#3a86ff", deep: "#1f57c3" };
  }
  return { fill: "#3fb68b", deep: "#18795c" };
}

function drawBlock(x, y, block, options = {}) {
  const { active = false, preview = false } = options;
  const { fill, deep } = getBlockColors(block);
  const scale = preview ? 0.72 : block.hitFlash > 0 ? 0.96 : 1;
  const width = BLOCK_WIDTH * scale;
  const height = BLOCK_HEIGHT * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = preview ? 0.45 : 1;

  ctx.fillStyle = block.hitFlash > 0 ? "#ffffff" : fill;
  roundedRectPath(ctx, -width / 2, -height / 2, width, height, 18);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = active ? 5 : 4;
  ctx.strokeRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);

  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(-width / 2 + 10, -height / 2 + 10, width - 20, 16);

  ctx.fillStyle = active ? "#fef3c7" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = preview ? "900 28px Avenir Next" : "900 36px Avenir Next";
  ctx.fillText(`${block.hp}`, 0, preview ? 0 : 2);
  ctx.font = preview ? "800 15px Avenir Next" : "800 18px Avenir Next";
  ctx.fillText(formatReward(block.reward), 0, preview ? 24 : 34);

  ctx.strokeStyle = deep;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-width / 2, height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawPreviewRow() {
  if (!state.nextRow || state.bossActive) return;

  ctx.fillStyle = "rgba(20,33,61,0.14)";
  roundedRectPath(ctx, 28, 34, W - 56, 92, 24);
  ctx.fill();
  ctx.fillStyle = "rgba(20,33,61,0.56)";
  ctx.font = "700 14px Avenir Next";
  ctx.textAlign = "center";
  ctx.fillText("NEXT", W / 2, 58);

  for (const block of state.nextRow.blocks) {
    drawBlock(LANES[block.lane], PREVIEW_Y, block, { preview: true });
  }
}

function drawCurrentRow() {
  if (!state.currentRow) return;

  for (const block of state.currentRow.blocks) {
    if (block.state === "broken" && block.breakFrames <= 0) continue;

    if (block.state === "broken") {
      ctx.save();
      ctx.globalAlpha = Math.max(0, block.breakFrames / 14);
      ctx.translate(0, (14 - block.breakFrames) * -0.5);
      drawBlock(LANES[block.lane], state.currentRowY, block, { active: block.lane === state.currentLane });
      ctx.restore();
      continue;
    }

    drawBlock(LANES[block.lane], state.currentRowY, block, {
      active: block.lane === state.currentLane,
    });
  }
}

function drawBoss() {
  if (!state.bossActive || !state.boss || state.boss.state !== "falling") return;

  ctx.save();
  ctx.translate(W / 2, state.boss.y);
  ctx.fillStyle = state.boss.hitFlash > 0 ? "#fef3c7" : "#14213d";
  roundedRectPath(ctx, -96, -74, 192, 148, 30);
  ctx.fill();

  ctx.fillStyle = "#f6bd60";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 38px Avenir Next";
  ctx.fillText(`${state.boss.hp}`, 0, 4);
  ctx.font = "800 18px Avenir Next";
  ctx.fillText(formatReward(state.boss.reward), 0, 36);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-76, -50, 152, 14);
  ctx.fillStyle = "#80ed99";
  ctx.fillRect(-76, -50, 152 * (state.boss.hp / state.boss.maxHp), 14);
  ctx.restore();
}

function drawPlayer() {
  const laneX = LANES[state.currentLane];
  ctx.save();
  ctx.translate(laneX, PLAYER_Y);

  if (state.flashFrames > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.arc(0, 0, 54 + state.flashFrames, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#14213d";
  roundedRectPath(ctx, -28, -34, 56, 68, 20);
  ctx.fill();

  ctx.fillStyle = "#f6bd60";
  ctx.beginPath();
  ctx.arc(0, -18, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#3fb68b";
  roundedRectPath(ctx, -34, 20, 68, 20, 10);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 22px Avenir Next";
  ctx.textAlign = "center";
  ctx.fillText(state.troop, 0, 68);
  ctx.restore();
}

function drawBullets() {
  ctx.fillStyle = "#ffd166";
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFloaters() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 20px Avenir Next";
  for (const floater of state.floaters) {
    ctx.save();
    ctx.globalAlpha = floater.life / floater.maxLife;
    ctx.fillStyle = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
    ctx.restore();
  }
}

function drawCollisionLine() {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(24, PLAYER_COLLISION_Y);
  ctx.lineTo(W - 24, PLAYER_COLLISION_Y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMessage() {
  ctx.fillStyle = "rgba(20,33,61,0.72)";
  ctx.fillRect(20, H - 62, W - 40, 36);
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 18px Avenir Next";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.message, W / 2, H - 44);
}

function render() {
  drawBackground();
  drawPreviewRow();
  drawCurrentRow();
  drawBoss();
  drawBullets();
  drawFloaters();
  drawCollisionLine();
  drawPlayer();
  drawMessage();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    moveLane(-1);
  } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    moveLane(1);
  } else if (event.key === " ") {
    startGame();
  }
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
leftButton.addEventListener("click", () => moveLane(-1));
rightButton.addEventListener("click", () => moveLane(1));
canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  moveLane(x < rect.width / 2 ? -1 : 1);
});

state.currentRow = createRow(0);
state.nextRow = createRow(1);
state.boss = createBoss();
updateHud();
render();
loop();
