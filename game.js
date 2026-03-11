const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");
const leftButton = document.getElementById("left-button");
const rightButton = document.getElementById("right-button");
const ultimateButton = document.getElementById("ultimate-button");
const overlay = document.getElementById("overlay");
const overlayKicker = document.getElementById("overlay-kicker");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const scoreValue = document.getElementById("score-value");
const stageValue = document.getElementById("stage-value");
const hintValue = document.getElementById("hint-value");
const comboValue = document.getElementById("combo-value");
const boostValue = document.getElementById("boost-value");
const ultimateValue = document.getElementById("ultimate-value");
const volumeSlider = document.getElementById("volume-slider");
const appModeLabel = document.getElementById("app-mode-label");
const networkStatus = document.getElementById("network-status");
const installButton = document.getElementById("install-button");
const updateButton = document.getElementById("update-button");
const OFFLINE_CACHE_VERSION = "20260311-182500";
const launchParams = new URLSearchParams(window.location.search);
let deferredInstallPrompt = null;
let waitingServiceWorker = null;
let shouldReloadForUpdate = false;

const W = canvas.width;
const H = canvas.height;
const LANES = [W * 0.3, W * 0.7];
const BLOCK_WIDTH = 132;
const BLOCK_HEIGHT = 88;
const HALF_BLOCK_HEIGHT = BLOCK_HEIGHT / 2;
const PLAYER_Y = H - 110;
const PLAYER_COLLISION_Y = PLAYER_Y - 4;
const TOTAL_ROWS = 20;
const ROW_SPEED = 2.35;
const ROW_START_Y = -70;
const PREVIEW_Y = 128;
const BULLET_SPEED = 11;
const FIRE_INTERVAL = 8;
const BULLET_DAMAGE = 3;
const MISS_PENALTY = 10;
const COMBO_REWARD = 8;
const BOSS_REWARD = { type: "mul", value: 2 };
const RAPID_FIRE_DURATION = 320;
const POWER_SHOT_DURATION = 220;
const ELEMENT_DURATION = 260;
const ULTIMATE_MAX = 100;
const ULTIMATE_EMERGENCY_THRESHOLD = 45;
const TREASURE_RUSH_DURATION = 240;
const FACTION_NAME = "小砲台";
const ITEM_NAME = "寶物方塊";
const ENEMY_NAME = "小怪獸";
const BOSS_NAME = "大怪獸";
const WEAPON_FAMILY = "玩具元素砲";
const ENEMY_TYPES = {
  runner: {
    name: "衝刺怪",
    speed: 1.55,
    hpScale: 1.05,
    armor: 0,
    slowImmune: false,
    poisonImmune: false,
    burnResist: 0,
    color: "#f97316",
    canDash: true,
  },
  tank: {
    name: "硬殼怪",
    speed: 0.78,
    hpScale: 1.85,
    armor: 2,
    slowImmune: false,
    poisonImmune: false,
    burnResist: 0,
    color: "#8b5cf6",
    canDash: false,
  },
  blob: {
    name: "黏黏怪",
    speed: 1.02,
    hpScale: 1.35,
    armor: 0,
    slowImmune: false,
    poisonImmune: true,
    burnResist: 0,
    color: "#22c55e",
    canDash: false,
    splits: true,
  },
  flyer: {
    name: "飛飛怪",
    speed: 1.3,
    hpScale: 1.12,
    armor: 0,
    slowImmune: true,
    poisonImmune: false,
    burnResist: 0.5,
    color: "#06b6d4",
    canDash: false,
  },
  mini: {
    name: "小小怪",
    speed: 1.42,
    hpScale: 0.72,
    armor: 0,
    slowImmune: false,
    poisonImmune: false,
    burnResist: 0,
    color: "#4ade80",
    canDash: false,
  },
};
const CRYSTAL_COLORS = {
  green: { fill: "#22c55e", deep: "#166534" },
  blue: { fill: "#3b82f6", deep: "#1d4ed8" },
  red: { fill: "#ef4444", deep: "#991b1b" },
};
const STAGE_THEMES = [
  { name: "糖果草原", rewardBias: 2, mulBias: 0.02, perkBias: 0.02, enemyBias: "runner" },
  { name: "流星夜空", rewardBias: 3, mulBias: 0.08, perkBias: 0.05, enemyBias: "flyer" },
  { name: "火山寶窟", rewardBias: 5, mulBias: 0.06, perkBias: 0.08, enemyBias: "tank" },
  { name: "彩虹風暴", rewardBias: 4, mulBias: 0.1, perkBias: 0.1, enemyBias: "blob" },
];

const HINTS = [
  `${ENEMY_NAME}突破就直接輸，${ITEM_NAME}漏掉只是少賺`,
  `先處理會撞線的${ENEMY_NAME}，再考慮高價值${ITEM_NAME}`,
  "乘法寶物比較稀有，值得先去拿",
  "兩邊一起掉時，先看哪邊比較危險",
  "護盾能幫你擋一下，但擋不住小怪獸突破",
  "火焰會一路燒，冰會讓怪慢下來",
  "雷射打得直又快，毒泡會慢慢扣血",
  "衝刺怪跑很快，硬殼怪比較耐打",
  "黏黏怪不怕毒，飛飛怪比較不怕冰",
  "精英怪更大更硬，打倒前不要貪寶物",
  "有些黏黏怪會分裂，衝刺怪還會突然暴衝",
  `${BOSS_NAME}也要打到 0，不能只撐到線前`,
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
  currentRowResolved: false,
  bullets: [],
  fireCooldown: 0,
  flashFrames: 0,
  message: "",
  bossActive: false,
  boss: null,
  floaters: [],
  particles: [],
  backgroundDrift: 0,
  rapidFireFrames: 0,
  powerShotFrames: 0,
  fireAmmoFrames: 0,
  laserAmmoFrames: 0,
  iceAmmoFrames: 0,
  poisonAmmoFrames: 0,
  shieldCharges: 0,
  ultimateCharge: 0,
  ultimateFlashFrames: 0,
  transitionClears: 0,
  slowMoFrames: 0,
  shakeFrames: 0,
  shakePower: 0,
  frameCount: 0,
  treasureRushFrames: 0,
  pickupChain: 0,
  bestScore: 0,
  bestStage: 0,
};

const audio = {
  ctx: null,
  master: null,
  music: null,
  sfx: null,
  nextBgmTime: 0,
  bgmStep: 0,
};

function ensureAudio() {
  if (audio.ctx) return audio.ctx;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audio.ctx = new AudioContextClass();
  audio.master = audio.ctx.createGain();
  audio.music = audio.ctx.createGain();
  audio.sfx = audio.ctx.createGain();
  audio.master.gain.value = 0.8;
  audio.music.gain.value = 0.22;
  audio.sfx.gain.value = 0.42;
  audio.music.connect(audio.master);
  audio.sfx.connect(audio.master);
  audio.master.connect(audio.ctx.destination);
  if (volumeSlider) {
    audio.master.gain.value = Number(volumeSlider.value) / 100;
  }
  return audio.ctx;
}

function setMasterVolume(value) {
  const ctx = ensureAudio();
  if (!ctx) return;
  audio.master.gain.value = Math.max(0, Math.min(1, value));
}

function resumeAudio() {
  const ctx = ensureAudio();
  if (!ctx) return Promise.resolve();
  if (ctx.state === "suspended") return ctx.resume();
  return Promise.resolve();
}

function unlockAudio() {
  return resumeAudio();
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.matchMedia("(display-mode: fullscreen)").matches || window.navigator.standalone === true;
}

function isHandheldLayout() {
  return window.matchMedia("(max-width: 1024px)").matches || window.matchMedia("(pointer: coarse)").matches;
}

function updateAppChrome() {
  const standalone = isStandaloneMode();
  const handheld = isHandheldLayout();
  document.body.dataset.displayMode = standalone ? "standalone" : "browser";
  document.body.dataset.handheld = handheld ? "true" : "false";

  if (appModeLabel) {
    appModeLabel.textContent = handheld ? (standalone ? "App 模式" : "瀏覽器模式") : "桌面網頁";
  }

  if (networkStatus) {
    networkStatus.textContent = navigator.onLine ? "已連線" : "離線可玩";
    networkStatus.dataset.online = navigator.onLine ? "true" : "false";
  }

  if (installButton) {
    installButton.hidden = !handheld || standalone || !deferredInstallPrompt;
  }

  if (updateButton) {
    updateButton.hidden = !handheld || !waitingServiceWorker;
  }
}

async function promptInstall() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result.outcome !== "accepted") {
    installButton.hidden = false;
  }
  deferredInstallPrompt = null;
  updateAppChrome();
}

function requestServiceWorkerUpdate() {
  if (!waitingServiceWorker) return;
  waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
}

function initAppExperience() {
  window.matchMedia("(display-mode: standalone)").addEventListener("change", updateAppChrome);
  window.matchMedia("(display-mode: fullscreen)").addEventListener("change", updateAppChrome);
  window.matchMedia("(max-width: 1024px)").addEventListener("change", updateAppChrome);
  window.matchMedia("(pointer: coarse)").addEventListener("change", updateAppChrome);
  window.addEventListener("online", updateAppChrome);
  window.addEventListener("offline", updateAppChrome);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateAppChrome();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateAppChrome();
  });
  installButton?.addEventListener("click", () => {
    promptInstall().catch((error) => {
      console.error("Install prompt failed", error);
    });
  });
  updateButton?.addEventListener("click", requestServiceWorkerUpdate);
  updateAppChrome();
}

function installAudioUnlock() {
  const unlockOnce = () => {
    unlockAudio().finally(() => {
      window.removeEventListener("pointerdown", unlockOnce);
      window.removeEventListener("touchstart", unlockOnce);
      window.removeEventListener("keydown", unlockOnce);
    });
  };
  window.addEventListener("pointerdown", unlockOnce, { passive: true });
  window.addEventListener("touchstart", unlockOnce, { passive: true });
  window.addEventListener("keydown", unlockOnce);
}

function playTone(freq, duration, options = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const { type = "sine", volume = 0.08, when = 0, slideTo = null, bus = "sfx", attack = 0.01 } = options;
  const start = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(bus === "music" ? audio.music : audio.sfx);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playNoise(duration, options = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;
  const { volume = 0.05, when = 0, highpass = null, lowpass = null, bus = "sfx" } = options;
  const start = ctx.currentTime + when;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const source = ctx.createBufferSource();
  let node = source;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.buffer = buffer;
  if (highpass) {
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = highpass;
    node.connect(hp);
    node = hp;
  }
  if (lowpass) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = lowpass;
    node.connect(lp);
    node = lp;
  }
  node.connect(gain);
  gain.connect(bus === "music" ? audio.music : audio.sfx);
  source.start(start);
  source.stop(start + duration);
}

function playChord(freqs, duration, options = {}) {
  for (const [index, freq] of freqs.entries()) {
    playTone(freq, duration, {
      ...options,
      volume: (options.volume ?? 0.03) * (index === 0 ? 1 : 0.72),
      when: (options.when ?? 0) + index * 0.01,
    });
  }
}

function playSfx(kind) {
  resumeAudio();
  if (kind === "move") {
    playTone(320, 0.08, { type: "square", volume: 0.03, slideTo: 420 });
  } else if (kind === "shoot") {
    playTone(540, 0.05, { type: "square", volume: 0.018, slideTo: 300 });
  } else if (kind === "hit") {
    playTone(220, 0.07, { type: "triangle", volume: 0.03, slideTo: 160 });
  } else if (kind === "reward") {
    playTone(660, 0.12, { type: "triangle", volume: 0.05 });
    playTone(880, 0.12, { type: "triangle", volume: 0.04, when: 0.06 });
  } else if (kind === "perk") {
    playTone(520, 0.08, { type: "square", volume: 0.04 });
    playTone(780, 0.12, { type: "triangle", volume: 0.035, when: 0.05 });
  } else if (kind === "enemyBreak") {
    playTone(180, 0.2, { type: "sawtooth", volume: 0.065, slideTo: 58, attack: 0.006 });
    playTone(94, 0.24, { type: "triangle", volume: 0.055, slideTo: 42, attack: 0.006 });
    playTone(280, 0.12, { type: "square", volume: 0.03, when: 0.02, slideTo: 160, attack: 0.005 });
    playNoise(0.18, { volume: 0.042, highpass: 650, lowpass: 3200 });
    playNoise(0.24, { volume: 0.028, lowpass: 180, when: 0.01 });
  } else if (kind === "ultimate") {
    playTone(240, 0.18, { type: "sawtooth", volume: 0.06 });
    playTone(360, 0.22, { type: "sawtooth", volume: 0.055, when: 0.05 });
    playTone(520, 0.28, { type: "triangle", volume: 0.05, when: 0.1 });
    playNoise(0.22, { volume: 0.05, highpass: 400 });
  } else if (kind === "danger") {
    playTone(180, 0.18, { type: "square", volume: 0.04 });
    playTone(140, 0.18, { type: "square", volume: 0.03, when: 0.12 });
  } else if (kind === "win") {
    playTone(523, 0.16, { type: "triangle", volume: 0.06 });
    playTone(659, 0.16, { type: "triangle", volume: 0.05, when: 0.1 });
    playTone(784, 0.24, { type: "triangle", volume: 0.06, when: 0.22 });
  } else if (kind === "lose") {
    playTone(220, 0.16, { type: "sawtooth", volume: 0.05, slideTo: 140 });
    playTone(160, 0.28, { type: "sawtooth", volume: 0.045, when: 0.14, slideTo: 90 });
  }
}

function scheduleBgm() {
  const ctx = ensureAudio();
  if (!ctx || !state.running) return;
  if (ctx.state === "suspended") return;
  const melody = [392, 440, 523, 587, 523, 440, 392, 330];
  const bass = [196, 220, 174.6, 146.8, 196, 220, 174.6, 146.8];
  const chords = [
    [392, 493.9, 587.3],
    [440, 523.3, 659.3],
    [349.2, 440, 523.3],
    [293.7, 392, 493.9],
  ];
  while (audio.nextBgmTime < ctx.currentTime + 0.6) {
    const step = audio.bgmStep % melody.length;
    const note = melody[step];
    const when = audio.nextBgmTime - ctx.currentTime;
    playTone(note, 0.18, { type: "triangle", volume: 0.03, when, bus: "music", attack: 0.005 });
    playTone(note * 2, 0.08, { type: "sine", volume: 0.008, when: when + 0.09, bus: "music", attack: 0.004 });
    playTone(bass[step], 0.24, { type: "sine", volume: 0.022, when, bus: "music", attack: 0.006 });
    if (step % 2 === 0) {
      playChord(chords[Math.floor(step / 2) % chords.length], 0.34, {
        type: "triangle",
        volume: 0.018,
        when,
        bus: "music",
        attack: 0.02,
      });
    }
    if (step % 4 === 0) {
      playNoise(0.05, { volume: 0.012, highpass: 1800, lowpass: 5200, when, bus: "music" });
      playTone(120, 0.08, { type: "sine", volume: 0.015, when, bus: "music", attack: 0.004 });
    } else if (step % 2 === 0) {
      playNoise(0.035, { volume: 0.008, highpass: 2500, lowpass: 6000, when, bus: "music" });
    }
    audio.nextBgmTime += 0.28;
    audio.bgmStep += 1;
  }
}

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

function getStageTheme(index) {
  return STAGE_THEMES[Math.min(STAGE_THEMES.length - 1, Math.floor(index / 5))];
}

function loadBestProgress() {
  try {
    state.bestScore = Number(window.localStorage.getItem("number-rush-best-score") || 0);
    state.bestStage = Number(window.localStorage.getItem("number-rush-best-stage") || 0);
  } catch {
    state.bestScore = 0;
    state.bestStage = 0;
  }
}

function persistBestProgress() {
  try {
    window.localStorage.setItem("number-rush-best-score", String(state.bestScore));
    window.localStorage.setItem("number-rush-best-stage", String(state.bestStage));
  } catch {
    // Ignore storage failures in restricted browsers.
  }
}

function createReward(depth, highValue = false, theme = getStageTheme(depth)) {
  if (highValue) {
    if (Math.random() < 0.55 + theme.mulBias) {
      return { type: "mul", value: Number((1.7 + depth * 0.025 + Math.random() * 0.35 + theme.mulBias).toFixed(1)) };
    }
    return { type: "add", value: 10 + depth + theme.rewardBias + Math.floor(Math.random() * 8) };
  }

  if (Math.random() < 0.22 + theme.mulBias * 0.5) {
    return { type: "mul", value: Number((1.25 + depth * 0.018 + Math.random() * 0.24 + theme.mulBias * 0.5).toFixed(1)) };
  }
  return { type: "add", value: 5 + theme.rewardBias + Math.floor(depth * 0.8) + Math.floor(Math.random() * 6) };
}

function createPerk(depth, highValue = false, theme = getStageTheme(depth)) {
  const roll = Math.random();
  if (highValue && roll < 0.15 + theme.perkBias) return "laser";
  if (highValue && roll < 0.29 + theme.perkBias) return "power";
  if (highValue && roll < 0.43 + theme.perkBias) return "fire";
  if (roll < 0.06 + depth * 0.005) return "shield";
  if (roll < 0.11 + depth * 0.008 + theme.perkBias * 0.5) return "rapid";
  if (roll < 0.15 + depth * 0.008 + theme.perkBias * 0.6) return "ice";
  if (roll < 0.19 + depth * 0.009 + theme.perkBias * 0.8) return "poison";
  return null;
}

function createBlock(lane, hp, reward, entityType = "item") {
  return {
    lane,
    hp,
    maxHp: hp,
    entityType,
    rewardType: reward.type,
    rewardValue: reward.value,
    reward,
    perk: null,
    state: "falling",
    hitFlash: 0,
    breakFrames: 0,
    burnFrames: 0,
    poisonFrames: 0,
    slowFrames: 0,
    statusTick: 0,
    enemyType: null,
    enemyStats: null,
    isElite: false,
    hasSplit: false,
    dashFrames: 0,
    dashCooldown: 0,
    crystalColor: null,
    sizeScale: 1,
  };
}

function createItemBlock(lane, hp, reward, options = {}) {
  const { big = false, superCrystal = false } = options;
  const block = createBlock(lane, hp, reward, "item");
  if (reward.type === "mul") {
    block.crystalColor = randomChoice(superCrystal ? ["blue", "blue", "red"] : ["blue", "red"]);
  } else {
    block.crystalColor = randomChoice(superCrystal ? ["green", "green", "red", "blue", "green"] : ["green", "green", "red", "blue"]);
  }
  block.sizeScale =
    block.crystalColor === "green"
      ? superCrystal
        ? 1.45
        : big
          ? 1.3
          : 1.18
      : block.crystalColor === "red"
        ? superCrystal
          ? 1.34
          : big
            ? 1.22
            : 1.08
        : superCrystal
          ? 1.38
          : big
            ? 1.24
            : 1.1;
  return block;
}

function createEnemyBlock(index, lane, options = {}) {
  const { preferFast = false, forcedType = null, elite = false, theme = getStageTheme(index) } = options;
  const pool =
    index < 4
      ? ["runner", "runner", "blob"]
      : preferFast
        ? ["runner", "runner", "flyer", "blob", "tank", theme.enemyBias]
        : ["runner", "blob", "tank", "flyer", theme.enemyBias];
  const enemyType = forcedType ?? randomChoice(pool);
  const enemyStats = ENEMY_TYPES[enemyType];
  const baseHp = 7 + Math.floor(index * 0.8) + Math.floor(Math.random() * 4);
  const hp = Math.max(4, Math.round(baseHp * enemyStats.hpScale * (elite ? 1.8 : 1)));
  const enemy = createBlock(lane, hp, { type: "add", value: 0 }, "enemy");
  enemy.enemyType = enemyType;
  enemy.enemyStats = enemyStats;
  enemy.isElite = elite;
  enemy.dashCooldown = enemyStats.canDash ? 56 + Math.floor(Math.random() * 26) : 0;
  return enemy;
}

function createSingleRow(index, lane) {
  const theme = getStageTheme(index);
  const easyHp = 6 + Math.floor(index * 0.75);
  const reward = createReward(index, false, theme);
  const block = createItemBlock(lane, easyHp, reward, { big: reward.value >= 8 });
  block.perk = createPerk(index, false, theme);
  return {
    index,
    hint: `${theme.name}：${randomChoice(HINTS)}`,
    blocks: [block],
  };
}

function createDualRow(index) {
  const theme = getStageTheme(index);
  const lowLane = Math.random() < 0.5 ? 0 : 1;
  const highLane = lowLane === 0 ? 1 : 0;
  const lowHp = 6 + Math.floor(index * 0.75) + Math.floor(Math.random() * 3);
  const highHp = lowHp + 5 + Math.floor(Math.random() * 4);
  const lowBlock = createItemBlock(lowLane, lowHp, createReward(index, false, theme), { big: true });
  const highBlock = createItemBlock(highLane, highHp, createReward(index + 1, true, theme), {
    big: true,
    superCrystal: true,
  });
  lowBlock.perk = createPerk(index, false, theme);
  highBlock.perk = createPerk(index, true, theme);
  return {
    index,
    hint: `${theme.name}：左右都很香，快選一邊`,
    blocks: [lowBlock, highBlock],
  };
}

function createEnemyRow(index, lane) {
  const theme = getStageTheme(index);
  const enemy = createEnemyBlock(index, lane, { preferFast: true, theme });
  return {
    index,
    hint: `${theme.name}：${enemy.enemyStats.name}來了，沒打掉就直接輸`,
    blocks: [enemy],
  };
}

function createDoubleEnemyRow(index) {
  const theme = getStageTheme(index);
  const leftEnemy = createEnemyBlock(index + 1, 0, { preferFast: true, theme });
  const rightEnemy = createEnemyBlock(index + 2, 1, { preferFast: true, theme });
  return {
    index,
    hint: `${theme.name}：${leftEnemy.enemyStats.name}和${rightEnemy.enemyStats.name}一起衝下來了`,
    blocks: [leftEnemy, rightEnemy],
  };
}

function createEliteEnemyRow(index) {
  const theme = getStageTheme(index);
  const lane = Math.random() < 0.5 ? 0 : 1;
  const forcedType = randomChoice(["tank", "runner", "flyer"]);
  const enemy = createEnemyBlock(index + 2, lane, { preferFast: true, forcedType, elite: true, theme });
  return {
    index,
    hint: `${theme.name}：精英${enemy.enemyStats.name}來了，先把它打掉`,
    blocks: [enemy],
  };
}

function createMixedRow(index) {
  const theme = getStageTheme(index);
  const enemyLane = Math.random() < 0.5 ? 0 : 1;
  const itemLane = enemyLane === 0 ? 1 : 0;
  const itemHp = 7 + Math.floor(index * 0.45) + Math.floor(Math.random() * 3);
  const enemy = createEnemyBlock(index + 1, enemyLane, { preferFast: true, theme });
  const item = createItemBlock(itemLane, itemHp, createReward(index + 1, true, theme), {
    big: true,
    superCrystal: index > 8,
  });
  item.perk = createPerk(index + 1, true, theme);
  return {
    index,
    hint: `${theme.name}：${enemy.enemyStats.name}優先，安全後再回收${ITEM_NAME}`,
    blocks: [enemy, item],
  };
}

function createJackpotRow(index) {
  const theme = getStageTheme(index);
  const leftBlock = createItemBlock(0, 7 + Math.floor(index * 0.55), createReward(index + 2, true, theme), {
    big: true,
    superCrystal: true,
  });
  const rightBlock = createItemBlock(1, 9 + Math.floor(index * 0.65), createReward(index + 3, true, theme), {
    big: true,
    superCrystal: true,
  });
  leftBlock.perk = createPerk(index + 1, true, theme);
  rightBlock.perk = createPerk(index + 2, true, theme);
  return {
    index,
    hint: `${theme.name}：寶藏雨來了，這排超肥`,
    blocks: [leftBlock, rightBlock],
  };
}

function createGauntletRow(index) {
  const theme = getStageTheme(index);
  const enemy = createEnemyBlock(index + 2, 0, {
    preferFast: true,
    elite: index > 9,
    forcedType: randomChoice(["runner", "tank", "flyer"]),
    theme,
  });
  const item = createItemBlock(1, 10 + Math.floor(index * 0.7), createReward(index + 2, true, theme), {
    big: true,
    superCrystal: true,
  });
  item.perk = randomChoice(["laser", "power", "fire", "ice", "poison"]);
  return {
    index,
    hint: `${theme.name}：先扛住猛怪，再拿超值寶藏`,
    blocks: [enemy, item],
  };
}

function createRow(index) {
  if (index === 0) return createSingleRow(index, 0);
  if (index === 1) return createSingleRow(index, 1);
  if (index === 2) return createMixedRow(index);
  if (index === 3) return createDoubleEnemyRow(index);
  if (index === 4 || index === 9 || index === 14) return createJackpotRow(index);
  if (index === 7 || index === 13 || index === 18) return createEliteEnemyRow(index);
  if (index === 11 || index === 16) return createGauntletRow(index);

  const roll = Math.random();
  if (roll < 0.16) return createSingleRow(index, 0);
  if (roll < 0.32) return createSingleRow(index, 1);
  if (roll < 0.46) return createMixedRow(index);
  if (roll < 0.58) return createJackpotRow(index);
  if (roll < 0.78) return createEnemyRow(index, Math.random() < 0.5 ? 0 : 1);
  if (roll < 0.86) return createEliteEnemyRow(index);
  if (roll < 0.92) return createDoubleEnemyRow(index);
  if (roll < 0.97) return createGauntletRow(index);
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
    burnFrames: 0,
    poisonFrames: 0,
    slowFrames: 0,
    statusTick: 0,
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
  if (state.treasureRushFrames > 0) return `寶藏狂熱中，現在打寶物更賺`;
  if (state.bossActive) return `${BOSS_NAME}完整進場後才可受擊`;
  if (state.currentRow) return state.currentRow.hint;
  return `${FACTION_NAME}出發`;
}

function getElementMode() {
  if (state.laserAmmoFrames > 0) return "laser";
  if (state.fireAmmoFrames > 0) return "fire";
  if (state.iceAmmoFrames > 0) return "ice";
  if (state.poisonAmmoFrames > 0) return "poison";
  return null;
}

function getWeaponTitle() {
  const elementMode = getElementMode();
  const baseMode = state.powerShotFrames > 0 ? "重砲" : state.rapidFireFrames > 0 ? "快射" : "";
  const elementTitle =
    elementMode === "laser"
      ? "雷射"
      : elementMode === "fire"
        ? "火焰"
        : elementMode === "ice"
          ? "冰霜"
        : elementMode === "poison"
            ? "毒泡"
            : "";
  if (state.treasureRushFrames > 0) return `寶藏狂熱 ${Math.ceil(state.treasureRushFrames / 30)}`;
  if (baseMode && elementTitle) return `${baseMode}+${elementTitle}`;
  if (baseMode) return baseMode;
  if (elementTitle) return elementTitle;
  if (state.shieldCharges > 0) return `護盾×${state.shieldCharges}`;
  return "無";
}

function getDangerActive() {
  if (state.bossActive && state.boss?.state === "falling") {
    return state.boss.y >= PLAYER_COLLISION_Y - 140;
  }
  if (!state.currentRow) return false;
  const liveEnemy = state.currentRow.blocks.some((block) => block.entityType === "enemy" && block.state === "falling");
  return liveEnemy && state.currentRowY >= PLAYER_COLLISION_Y - 120;
}

function gainUltimateCharge(amount) {
  state.ultimateCharge = Math.min(ULTIMATE_MAX, state.ultimateCharge + amount);
}

function canUseUltimate() {
  if (!state.running) return false;
  if (state.ultimateCharge >= ULTIMATE_MAX) return true;
  return state.ultimateCharge >= ULTIMATE_EMERGENCY_THRESHOLD && getDangerActive();
}

function triggerScreenShake(frames, power) {
  state.shakeFrames = Math.max(state.shakeFrames, frames);
  state.shakePower = Math.max(state.shakePower, power);
}

function activateTreasureRush(x = W / 2, y = PLAYER_COLLISION_Y - 80) {
  state.treasureRushFrames = TREASURE_RUSH_DURATION;
  state.rapidFireFrames = Math.max(state.rapidFireFrames, 150);
  state.powerShotFrames = Math.max(state.powerShotFrames, 110);
  gainUltimateCharge(18);
  state.message += "  Treasure Rush!";
  pushFloater("TREASURE RUSH!", x, y, "#fde68a");
  triggerScreenShake(12, 8);
}

function updateHud() {
  scoreValue.textContent = `${state.troop}`;
  const stage = state.bossActive ? TOTAL_ROWS : Math.min(state.rowsCompleted + 1, TOTAL_ROWS);
  stageValue.textContent = `${stage} / ${TOTAL_ROWS}`;
  hintValue.textContent = getCurrentHint();
  comboValue.textContent = `${state.combo}`;
  boostValue.textContent = getWeaponTitle();
  ultimateValue.textContent = canUseUltimate() ? "READY!" : `${state.ultimateCharge}%`;
  if (ultimateButton) ultimateButton.disabled = !canUseUltimate();
}

function spawnBullet() {
  const elementMode = getElementMode();
  playSfx("shoot");
  state.bullets.push({
    lane: state.currentLane,
    x: LANES[state.currentLane],
    y: PLAYER_Y - 36,
    kind:
      elementMode ??
      (state.powerShotFrames > 0 ? "power" : state.rapidFireFrames > 0 ? "rapid" : "normal"),
  });
}

function resetCombatState(options = {}) {
  const { preserveFlash = false, delayNextShot = false } = options;
  state.bullets = [];
  state.fireCooldown = delayNextShot ? FIRE_INTERVAL : 0;
  if (!preserveFlash) state.flashFrames = 0;
}

function setElementMode(mode) {
  state.fireAmmoFrames = 0;
  state.laserAmmoFrames = 0;
  state.iceAmmoFrames = 0;
  state.poisonAmmoFrames = 0;
  if (mode === "fire") state.fireAmmoFrames = ELEMENT_DURATION;
  if (mode === "laser") state.laserAmmoFrames = ELEMENT_DURATION;
  if (mode === "ice") state.iceAmmoFrames = ELEMENT_DURATION;
  if (mode === "poison") state.poisonAmmoFrames = ELEMENT_DURATION;
}

function applyPerk(block) {
  if (!block.perk) return;
  playSfx("perk");
  if (block.perk === "rapid") {
    state.rapidFireFrames = RAPID_FIRE_DURATION;
    state.message += "  快射啟動";
    pushFloater("快射", LANES[block.lane], state.currentRowY - 44, "#7dd3fc");
  } else if (block.perk === "power") {
    state.powerShotFrames = POWER_SHOT_DURATION;
    state.message += "  重砲啟動";
    pushFloater("重砲", LANES[block.lane], state.currentRowY - 44, "#f59e0b");
  } else if (block.perk === "fire") {
    setElementMode("fire");
    state.message += "  火焰玩具砲";
    pushFloater("火焰", LANES[block.lane], state.currentRowY - 44, "#fb923c");
  } else if (block.perk === "laser") {
    setElementMode("laser");
    state.message += "  彩虹雷射砲";
    pushFloater("雷射", LANES[block.lane], state.currentRowY - 44, "#93c5fd");
  } else if (block.perk === "ice") {
    setElementMode("ice");
    state.message += "  冰冰霜凍砲";
    pushFloater("冰霜", LANES[block.lane], state.currentRowY - 44, "#67e8f9");
  } else if (block.perk === "poison") {
    setElementMode("poison");
    state.message += "  黏黏毒泡砲";
    pushFloater("毒泡", LANES[block.lane], state.currentRowY - 44, "#86efac");
  } else if (block.perk === "shield") {
    state.shieldCharges += 1;
    state.message += "  護盾 +1";
    pushFloater("護盾", LANES[block.lane], state.currentRowY - 44, "#a78bfa");
  }
  updateHud();
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

function pushExplosion(x, y, style = "normal") {
  const baseColor =
    style === "fire"
      ? "#fb923c"
      : style === "laser"
        ? "#93c5fd"
        : style === "ice"
          ? "#67e8f9"
          : style === "poison"
            ? "#86efac"
            : style === "power"
              ? "#f59e0b"
              : style === "rapid"
                ? "#38bdf8"
                : "#ff7b89";
  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.25;
    const speed =
      style === "rapid" ? 2.4 + Math.random() * 3.2 : 1.6 + Math.random() * (style === "power" ? 3.2 : 2.4);
    state.particles.push({
      kind: style === "ice" ? "iceShard" : "shard",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.4,
      life: 24 + Math.floor(Math.random() * 10),
      maxLife: 32,
      size: style === "power" ? 7 + Math.random() * 7 : 4 + Math.random() * 5,
      color: baseColor,
    });
  }

  state.particles.push({
    kind: style === "laser" ? "laserRing" : style === "poison" ? "poisonRing" : "ring",
    x,
    y,
    vx: 0,
    vy: 0,
    life: 18,
    maxLife: 18,
    size: style === "power" ? 34 : 24,
    color:
      style === "laser"
        ? "rgba(147,197,253,0.9)"
        : style === "poison"
          ? "rgba(134,239,172,0.82)"
          : "rgba(255,255,255,0.8)",
  });

  state.particles.push({
    kind: style === "laser" ? "laserFlash" : style === "ice" ? "iceFlash" : "flash",
    x,
    y,
    vx: 0,
    vy: 0,
    life: 10,
    maxLife: 10,
    size: style === "power" ? 42 : 34,
    color:
      style === "ice"
        ? "rgba(224,247,255,0.95)"
        : style === "laser"
          ? "rgba(219,234,254,0.95)"
          : "rgba(255,244,194,0.95)",
  });

  if (style === "fire") {
    state.particles.push({
      kind: "fireball",
      x,
      y,
      vx: 0,
      vy: 0,
      life: 18,
      maxLife: 18,
      size: 74,
      color: "#fb923c",
    });
  }

  for (let i = 0; i < 8; i += 1) {
    const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.18;
    const speed = 2.8 + Math.random() * 1.6;
    state.particles.push({
      kind: style === "poison" ? "bubble" : style === "laser" ? "beamSpark" : "spark",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 16 + Math.floor(Math.random() * 8),
      maxLife: 24,
      size: 10 + Math.random() * 8,
      color: style === "poison" ? "#86efac" : style === "laser" ? "#dbeafe" : "#ffd166",
    });
  }
}

function pushUltimateBurst() {
  for (let i = 0; i < 10; i += 1) {
    const x = 26 + (W - 52) * (i / 9);
    const y = 120 + Math.sin(i * 1.6) * 44;
    pushExplosion(x, y, i % 3 === 0 ? "fire" : i % 3 === 1 ? "laser" : "power");
  }

  for (let i = 0; i < 28; i += 1) {
    const angle = (Math.PI * 2 * i) / 28;
    const speed = 2.8 + Math.random() * 4.2;
    state.particles.push({
      kind: "ultimateSpark",
      x: W / 2,
      y: PLAYER_COLLISION_Y - 60,
      vx: Math.cos(angle) * speed * 1.5,
      vy: Math.sin(angle) * speed * 1.1 - 1.5,
      life: 22 + Math.floor(Math.random() * 14),
      maxLife: 36,
      size: 16 + Math.random() * 18,
      color: i % 2 === 0 ? "#fff7ed" : "#fb923c",
    });
  }

  for (let i = 0; i < 16; i += 1) {
    state.particles.push({
      kind: "ultimateFlare",
      x: 22 + Math.random() * (W - 44),
      y: -30 - Math.random() * 140,
      vx: (Math.random() - 0.5) * 1.8,
      vy: 5.4 + Math.random() * 3.2,
      life: 24 + Math.floor(Math.random() * 12),
      maxLife: 34,
      size: 18 + Math.random() * 22,
      color: Math.random() > 0.5 ? "#ffd166" : "#fb923c",
    });
  }
}

function applyCrystalPower(block) {
  if (block.entityType !== "item") return "";

  if (block.crystalColor === "green") {
    const bonus = Math.max(8, Math.round(block.reward.value * 0.8));
    state.troop = clampTroop(state.troop + bonus);
    pushFloater(`綠晶+${bonus}`, LANES[block.lane], state.currentRowY - 44, "#4ade80");
    return `  綠晶爆發 +${bonus}`;
  }

  if (block.crystalColor === "red") {
    state.powerShotFrames += 180;
    state.fireAmmoFrames = Math.max(state.fireAmmoFrames, 180);
    pushFloater("紅晶爆發", LANES[block.lane], state.currentRowY - 44, "#f87171");
    return "  紅晶爆發";
  }

  if (block.crystalColor === "blue") {
    state.laserAmmoFrames = Math.max(state.laserAmmoFrames, 180);
    state.rapidFireFrames += 120;
    pushFloater("藍晶充能", LANES[block.lane], state.currentRowY - 44, "#60a5fa");
    return "  藍晶充能";
  }

  return "";
}

function startGame() {
  resumeAudio();
  playTone(440, 0.14, { type: "triangle", volume: 0.12 });
  playTone(660, 0.18, { type: "triangle", volume: 0.1, when: 0.08 });
  if (launchParams.get("source") === "pwa" || launchParams.get("action") === "start") {
    history.replaceState({}, document.title, window.location.pathname);
  }
  state.running = true;
  state.troop = 12;
  state.combo = 0;
  state.rowsCompleted = 0;
  state.currentLane = 0;
  state.currentRow = createRow(0);
  state.nextRow = createRow(1);
  state.currentRowY = ROW_START_Y;
  state.currentRowResolved = false;
  state.bossActive = false;
  state.boss = createBoss();
  state.ultimateCharge = 0;
  state.ultimateFlashFrames = 0;
  state.slowMoFrames = 0;
  state.shakeFrames = 0;
  state.shakePower = 0;
  state.frameCount = 0;
  state.treasureRushFrames = 0;
  state.pickupChain = 0;
  state.message = `${FACTION_NAME}出發`;
  resetCombatState();
  state.backgroundDrift = 0;
  audio.nextBgmTime = audio.ctx ? audio.ctx.currentTime : 0;
  audio.bgmStep = 0;
  updateHud();
  hideOverlay();
}

function finishGame(win, kicker, text) {
  state.running = false;
  state.pickupChain = 0;
  state.treasureRushFrames = 0;
  state.bestScore = Math.max(state.bestScore, state.troop);
  state.bestStage = Math.max(state.bestStage, state.rowsCompleted + (win ? 1 : 0));
  persistBestProgress();
  playSfx(win ? "win" : "lose");
  setOverlay(
    kicker,
    win ? `${BOSS_NAME}被打倒了` : `${FACTION_NAME}被撞倒了`,
    `${text}  最高隊伍 ${state.bestScore}，最遠關卡 ${state.bestStage}。`,
    "再玩一次",
  );
}

function moveLane(direction) {
  if (!state.running) return;
  state.currentLane = Math.max(0, Math.min(1, state.currentLane + direction));
  playSfx("move");
}

function activateUltimate() {
  if (!canUseUltimate()) return;

  playSfx("ultimate");
  state.ultimateCharge = 0;
  state.ultimateFlashFrames = 42;
  state.slowMoFrames = 28;
  state.flashFrames = 18;
  state.message = "大絕招發動!";
  triggerScreenShake(34, 22);
  pushFloater("MEGA!", W / 2, PLAYER_COLLISION_Y - 46, "#fff7ed");
  pushUltimateBurst();

  if (state.bossActive && state.boss?.state === "falling") {
    state.boss.hp = Math.max(0, state.boss.hp - 28);
    state.boss.hitFlash = 10;
    pushExplosion(W / 2, state.boss.y, "power");
    if (state.boss.hp <= 0) {
      updateBossStatusEffects();
    }
  } else if (state.currentRow) {
    let clearedEnemy = false;
    for (const block of state.currentRow.blocks) {
      if (block.entityType === "enemy" && block.state === "falling") {
        clearedEnemy = true;
        finishEnemyBreak(block, LANES[block.lane], state.currentRowY);
      }
    }
    if (clearedEnemy) {
      state.currentRowY = Math.min(state.currentRowY, PLAYER_COLLISION_Y - 120);
    }
  }

  state.ultimateCharge = 0;
  updateHud();
}

function rewardCombo() {
  if (state.combo > 0 && state.combo % 3 === 0) {
    state.troop += COMBO_REWARD;
    state.message += `  連擊獎勵 +${COMBO_REWARD}`;
  }
}

function completeCurrentRow() {
  resetCombatState({ preserveFlash: true, delayNextShot: true });
  state.transitionClears += 1;
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
  state.currentRowResolved = false;
  updateHud();
}

function applyBlockReward(block) {
  if (block.entityType !== "item") return;
  playSfx("reward");
  state.troop = clampTroop(applyReward(state.troop, block.reward));
  if (state.treasureRushFrames > 0) {
    const rushBonus = block.reward.type === "mul" ? 6 : 4;
    state.troop = clampTroop(state.troop + rushBonus);
    state.message = `寶藏狂熱 +${rushBonus}`;
    pushFloater(`BONUS +${rushBonus}`, LANES[block.lane], state.currentRowY - 54, "#fef08a");
  }
  state.combo += 1;
  state.pickupChain += 1;
  gainUltimateCharge(18);
  state.message = `${block.lane === 0 ? "左" : "右"}邊${ITEM_NAME}到手 ${formatReward(block.reward)}`;
  block.state = "broken";
  block.breakFrames = 14;
  state.currentRowResolved = true;
  pushFloater(formatReward(block.reward), LANES[block.lane], state.currentRowY - 18, "#fef3c7");
  state.message += applyCrystalPower(block);
  applyPerk(block);
  if (state.pickupChain > 0 && state.pickupChain % 4 === 0) {
    activateTreasureRush(LANES[block.lane], state.currentRowY - 78);
  }
  rewardCombo();
  updateHud();
}

function missCurrentRow() {
  if (!state.currentRow) return;
  state.combo = 0;
  state.pickupChain = 0;
  state.message = `${ITEM_NAME}漏接`;
  pushFloater("MISS ITEM", W / 2, PLAYER_COLLISION_Y - 20, "#94a3b8");
  for (const block of state.currentRow.blocks) {
    if (block.state === "falling" && block.entityType === "item") block.state = "missed";
  }
  state.currentRowResolved = true;
  updateHud();
}

function isFullyVisible(centerY, halfHeight) {
  return centerY - halfHeight >= 0 && centerY + halfHeight <= H;
}

function getBulletDamage(kind) {
  let damage = BULLET_DAMAGE;
  if (state.powerShotFrames > 0) damage += 2;
  if (kind === "laser") damage += 1;
  if (kind === "fire") damage += 1;
  return damage;
}

function applyElementHit(target, bulletKind) {
  if (bulletKind === "fire") {
    target.burnFrames = Math.max(target.burnFrames, target.enemyStats?.burnResist ? 75 : 120);
    target.statusTick = 0;
  } else if (bulletKind === "ice") {
    if (!target.enemyStats?.slowImmune) target.slowFrames = 90;
  } else if (bulletKind === "poison") {
    if (!target.enemyStats?.poisonImmune) {
      target.poisonFrames = 150;
      target.statusTick = 0;
    }
  }
}

function splitEnemy(target, x, y) {
  target.enemyType = "mini";
  target.enemyStats = ENEMY_TYPES.mini;
  target.isElite = false;
  target.hasSplit = true;
  target.hp = 4;
  target.maxHp = 4;
  target.burnFrames = 0;
  target.poisonFrames = 0;
  target.slowFrames = 0;
  target.statusTick = 0;
  target.hitFlash = 5;
  target.breakFrames = 0;
  target.dashFrames = 0;
  target.dashCooldown = 0;
  pushFloater("分裂!", x, y - 26, "#86efac");
  pushExplosion(x, y, "poison");
}

function finishEnemyBreak(target, x, y) {
  if (target.enemyStats?.splits && !target.hasSplit) {
    splitEnemy(target, x, y);
    state.message = `${target.lane === 0 ? "左" : "右"}${ENEMY_NAME}分裂了`;
    return;
  }
  target.state = "broken";
  target.breakFrames = 14;
  playSfx("enemyBreak");
  gainUltimateCharge(target.isElite ? 40 : 28);
  state.message = `${target.lane === 0 ? "左" : "右"}${ENEMY_NAME}擊破`;
  pushFloater("CLEAR", x, y - 18, "#fca5a5");
  const elementMode = getElementMode();
  const explosionStyle =
    elementMode ??
    (state.powerShotFrames > 0 ? "power" : state.rapidFireFrames > 0 ? "rapid" : "normal");
  pushExplosion(x, y, explosionStyle);
  const unresolvedItems = state.currentRow?.blocks.some(
    (item) => item.entityType === "item" && item.state === "falling",
  );
  if (!unresolvedItems && !state.currentRowResolved) {
    state.currentRowResolved = true;
  }
}

function applyTickDamage(target, amount, x, y, color, label) {
  if (!target || target.state !== "falling") return;
  target.hp = Math.max(0, target.hp - amount);
  target.hitFlash = 2;
  pushFloater(label, x, y, color);
}

function updateBlockStatusEffects(block, x, y) {
  if (block.slowFrames > 0) block.slowFrames -= 1;
  if (block.burnFrames > 0 || block.poisonFrames > 0) {
    block.statusTick += 1;
  }

  if (block.burnFrames > 0) {
    block.burnFrames -= 1;
    if (block.statusTick % 18 === 0) {
      applyTickDamage(block, 1, x, y - 12, "#fb923c", "燒");
    }
  }

  if (block.poisonFrames > 0) {
    block.poisonFrames -= 1;
    if (block.statusTick % 24 === 0) {
      applyTickDamage(block, 1, x, y - 28, "#86efac", "毒");
    }
  }

  if (block.hp <= 0 && block.state === "falling") {
    if (block.entityType === "enemy") {
      finishEnemyBreak(block, x, y);
    } else {
      applyBlockReward(block);
    }
  }
}

function updateEnemyBehavior(block) {
  if (block.entityType !== "enemy" || block.state !== "falling") return;
  if (block.dashFrames > 0) {
    block.dashFrames -= 1;
    return;
  }
  if (block.dashCooldown > 0) {
    block.dashCooldown -= 1;
    return;
  }
  if (block.enemyStats?.canDash) {
    block.dashFrames = 18;
    block.dashCooldown = 72 + Math.floor(Math.random() * 28);
    pushFloater("衝!", LANES[block.lane], state.currentRowY - 24, "#f97316");
    state.message = `${block.enemyStats.name}突然加速`;
  }
}

function updateBossStatusEffects() {
  if (!state.boss || state.boss.state !== "falling") return;
  if (state.boss.slowFrames > 0) state.boss.slowFrames -= 1;
  if (state.boss.burnFrames > 0 || state.boss.poisonFrames > 0) {
    state.boss.statusTick += 1;
  }

  if (state.boss.burnFrames > 0) {
    state.boss.burnFrames -= 1;
    if (state.boss.statusTick % 18 === 0) {
      applyTickDamage(state.boss, 1, W / 2, state.boss.y - 18, "#fb923c", "燒");
    }
  }

  if (state.boss.poisonFrames > 0) {
    state.boss.poisonFrames -= 1;
    if (state.boss.statusTick % 24 === 0) {
      applyTickDamage(state.boss, 1, W / 2, state.boss.y - 30, "#86efac", "毒");
    }
  }

  if (state.boss.hp <= 0 && state.boss.state === "falling") {
    state.boss.state = "broken";
    resetCombatState({ delayNextShot: true });
    state.troop = clampTroop(applyReward(state.troop, state.boss.reward));
    state.message = `${BOSS_NAME}打倒了 ${formatReward(state.boss.reward)}`;
    pushFloater(formatReward(state.boss.reward), W / 2, state.boss.y - 36, "#ffd166");
    updateHud();
    finishGame(true, "勝利", `你拿到 ${state.troop} 分，還打倒了${BOSS_NAME}。`);
  }
}

function updateBullets() {
  const bulletMode = getElementMode();
  let currentFireInterval = state.rapidFireFrames > 0 ? Math.max(3, FIRE_INTERVAL - 4) : FIRE_INTERVAL;
  if (bulletMode === "laser") currentFireInterval = Math.max(4, currentFireInterval - 1);
  state.fireCooldown -= 1;
  if (state.fireCooldown <= 0) {
    spawnBullet();
    state.fireCooldown = currentFireInterval;
  }

  state.bullets = state.bullets.filter((bullet) => bullet.y > -40);
  for (const bullet of state.bullets) {
    bullet.x = LANES[bullet.lane];
    bullet.y -= bullet.kind === "laser" ? BULLET_SPEED + 3 : BULLET_SPEED;
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
      const rawDamage = getBulletDamage(bullet.kind);
      const damage =
        block.entityType === "enemy" ? Math.max(1, rawDamage - (block.enemyStats?.armor ?? 0)) : rawDamage;
      block.hp = Math.max(0, block.hp - damage);
      block.hitFlash = 4;
      playSfx("hit");
      applyElementHit(block, bullet.kind);
      state.message = `${block.lane === 0 ? "左" : "右"}${block.entityType === "enemy" ? ENEMY_NAME : ITEM_NAME} -${damage}`;
      pushFloater(`-${damage}`, LANES[block.lane], state.currentRowY - 8, "#ffffff");
      state.bullets.splice(i, 1);
      if (block.hp <= 0) {
        if (block.entityType === "enemy") {
          finishEnemyBreak(block, LANES[block.lane], state.currentRowY);
        } else {
          applyBlockReward(block);
          return;
        }
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
      const damage = getBulletDamage(bullet.kind);
      state.boss.hp = Math.max(0, state.boss.hp - damage);
      state.boss.hitFlash = 5;
      playSfx("hit");
      applyElementHit(state.boss, bullet.kind);
      state.message = `${BOSS_NAME} -${damage}`;
      pushFloater(`-${damage}`, W / 2, state.boss.y - 18, "#fef3c7");
      state.bullets.splice(i, 1);
      if (state.boss.hp <= 0) {
        updateBossStatusEffects();
        return;
      }
    }
  }
}

function updateCurrentRow() {
  if (!state.currentRow) return;

  for (const block of state.currentRow.blocks) {
    if (block.hitFlash > 0) block.hitFlash -= 1;
    if (block.breakFrames > 0) block.breakFrames -= 1;
    if (block.entityType === "enemy") updateEnemyBehavior(block);
    if (block.state === "falling") {
      updateBlockStatusEffects(block, LANES[block.lane], state.currentRowY);
    }
  }

  const slowed = state.currentRow.blocks.some((block) => block.state === "falling" && block.slowFrames > 0);
  const enemySpeedMultiplier = state.currentRow.blocks
    .filter((block) => block.entityType === "enemy" && block.state === "falling")
    .reduce((maxSpeed, block) => {
      const dashBoost = block.dashFrames > 0 ? 1.7 : 1;
      return Math.max(maxSpeed, (block.enemyStats?.speed ?? 1) * dashBoost);
    }, 1);
  state.currentRowY += ROW_SPEED * enemySpeedMultiplier * (slowed ? 0.58 : 1);

  hitCurrentRow();

  const enemyBrokeThrough = state.currentRow.blocks.some(
    (block) => block.entityType === "enemy" && block.state === "falling" && state.currentRowY >= PLAYER_COLLISION_Y,
  );
  if (enemyBrokeThrough) {
    state.combo = 0;
    state.message = `${ENEMY_NAME}突破`;
    pushFloater("BREACH", W / 2, PLAYER_COLLISION_Y - 20, "#ef476f");
    updateHud();
    finishGame(false, "失敗", `${ENEMY_NAME}跑到底了，這局沒有守住。`);
    return;
  }

  if (state.currentRowResolved) {
    const allBlocksPastLine = state.currentRow.blocks.every((block) => {
      if (block.state === "broken") return true;
      return state.currentRowY >= PLAYER_COLLISION_Y + HALF_BLOCK_HEIGHT + 8;
    });
    if (allBlocksPastLine) {
      completeCurrentRow();
    }
    return;
  }

  if (state.running && isFullyVisible(state.currentRowY, HALF_BLOCK_HEIGHT) && state.currentRowY >= PLAYER_COLLISION_Y) {
    const success = state.currentRow.blocks.some(
      (block) => block.entityType === "item" && block.state === "broken",
    );
    const hasFallingItems = state.currentRow.blocks.some(
      (block) => block.entityType === "item" && block.state === "falling",
    );
    if (!success && hasFallingItems) {
      missCurrentRow();
    }
  }
}

function updateBoss() {
  if (!state.bossActive || !state.boss || state.boss.state !== "falling") return;

  state.boss.y += ROW_SPEED * (state.boss.slowFrames > 0 ? 0.6 : 1);
  if (state.boss.hitFlash > 0) state.boss.hitFlash -= 1;
  updateBossStatusEffects();
  if (!state.running || !state.boss || state.boss.state !== "falling") return;
  hitBoss();

  if (state.running && isFullyVisible(state.boss.y, 74) && state.boss.y >= PLAYER_COLLISION_Y) {
    state.combo = 0;
    state.troop = clampTroop(state.troop - 20);
    state.message = `${BOSS_NAME}衝撞 -20`;
    updateHud();
    finishGame(false, "失敗", `${BOSS_NAME}沒有先被打倒，它撞到終點了。`);
  }
}

function update() {
  state.frameCount += 1;
  state.floaters = state.floaters.filter((floater) => floater.life > 0);
  for (const floater of state.floaters) {
    floater.life -= 1;
    floater.y -= 0.9;
  }

  state.particles = state.particles.filter((particle) => particle.life > 0);
  for (const particle of state.particles) {
    particle.life -= 1;
    particle.x += particle.vx;
    particle.y += particle.vy;
    if (particle.kind === "shard") {
      particle.vy += 0.06;
      particle.vx *= 0.98;
    } else if (particle.kind === "spark") {
      particle.vx *= 0.95;
      particle.vy *= 0.95;
    }
  }

  if (!state.running) return;

  if (state.shakeFrames > 0) {
    state.shakeFrames -= 1;
    state.shakePower *= 0.92;
  } else {
    state.shakePower = 0;
  }

  if (state.flashFrames > 0) state.flashFrames -= 1;
  if (state.ultimateFlashFrames > 0) state.ultimateFlashFrames -= 1;
  if (state.slowMoFrames > 0) state.slowMoFrames -= 1;
  if (state.treasureRushFrames > 0) state.treasureRushFrames -= 1;
  if (state.rapidFireFrames > 0) state.rapidFireFrames -= 1;
  if (state.powerShotFrames > 0) state.powerShotFrames -= 1;
  if (state.fireAmmoFrames > 0) state.fireAmmoFrames -= 1;
  if (state.laserAmmoFrames > 0) state.laserAmmoFrames -= 1;
  if (state.iceAmmoFrames > 0) state.iceAmmoFrames -= 1;
  if (state.poisonAmmoFrames > 0) state.poisonAmmoFrames -= 1;
  const slowMotionActive = state.slowMoFrames > 0;
  state.backgroundDrift += slowMotionActive ? 0.35 : 0.8;
  scheduleBgm();
  if (slowMotionActive && state.frameCount % 2 === 0) {
    updateHud();
    return;
  }
  updateBullets();

  if (state.bossActive) {
    updateBoss();
  } else {
    updateCurrentRow();
  }
  updateHud();
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

function drawUltimateOverlay() {
  if (state.ultimateFlashFrames <= 0) return;

  const strength = state.ultimateFlashFrames / 42;
  const pulse = 0.78 + Math.sin((42 - state.ultimateFlashFrames) * 0.7) * 0.18;

  ctx.save();
  const skyGlow = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.9);
  skyGlow.addColorStop(0, `rgba(255,255,255,${0.34 * strength})`);
  skyGlow.addColorStop(0.4, `rgba(255,196,92,${0.26 * strength})`);
  skyGlow.addColorStop(1, "rgba(255,120,40,0)");
  ctx.fillStyle = skyGlow;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = `rgba(255,244,214,${0.32 * strength})`;
  ctx.fillRect(0, 0, W, H);

  ctx.translate(W / 2, H * 0.6);
  for (let i = 0; i < 12; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI * 2 * i) / 12 + (42 - state.ultimateFlashFrames) * 0.03);
    const beamAlpha = (0.07 + (i % 3) * 0.02) * strength;
    const beamLength = 180 + i * 10 + pulse * 80;
    const beamWidth = 12 + (i % 4) * 6;
    const beam = ctx.createLinearGradient(0, 0, 0, -beamLength);
    beam.addColorStop(0, `rgba(255,255,255,${beamAlpha * 1.8})`);
    beam.addColorStop(0.45, `rgba(255,214,102,${beamAlpha})`);
    beam.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = beam;
    roundedRectPath(ctx, -beamWidth / 2, -beamLength, beamWidth, beamLength, beamWidth / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  for (let i = 0; i < 3; i += 1) {
    const radius = 90 + i * 72 + (42 - state.ultimateFlashFrames) * (8 + i * 2);
    ctx.strokeStyle =
      i === 0
        ? `rgba(255,255,255,${0.5 * strength})`
        : i === 1
          ? `rgba(255,214,102,${0.34 * strength})`
          : `rgba(251,146,60,${0.26 * strength})`;
    ctx.lineWidth = 14 - i * 3;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.72, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(255,255,255,${0.24 * strength})`;
  ctx.beginPath();
  ctx.ellipse(W / 2, H * 0.8, 170 + pulse * 28, 48 + pulse * 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getBlockColors(block) {
  if (block.entityType === "enemy") {
    const enemyColor = block.enemyStats?.color;
    if (enemyColor) {
      return { fill: enemyColor, deep: "#1f2937" };
    }
    return { fill: "#ef476f", deep: "#b71d47" };
  }
  if (block.crystalColor && CRYSTAL_COLORS[block.crystalColor]) {
    return CRYSTAL_COLORS[block.crystalColor];
  }
  if (block.rewardType === "mul") {
    return { fill: "#3a86ff", deep: "#1f57c3" };
  }
  return { fill: "#3fb68b", deep: "#18795c" };
}

function getRewardTier(reward) {
  if (reward.type === "mul") {
    if (reward.value >= 2.2) return 4;
    if (reward.value >= 1.8) return 3;
    if (reward.value >= 1.4) return 2;
    return 1;
  }

  if (reward.value >= 18) return 4;
  if (reward.value >= 13) return 3;
  if (reward.value >= 8) return 2;
  return 1;
}

function drawGem(x, y, size, fill, shine = "#ffffff") {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.75, y - size * 0.15);
  ctx.lineTo(x + size * 0.35, y + size);
  ctx.lineTo(x - size * 0.35, y + size);
  ctx.lineTo(x - size * 0.75, y - size * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(x - size * 0.2, y - size * 0.28, Math.max(1.5, size * 0.18), 0, Math.PI * 2);
  ctx.fill();
}

function drawCoin(x, y, r) {
  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = Math.max(1, r * 0.22);
  ctx.stroke();
  ctx.fillStyle = "#fff7cc";
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.2, Math.max(1, r * 0.28), 0, Math.PI * 2);
  ctx.fill();
}

function drawRewardIconSet(block, preview = false) {
  const tier = getRewardTier(block.reward);
  const iconY = preview ? 20 : 28;
  const spacing = preview ? 15 : 19;
  const gemSize = preview ? 6 : 8;
  const isGreen = block.crystalColor === "green";
  const isRed = block.crystalColor === "red";
  const isBlue = block.crystalColor === "blue";

  ctx.save();
  ctx.translate(0, iconY);

  if (block.reward.type === "mul") {
    drawGem(0, -2, preview ? 8 : 11, isRed ? "#f87171" : "#93c5fd", "#eff6ff");

    for (let i = 0; i < tier; i += 1) {
      const x = -((tier - 1) * spacing) / 2 + i * spacing;
      const y = i % 2 === 0 ? 17 : 22;
      drawGem(
        x,
        y,
        gemSize,
        i % 3 === 0 ? "#60a5fa" : i % 3 === 1 ? "#f87171" : "#4ade80",
        "#ffffff",
      );
    }

    if (!preview) {
      drawGem(-28, 8, 6, "#4ade80");
      drawGem(28, 8, 6, "#f87171");
    }
  } else {
    if (isGreen) {
      drawGem(0, -2, preview ? 8 : 11, "#4ade80", "#dcfce7");
    } else if (isRed) {
      drawGem(0, -2, preview ? 8 : 11, "#f87171", "#fee2e2");
    } else if (isBlue) {
      drawGem(0, -2, preview ? 8 : 11, "#60a5fa", "#dbeafe");
    } else {
      drawCoin(0, -2, preview ? 7 : 9);
    }

    for (let i = 0; i < tier; i += 1) {
      const x = -((tier - 1) * spacing) / 2 + i * spacing;
      const y = i % 2 === 0 ? 18 : 23;
      if (i % 3 === 0) {
        drawCoin(x, y, preview ? 3.5 : 4.5);
      } else if (i % 3 === 1) {
        drawGem(x, y, preview ? 4.5 : 5.5, "#4ade80", "#dcfce7");
      } else {
        drawGem(x, y, preview ? 4.5 : 5.5, "#f87171", "#fee2e2");
      }
    }

    if (!preview) {
      drawCoin(-26, 8, 4);
      drawCoin(26, 8, 4);
    }
  }

  ctx.restore();
}

function drawPerkIcon(perk) {
  if (!perk) return;

  const badgeColor =
    perk === "rapid"
      ? "#7dd3fc"
      : perk === "power"
        ? "#f59e0b"
        : perk === "fire"
          ? "#fb923c"
          : perk === "laser"
            ? "#93c5fd"
            : perk === "ice"
              ? "#67e8f9"
              : perk === "poison"
                ? "#86efac"
                : "#c4b5fd";
  ctx.fillStyle = badgeColor;
  roundedRectPath(ctx, -28, -40, 56, 18, 9);
  ctx.fill();
  ctx.fillStyle = "#14213d";

  if (perk === "rapid") {
    for (let i = 0; i < 3; i += 1) {
      const x = -14 + i * 10;
      roundedRectPath(ctx, x, -35, 5, 8, 2);
      ctx.fill();
    }
  } else if (perk === "power") {
    ctx.beginPath();
    ctx.moveTo(0, -37);
    ctx.lineTo(9, -31);
    ctx.lineTo(0, -23);
    ctx.lineTo(-9, -31);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-2, -34, 4, 8);
  } else if (perk === "fire") {
    ctx.beginPath();
    ctx.moveTo(0, -37);
    ctx.quadraticCurveTo(10, -30, 3, -23);
    ctx.quadraticCurveTo(-2, -25, 0, -37);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, -27);
    ctx.quadraticCurveTo(-2, -35, 4, -27);
    ctx.quadraticCurveTo(-1, -22, -8, -27);
    ctx.fill();
  } else if (perk === "laser") {
    ctx.fillRect(-14, -33, 28, 3);
    ctx.fillRect(-10, -29, 20, 3);
    ctx.fillRect(-6, -25, 12, 3);
  } else if (perk === "ice") {
    ctx.beginPath();
    ctx.moveTo(0, -37);
    ctx.lineTo(4, -31);
    ctx.lineTo(10, -31);
    ctx.lineTo(5, -27);
    ctx.lineTo(8, -21);
    ctx.lineTo(0, -25);
    ctx.lineTo(-8, -21);
    ctx.lineTo(-5, -27);
    ctx.lineTo(-10, -31);
    ctx.lineTo(-4, -31);
    ctx.closePath();
    ctx.fill();
  } else if (perk === "poison") {
    ctx.beginPath();
    ctx.arc(-5, -31, 5, 0, Math.PI * 2);
    ctx.arc(5, -31, 5, 0, Math.PI * 2);
    ctx.arc(0, -25, 5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#14213d";
    ctx.beginPath();
    ctx.arc(0, -31, 7, 0.2 * Math.PI, 1.8 * Math.PI);
    ctx.stroke();
  }
}

function drawStatusEffects(width, height, target) {
  if (target.burnFrames > 0) {
    ctx.fillStyle = "rgba(251,146,60,0.28)";
    ctx.beginPath();
    ctx.arc(-width * 0.22, -height * 0.24, 10, 0, Math.PI * 2);
    ctx.arc(width * 0.18, -height * 0.12, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (target.poisonFrames > 0) {
    ctx.fillStyle = "rgba(134,239,172,0.24)";
    ctx.beginPath();
    ctx.arc(-width * 0.16, 4, 7, 0, Math.PI * 2);
    ctx.arc(width * 0.14, 14, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (target.slowFrames > 0) {
    ctx.strokeStyle = "rgba(103,232,249,0.65)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-width * 0.2, -6);
    ctx.lineTo(width * 0.2, -6);
    ctx.moveTo(-width * 0.1, -18);
    ctx.lineTo(width * 0.1, 8);
    ctx.moveTo(width * 0.1, -18);
    ctx.lineTo(-width * 0.1, 8);
    ctx.stroke();
  }
}

function drawBlock(x, y, block, options = {}) {
  if (block.entityType === "enemy") {
    drawEnemySprite(x, y, block, options);
    return;
  }

  const { active = false, preview = false } = options;
  const { fill, deep } = getBlockColors(block);
  const sizeScale = block.sizeScale ?? 1;
  const scale = (preview ? 0.72 : block.hitFlash > 0 ? 0.96 : 1) * sizeScale;
  const width = BLOCK_WIDTH * scale;
  const height = BLOCK_HEIGHT * scale;

  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = preview ? 0.45 : 1;

  if (!preview) {
    ctx.fillStyle = active ? "rgba(255,241,179,0.22)" : "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.ellipse(0, 6, width * 0.48, height * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = block.hitFlash > 0 ? "#ffffff" : fill;
  roundedRectPath(ctx, -width / 2, -height / 2, width, height, 18);
  ctx.fill();
  drawStatusEffects(width, height, block);

  ctx.fillStyle = "rgba(255,255,255,0.2)";
  roundedRectPath(ctx, -width / 2 + 8, -height / 2 + 8, width - 16, height * 0.32, 12);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.beginPath();
  ctx.moveTo(-width / 2 + 14, height / 2 - 14);
  ctx.lineTo(width / 2 - 14, height / 2 - 14);
  ctx.lineTo(width / 2 - 28, height / 2 - 2);
  ctx.lineTo(-width / 2 + 28, height / 2 - 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.72)";
  ctx.lineWidth = active ? 5 : 4;
  roundedRectPath(ctx, -width / 2 + 2, -height / 2 + 2, width - 4, height - 4, 16);
  ctx.stroke();

  ctx.fillStyle = deep;
  ctx.beginPath();
  ctx.arc(-width / 2 + 18, -height / 2 + 18, preview ? 6 : 8, 0, Math.PI * 2);
  ctx.arc(width / 2 - 18, -height / 2 + 18, preview ? 6 : 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = active ? "#fef3c7" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = preview ? "900 28px Avenir Next" : "900 36px Avenir Next";
  ctx.fillText(`${block.hp}`, 0, preview ? 0 : 2);
  drawRewardIconSet(block, preview);
  if (block.perk && block.entityType === "item" && !preview) {
    drawPerkIcon(block.perk);
  }

  ctx.strokeStyle = deep;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-width / 2, height / 2);
  ctx.lineTo(width / 2, height / 2);
  ctx.stroke();
  ctx.restore();
}

function drawEnemySprite(x, y, block, options = {}) {
  const { active = false, preview = false } = options;
  const bob = preview ? 0 : Math.sin((state.backgroundDrift + x) * 0.08) * 4;
  const baseScale = block.isElite ? 1.12 : block.enemyType === "mini" ? 0.78 : 1;
  const scale = preview ? 0.72 : block.hitFlash > 0 ? 0.97 * baseScale : baseScale;
  const width = BLOCK_WIDTH * scale;
  const height = BLOCK_HEIGHT * scale;
  const blink = Math.sin((state.backgroundDrift + x) * 0.18) > 0.92;
  const enemyType = block.enemyType ?? "runner";
  const { fill, deep } = getBlockColors(block);
  const rim = active ? "#ffe8a3" : deep;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = preview ? 0.5 : 1;

  ctx.fillStyle = block.hitFlash > 0 ? "#fff1f2" : fill;
  roundedRectPath(ctx, -width / 2, -height / 2, width, height, 24);
  ctx.fill();
  drawStatusEffects(width, height, block);

  if (block.isElite) {
    ctx.strokeStyle = "#fef08a";
    ctx.lineWidth = 4;
    roundedRectPath(ctx, -width / 2 - 6, -height / 2 - 6, width + 12, height + 12, 28);
    ctx.stroke();
    ctx.fillStyle = "#fde047";
    ctx.beginPath();
    ctx.moveTo(0, -height / 2 - 18);
    ctx.lineTo(10, -height / 2 - 6);
    ctx.lineTo(4, -height / 2 - 6);
    ctx.lineTo(0, -height / 2 + 2);
    ctx.lineTo(-4, -height / 2 - 6);
    ctx.lineTo(-10, -height / 2 - 6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  roundedRectPath(ctx, -width / 2 + 10, -height / 2 + 10, width - 20, 18, 8);
  ctx.fill();

  ctx.strokeStyle = rim;
  ctx.lineWidth = active ? 5 : 4;
  ctx.strokeRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4);

  if (enemyType === "tank") {
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundedRectPath(ctx, -width / 2 + 18, -4, width - 36, 22, 10);
    ctx.fill();
  } else if (enemyType === "blob") {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(-18, 10, 12, 0, Math.PI * 2);
    ctx.arc(0, 16, 16, 0, Math.PI * 2);
    ctx.arc(18, 10, 12, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemyType === "flyer") {
    ctx.strokeStyle = "rgba(255,255,255,0.28)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-34, -8);
    ctx.quadraticCurveTo(-18, -24, -2, -8);
    ctx.moveTo(34, -8);
    ctx.quadraticCurveTo(18, -24, 2, -8);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(-18, -20);
    ctx.lineTo(-8, -34);
    ctx.lineTo(0, -18);
    ctx.lineTo(8, -34);
    ctx.lineTo(18, -20);
    ctx.closePath();
    ctx.fill();
  }

  const eyeY = -10;
  const eyeOffset = 22;
  ctx.fillStyle = "#fff5f7";
  if (blink && !preview) {
    ctx.fillRect(-eyeOffset - 10, eyeY, 20, 3);
    ctx.fillRect(eyeOffset - 10, eyeY, 20, 3);
  } else {
    ctx.beginPath();
    ctx.ellipse(-eyeOffset, eyeY, 10, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffset, eyeY, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#14213d";
    const pupilShift = active ? 2.5 : Math.sin((state.backgroundDrift + x) * 0.06) * 2;
    ctx.beginPath();
    ctx.arc(-eyeOffset + pupilShift, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.arc(eyeOffset + pupilShift, eyeY + 1, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = deep;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-24, 16);
  ctx.quadraticCurveTo(0, 30 + Math.sin(state.backgroundDrift * 0.08) * 4, 24, 16);
  ctx.stroke();

  ctx.fillStyle = "#fff5f7";
  ctx.beginPath();
  ctx.moveTo(-20, 18);
  ctx.lineTo(-12, 34);
  ctx.lineTo(-4, 18);
  ctx.moveTo(4, 18);
  ctx.lineTo(12, 34);
  ctx.lineTo(20, 18);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = preview ? "900 28px Avenir Next" : "900 34px Avenir Next";
  ctx.fillText(`${block.hp}`, 0, -34);
  if (!preview) {
    ctx.font = "800 12px Avenir Next";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(block.isElite ? `精英${block.enemyStats?.name ?? ENEMY_NAME}` : block.enemyStats?.name ?? ENEMY_NAME, 0, 34);
  }

  if (!preview) {
    const legSwing = Math.sin((state.backgroundDrift + x) * 0.12) * 5;
    if (enemyType === "flyer") {
      ctx.strokeStyle = deep;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-16, height / 2 - 6);
      ctx.lineTo(-10, height / 2 + 10);
      ctx.moveTo(16, height / 2 - 6);
      ctx.lineTo(10, height / 2 + 10);
      ctx.stroke();
    } else if (enemyType === "blob") {
      ctx.fillStyle = "rgba(20,33,61,0.26)";
      ctx.beginPath();
      ctx.arc(-14, height / 2 - 2, 6, 0, Math.PI * 2);
      ctx.arc(14, height / 2 - 2, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = deep;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-24, height / 2 - 10);
      ctx.lineTo(-30 - legSwing, height / 2 + 18);
      ctx.moveTo(-6, height / 2 - 10);
      ctx.lineTo(-2 + legSwing, height / 2 + 16);
      ctx.moveTo(6, height / 2 - 10);
      ctx.lineTo(2 - legSwing, height / 2 + 16);
      ctx.moveTo(24, height / 2 - 10);
      ctx.lineTo(30 + legSwing, height / 2 + 18);
      ctx.stroke();
    }
  }

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

    if (block.state === "missed") {
      ctx.save();
      ctx.globalAlpha = 0.42;
      drawBlock(LANES[block.lane], state.currentRowY, block, {
        active: false,
      });
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
  drawStatusEffects(192, 148, state.boss);

  ctx.fillStyle = "#f6bd60";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "900 38px Avenir Next";
  ctx.fillText(`${state.boss.hp}`, 0, 4);
  drawRewardIconSet({ reward: state.boss.reward }, false);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(-76, -50, 152, 14);
  ctx.fillStyle = "#80ed99";
  ctx.fillRect(-76, -50, 152 * (state.boss.hp / state.boss.maxHp), 14);
  ctx.restore();
}

function drawPlayer() {
  const laneX = LANES[state.currentLane];
  const elementMode = getElementMode();
  ctx.save();
  ctx.translate(laneX, PLAYER_Y);

  if (state.flashFrames > 0) {
    ctx.fillStyle = "rgba(255,255,255,0.42)";
    ctx.beginPath();
    ctx.arc(0, 0, 54 + state.flashFrames, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.powerShotFrames > 0) {
    ctx.fillStyle = "rgba(245,158,11,0.18)";
    ctx.beginPath();
    ctx.arc(0, 0, 58, 0, Math.PI * 2);
    ctx.fill();
  } else if (state.rapidFireFrames > 0) {
    ctx.fillStyle = "rgba(56,189,248,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
  } else if (elementMode === "fire") {
    ctx.fillStyle = "rgba(251,146,60,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
  } else if (elementMode === "laser") {
    ctx.fillStyle = "rgba(147,197,253,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
  } else if (elementMode === "ice") {
    ctx.fillStyle = "rgba(103,232,249,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
  } else if (elementMode === "poison") {
    ctx.fillStyle = "rgba(134,239,172,0.16)";
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#0f172a";
  roundedRectPath(ctx, -34, -34, 68, 72, 24);
  ctx.fill();

  ctx.fillStyle = "#ffcf70";
  roundedRectPath(ctx, -22, -28, 44, 30, 14);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-8, -14, 4, 0, Math.PI * 2);
  ctx.arc(8, -14, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#14213d";
  ctx.beginPath();
  ctx.arc(-7, -13, 2, 0, Math.PI * 2);
  ctx.arc(9, -13, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#14213d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.quadraticCurveTo(0, 2, 8, -4);
  ctx.stroke();

  ctx.fillStyle = "#3fb68b";
  roundedRectPath(ctx, -40, 18, 80, 24, 12);
  ctx.fill();

  ctx.fillStyle = "#1f2937";
  roundedRectPath(ctx, -24, 26, 48, 10, 5);
  ctx.fill();

  ctx.fillStyle = "#5eead4";
  ctx.beginPath();
  ctx.arc(-18, 30, 6, 0, Math.PI * 2);
  ctx.arc(18, 30, 6, 0, Math.PI * 2);
  ctx.fill();

  drawWeaponRig();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 22px Avenir Next";
  ctx.textAlign = "center";
  ctx.fillText(state.troop, 0, 68);
  ctx.fillStyle = "rgba(255,255,255,0.76)";
  ctx.font = "700 12px Avenir Next";
  ctx.fillText(WEAPON_FAMILY, 0, 84);
  ctx.restore();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    drawBulletSprite(bullet);
  }
}

function drawWeaponRig() {
  const weaponMode = state.powerShotFrames > 0 ? "power" : state.rapidFireFrames > 0 ? "rapid" : "normal";
  const elementMode = getElementMode();
  const muzzlePulse = state.fireCooldown <= 2 && state.running ? 1 : 0;
  const recoil = muzzlePulse ? 4 : 0;

  ctx.save();
  ctx.translate(0, -4);

  ctx.fillStyle = "rgba(20,33,61,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 18, 34, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  if (weaponMode === "power") {
    ctx.fillStyle = "#f59e0b";
    roundedRectPath(ctx, -34, -8, 68, 22, 10);
    ctx.fill();
    ctx.fillStyle = "#fff3c4";
    roundedRectPath(ctx, -18, -16 - recoil, 54, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#1f2937";
    roundedRectPath(ctx, 18, -14, 28, 30, 9);
    ctx.fill();
    ctx.fillStyle = "#fcd34d";
    roundedRectPath(ctx, 46, -13 - recoil, 22, 10, 5);
    ctx.fill();
  } else if (weaponMode === "rapid") {
    ctx.fillStyle = "#38bdf8";
    roundedRectPath(ctx, -30, -6, 60, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#e0f2fe";
    roundedRectPath(ctx, -14, -14 - recoil, 48, 12, 6);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    roundedRectPath(ctx, 18, -10, 22, 22, 7);
    ctx.fill();
    ctx.fillStyle = "#7dd3fc";
    roundedRectPath(ctx, 42, -11 - recoil, 18, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#bae6fd";
    roundedRectPath(ctx, -28, 10, 56, 6, 3);
    ctx.fill();
  } else {
    ctx.fillStyle = "#94a3b8";
    roundedRectPath(ctx, -26, -4, 52, 16, 8);
    ctx.fill();
    ctx.fillStyle = "#e2e8f0";
    roundedRectPath(ctx, -10, -12 - recoil, 34, 10, 5);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    roundedRectPath(ctx, 12, -8, 18, 20, 6);
    ctx.fill();
    ctx.fillStyle = "#cbd5e1";
    roundedRectPath(ctx, 30, -9 - recoil, 14, 6, 3);
    ctx.fill();
  }

  ctx.fillStyle = "#1f2937";
  roundedRectPath(ctx, -10, 8, 20, 18, 8);
  ctx.fill();

  if (elementMode === "fire") {
    ctx.fillStyle = "#fb923c";
    roundedRectPath(ctx, 8, -18 - recoil, 24, 12, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(28, -24);
    ctx.quadraticCurveTo(46, -36, 52, -18);
    ctx.quadraticCurveTo(45, -4, 28, -14);
    ctx.fill();
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.moveTo(34, -22);
    ctx.quadraticCurveTo(42, -26, 44, -16);
    ctx.quadraticCurveTo(39, -10, 34, -16);
    ctx.fill();
  } else if (elementMode === "laser") {
    ctx.fillStyle = "#dbeafe";
    roundedRectPath(ctx, 6, -16 - recoil, 52, 8, 4);
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    roundedRectPath(ctx, 52, -20 - recoil, 22, 16, 6);
    ctx.fill();
    ctx.fillStyle = "#eff6ff";
    ctx.fillRect(10, -14 - recoil, 44, 4);
  } else if (elementMode === "ice") {
    ctx.strokeStyle = "#67e8f9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(22, -22);
    ctx.lineTo(34, -10);
    ctx.lineTo(46, -24);
    ctx.lineTo(58, -12);
    ctx.stroke();
  } else if (elementMode === "poison") {
    ctx.fillStyle = "#86efac";
    ctx.beginPath();
    ctx.arc(18, -14, 6, 0, Math.PI * 2);
    ctx.arc(30, -10, 8, 0, Math.PI * 2);
    ctx.arc(42, -14, 6, 0, Math.PI * 2);
    ctx.arc(54, -10, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (muzzlePulse) {
    const muzzleX = weaponMode === "power" ? 68 : weaponMode === "rapid" ? 60 : 44;
    ctx.fillStyle =
      elementMode === "fire"
        ? "rgba(251,146,60,0.82)"
        : elementMode === "laser"
          ? "rgba(147,197,253,0.82)"
          : elementMode === "ice"
            ? "rgba(103,232,249,0.82)"
            : elementMode === "poison"
              ? "rgba(134,239,172,0.82)"
              : weaponMode === "power"
                ? "rgba(251,191,36,0.82)"
                : "rgba(255,255,255,0.78)";
    ctx.beginPath();
    ctx.moveTo(muzzleX, -8);
    ctx.lineTo(muzzleX + 18, 0);
    ctx.lineTo(muzzleX, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,237,160,0.75)";
    ctx.beginPath();
    ctx.arc(muzzleX - 2, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  if (state.shieldCharges > 0) {
    ctx.strokeStyle = "rgba(167,139,250,0.7)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 2, 42, -0.25 * Math.PI, 1.25 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBulletSprite(bullet) {
  ctx.save();
  ctx.translate(bullet.x, bullet.y);

  if (bullet.kind === "laser") {
    ctx.fillStyle = "rgba(147, 197, 253, 0.12)";
    ctx.fillRect(-4, -20, 8, 40);
    ctx.fillStyle = "#dbeafe";
    roundedRectPath(ctx, -3, -14, 6, 28, 3);
    ctx.fill();
    ctx.fillStyle = "#93c5fd";
    ctx.fillRect(-1, -18, 2, 36);
  } else if (bullet.kind === "fire") {
    ctx.fillStyle = "rgba(251, 146, 60, 0.12)";
    ctx.beginPath();
    ctx.arc(0, 6, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(251, 146, 60, 0.2)";
    ctx.beginPath();
    ctx.arc(0, 8, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.quadraticCurveTo(16, -4, 10, 14);
    ctx.quadraticCurveTo(0, 10, -10, 14);
    ctx.quadraticCurveTo(-16, -4, 0, -18);
    ctx.fill();
    ctx.fillStyle = "#fdba74";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(8, 0, 4, 10);
    ctx.quadraticCurveTo(0, 7, -4, 10);
    ctx.quadraticCurveTo(-8, 0, 0, -10);
    ctx.fill();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.arc(0, 3, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (bullet.kind === "ice") {
    ctx.strokeStyle = "rgba(103, 232, 249, 0.2)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, 12);
    ctx.moveTo(-7, -4);
    ctx.lineTo(7, 4);
    ctx.moveTo(7, -4);
    ctx.lineTo(-7, 4);
    ctx.stroke();
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
  } else if (bullet.kind === "poison") {
    ctx.fillStyle = "rgba(134, 239, 172, 0.14)";
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#86efac";
    ctx.beginPath();
    ctx.arc(-3, -2, 6, 0, Math.PI * 2);
    ctx.arc(4, 2, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (bullet.kind === "power") {
    ctx.fillStyle = "rgba(245, 158, 11, 0.14)";
    ctx.beginPath();
    ctx.ellipse(0, 14, 8, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(245, 158, 11, 0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f59e0b";
    roundedRectPath(ctx, -5, -10, 10, 20, 5);
    ctx.fill();
    ctx.fillStyle = "#fff7cc";
    ctx.fillRect(-2, -8, 4, 12);
  } else if (bullet.kind === "rapid") {
    ctx.fillStyle = "rgba(56, 189, 248, 0.1)";
    ctx.beginPath();
    ctx.ellipse(0, 10, 5, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#38bdf8";
    roundedRectPath(ctx, -3, -8, 6, 16, 3);
    ctx.fill();
    ctx.fillStyle = "#e0f2fe";
    ctx.fillRect(-1, -6, 2, 8);
  } else {
    ctx.fillStyle = "rgba(250, 204, 21, 0.09)";
    ctx.beginPath();
    ctx.ellipse(0, 8, 4, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(250, 204, 21, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.arc(0, -1, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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

function drawParticles() {
  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.translate(particle.x, particle.y);

    if (particle.kind === "ring") {
      const growth = 1 + (particle.maxLife - particle.life) * 0.22;
      ctx.strokeStyle = particle.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * growth, 0, Math.PI * 2);
      ctx.stroke();
    } else if (particle.kind === "fireball") {
      const scale = 0.55 + particle.life / particle.maxLife;
      ctx.fillStyle = "rgba(251,146,60,0.32)";
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fb923c";
      ctx.beginPath();
      ctx.moveTo(0, -particle.size * 0.7 * scale);
      ctx.quadraticCurveTo(particle.size * 0.55 * scale, -particle.size * 0.1 * scale, particle.size * 0.28 * scale, particle.size * 0.52 * scale);
      ctx.quadraticCurveTo(0, particle.size * 0.36 * scale, -particle.size * 0.28 * scale, particle.size * 0.52 * scale);
      ctx.quadraticCurveTo(-particle.size * 0.55 * scale, -particle.size * 0.1 * scale, 0, -particle.size * 0.7 * scale);
      ctx.fill();
      ctx.fillStyle = "#fdba74";
      ctx.beginPath();
      ctx.moveTo(0, -particle.size * 0.38 * scale);
      ctx.quadraticCurveTo(particle.size * 0.24 * scale, -particle.size * 0.02 * scale, particle.size * 0.12 * scale, particle.size * 0.24 * scale);
      ctx.quadraticCurveTo(0, particle.size * 0.16 * scale, -particle.size * 0.12 * scale, particle.size * 0.24 * scale);
      ctx.quadraticCurveTo(-particle.size * 0.24 * scale, -particle.size * 0.02 * scale, 0, -particle.size * 0.38 * scale);
      ctx.fill();
    } else if (particle.kind === "flash") {
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * (particle.life / particle.maxLife), 0, Math.PI * 2);
      ctx.fill();
    } else if (particle.kind === "spark") {
      ctx.rotate(Math.atan2(particle.vy, particle.vx));
      ctx.fillStyle = particle.color;
      roundedRectPath(ctx, -particle.size / 2, -1.5, particle.size, 3, 1.5);
      ctx.fill();
    } else if (particle.kind === "ultimateSpark") {
      ctx.rotate(Math.atan2(particle.vy, particle.vx));
      const spark = ctx.createLinearGradient(-particle.size * 0.5, 0, particle.size, 0);
      spark.addColorStop(0, "rgba(255,255,255,0)");
      spark.addColorStop(0.4, particle.color);
      spark.addColorStop(1, "rgba(255,180,80,0)");
      ctx.fillStyle = spark;
      roundedRectPath(ctx, -particle.size * 0.35, -4, particle.size * 1.4, 8, 4);
      ctx.fill();
    } else if (particle.kind === "ultimateFlare") {
      const flare = ctx.createRadialGradient(0, 0, 2, 0, 0, particle.size);
      flare.addColorStop(0, "rgba(255,255,255,0.95)");
      flare.addColorStop(0.28, particle.color);
      flare.addColorStop(1, "rgba(251,146,60,0)");
      ctx.fillStyle = flare;
      ctx.beginPath();
      ctx.arc(0, 0, particle.size * (particle.life / particle.maxLife), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(255,244,214,${(particle.life / particle.maxLife) * 0.6})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -particle.size * 1.4);
      ctx.lineTo(0, particle.size * 1.4);
      ctx.moveTo(-particle.size * 1.2, 0);
      ctx.lineTo(particle.size * 1.2, 0);
      ctx.stroke();
    } else {
      ctx.fillStyle = particle.color;
      ctx.rotate((particle.maxLife - particle.life) * 0.08);
      roundedRectPath(ctx, -particle.size / 2, -particle.size / 2, particle.size, particle.size, 2);
      ctx.fill();
    }

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
  const shakeX = state.shakeFrames > 0 ? (Math.random() - 0.5) * state.shakePower : 0;
  const shakeY = state.shakeFrames > 0 ? (Math.random() - 0.5) * state.shakePower : 0;
  ctx.save();
  if (shakeX || shakeY) ctx.translate(shakeX, shakeY);
  drawBackground();
  drawUltimateOverlay();
  drawPreviewRow();
  drawCurrentRow();
  drawBoss();
  drawBullets();
  drawParticles();
  drawFloaters();
  drawCollisionLine();
  drawPlayer();
  drawMessage();
  ctx.restore();
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

function registerOfflineSupport() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${OFFLINE_CACHE_VERSION}`)
      .then((registration) => {
        if (registration.waiting) {
          waitingServiceWorker = registration.waiting;
          shouldReloadForUpdate = true;
          updateAppChrome();
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              waitingServiceWorker = newWorker;
              shouldReloadForUpdate = true;
              updateAppChrome();
            }
          });
        });

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!shouldReloadForUpdate) return;
          shouldReloadForUpdate = false;
          window.location.reload();
        });
      })
      .catch((error) => {
        console.error("Service worker registration failed", error);
      });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    if (event.key === "ArrowLeft") event.preventDefault();
    moveLane(-1);
  } else if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    if (event.key === "ArrowRight") event.preventDefault();
    moveLane(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    activateUltimate();
  } else if (event.key === " ") {
    event.preventDefault();
    startGame();
  }
});

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
leftButton.addEventListener("click", () => moveLane(-1));
rightButton.addEventListener("click", () => moveLane(1));
ultimateButton.addEventListener("click", activateUltimate);
volumeSlider.addEventListener("input", (event) => {
  setMasterVolume(Number(event.target.value) / 100);
  if (Number(event.target.value) > 0) {
    unlockAudio().then(() => {
      playTone(660, 0.08, { type: "triangle", volume: 0.08 });
    });
  }
});
canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  moveLane(x < rect.width / 2 ? -1 : 1);
});

installAudioUnlock();
initAppExperience();
registerOfflineSupport();

if (launchParams.get("action") === "start") {
  startGame();
} else if (launchParams.get("action") === "offline") {
  setOverlay("離線模式就緒", "照樣能玩", "核心內容已快取，沒有網路也能直接開局。", "開始");
}

window.__gameDebug = {
  getSnapshot() {
    return {
      running: state.running,
      troop: state.troop,
      combo: state.combo,
      rowsCompleted: state.rowsCompleted,
      currentLane: state.currentLane,
      bulletCount: state.bullets.length,
      transitionClears: state.transitionClears,
      bossActive: state.bossActive,
      currentRow: state.currentRow
        ? {
            y: state.currentRowY,
            fullyVisible: isFullyVisible(state.currentRowY, HALF_BLOCK_HEIGHT),
            resolved: state.currentRowResolved,
            blocks: state.currentRow.blocks.map((block) => ({
              lane: block.lane,
              hp: block.hp,
              entityType: block.entityType,
              state: block.state,
              rewardType: block.rewardType,
              rewardValue: block.rewardValue,
            })),
          }
        : null,
    };
  },
  startGame,
  setCurrentRowForTest(rowConfig) {
    state.currentRow = {
      index: state.rowsCompleted,
      hint: "test-row",
      blocks: rowConfig.blocks.map((block) => ({
        lane: block.lane,
        hp: block.hp,
        maxHp: block.hp,
        entityType: block.entityType,
        rewardType: block.rewardType,
        rewardValue: block.rewardValue,
        reward: { type: block.rewardType, value: block.rewardValue },
        perk: null,
        state: "falling",
        hitFlash: 0,
        breakFrames: 0,
        burnFrames: 0,
        poisonFrames: 0,
        slowFrames: 0,
        statusTick: 0,
        enemyType: block.enemyType ?? null,
        enemyStats: block.enemyType ? ENEMY_TYPES[block.enemyType] : null,
        crystalColor: block.crystalColor ?? "green",
        sizeScale: block.sizeScale ?? 1,
      })),
    };
    state.currentRowY = ROW_START_Y;
    state.currentRowResolved = false;
    state.bullets = [];
    state.fireCooldown = 0;
    updateHud();
  },
};

loadBestProgress();
state.currentRow = createRow(0);
state.nextRow = createRow(1);
state.boss = createBoss();
updateHud();
render();
loop();
