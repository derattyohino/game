(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const context = canvas.getContext("2d");
  const startDialog = document.getElementById("start-dialog");
  const endDialog = document.getElementById("end-dialog");
  const endTitle = document.getElementById("end-title");
  const endMessage = document.getElementById("end-message");
  const endKicker = document.getElementById("end-kicker");
  const keys = new Set();
  let jumpRequested = false;
  const width = canvas.width;
  const height = canvas.height;
  const groundY = 430;
  let levelLength = 0;
  const timeLimit = 50;
  const itemTimeBonus = 10;
  const playerHitbox = { width: 44, height: 126 };
  const platforms = [];
  const staticPlatforms = [];
  const obstacles = [];
  let timeItem;
  let stageElapsed = 0;
  let runSeed = 0;
  let biome = 0;
  let terrainProfile = [];
  let scenery = [];
  const biomes = [
    { name: "星空の浮遊島", sky: ["#182747", "#426b8b", "#d9a77d"], rock: "#33405a", rockTop: "#657c91", accent: "#8ce0df", distant: "#667b9a", moon: "#ffe2a8" },
    { name: "深紅の火山", sky: ["#260f24", "#803b48", "#ed9866"], rock: "#392638", rockTop: "#b55b55", accent: "#ffba6b", distant: "#613448", moon: "#ffd1a0" },
    { name: "蒼氷の峡谷", sky: ["#10253b", "#39718b", "#b2d8d6"], rock: "#283c53", rockTop: "#73b7c0", accent: "#b5f5ee", distant: "#567e9a", moon: "#e1fbff" },
    { name: "夕焼けの遺跡", sky: ["#32213d", "#aa5c61", "#f0b16d"], rock: "#433044", rockTop: "#cd8c67", accent: "#ffe08a", distant: "#80515b", moon: "#ffe2ab" }
  ];
  const spriteFiles = {
    idle: "pic/sayu_game.png",
    run: "pic/sayu_run_game.png",
    jump: "pic/sayu_jump_game.png"
  };
  const sprites = {};
  const music = document.getElementById("bgm");
  const musicToggle = document.getElementById("music-toggle");
  let musicEnabled = true;
  let state = "ready";
  let player;
  let cameraX = 0;
  let remainingTime = timeLimit;
  let stage = 1;
  let clearedStages = 0;
  let lastFrame = 0;
  let fallMessage = 0;
  let fallMessageText = "あわてずに、もう一度！";

  for (const [name, source] of Object.entries(spriteFiles)) {
    const image = new Image();
    image.src = source;
    image.addEventListener("load", draw);
    image.addEventListener("error", () => {
      console.error(`キャラクター画像を読み込めませんでした: ${source}`);
    });
    sprites[name] = image;
  }

  function createRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function generateStage(stageNumber) {
    const random = createRandom((runSeed + stageNumber * 7919 + 104729) >>> 0);
    biome = (stageNumber - 1) % biomes.length;
    platforms.length = 0;
    staticPlatforms.length = 0;
    obstacles.length = 0;
    terrainProfile = [];
    scenery = [];
    stageElapsed = 0;
    let positionX = 0;
    let previousY = groundY;
    const segmentCount = Math.min(10 + stageNumber, 22);
    const difficulty = Math.min(stageNumber - 1, 8);
    const gapMinimum = 65 + difficulty * 5;
    const gapMaximum = Math.min(gapMinimum + 40 + difficulty * 2, 145);
    const widthMinimum = Math.max(125, 245 - difficulty * 15);
    const obstacleTypes = [
      { kind: "cone", width: 48, height: 40 },
      { kind: "barrier", width: 60, height: 48 },
      { kind: "crate", width: 50, height: 46 },
      { kind: "bench", width: 66, height: 42 }
    ];
    const heights = [300, 340, 380, 420];
    const obstacleFrequency = Math.max(2, 4 - Math.floor(difficulty / 2));
    const movingPlatformFrequency = Math.max(2, 4 - Math.floor(difficulty / 3));

    for (let index = 0; index < segmentCount; index++) {
      if (index > 0) {
        const reachableHeights = heights.filter((y) => Math.abs(y - previousY) <= 100);
        const nextY = index === segmentCount - 1
          ? 400
          : reachableHeights[Math.floor(random() * reachableHeights.length)];
        const gap = gapMinimum + Math.floor(random() * (gapMaximum - gapMinimum + 1));
        const movingBridge = index % movingPlatformFrequency === 1;

        if (movingBridge) {
          const bridgeBaseY = Math.min(440, Math.min(previousY, nextY) + 48);
          const phase = random() * Math.PI * 2;
          const amplitude = 20 + random() * 18;
          const period = Math.max(1.25, 2.4 - difficulty * 0.1) + random() * 0.6;
          const bridgeWidth = Math.max(64, 92 - difficulty * 3) + Math.floor(random() * 14);
          const bridgeX = positionX + Math.max(0, (gap - bridgeWidth) / 2);
          const bridge = {
            id: `moving-${index}`,
            x: bridgeX,
            width: bridgeWidth,
            baseY: bridgeBaseY,
            y: bridgeBaseY + Math.sin(phase) * amplitude,
            previousY: bridgeBaseY + Math.sin(phase) * amplitude,
            deltaY: 0,
            amplitude,
            period,
            phase,
            moving: true
          };
          platforms.push(bridge);
        }

        positionX += gap;
        previousY = nextY;
      }

      const segmentWidth = widthMinimum + Math.floor(random() * 81);
      const isLast = index === segmentCount - 1;
      const segment = {
        id: `ground-${index}`,
        x: positionX,
        width: segmentWidth,
        y: isLast ? 420 : previousY,
        baseY: isLast ? 420 : previousY,
        previousY: isLast ? 420 : previousY,
        deltaY: 0,
        moving: false
      };
      platforms.push(segment);
      staticPlatforms.push(segment);
      terrainProfile.push({ x: segment.x, width: segment.width, y: segment.y });

      if (index > 0 && index < segmentCount - 1 && index % obstacleFrequency === 0) {
        const obstacle = obstacleTypes[Math.floor(random() * obstacleTypes.length)];
        obstacles.push({
          ...obstacle,
          x: segment.x + 55 + Math.floor(random() * Math.max(1, segment.width - obstacle.width - 110)),
          y: segment.y - obstacle.height,
          floorY: segment.y,
          bottom: segment.y
        });
      }

      positionX += segmentWidth;
    }

    levelLength = positionX + 100;
    for (let index = 0; index < Math.ceil(levelLength / 220); index++) {
      scenery.push({
        x: index * 220 + random() * 90,
        height: 55 + random() * 135,
        width: 34 + random() * 54,
        variant: Math.floor(random() * 3)
      });
    }
    const itemSegments = staticPlatforms.filter((segment) => !obstacles.some((obstacle) =>
      obstacle.x + obstacle.width > segment.x + segment.width * 0.35
      && obstacle.x < segment.x + segment.width * 0.65
    ));
    const itemSegment = itemSegments[Math.floor(random() * itemSegments.length)];
    timeItem = {
      x: itemSegment.x + itemSegment.width / 2,
      y: itemSegment.y - 30,
      radius: 16,
      collected: false
    };
  }

  function resetPlayer() {
    const startingPlatform = staticPlatforms[0];
    player = {
      x: 105,
      y: startingPlatform.y - playerHitbox.height,
      velocityY: 0,
      grounded: true,
      standingPlatformId: "ground-0",
      facing: 1,
      runFrame: 0
    };
    cameraX = 0;
    fallMessage = 0;
    fallMessageText = "あわてずに、もう一度！";
    jumpRequested = false;
    keys.clear();
  }

  function resetGame() {
    stage = 1;
    clearedStages = 0;
    remainingTime = timeLimit;
    runSeed = Math.floor(Math.random() * 4294967296);
    generateStage(stage);
    resetPlayer();
  }

  function updateMusicButton() {
    musicToggle.textContent = musicEnabled ? "♫ BGM：オン" : "♫ BGM：オフ";
    musicToggle.setAttribute("aria-pressed", String(musicEnabled));
  }

  function showMusicError(message, error) {
    musicEnabled = false;
    musicToggle.textContent = "♫ BGM再生エラー";
    musicToggle.setAttribute("aria-pressed", "false");
    musicToggle.title = "音声再生に失敗しました。Live ServerなどWebサーバー経由で開いてください。";
    console.error(message, error);
  }

  function playMusic() {
    if (!musicEnabled) return;
    music.play()
      .then(() => musicToggle.removeAttribute("title"))
      .catch((error) => showMusicError("BGMを再生できませんでした。", error));
  }

  function startGame() {
    resetGame();
    state = "playing";
    startDialog.classList.add("is-hidden");
    endDialog.classList.add("is-hidden");
    music.currentTime = 0;
    playMusic();
    lastFrame = performance.now();
  }

  function finishGame() {
    state = "lost";
    keys.clear();
    music.pause();
    endKicker.textContent = "TIME IS UP";
    endTitle.textContent = "タイムアップ！";
    endMessage.textContent = `到達ステージ：${stage}　／　クリアしたステージ：${clearedStages}`;
    endDialog.classList.remove("is-hidden");
    draw();
  }

  function clearStage() {
    clearedStages = stage;
    stage += 1;
    generateStage(stage);
    resetPlayer();
    fallMessage = 1.7;
    fallMessageText = `STAGE ${stage}！`;
  }

  function isPressed(...codes) {
    return codes.some((code) => keys.has(code));
  }

  function update(delta) {
    if (state !== "playing") return;
    const shouldJump = jumpRequested;
    jumpRequested = false;
    remainingTime = Math.max(0, remainingTime - delta);
    fallMessage = Math.max(0, fallMessage - delta);
    if (remainingTime === 0) {
      finishGame();
      return;
    }

    const movingLeft = isPressed("ArrowLeft", "KeyA");
    const movingRight = isPressed("ArrowRight", "KeyD");
    const horizontal = Number(movingRight) - Number(movingLeft);
    for (const platform of platforms) {
      platform.previousY = platform.y;
      if (platform.moving) {
        platform.y = platform.baseY
          + Math.sin((stageElapsed / platform.period) * Math.PI * 2 + platform.phase) * platform.amplitude;
      }
      platform.deltaY = platform.y - platform.previousY;
    }
    stageElapsed += delta;
    if (player.grounded && player.standingPlatformId) {
      const standingPlatform = platforms.find((platform) => platform.id === player.standingPlatformId);
      if (standingPlatform && standingPlatform.moving) player.y += standingPlatform.deltaY;
    }
    const previousBottom = player.y + playerHitbox.height;
    const previousX = player.x;
    player.x = Math.max(14, Math.min(levelLength - 30, player.x + horizontal * 255 * delta));

    if (horizontal !== 0) {
      for (const obstacle of obstacles) {
        const overlapsSolidSide = player.y + playerHitbox.height > obstacle.y
          && player.y < obstacle.bottom;
        const overlapsSolidX = player.x + playerHitbox.width / 2 > obstacle.x
          && player.x - playerHitbox.width / 2 < obstacle.x + obstacle.width;
        if (overlapsSolidSide && overlapsSolidX) {
          player.x = horizontal > 0
            ? Math.min(player.x, obstacle.x - playerHitbox.width / 2)
            : Math.max(player.x, obstacle.x + obstacle.width + playerHitbox.width / 2);
        }
      }
    }

    player.grounded = false;
    if (player.x !== previousX) player.facing = Math.sign(player.x - previousX);

    player.velocityY += 1850 * delta;
    player.y += player.velocityY * delta;

    if (player.velocityY >= 0) {
      const left = player.x - playerHitbox.width / 2;
      const right = player.x + playerHitbox.width / 2;
      const landingSurface = [...platforms, ...obstacles]
        .filter((solid) => right > solid.x
          && left < solid.x + solid.width
          && previousBottom <= solid.y
          && player.y + playerHitbox.height >= solid.y)
        .sort((a, b) => a.y - b.y)[0];
      if (landingSurface) {
        player.y = landingSurface.y - playerHitbox.height;
        player.velocityY = 0;
        player.grounded = true;
        player.standingPlatformId = landingSurface.id || null;
      }
    }

    if (player.grounded) {
      if (shouldJump) {
        player.velocityY = -690;
        player.grounded = false;
        player.standingPlatformId = null;
      }
      player.runFrame += delta;
    }

    if (player.y > height + 75) {
      const previousPlatform = staticPlatforms
        .slice()
        .reverse()
        .find((platform) => platform.x + platform.width <= player.x);
      player.x = previousPlatform ? previousPlatform.x + Math.min(40, previousPlatform.width / 2) : 105;
      player.y = (previousPlatform ? previousPlatform.baseY : groundY) - playerHitbox.height;
      player.velocityY = 0;
      player.grounded = true;
      player.standingPlatformId = previousPlatform ? previousPlatform.id : "ground-0";
      remainingTime = Math.max(0, remainingTime - 4);
      fallMessage = 1.7;
      fallMessageText = "あわてずに、もう一度！";
    }

    if (!timeItem.collected
      && Math.abs(player.x - timeItem.x) < playerHitbox.width / 2 + timeItem.radius
      && player.y < timeItem.y + timeItem.radius
      && player.y + playerHitbox.height > timeItem.y - timeItem.radius) {
      timeItem.collected = true;
      remainingTime += itemTimeBonus;
      fallMessage = 1.7;
      fallMessageText = `残り時間 +${itemTimeBonus}秒！`;
    }

    cameraX = Math.max(0, Math.min(levelLength - width + 100, player.x - width * 0.32));
    if (player.x >= levelLength - 125) clearStage();
  }

  function roundedRect(x, y, w, h, radius) {
    context.beginPath();
    context.roundRect(x, y, w, h, radius);
    context.fill();
  }

  function drawBackground() {
    const palette = biomes[biome];
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, palette.sky[0]);
    sky.addColorStop(0.55, palette.sky[1]);
    sky.addColorStop(1, palette.sky[2]);
    context.fillStyle = sky;
    context.fillRect(0, 0, width, height);

    context.fillStyle = palette.moon;
    context.globalAlpha = 0.78;
    context.beginPath();
    context.arc(760 - cameraX * 0.035, 112, biome === 1 ? 42 : 31, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;

    for (let i = 0; i < 32; i++) {
      const starX = ((i * 193 - cameraX * 0.1) % (width + 80) + width + 80) % (width + 80);
      const starY = 30 + ((i * 61) % 160);
      context.fillStyle = i % 3 === 0 ? "rgba(255,238,215,.8)" : "rgba(255,255,255,.45)";
      context.fillRect(starX, starY, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }

    drawDistantIslands(palette);
    drawScenery(palette);
    drawTerrainBackdrop(palette);
  }

  function drawDistantIslands(palette) {
    const shift = cameraX * 0.2;
    const first = Math.floor(shift / 360);
    context.fillStyle = palette.distant;
    context.globalAlpha = 0.48;
    for (let index = first; index < first + 6; index++) {
      const x = index * 360 - shift;
      const top = 250 + ((index * 47 % 80) + 80) % 80;
      context.beginPath();
      context.moveTo(x - 70, top + 36);
      context.lineTo(x + 18, top);
      context.lineTo(x + 65, top + 32);
      context.lineTo(x + 122, top + 10);
      context.lineTo(x + 195, top + 50);
      context.lineTo(x + 160, top + 61);
      context.lineTo(x - 48, top + 61);
      context.closePath();
      context.fill();
      context.fillStyle = palette.accent;
      context.beginPath();
      context.moveTo(x + 18, top + 5);
      context.lineTo(x + 7, top + 29);
      context.lineTo(x + 30, top + 22);
      context.closePath();
      context.fill();
      context.fillStyle = palette.distant;
    }
    context.globalAlpha = 1;
  }

  function drawScenery(palette) {
    for (const landmark of scenery) {
      const x = landmark.x - cameraX * 0.58;
      if (x + landmark.width < 0 || x > width) continue;
      const y = 390 - landmark.height;
      context.save();
      context.fillStyle = palette.distant;
      context.globalAlpha = 0.7;
      if (biome === 0) {
        context.beginPath();
        context.moveTo(x, y + landmark.height);
        context.lineTo(x + landmark.width * 0.48, y);
        context.lineTo(x + landmark.width, y + landmark.height);
        context.closePath();
        context.fill();
        context.fillStyle = palette.accent;
        context.fillRect(x + landmark.width * 0.38, y + landmark.height * 0.55, 7, 13);
      } else if (biome === 1) {
        context.beginPath();
        context.moveTo(x, y + landmark.height);
        context.lineTo(x + landmark.width * 0.18, y + landmark.height * 0.42);
        context.lineTo(x + landmark.width * 0.4, y + landmark.height * 0.62);
        context.lineTo(x + landmark.width * 0.66, y);
        context.lineTo(x + landmark.width, y + landmark.height);
        context.closePath();
        context.fill();
        context.fillStyle = palette.accent;
        context.fillRect(x + landmark.width * 0.58, y + landmark.height * 0.48, 5, landmark.height * 0.42);
      } else if (biome === 2) {
        context.beginPath();
        context.moveTo(x + landmark.width * 0.2, y + landmark.height);
        context.lineTo(x + landmark.width * 0.42, y);
        context.lineTo(x + landmark.width * 0.58, y + landmark.height * 0.38);
        context.lineTo(x + landmark.width * 0.78, y + landmark.height * 0.12);
        context.lineTo(x + landmark.width, y + landmark.height);
        context.closePath();
        context.fill();
        context.fillStyle = palette.accent;
        context.fillRect(x + landmark.width * 0.43, y + landmark.height * 0.28, 4, landmark.height * 0.35);
      } else {
        context.fillRect(x + landmark.width * 0.35, y, landmark.width * 0.3, landmark.height);
        context.fillRect(x, y + landmark.height * 0.35, landmark.width, landmark.height * 0.13);
        context.fillStyle = palette.accent;
        context.beginPath();
        context.arc(x + landmark.width * 0.5, y, landmark.width * 0.3, Math.PI, 0);
        context.fill();
      }
      context.restore();
    }
  }

  function drawTerrainBackdrop(palette) {
    context.save();
    context.fillStyle = palette.rock;
    context.strokeStyle = palette.rockTop;
    context.lineWidth = 3;
    context.globalAlpha = 0.7;

    for (const segment of terrainProfile) {
      const left = segment.x - cameraX;
      const right = left + segment.width;
      if (right < 0 || left > width) continue;
      const shelfWidth = 55;
      const segmentEnd = segment.x + segment.width;
      const firstShelf = Math.floor(segment.x / shelfWidth) * shelfWidth;
      for (let shelfX = firstShelf; shelfX < segmentEnd; shelfX += shelfWidth) {
        const worldX = Math.max(shelfX, segment.x);
        const shelfEnd = Math.min(shelfX + shelfWidth, segmentEnd);
        const x = worldX - cameraX;
        const chunkWidth = shelfEnd - worldX;
        const noise = Math.sin(worldX * 0.015) * 9 + Math.cos(worldX * 0.041) * 6;
        const top = segment.y + 24 + noise;
        const depth = 90 + ((Math.floor(worldX / shelfWidth) * 37) % 100);
        context.beginPath();
        context.moveTo(x, top);
        context.lineTo(x + chunkWidth * 0.78, top + 4);
        context.lineTo(x + chunkWidth, top + depth);
        context.lineTo(x + 10, top + depth - 12);
        context.closePath();
        context.fill();
        context.strokeStyle = palette.rockTop;
        context.beginPath();
        context.moveTo(x + 6, top + 13);
        context.lineTo(x + shelfWidth * 0.45, top + 20);
        context.stroke();
      }
      context.fillStyle = palette.accent;
      context.globalAlpha = 0.42;
      context.fillRect(left, segment.y + 22, segment.width, 3);
      context.fillStyle = palette.rock;
      context.globalAlpha = 0.7;
    }

    context.restore();
  }

  function drawPlatform(platform) {
    const screenX = platform.x - cameraX;
    if (screenX > width || screenX + platform.width < 0) return;
    if (platform.moving) {
      context.save();
      context.strokeStyle = "rgba(220, 193, 255, 0.4)";
      context.lineWidth = 2;
      context.setLineDash([5, 6]);
      context.beginPath();
      context.moveTo(screenX + platform.width / 2, platform.baseY - platform.amplitude);
      context.lineTo(screenX + platform.width / 2, platform.baseY + platform.amplitude);
      context.stroke();
      context.setLineDash([]);
    }
    context.fillStyle = platform.moving ? "#51466f" : "#37334c";
    context.fillRect(screenX, platform.y, platform.width, 22);
    context.fillStyle = platform.moving ? "#d6b7ff" : "#ffc28f";
    context.fillRect(screenX, platform.y, platform.width, 5);
    if (platform.moving) {
      context.fillStyle = "#f4eaff";
      context.fillRect(screenX + 8, platform.y + 10, platform.width - 16, 3);
      context.restore();
      return;
    }
    context.fillStyle = "rgba(255, 255, 255, 0.13)";
    for (let x = Math.ceil(screenX / 72) * 72; x < screenX + platform.width; x += 72) {
      context.fillRect(x, platform.y + 11, 34, 3);
    }
  }

  function drawObstacles() {
    for (const obstacle of obstacles) {
      const x = obstacle.x - cameraX;
      const top = obstacle.y;
      const floor = obstacle.floorY;
      if (x + obstacle.width < 0 || x > width) continue;

      context.save();
      if (obstacle.kind === "cone") {
        context.fillStyle = "#f4a476";
        context.beginPath();
        context.moveTo(x + obstacle.width / 2, top);
        context.lineTo(x + obstacle.width, floor);
        context.lineTo(x, floor);
        context.closePath();
        context.fill();
        context.fillStyle = "#fff0d6";
        context.fillRect(x + 12, top + obstacle.height * 0.55, obstacle.width - 24, 6);
      } else if (obstacle.kind === "crate") {
        context.fillStyle = "#a76b5c";
        context.fillRect(x, top, obstacle.width, obstacle.height);
        context.strokeStyle = "#e9ae82";
        context.lineWidth = 4;
        context.strokeRect(x + 4, top + 4, obstacle.width - 8, obstacle.height - 8);
        context.beginPath();
        context.moveTo(x + 7, top + 7);
        context.lineTo(x + obstacle.width - 7, floor - 7);
        context.moveTo(x + obstacle.width - 7, top + 7);
        context.lineTo(x + 7, floor - 7);
        context.stroke();
      } else if (obstacle.kind === "bench") {
        context.fillStyle = "#3b3046";
        context.fillRect(x + 8, top + 8, obstacle.width - 16, obstacle.height - 8);
        context.fillStyle = "#d09573";
        context.fillRect(x, top, obstacle.width, 9);
        context.fillStyle = "#e6b18a";
        context.fillRect(x + 9, top + 9, 7, obstacle.height - 9);
        context.fillRect(x + obstacle.width - 16, top + 9, 7, obstacle.height - 9);
      } else {
        context.fillStyle = "#ede0d0";
        context.fillRect(x + 5, top + 13, obstacle.width - 10, obstacle.height - 13);
        context.fillStyle = "#ef977d";
        context.beginPath();
        context.moveTo(x, top + 13);
        context.lineTo(x + obstacle.width / 2, top);
        context.lineTo(x + obstacle.width, top + 13);
        context.lineTo(x + obstacle.width, top + 23);
        context.lineTo(x, top + 23);
        context.closePath();
        context.fill();
        context.fillStyle = "#f9e8d2";
        context.fillRect(x + 5, top + 24, obstacle.width - 10, 5);
      }
      context.restore();
    }
  }

  function drawTimeItem() {
    if (timeItem.collected) return;
    const x = timeItem.x - cameraX;
    if (x + timeItem.radius < 0 || x - timeItem.radius > width) return;
    context.save();
    context.fillStyle = "rgba(255, 220, 133, 0.25)";
    context.beginPath();
    context.arc(x, timeItem.y, timeItem.radius + 7, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ffd76a";
    context.beginPath();
    context.arc(x, timeItem.y, timeItem.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#6b4328";
    context.font = "800 16px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("+", x, timeItem.y);
    context.restore();
  }

  function drawLandmarks() {
    const palette = biomes[biome];
    const stationPlatform = staticPlatforms[0];
    const stationX = 28 - cameraX;
    const stationY = stationPlatform.y;
    if (stationX > -170 && stationX < width + 20) {
      context.save();
      context.fillStyle = palette.distant;
      context.fillRect(stationX, stationY - 94, 122, 94);
      context.fillStyle = palette.rock;
      context.fillRect(stationX - 8, stationY - 102, 138, 12);
      context.fillStyle = palette.moon;
      context.font = "800 12px sans-serif";
      context.textAlign = "center";
      context.fillText("STATION", stationX + 61, stationY - 116);
      context.fillStyle = palette.sky[1];
      context.fillRect(stationX + 18, stationY - 70, 86, 27);
      context.fillStyle = palette.rock;
      context.font = "800 15px sans-serif";
      context.fillText("駅", stationX + 61, stationY - 51);
      context.fillStyle = "rgba(255,255,255,0.12)";
      context.beginPath();
      context.moveTo(stationX + 61, stationY - 42);
      context.lineTo(stationX - 12, stationY);
      context.lineTo(stationX + 134, stationY);
      context.fill();
      context.restore();
    }

    const goalPlatform = staticPlatforms[staticPlatforms.length - 1];
    const goalX = levelLength - 82 - cameraX;
    const goalY = goalPlatform.y;
    if (goalX < -160 || goalX > width + 160) return;

    context.save();
    context.fillStyle = palette.distant;
    context.fillRect(goalX + 10, goalY - 103, 90, 103);
    context.fillStyle = palette.rock;
    context.fillRect(goalX, goalY - 115, 110, 14);
    context.fillStyle = palette.accent;
    context.font = "800 12px sans-serif";
    context.textAlign = "center";
    context.fillText("STAGE CLEAR", goalX + 55, goalY - 126);
    context.fillStyle = palette.sky[1];
    context.fillRect(goalX + 27, goalY - 72, 56, 72);
    context.fillStyle = palette.moon;
    context.fillRect(goalX + 36, goalY - 61, 38, 6);
    context.fillStyle = "rgba(255,255,255,0.12)";
    context.beginPath();
    context.moveTo(goalX + 55, goalY - 74);
    context.lineTo(goalX - 20, goalY);
    context.lineTo(goalX + 130, goalY);
    context.fill();
    context.restore();
  }

  function drawPlayer() {
    const moving = isPressed("ArrowLeft", "KeyA", "ArrowRight", "KeyD");
    const spriteName = !player.grounded ? "jump" : moving ? (Math.floor(player.runFrame / 0.14) % 2 === 0 ? "idle" : "run") : "idle";
    const sprite = sprites[spriteName];
    if (!sprite || !sprite.complete || sprite.naturalWidth === 0) return;
    const drawHeight = 142;
    const drawWidth = drawHeight * sprite.naturalWidth / sprite.naturalHeight;
    const screenX = player.x - cameraX - drawWidth / 2;
    const screenY = player.y + playerHitbox.height - drawHeight;
    context.save();
    if (player.facing < 0) {
      context.translate(screenX * 2 + drawWidth, 0);
      context.scale(-1, 1);
      context.drawImage(sprite, screenX, screenY, drawWidth, drawHeight);
    } else {
      context.drawImage(sprite, screenX, screenY, drawWidth, drawHeight);
    }
    context.restore();
  }

  function drawHud() {
    context.save();
    context.fillStyle = "rgba(24, 23, 43, 0.76)";
    roundedRect(22, 18, 234, 58, 15);
    context.fillStyle = "#d6c6ee";
    context.font = "700 11px sans-serif";
    context.fillText(`STAGE ${stage} · ${biomes[biome].name}`, 39, 39);
    context.fillStyle = "#fff8ef";
    context.font = "700 16px sans-serif";
    context.fillText(player.x < 260 ? "足場を越えて進もう！" : "ライブハウスへ！", 39, 61);

    context.fillStyle = "rgba(24, 23, 43, 0.82)";
    roundedRect(width - 149, 18, 127, 58, 15);
    context.fillStyle = "#d6c6ee";
    context.font = "700 11px sans-serif";
    context.fillText("OPENING IN", width - 130, 39);
    context.fillStyle = remainingTime < 10 ? "#ffaaa5" : "#fff8ef";
    context.font = "800 21px sans-serif";
    context.fillText(`${Math.ceil(remainingTime)}s`, width - 130, 64);

    const progress = Math.max(0, Math.min(1, player.x / levelLength));
    context.fillStyle = "rgba(255, 255, 255, 0.24)";
    roundedRect(width / 2 - 100, 30, 200, 8, 5);
    context.fillStyle = "#e4b7ff";
    roundedRect(width / 2 - 100, 30, 200 * progress, 8, 5);
    context.fillStyle = "#f2eafd";
    context.font = "600 10px sans-serif";
    context.textAlign = "center";
    context.fillText("駅", width / 2 - 108, 48);
    context.fillText("ライブハウス", width / 2 + 109, 48);
    context.textAlign = "start";

    if (fallMessage > 0) {
      context.globalAlpha = Math.min(1, fallMessage * 2);
      context.fillStyle = "rgba(34, 24, 43, 0.78)";
      roundedRect(width / 2 - 115, 93, 230, 36, 12);
      context.fillStyle = "#fff0ce";
      context.font = "700 13px sans-serif";
      context.textAlign = "center";
      context.fillText(fallMessageText, width / 2, 117);
      context.textAlign = "start";
    }
    context.restore();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    drawBackground();
    for (const platform of platforms) drawPlatform(platform);
    drawObstacles();
    drawTimeItem();
    drawLandmarks();
    if (player) {
      drawPlayer();
      drawHud();
    }
  }

  function frame(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.04);
    lastFrame = now;
    update(delta);
    draw();
    requestAnimationFrame(frame);
  }

  document.getElementById("start-button").addEventListener("click", startGame);
  document.getElementById("restart-button").addEventListener("click", startGame);
  musicToggle.addEventListener("click", () => {
    musicEnabled = !musicEnabled;
    updateMusicButton();
    if (musicEnabled && state === "playing") playMusic();
    else music.pause();
  });
  music.addEventListener("error", () => showMusicError(
    "BGMファイルを読み込めませんでした: assets/running-to-the-live-house.wav",
    music.error
  ));

  window.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Space" && state !== "playing") return;
    if (!keys.has(event.code) && ["Space", "ArrowUp", "KeyW"].includes(event.code)) jumpRequested = true;
    keys.add(event.code);
  });

  window.addEventListener("keyup", (event) => keys.delete(event.code));
  window.addEventListener("blur", () => keys.clear());

  for (const button of document.querySelectorAll(".touch-button")) {
    const code = button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      if (code === "Space") jumpRequested = true;
      keys.add(code);
    });
    const release = () => keys.delete(code);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  updateMusicButton();
  resetGame();
  requestAnimationFrame((now) => {
    lastFrame = now;
    requestAnimationFrame(frame);
  });
})();
