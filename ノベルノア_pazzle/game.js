(() => {
  const SIZE = 6;
  const STARTING_PARTY_HP = 100;
  const STAGES = [
    { name: "月影の守護者", area: "星降る遺跡", element: "紫属性", weakness: "red", icon: "☾", hp: 1150, time: 120, attackEvery: 9, attackDamage: 22, obstacles: ["block", "freeze", "poison"], colors: ["#e0d1ff", "#9a7bc6", "#5d486f", "#c8b3ee"] },
    { name: "紅蓮の翼獣", area: "溶岩の古城", element: "炎属性", weakness: "water", icon: "♨", hp: 1500, time: 115, attackEvery: 8, attackDamage: 25, obstacles: ["block", "freeze", "poison", "block"], colors: ["#ffe0bd", "#cb684c", "#693a53", "#ffa36d"] },
    { name: "霧氷の女王", area: "白銀の霊峰", element: "氷属性", weakness: "red", icon: "❄", hp: 1900, time: 110, attackEvery: 7, attackDamage: 28, obstacles: ["freeze", "block", "poison", "freeze"], colors: ["#e1fbff", "#69b9d1", "#355c82", "#9be9ff"] },
    { name: "深淵の魔樹", area: "星喰いの森", element: "森属性", weakness: "white", icon: "♣", hp: 2300, time: 105, attackEvery: 6, attackDamage: 32, obstacles: ["poison", "block", "freeze", "poison"], colors: ["#d9ffd0", "#648b55", "#354939", "#a9f289"] },
    { name: "終焉の星竜", area: "星の祭壇", element: "星属性", weakness: "purple", icon: "✹", hp: 2750, time: 100, attackEvery: 5, attackDamage: 35, obstacles: ["block", "poison", "freeze", "block"], colors: ["#ffe2f2", "#ac67a8", "#3e355e", "#ffa9df"] },
  ];
  const BLUE_CHANCE = 0.045;
  const COLORS = ["water", "white", "red", "pink", "purple"];
  const TILE_SYMBOLS = {
    water: "✧",
    white: "✦",
    red: "♥",
    pink: "♡",
    purple: "✦",
    blue: "✧",
  };
  const COLOR_LABELS = {
    water: "水色",
    white: "白",
    red: "赤",
    pink: "ピンク",
    purple: "紫",
    blue: "青",
  };
  const MEMBER_BY_COLOR = {
    water: "satan",
    white: "momo",
    red: "sayu",
    pink: "au",
    purple: "koyuru",
  };
  const BURST_COLORS = {
    satan: "#8feaff",
    momo: "#fff1b2",
    sayu: "#ff8894",
    au: "#ffabd9",
    koyuru: "#bd96ff",
  };
  const state = {
    board: [],
    selected: null,
    busy: false,
    gameOver: false,
    stage: 0,
    bossMaxHp: STAGES[0].hp,
    bossHp: STAGES[0].hp,
    lastStageWon: false,
    partyHp: STARTING_PARTY_HP,
    shield: 0,
    fever: 0,
    feverUntil: 0,
    combo: 0,
    elapsed: 0,
    score: 0,
    attackTimer: STAGES[0].attackEvery,
    poisonedUntil: 0,
    buffUntil: 0,
    lastMatchedColor: null,
    round: 0,
    feedbackTimer: null,
    cutinTimer: null,
    interval: null,
  };
  let musicBufferPromise = null;
  let musicBuffer = null;
  let musicSource = null;
  let musicFallbackPromise = null;
  let musicRequestId = 0;
  let musicStartedAt = 0;
  let musicOffset = 0;
  let musicManuallyPaused = false;
  let audioContext = null;
  let soundEnabled = true;
  let audioErrorReported = false;
  let lastImpactSoundAt = 0;

  const elements = {
    board: document.querySelector("#board"),
    timer: document.querySelector("#timer"),
    bossHpText: document.querySelector("#boss-hp-text"),
    bossName: document.querySelector("#boss-name"),
    bossHealthFill: document.querySelector("#boss-health-fill"),
    partyHpText: document.querySelector("#party-hp-text"),
    partyHealthFill: document.querySelector("#party-health-fill"),
    shieldLabel: document.querySelector("#shield-label"),
    shieldValue: document.querySelector("#shield-value"),
    battleMessage: document.querySelector("#battle-message"),
    boss: document.querySelector("#boss-wrap"),
    comboCount: document.querySelector("#combo-count"),
    comboDisplay: document.querySelector("#combo-display"),
    feverFill: document.querySelector("#fever-fill"),
    feverPercent: document.querySelector("#fever-percent"),
    skillCutin: document.querySelector("#skill-cutin"),
    affinityLabel: document.querySelector("#affinity-label"),
    enemyElement: document.querySelector("#enemy-element"),
    stageDisplay: document.querySelector("#stage-display"),
    stageKicker: document.querySelector("#stage-kicker"),
    battleHeading: document.querySelector("#battle-heading"),
    bossSymbol: document.querySelector("#boss-symbol"),
    feedback: document.querySelector("#board-feedback"),
    resultOverlay: document.querySelector("#result-overlay"),
    resultKicker: document.querySelector("#result-kicker"),
    resultTitle: document.querySelector("#result-title"),
    resultMessage: document.querySelector("#result-message"),
    backgroundMusic: document.querySelector("#background-music"),
    bgmToggle: document.querySelector("#bgm-toggle"),
    sfxToggle: document.querySelector("#sfx-toggle"),
  };

  function makeTile(color) {
    return { color, special: null, obstacle: null, obstacleUntil: 0 };
  }

  function randomColor() {
    if (Math.random() < BLUE_CHANCE) return "blue";
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  function randomTile() {
    return makeTile(randomColor());
  }

  function createsInitialMatch(board, row, col, color) {
    return (
      (col > 1 &&
        board[row][col - 1]?.color === color &&
        board[row][col - 2]?.color === color) ||
      (row > 1 &&
        board[row - 1][col]?.color === color &&
        board[row - 2][col]?.color === color)
    );
  }

  function createBoard() {
    const board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        let tile = randomTile();
        let attempts = 0;
        while (createsInitialMatch(board, row, col, tile.color) && attempts < 25) {
          tile = randomTile();
          attempts += 1;
        }
        board[row][col] = tile;
      }
    }
    return board;
  }

  function matchesOnBoard(board) {
    const cells = new Set();
    const candidates = new Map();
    const recordRun = (run) => {
      if (run.length < 3) return;
      run.forEach((index) => cells.add(index));
      if (run.length >= 4) {
        const index = run[Math.floor(run.length / 2)];
        const special = run.length >= 5 ? "lane" : "bomb";
        const previous = candidates.get(index);
        candidates.set(index, previous === "lane" || special === "lane" ? "lane" : "bomb");
      }
    };

    for (let row = 0; row < SIZE; row += 1) {
      let run = [];
      let color = null;
      for (let col = 0; col <= SIZE; col += 1) {
        const tile = col < SIZE ? board[row][col] : null;
        if (tile && !tile.obstacle && tile.color === color) {
          run.push(row * SIZE + col);
        } else {
          recordRun(run);
          run = tile && !tile.obstacle ? [row * SIZE + col] : [];
          color = tile && !tile.obstacle ? tile.color : null;
        }
      }
    }

    for (let col = 0; col < SIZE; col += 1) {
      let run = [];
      let color = null;
      for (let row = 0; row <= SIZE; row += 1) {
        const tile = row < SIZE ? board[row][col] : null;
        if (tile && !tile.obstacle && tile.color === color) {
          run.push(row * SIZE + col);
        } else {
          recordRun(run);
          run = tile && !tile.obstacle ? [row * SIZE + col] : [];
          color = tile && !tile.obstacle ? tile.color : null;
        }
      }
    }
    return { cells, candidates };
  }

  function hasAvailableMove(board) {
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        const here = board[row][col];
        if (here.obstacle) continue;
        for (const [nextRow, nextCol] of [[row, col + 1], [row + 1, col]]) {
          if (nextRow >= SIZE || nextCol >= SIZE) continue;
          const there = board[nextRow][nextCol];
          if (there.obstacle) continue;
          if (here.special || there.special) return true;
          board[row][col] = there;
          board[nextRow][nextCol] = here;
          const hasMatch = matchesOnBoard(board).cells.size > 0;
          board[row][col] = here;
          board[nextRow][nextCol] = there;
          if (hasMatch) return true;
        }
      }
    }
    return false;
  }

  function ensurePlayableBoard() {
    let attempts = 0;
    while ((!hasAvailableMove(state.board) || matchesOnBoard(state.board).cells.size) && attempts < 20) {
      state.board = createBoard();
      attempts += 1;
    }
  }

  function renderBoard(clearing = new Set()) {
    const fragment = document.createDocumentFragment();
    state.board.forEach((row, rowIndex) => {
      row.forEach((tile, colIndex) => {
        const index = rowIndex * SIZE + colIndex;
        const button = document.createElement("button");
        button.type = "button";
        button.className = `tile tile-${tile.color}`;
        button.dataset.index = String(index);
        button.setAttribute("role", "gridcell");
        button.setAttribute(
          "aria-label",
          `${rowIndex + 1}行${colIndex + 1}列、${COLOR_LABELS[tile.color]}${tile.special ? "強化ピース" : ""}${tile.obstacle ? obstacleLabel(tile.obstacle) : ""}`,
        );
        if (state.selected === index) button.classList.add("selected");
        if (clearing.has(index)) button.classList.add("clearing");
        if (tile.special) button.classList.add(`special-${tile.special}`);
        if (tile.obstacle) button.classList.add(`obstacle-${tile.obstacle}`);
        if (tile.obstacle === "block") button.disabled = true;

        const symbol = document.createElement("span");
        symbol.className = "tile-symbol";
        symbol.textContent = tile.special === "bomb" ? "✺" : tile.special === "lane" ? "✣" : tile.color === "blue" ? "✦" : TILE_SYMBOLS[tile.color];
        button.append(symbol);
        fragment.append(button);
      });
    });
    elements.board.replaceChildren(fragment);
  }

  function obstacleLabel(obstacle) {
    return { block: "、おじゃまブロック", freeze: "、凍結中", poison: "、毒つき" }[obstacle] || "";
  }

  function setMessage(message) {
    elements.battleMessage.textContent = message;
  }

  function showFeedback(message) {
    elements.feedback.textContent = message;
    elements.feedback.classList.add("show");
    clearTimeout(state.feedbackTimer);
    state.feedbackTimer = setTimeout(() => elements.feedback.classList.remove("show"), 780);
  }

  function updateHud() {
    const stage = STAGES[state.stage];
    const remainingTime = stage.time - state.elapsed;
    const bossRatio = Math.max(0, state.bossHp / state.bossMaxHp);
    const partyRatio = Math.max(0, state.partyHp / STARTING_PARTY_HP);
    elements.bossHpText.textContent = `${Math.ceil(state.bossHp)} / ${state.bossMaxHp}`;
    elements.bossHealthFill.style.width = `${bossRatio * 100}%`;
    elements.partyHpText.textContent = `${Math.ceil(state.partyHp)} / ${STARTING_PARTY_HP}`;
    elements.partyHealthFill.style.width = `${partyRatio * 100}%`;
    elements.shieldLabel.hidden = state.shield <= 0;
    elements.shieldValue.textContent = String(Math.ceil(state.shield));
    elements.comboCount.textContent = String(state.combo);
    elements.comboDisplay.classList.toggle("combo-hot", state.combo > 1);
    elements.feverFill.style.width = `${state.fever}%`;
    elements.feverPercent.textContent = `${Math.floor(state.fever)}%`;
    const minutes = Math.floor(Math.max(0, remainingTime) / 60);
    const seconds = Math.max(0, remainingTime) % 60;
    elements.timer.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    elements.enemyElement.textContent = stage.element;
    elements.affinityLabel.textContent = `${COLOR_LABELS[stage.weakness]}ピースが有効`;
  }

  function announceDamage(amount) {
    state.bossHp = Math.max(0, state.bossHp - amount);
    state.score += Math.round(amount);
    const now = performance.now();
    if (now - lastImpactSoundAt > 75) playSound("impact");
    lastImpactSoundAt = now;
    elements.boss.classList.remove("hit");
    void elements.boss.offsetWidth;
    elements.boss.classList.add("hit");
    if (state.bossHp <= 0) finishGame(true);
    updateHud();
  }

  function healParty(amount) {
    const actual = Math.min(amount, STARTING_PARTY_HP - state.partyHp);
    state.partyHp += actual;
    if (actual > 0) showFeedback(`♥ +${Math.round(actual)} HP`);
    updateHud();
  }

  function takeDamage(amount) {
    const absorbed = Math.min(amount, state.shield);
    state.shield -= absorbed;
    const remaining = amount - absorbed;
    if (remaining > 0) playSound("damage");
    state.partyHp = Math.max(0, state.partyHp - remaining);
    updateHud();
    if (remaining > 0 && !state.gameOver) setMessage(`敵の攻撃！ パーティーに ${Math.round(remaining)} ダメージ`);
    if (state.partyHp <= 0) finishGame(false);
  }

  function getMultiplier(chain) {
    const chainMultiplier = chain === 1 ? 1.2 : 1.5 + (chain - 2) * 0.3;
    return chainMultiplier + (Date.now() < state.feverUntil ? 0.5 : 0);
  }

  function activateMember(member, duration = 850, playEffect = true) {
    const card = document.querySelector(`[data-member="${member}"]`);
    if (!card) return;
    if (playEffect) playSound("member", member);
    card.classList.add("active");
    const artwork = card.querySelector(".member-art");
    if (artwork) {
      artwork.querySelector(".skill-burst")?.remove();
      const burst = document.createElement("span");
      burst.className = "skill-burst";
      burst.style.setProperty("--member-color", BURST_COLORS[member] || "#fff");
      burst.setAttribute("aria-hidden", "true");
      for (let particleIndex = 0; particleIndex < 10; particleIndex += 1) {
        const particle = document.createElement("span");
        particle.className = "burst-particle";
        particle.style.setProperty("--angle", `${particleIndex * 36}deg`);
        particle.style.setProperty("--delay", `${(particleIndex % 4) * 35}ms`);
        burst.append(particle);
      }
      artwork.append(burst);
      setTimeout(() => burst.remove(), duration + 100);
    }
    setTimeout(() => card.classList.remove("active"), duration);
  }

  function triggerAllPartySkill(multiplier) {
    elements.skillCutin.hidden = false;
    clearTimeout(state.cutinTimer);
    state.cutinTimer = setTimeout(() => {
      elements.skillCutin.hidden = true;
    }, 1400);
    Object.values(MEMBER_BY_COLOR).forEach((member) => activateMember(member, 1100, false));
    playSound("ultimate");
    const damage = Math.round(118 * multiplier);
    announceDamage(damage);
    state.shield += 12;
    setMessage(`全員必殺ノヴァリンク！ ボスに ${damage} ダメージ`);
  }

  function handleSkill(color, tileCount, multiplier, chain) {
    const member = MEMBER_BY_COLOR[color];
    if (member) activateMember(member);
    const sizeBonus = Math.max(0, tileCount - 3);
    const damageScale = multiplier * (1 + sizeBonus * 0.16);
    const weaknessBonus = color === STAGES[state.stage].weakness ? 1.35 : 1;
    switch (color) {
      case "water": {
        const damage = Math.round((23 + tileCount * 8) * damageScale * weaknessBonus);
        announceDamage(damage);
        state.attackTimer = Math.min(state.attackTimer + 3, 15);
        setMessage(`さたんのスキル！ 敵の防御を下げて ${damage} ダメージ`);
        break;
      }
      case "white":
        playSound("heal");
        healParty((11 + tileCount * 4) * multiplier);
        state.board.forEach((row) => row.forEach((tile) => {
          if (tile.obstacle === "poison" || tile.obstacle === "freeze") {
            tile.obstacle = null;
            tile.obstacleUntil = 0;
          }
        }));
        renderBoard();
        setMessage("ももの浄化！ パーティーを回復して毒と凍結を解除");
        break;
      case "red": {
        const damage = Math.round((34 + tileCount * 11) * damageScale * weaknessBonus);
        announceDamage(damage);
        setMessage(`さゆの一撃！ 弱点を突いて ${damage} ダメージ`);
        break;
      }
      case "pink":
        playSound("shield");
        state.shield += Math.round((13 + tileCount * 4) * multiplier);
        state.buffUntil = Date.now() + 10000;
        updateHud();
        setMessage(`あうの応援！ シールド付与＆通常攻撃速度アップ`);
        break;
      case "purple": {
        const damage = Math.round((18 + tileCount * 8) * damageScale);
        announceDamage(damage);
        state.poisonedUntil = Date.now() + 6000;
        setMessage(`こゆるの魔法！ 全体攻撃 ${damage} ダメージ＋呪い`);
        break;
      }
      case "blue":
        triggerAllPartySkill(multiplier);
        break;
      default:
        break;
    }

    if (chain > 1 && color !== "blue") {
      showFeedback(`${chain} CHAIN · ×${multiplier.toFixed(1)}`);
    }
  }

  function activateSpecial(index, clearing, visited) {
    if (visited.has(index)) return;
    visited.add(index);
    const row = Math.floor(index / SIZE);
    const col = index % SIZE;
    const tile = state.board[row][col];
    if (!tile) return;
    if (tile.special === "bomb") {
      playSound("bomb");
      for (let y = Math.max(0, row - 1); y <= Math.min(SIZE - 1, row + 1); y += 1) {
        for (let x = Math.max(0, col - 1); x <= Math.min(SIZE - 1, col + 1); x += 1) {
          clearing.add(y * SIZE + x);
        }
      }
    } else if (tile.special === "lane") {
      playSound("lane");
      for (let offset = 0; offset < SIZE; offset += 1) {
        clearing.add(row * SIZE + offset);
        clearing.add(offset * SIZE + col);
      }
    }
    clearing.add(index);
  }

  function addAdjacentBlockDestruction(clearing) {
    const bonus = new Set();
    for (const index of clearing) {
      const row = Math.floor(index / SIZE);
      const col = index % SIZE;
      for (const [y, x] of [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]) {
        if (y < 0 || y >= SIZE || x < 0 || x >= SIZE) continue;
        if (state.board[y][x].obstacle === "block") bonus.add(y * SIZE + x);
      }
    }
    bonus.forEach((index) => clearing.add(index));
  }

  async function resolveBoard() {
    if (state.busy || state.gameOver) return;
    const round = state.round;
    state.busy = true;
    state.selected = null;
    let chain = 0;
    let previousTurnColors = new Set();
    try {
      while (!state.gameOver) {
        const { cells, candidates } = matchesOnBoard(state.board);
        if (cells.size === 0) break;
        chain += 1;
        playSound(chain > 1 ? "combo" : "clear");
        state.combo = chain;
        const clearing = new Set(cells);
        const tileCounts = new Map();
        const specialVisited = new Set();

        const pendingSpecials = [...clearing];
        while (pendingSpecials.length) {
          const index = pendingSpecials.pop();
          const tile = state.board[Math.floor(index / SIZE)][index % SIZE];
          if (tile.special && !specialVisited.has(index)) {
            const previousSize = clearing.size;
            activateSpecial(index, clearing, specialVisited);
            if (clearing.size > previousSize) {
              for (const clearedIndex of clearing) {
                if (!specialVisited.has(clearedIndex) && !pendingSpecials.includes(clearedIndex)) {
                  pendingSpecials.push(clearedIndex);
                }
              }
            }
          }
        }

        for (const index of clearing) {
          const tile = state.board[Math.floor(index / SIZE)][index % SIZE];
          if (tile.obstacle !== "block") {
            tileCounts.set(tile.color, (tileCounts.get(tile.color) || 0) + 1);
          }
        }
        const specialIndex = [...candidates.keys()].find((index) => clearing.has(index) && !specialVisited.has(index));
        if (specialIndex !== undefined) clearing.delete(specialIndex);
        addAdjacentBlockDestruction(clearing);

        for (const index of clearing) {
          const tile = state.board[Math.floor(index / SIZE)][index % SIZE];
          if (tile.obstacle === "poison") takeDamage(4);
        }

        state.fever = Math.min(100, state.fever + clearing.size * 3);
        if (state.fever >= 100 && Date.now() >= state.feverUntil) {
          state.fever = 0;
          state.feverUntil = Date.now() + 9000;
          playSound("fever");
          showFeedback("✦ FEVER TIME ✦");
          setMessage("フィーバー！ スキル威力アップ！");
        }
        updateHud();
        renderBoard(clearing);
        await new Promise((resolve) => setTimeout(resolve, 190));
        if (state.round !== round) return;
        if (state.gameOver) break;

        const colorsThisChain = new Set(tileCounts.keys());
        const multiplier = getMultiplier(chain);
        const precedingColors = chain === 1
          ? new Set(state.lastMatchedColor ? [state.lastMatchedColor] : [])
          : previousTurnColors;
        const hasCrossLink = colorsThisChain.size > 1;
        const hasTagLink = [...colorsThisChain].some((color) =>
          [...precedingColors].some((previousColor) => previousColor !== color),
        );
        if (hasCrossLink || hasTagLink) {
          const comboDamage = Math.round(20 * multiplier + (colorsThisChain.size - 1) * 12);
          announceDamage(comboDamage);
          showFeedback(hasCrossLink ? "CROSS LINK!" : "TAG SKILL!");
          setMessage(`${hasCrossLink ? "色の連携技" : "連続タッグ技"}！ ${comboDamage} ダメージ`);
        }
        for (const [color, count] of tileCounts) {
          if (count > 0 && !state.gameOver) handleSkill(color, count, multiplier, chain);
        }
        previousTurnColors = colorsThisChain;

        state.board = state.board.map((row) => row.map((tile) => tile));
        for (let col = 0; col < SIZE; col += 1) {
          const remaining = [];
          for (let row = SIZE - 1; row >= 0; row -= 1) {
            const index = row * SIZE + col;
            if (!clearing.has(index)) remaining.push(state.board[row][col]);
          }
          for (let row = SIZE - 1; row >= 0; row -= 1) {
            state.board[row][col] = remaining[SIZE - 1 - row] || randomTile();
          }
        }
        if (specialIndex !== undefined) {
          const row = Math.floor(specialIndex / SIZE);
          state.board[row][specialIndex % SIZE].special = candidates.get(specialIndex);
          showFeedback(candidates.get(specialIndex) === "lane" ? "LINE BOOST!" : "BOMB BOOST!");
          setMessage(candidates.get(specialIndex) === "lane" ? "強化ピース出現！ 縦横一列を消そう" : "強化ピース出現！ 周囲を巻き込んで消そう");
        }
        renderBoard();
        await new Promise((resolve) => setTimeout(resolve, 170));
        if (state.round !== round) return;
      }
      if (!state.gameOver) {
        state.lastMatchedColor = previousTurnColors.size
          ? [...previousTurnColors][previousTurnColors.size - 1]
          : state.lastMatchedColor;
        ensurePlayableBoard();
        renderBoard();
      }
    } finally {
      if (state.round === round) {
        state.busy = false;
      }
      if (state.round === round && !state.gameOver) {
        state.combo = 0;
        updateHud();
      }
    }
  }

  async function swapTiles(first, second) {
    if (state.busy || state.gameOver || first === second) return;
    const firstTile = state.board[Math.floor(first / SIZE)][first % SIZE];
    const secondTile = state.board[Math.floor(second / SIZE)][second % SIZE];
    if (firstTile.obstacle === "block" || secondTile.obstacle === "block") return;
    if (firstTile.obstacle === "freeze" || secondTile.obstacle === "freeze") {
      showFeedback("FROZEN!");
      setMessage("凍ったピースは動かせない！ 白ピースで浄化しよう");
      return;
    }
    state.board[Math.floor(first / SIZE)][first % SIZE] = secondTile;
    state.board[Math.floor(second / SIZE)][second % SIZE] = firstTile;
    const matches = matchesOnBoard(state.board).cells.size > 0;
    if (!matches && !firstTile.special && !secondTile.special) {
      state.board[Math.floor(first / SIZE)][first % SIZE] = firstTile;
      state.board[Math.floor(second / SIZE)][second % SIZE] = secondTile;
      renderBoard();
      showFeedback("NO MATCH");
      return;
    }
    playSound("swap");
    state.selected = null;
    renderBoard();
    await resolveBoard();
  }

  function onBoardClick(event) {
    const button = event.target.closest(".tile");
    if (!button || state.busy || state.gameOver) return;
    const index = Number(button.dataset.index);
    if (index === suppressedClickIndex) {
      suppressedClickIndex = null;
      return;
    }
    if (!Number.isInteger(index)) return;
    if (state.selected === null) {
      state.selected = index;
      renderBoard();
      return;
    }
    if (state.selected === index) {
      state.selected = null;
      renderBoard();
      return;
    }
    void swapTiles(state.selected, index);
  }

  function applyEnemyAttack() {
    if (state.gameOver) return;
    state.attackTimer -= 1;
    if (state.attackTimer > 0) return;
    const stage = STAGES[state.stage];
    const enraged = state.bossHp <= state.bossMaxHp / 2;
    const freeCells = [];
    for (let row = 0; row < SIZE; row += 1) {
      for (let col = 0; col < SIZE; col += 1) {
        if (!state.board[row][col].obstacle) freeCells.push([row, col]);
      }
    }
    for (const obstacle of stage.obstacles) {
      if (!freeCells.length) break;
      const chosen = Math.floor(Math.random() * freeCells.length);
      const [row, col] = freeCells.splice(chosen, 1)[0];
      const tile = state.board[row][col];
      tile.obstacle = obstacle;
      tile.obstacleUntil = obstacle === "freeze" ? Date.now() + 8000 : 0;
    }
    renderBoard();
    playSound("enemy");
    takeDamage(stage.attackDamage + (enraged ? 4 : 0));
    if (!state.gameOver) {
      setMessage(enraged ? `${stage.name}の怒り！ 盤面に妨害が発生！` : `${stage.name}の攻撃！ 盤面に妨害が発生！`);
    }
    state.attackTimer = Math.max(3, stage.attackEvery - (enraged ? 2 : 0));
  }

  function processPeriodicEffects() {
    if (state.gameOver) return;
    state.elapsed += 1;
    applyEnemyAttack();
    if (state.poisonedUntil && Date.now() < state.poisonedUntil && state.elapsed % 2 === 0) {
      announceDamage(6);
      if (!state.gameOver) setMessage("呪いの継続ダメージ！");
    } else if (state.poisonedUntil && Date.now() >= state.poisonedUntil) {
      state.poisonedUntil = 0;
    }
    const attackInterval = Date.now() < state.buffUntil ? 4 : 6;
    if (state.elapsed % attackInterval === 0 && !state.gameOver) {
      announceDamage(9);
      if (!state.gameOver) setMessage("仲間の通常攻撃！");
    }
    for (const row of state.board) {
      for (const tile of row) {
        if (tile.obstacle === "freeze" && Date.now() >= tile.obstacleUntil) {
          tile.obstacle = null;
          tile.obstacleUntil = 0;
          renderBoard();
        }
      }
    }
    if (Date.now() >= state.feverUntil) state.feverUntil = 0;
    updateHud();
    if (STAGES[state.stage].time - state.elapsed <= 0 && !state.gameOver) finishGame(false, true);
  }

  function finishGame(won, timeout = false) {
    if (state.gameOver) return;
    state.gameOver = true;
    window.clearInterval(state.interval);
    clearTimeout(state.cutinTimer);
    elements.skillCutin.hidden = true;
    const finalStage = state.stage === STAGES.length - 1;
    if (won) playSound(finalStage ? "final" : "stage-clear");
    else playSound("failure");
    elements.resultKicker.textContent = won ? (finalStage ? "ALL QUESTS COMPLETE" : `STAGE ${state.stage + 1} CLEAR`) : "QUEST FAILED";
    elements.resultTitle.textContent = won ? (finalStage ? "五つの星を取り戻した！" : `${STAGES[state.stage].name}を撃破！`) : timeout ? "時間切れ…" : "みんな、あと少し！";
    elements.resultMessage.textContent = won
      ? finalStage
        ? `全５ステージ制覇！　累計スコア ${state.score.toLocaleString()}`
        : `ステージ ${state.stage + 1} クリア！　累計スコア ${state.score.toLocaleString()}。次のステージではHPが25回復する。`
      : timeout
        ? `${STAGES[state.stage].name}を倒す時間が足りなかった。連鎖をつないで再挑戦しよう。`
        : `${STAGES[state.stage].name}に押し切られてしまった。回復やシールドを活用して再挑戦しよう。`;
    state.lastStageWon = won;
    const continueButton = elements.resultOverlay.querySelector("#play-again-button");
    const continueLabel = won
      ? finalStage ? ["最初からプレイ", "↻"] : ["次のステージへ", "→"]
      : ["このステージに再挑戦", "↻"];
    continueButton.firstChild.textContent = `${continueLabel[0]} `;
    continueButton.querySelector("span").textContent = continueLabel[1];
    elements.resultOverlay.hidden = false;
    elements.resultOverlay.querySelector("button").focus();
    updateHud();
  }

  function startGame(stageIndex = 0, resetParty = true) {
    window.clearInterval(state.interval);
    clearTimeout(state.cutinTimer);
    state.round += 1;
    state.stage = stageIndex;
    const stage = STAGES[state.stage];
    document.querySelector("#intro-screen").hidden = true;
    document.querySelector(".game-layout").hidden = false;
    document.querySelector(".footer-note").hidden = false;
    document.querySelector("#restart-button").hidden = false;
    Object.assign(state, {
      selected: null,
      busy: false,
      gameOver: false,
      lastStageWon: false,
      bossMaxHp: stage.hp,
      bossHp: stage.hp,
      partyHp: resetParty ? STARTING_PARTY_HP : Math.min(STARTING_PARTY_HP, state.partyHp + 25),
      shield: 0,
      fever: 0,
      feverUntil: 0,
      combo: 0,
      elapsed: 0,
      score: resetParty ? 0 : state.score,
      attackTimer: stage.attackEvery,
      poisonedUntil: 0,
      buffUntil: 0,
      lastMatchedColor: null,
      cutinTimer: null,
    });
    elements.stageDisplay.textContent = `STAGE ${state.stage + 1} / ${STAGES.length} · ${stage.area}`;
    elements.stageKicker.textContent = `STAGE ${String(state.stage + 1).padStart(2, "0")} · BATTLE`;
    elements.battleHeading.textContent = stage.name;
    elements.bossName.textContent = stage.name;
    elements.boss.setAttribute("aria-label", stage.name);
    elements.boss.dataset.stage = String(state.stage);
    elements.bossSymbol.textContent = stage.icon;
    elements.boss.style.setProperty("--boss-light", stage.colors[0]);
    elements.boss.style.setProperty("--boss-main", stage.colors[1]);
    elements.boss.style.setProperty("--boss-dark", stage.colors[2]);
    elements.boss.style.setProperty("--boss-glow", stage.colors[3]);
    elements.bossHealthFill.style.background = `linear-gradient(90deg, ${stage.colors[0]}, ${stage.colors[1]} 70%, ${stage.colors[3]})`;
    state.board = createBoard();
    ensurePlayableBoard();
    elements.resultOverlay.hidden = true;
    elements.skillCutin.hidden = true;
    setMessage(`${stage.name}が立ちはだかる！ 弱点の${COLOR_LABELS[stage.weakness]}ピースで攻めよう！`);
    updateHud();
    renderBoard();
    state.interval = window.setInterval(processPeriodicEffects, 1000);
  }

  function updateMusicButton(isPlaying) {
    elements.bgmToggle.textContent = isPlaying ? "♫" : "♪";
    elements.bgmToggle.setAttribute("aria-pressed", String(isPlaying));
    elements.bgmToggle.setAttribute("aria-label", isPlaying ? "BGMを停止" : "BGMを再生");
    elements.bgmToggle.title = isPlaying ? "BGMを停止" : "BGMを再生";
  }

  function updateSoundButton() {
    elements.sfxToggle.textContent = soundEnabled ? "♪" : "♩";
    elements.sfxToggle.setAttribute("aria-pressed", String(soundEnabled));
    elements.sfxToggle.setAttribute("aria-label", soundEnabled ? "効果音をオフ" : "効果音をオン");
    elements.sfxToggle.title = soundEnabled ? "効果音をオフ" : "効果音をオン";
  }

  function playSound(type, member) {
    if (!soundEnabled || !window.AudioContext) return;
    const melody = {
      select: [[587, .055, 0, "sine", .018]],
      swap: [[659, .08, 0, "sine", .09], [880, .1, .045, "sine", .09]],
      clear: [[523, .12, 0, "sine"], [784, .16, .055, "sine"]],
      combo: [[523, .14, 0, "triangle"], [659, .14, .06, "triangle"], [880, .22, .12, "sine"]],
      impact: [[175, .1, 0, "triangle", .04, 90]],
      damage: [[220, .16, 0, "sawtooth", .025, 110], [146, .2, .08, "triangle", .025, 95]],
      enemy: [[330, .12, 0, "triangle", .03, 230], [185, .2, .09, "sawtooth", .026, 120]],
      heal: [[659, .15, 0, "sine"], [880, .2, .08, "sine"], [1175, .24, .16, "sine"]],
      shield: [[440, .12, 0, "sine"], [659, .14, .07, "sine"], [880, .2, .14, "sine"]],
      slash: [[293, .08, 0, "sawtooth", .035, 780], [196, .16, .05, "triangle", .03, 98]],
      magic: [[740, .13, 0, "sine"], [988, .16, .09, "triangle"], [740, .2, .18, "sine", .03, 1480]],
      ultimate: [[523, .18, 0, "triangle"], [784, .2, .09, "sine"], [1046, .25, .18, "sine"], [1568, .3, .28, "sine"]],
      bomb: [[392, .12, 0, "sawtooth", .035, 90], [196, .22, .06, "triangle", .03, 60]],
      lane: [[349, .12, 0, "triangle", .03, 1000], [698, .2, .08, "sine"]],
      fever: [[659, .12, 0, "sine"], [880, .12, .08, "sine"], [1175, .24, .16, "sine"]],
      "stage-clear": [[523, .18, 0, "sine"], [659, .18, .13, "sine"], [784, .2, .26, "triangle"], [1046, .36, .4, "sine"]],
        "stage-start": [[392, .15, 0, "triangle"], [587, .18, .09, "sine"], [784, .22, .2, "sine"]],
      final: [[523, .2, 0, "sine"], [659, .2, .12, "sine"], [784, .2, .24, "sine"], [1046, .24, .36, "triangle"], [1318, .48, .5, "sine"]],
      failure: [[392, .18, 0, "triangle", .03, 330], [311, .22, .16, "triangle", .03, 261], [233, .3, .34, "sine", .035, 196]],
      satan: [[392, .12, 0, "triangle"], [784, .18, .08, "sine"]],
      momo: [[659, .14, 0, "sine"], [988, .2, .08, "sine"]],
      sayu: [[293, .08, 0, "sawtooth", .035, 740], [587, .14, .06, "triangle"]],
      au: [[523, .14, 0, "triangle"], [784, .18, .1, "sine"]],
      koyuru: [[740, .15, 0, "sine"], [1110, .2, .1, "triangle"]],
    };
    const notes = type === "member" ? melody[member] : melody[type];
    if (!notes) return;

    void (async () => {
      try {
        audioContext ??= new AudioContext();
        await audioContext.resume();
        const now = audioContext.currentTime;
        for (const [frequency, duration, offset, waveform, volume = .035, endFrequency = frequency] of notes) {
          const oscillator = audioContext.createOscillator();
          const gain = audioContext.createGain();
          const startsAt = now + offset;
          oscillator.type = waveform;
          oscillator.frequency.setValueAtTime(frequency, startsAt);
          if (endFrequency !== frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, startsAt + duration);
          gain.gain.setValueAtTime(.0001, startsAt);
          gain.gain.linearRampToValueAtTime(Math.min(volume * 3.5, .25), startsAt + .012);
          gain.gain.exponentialRampToValueAtTime(.0001, startsAt + duration);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(startsAt);
          oscillator.stop(startsAt + duration + .01);
        }
      } catch (error) {
        if (!audioErrorReported) {
          audioErrorReported = true;
          console.error("効果音を再生できません。", error);
        }
      }
    })();
  }

  function isMusicPlaying() {
    return musicSource !== null || !elements.backgroundMusic.paused;
  }

  async function playWithWebAudio() {
    if (!window.AudioContext) {
      throw new Error("このブラウザーはWeb Audioに対応していません。");
    }
    audioContext ??= new AudioContext();
    await audioContext.resume();
    musicBufferPromise ??= fetch(elements.backgroundMusic.src)
      .then((response) => {
        if (!response.ok) throw new Error(`BGMを読み込めませんでした (${response.status})。`);
        return response.arrayBuffer();
      })
      .then((data) => audioContext.decodeAudioData(data))
      .catch((error) => {
        musicBufferPromise = null;
        throw error;
      });
    musicBuffer = await musicBufferPromise;
    if (musicSource) return;

    musicSource = audioContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    musicSource.loop = true;
    musicSource.connect(audioContext.destination);
    musicStartedAt = audioContext.currentTime;
    musicSource.start(0, musicOffset);
    updateMusicButton(true);
  }

  async function startMusicFallback(requestId) {
    if (requestId !== musicRequestId || musicManuallyPaused) return;
    if (musicFallbackPromise) return musicFallbackPromise;
    musicFallbackPromise = (async () => {
      try {
        await playWithWebAudio();
        if (requestId !== musicRequestId || musicManuallyPaused) {
          stopWebAudioMusic();
          return;
        }
        updateMusicButton(true);
      } catch (error) {
        if (requestId !== musicRequestId || musicManuallyPaused) return;
        updateMusicButton(false);
        setMessage("BGMを再生できません。♫ボタンで再試行してください。");
        console.error("BGMの再生に失敗しました。", error);
      }
    })().finally(() => {
      musicFallbackPromise = null;
    });
    return musicFallbackPromise;
  }

  async function playBackgroundMusic() {
    musicManuallyPaused = false;
    if (isMusicPlaying()) return;
    const requestId = ++musicRequestId;
    try {
      await elements.backgroundMusic.play();
      if (requestId !== musicRequestId || musicManuallyPaused) {
        elements.backgroundMusic.pause();
        return;
      }
      updateMusicButton(true);
    } catch {
      await startMusicFallback(requestId);
    }
  }

  function stopWebAudioMusic() {
    if (musicSource) {
      musicOffset = (musicOffset + audioContext.currentTime - musicStartedAt) % musicBuffer.duration;
      musicSource.stop();
      musicSource.disconnect();
      musicSource = null;
    }
  }

  function stopBackgroundMusic() {
    musicManuallyPaused = true;
    musicRequestId += 1;
    stopWebAudioMusic();
    elements.backgroundMusic.pause();
    updateMusicButton(false);
  }

  elements.board.addEventListener("click", onBoardClick);
  let pointerStartIndex = null;
  let activePointerId = null;
  let suppressedClickIndex = null;
  elements.board.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".tile");
    if (
      !button ||
      !event.isPrimary ||
      (event.pointerType === "mouse" && event.button !== 0) ||
      state.busy ||
      state.gameOver
    ) return;
    pointerStartIndex = Number(button.dataset.index);
    activePointerId = event.pointerId;
    button.classList.add("drag-source");
    playSound("select");
    if (!musicManuallyPaused && !isMusicPlaying()) void playBackgroundMusic();
  });
  window.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointerId || pointerStartIndex === null) return;
    const source = pointerStartIndex;
    const targetTile = document.elementFromPoint(event.clientX, event.clientY)?.closest(".tile");
    const sourceTile = elements.board.querySelector(`[data-index="${source}"]`);
    sourceTile?.classList.remove("drag-source");
    pointerStartIndex = null;
    activePointerId = null;

    if (!targetTile) return;
    const target = Number(targetTile.dataset.index);
    if (target !== source) {
      suppressedClickIndex = target;
      window.setTimeout(() => {
        if (suppressedClickIndex === target) suppressedClickIndex = null;
      }, 400);
      void swapTiles(source, target);
    }
  });
  window.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== activePointerId) return;
    elements.board.querySelector(`[data-index="${pointerStartIndex}"]`)?.classList.remove("drag-source");
    pointerStartIndex = null;
    activePointerId = null;
  });
  elements.bgmToggle.addEventListener("click", () => {
    if (isMusicPlaying()) {
      stopBackgroundMusic();
    } else {
      void playBackgroundMusic();
    }
  });
  elements.sfxToggle.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
    if (soundEnabled) playSound("shield");
  });
  elements.backgroundMusic.addEventListener("pause", () => updateMusicButton(false));
  elements.backgroundMusic.addEventListener("play", () => updateMusicButton(true));
  elements.backgroundMusic.addEventListener("error", () => {
    if (!musicManuallyPaused && !musicSource) {
      void startMusicFallback(musicRequestId);
    }
  });
  document.querySelector("#restart-button").addEventListener("click", () => startGame(0, true));
  document.querySelector("#start-game-button").addEventListener("click", () => {
    startGame(0, true);
    elements.board.querySelector(".tile")?.focus();
  });
  document.querySelector("#play-again-button").addEventListener("click", () => {
    if (state.lastStageWon && state.stage < STAGES.length - 1) {
      playSound("stage-start");
      startGame(state.stage + 1, false);
    } else if (state.lastStageWon) {
      startGame(0, true);
    } else {
      startGame(state.stage, true);
    }
  });

  updateSoundButton();
})();
