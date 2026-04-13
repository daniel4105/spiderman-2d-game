/* ============================================================
   MILES MORALES SPIDER-MAN 2D GAME  |  main.js
   Canvas 2D — Platformer / Shooter
   ============================================================ */

(function () {
  "use strict";

  /* ── CONFIG ─────────────────────────────────────────────── */
  const CFG = {
    gravity:       0.55,
    playerSpeed:   4.5,
    jumpForce:    -13.5,
    webSpeed:      11,
    bulletSpeed:   5,
    buildingW:     220,
    buildingGap:   90,
    scrollSpeed:   2.8,
    maxHp:         5,
    maxBldEnemies: 5,
    lvlThresholds: [0, 5, 15, 30, 50, 75], // enemies to beat to reach next level
    lvlEnemyHp:   [2, 3, 4,  5,  6,  8],
    lvlEnemyCount:[2, 3, 3,  4,  5,  5],
    lvlFireRate:  [120,100,85, 70, 55, 40],
    TOTAL_LEVELS:  5,
  };

  /* ── STATE ─────────────────────────────────────────────── */
  let state = {};

  /* ── ASSETS ─────────────────────────────────────────────── */
  const IMG = {};
  const imgSrc = {
    standing:   "assets/img/standing.png",
    shoot:      "assets/img/shoot.png",
    running:    "assets/img/running.png",
    thug:       "assets/img/thug.png",
    background: "./ass",
    building:   "assets/img/building.png",
    web:        "assets/img/web.png",
  };
  let assetsLoaded = 0;
  const totalAssets = Object.keys(imgSrc).length;

  /* ── AUDIO ─────────────────────────────────────────────── */
  const AUDIO = {};
  function tryAudio(id, src, loop = false, vol = 0.5) {
    try {
      const a = new Audio(src);
      a.loop = loop;
      a.volume = vol;
      AUDIO[id] = a;
    } catch (_) {}
  }
  tryAudio("menu",   "assets/audio/menumusic.mp3",   true,  0.4);
  tryAudio("game",   "assets/audio/gamemusic.mp3",   true,  0.35);
  tryAudio("shoot",  "assets/audio/shoot.mp3",        false, 0.4);
  tryAudio("hit",    "assets/audio/hit.mp3",          false, 0.5);
  tryAudio("die",    "assets/audio/die.mp3",          false, 0.6);
  tryAudio("levelup","assets/audio/levelup.mp3",      false, 0.6);

  function playAudio(id) {
    if (!AUDIO[id]) return;
    AUDIO[id].currentTime = 0;
    AUDIO[id].play().catch(() => {});
  }
  function stopAudio(id) {
    if (!AUDIO[id]) return;
    AUDIO[id].pause();
    AUDIO[id].currentTime = 0;
  }
  function stopAllMusic() {
    ["menu", "game"].forEach(id => stopAudio(id));
  }

  /* ── CANVAS ─────────────────────────────────────────────── */
  let canvas, ctx, W, H;

  function resizeCanvas() {
    const wrapper = document.getElementById("game-canvas");
    W = wrapper.width  = wrapper.offsetWidth;
    H = wrapper.height = wrapper.offsetHeight;
  }

  /* ── LOAD IMAGES ─────────────────────────────────────────── */
  function loadAssets(cb) {
    Object.entries(imgSrc).forEach(([k, src]) => {
      const im = new Image();
      im.onload = im.onerror = () => {
        assetsLoaded++;
        if (assetsLoaded === totalAssets) cb();
      };
      im.src = src;
      IMG[k] = im;
    });
  }

  /* ── DOM REFS ─────────────────────────────────────────────── */
  let elMenu, elGame, elOverlay, elOverlayCard, elFlash;
  let elScore, elBest, elLevel, elEnemiesLeft;
  let elMenuScore, elMenuBest;
  let hearts = [];

  function initDom() {
    elMenu    = document.getElementById("menu-section");
    elGame    = document.getElementById("game-section");
    elOverlay = document.getElementById("overlay");
    elOverlayCard = document.getElementById("overlay-card");
    elFlash   = document.getElementById("level-flash");
    elScore   = document.getElementById("hud-score");
    elBest    = document.getElementById("hud-best");
    elLevel   = document.getElementById("hud-level");
    elEnemiesLeft = document.getElementById("hud-enemies");
    elMenuScore = document.getElementById("menu-score");
    elMenuBest  = document.getElementById("menu-best");
    hearts    = Array.from(document.querySelectorAll(".heart"));

    document.getElementById("btn-play").addEventListener("click", startGame);
    document.getElementById("btn-instructions").addEventListener("click", () => {
      document.getElementById("instructions-section").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("btn-resume").addEventListener("click", resumeGame);
    document.getElementById("btn-restart-pause").addEventListener("click", restartGame);
    document.getElementById("btn-restart-gameover").addEventListener("click", restartGame);
    document.getElementById("btn-menu").addEventListener("click", goMenu);
    document.getElementById("btn-menu-go").addEventListener("click", goMenu);
    canvas = document.getElementById("game-canvas");
    ctx    = canvas.getContext("2d");

    /* custom cursor */
    canvas.addEventListener("mousemove", e => {
      const r = canvas.getBoundingClientRect();
      state.cursor = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top)  * (H / r.height),
      };
    });
    canvas.addEventListener("mouseleave", () => { state.cursor = null; });
    canvas.addEventListener("click", e => {
      if (state.running && !state.paused) playerShoot(e);
    });
    // touch shoot
    canvas.addEventListener("touchstart", e => {
      if (state.running && !state.paused) {
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        playerShoot(null, {
          x: (t.clientX - r.left) * (W / r.width),
          y: (t.clientY - r.top)  * (H / r.height),
        });
        e.preventDefault();
      }
    }, { passive: false });

    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup",   e => { state.keys[e.code] = false; });
    window.addEventListener("resize",    () => { if (state.running) resizeCanvas(); });
  }

  /* ── INPUT ─────────────────────────────────────────────── */
  function onKey(e) {
    state.keys = state.keys || {};
    state.keys[e.code] = true;

    if (e.code === "Escape" && state.running) {
      state.paused ? resumeGame() : pauseGame();
    }
    if (e.code === "Space" && state.running && !state.paused) {
      e.preventDefault();
      playerJump();
    }
  }

  /* ── GAME OBJECTS ─────────────────────────────────────────── */

  // Building
  function makeBldg(x) {
    const roofH  = 18 + Math.random() * 30;
    const bldgH  = H * 0.40 + Math.random() * H * 0.12;
    const y      = H - bldgH;
    const level  = state.level;
    const count  = Math.min(
      CFG.maxBldEnemies,
      Math.floor(Math.random() * CFG.lvlEnemyCount[level]) + 1
    );
    const enemies = [];
    for (let i = 0; i < count; i++) {
      enemies.push(makeEnemy(x + 20 + Math.random() * (CFG.buildingW - 60), y - 42));
    }
    return { x, y, w: CFG.buildingW, h: bldgH, roofY: y, enemies, spawned: false };
  }

  function makeEnemy(x, y) {
    const level = state.level;
    return {
      x, y,
      w: 36, h: 42,
      vx: 0, vy: 0,
      hp:    CFG.lvlEnemyHp[level],
      maxHp: CFG.lvlEnemyHp[level],
      fireTimer: Math.floor(Math.random() * CFG.lvlFireRate[level]),
      alive: true,
      frame: 0, frameTimer: 0,
      dir: -1,           // facing left (toward player)
      bullets: [],
    };
  }

  function makePlayer() {
    return {
      x: 80, y: 100,
      w: 44, h: 52,
      vx: 0, vy: 0,
      onGround: false,
      hp: CFG.maxHp,
      frame: 0, frameTimer: 0,
      shootTimer: 0,
      isShooting: false,
      webs: [],
      facing: 1,  // 1=right -1=left
      invincible: 0,
    };
  }

  /* ── INIT GAME STATE ─────────────────────────────────────── */
  function initState() {
    state = {
      running:   false,
      paused:    false,
      gameOver:  false,
      won:       false,
      score:     0,
      best:      parseInt(localStorage.getItem("spidy_best") || "0"),
      level:     0,
      totalKills: 0,
      keys:      {},
      cursor:    null,
      player:    makePlayer(),
      buildings: [],
      worldX:    0,    // how far we've scrolled
      particles: [],
      raf:       null,
    };
    /* seed initial buildings */
    let bx = 0;
    for (let i = 0; i < 5; i++) {
      state.buildings.push(makeBldg(bx));
      bx += CFG.buildingW + CFG.buildingGap;
    }
    state.nextBldX = bx;
  }

  /* ── START / STOP ─────────────────────────────────────────── */
  function startGame() {
    stopAllMusic();
    playAudio("game");
    elMenu.style.display = "none";
    elGame.style.display = "block";
    elOverlay.classList.remove("active");
    initState();
    resizeCanvas();
    state.running = true;
    updateHUD();
    requestAnimationFrame(loop);
  }

  function pauseGame() {
    state.paused = true;
    showOverlay("paused");
  }

  function resumeGame() {
    state.paused = false;
    hideOverlay();
    requestAnimationFrame(loop);
  }

  function restartGame() {
    if (state.raf) cancelAnimationFrame(state.raf);
    hideOverlay();
    stopAllMusic();
    playAudio("game");
    initState();
    resizeCanvas();
    state.running = true;
    updateHUD();
    requestAnimationFrame(loop);
  }

  function goMenu() {
    if (state.raf) cancelAnimationFrame(state.raf);
    state.running = false;
    stopAllMusic();
    playAudio("menu");
    elGame.style.display  = "none";
    elMenu.style.display  = "";
    hideOverlay();
    if (elMenuScore) elMenuScore.textContent = state.score || 0;
    if (elMenuBest)  elMenuBest.textContent  = state.best  || 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── HUD ─────────────────────────────────────────────────── */
  function updateHUD() {
    if (elScore)       elScore.textContent       = state.score;
    if (elBest)        elBest.textContent        = state.best;
    if (elLevel)       elLevel.textContent       = `${state.level + 1}`;
    const nextKills = CFG.lvlThresholds[state.level + 1] ?? "—";
    if (elEnemiesLeft) elEnemiesLeft.textContent =
      state.level >= CFG.TOTAL_LEVELS ? "MAX" :
      Math.max(0, nextKills - state.totalKills);
    hearts.forEach((h, i) => {
      h.classList.toggle("empty", i >= state.player.hp);
    });
  }

  /* ── OVERLAY ─────────────────────────────────────────────── */
  function showOverlay(type) {
    elOverlay.classList.add("active");
    elOverlayCard.innerHTML = "";

    if (type === "paused") {
      elOverlayCard.innerHTML = `
        <div class="ol-title c-purple">PAUSA</div>
        <div class="ol-sub">— JUEGO EN PAUSA —</div>
        <div class="ol-stat c-white">Puntuación: <span class="c-neon">${state.score}</span></div>
        <div class="ol-stat c-white">Nivel: <span class="c-neon">${state.level + 1}</span></div>
        <div style="margin-top:1.2rem;display:flex;flex-direction:column;gap:.6rem">
          <button class="btn-spidy" id="btn-resume">▶ CONTINUAR</button>
          <button class="btn-outline-spidy" id="btn-restart-pause">↺ REINICIAR</button>
          <button class="btn-outline-spidy" id="btn-menu">⌂ MENÚ</button>
        </div>`;
      document.getElementById("btn-resume").onclick      = resumeGame;
      document.getElementById("btn-restart-pause").onclick = restartGame;
      document.getElementById("btn-menu").onclick         = goMenu;
    }

    if (type === "gameover") {
      const newBest = state.score > state.best;
      elOverlayCard.innerHTML = `
        <div class="ol-title c-red">GAME OVER</div>
        <div class="ol-sub">— MILES CAYÓ —</div>
        <div class="ol-stat">Puntuación: <span class="c-neon">${state.score}</span></div>
        <div class="ol-stat">Enemigos: <span class="c-neon">${state.totalKills}</span></div>
        <div class="ol-stat">Nivel: <span class="c-neon">${state.level + 1}</span></div>
        ${newBest ? `<div class="ol-stat c-neon" style="margin-top:.4rem">★ NUEVO RÉCORD ★</div>` : ""}
        <div class="ol-stat">Mejor: <span class="c-neon">${state.best}</span></div>
        <div style="margin-top:1.2rem;display:flex;flex-direction:column;gap:.6rem">
          <button class="btn-spidy" id="btn-restart-gameover">↺ REINTENTAR</button>
          <button class="btn-outline-spidy" id="btn-menu-go">⌂ MENÚ</button>
        </div>`;
      document.getElementById("btn-restart-gameover").onclick = restartGame;
      document.getElementById("btn-menu-go").onclick          = goMenu;
    }

    if (type === "victory") {
      elOverlayCard.innerHTML = `
        <div class="ol-title c-neon">¡VICTORIA!</div>
        <div class="ol-sub">— BROOKLYN ESTÁ SEGURA —</div>
        <div class="ol-stat">Puntuación Final: <span class="c-neon">${state.score}</span></div>
        <div class="ol-stat">Enemigos: <span class="c-neon">${state.totalKills}</span></div>
        <div class="ol-stat">Récord: <span class="c-neon">${state.best}</span></div>
        <div style="margin-top:1.2rem;display:flex;flex-direction:column;gap:.6rem">
          <button class="btn-spidy" id="btn-restart-gameover">↺ JUGAR DE NUEVO</button>
          <button class="btn-outline-spidy" id="btn-menu-go">⌂ MENÚ</button>
        </div>`;
      document.getElementById("btn-restart-gameover").onclick = restartGame;
      document.getElementById("btn-menu-go").onclick          = goMenu;
    }
  }

  function hideOverlay() {
    elOverlay.classList.remove("active");
  }

  /* ── LEVEL UP ─────────────────────────────────────────────── */
  function checkLevelUp() {
    if (state.level >= CFG.TOTAL_LEVELS) return;
    const next = CFG.lvlThresholds[state.level + 1];
    if (next !== undefined && state.totalKills >= next) {
      state.level++;
      playAudio("levelup");
      showFlash(`NIVEL ${state.level + 1}`);
      if (state.level >= CFG.TOTAL_LEVELS) {
        endGame(true);
      }
    }
  }

  function showFlash(txt) {
    const el = document.querySelector(".flash-txt");
    if (el) el.textContent = txt;
    elFlash.classList.remove("active");
    void elFlash.offsetWidth;
    elFlash.classList.add("active");
    setTimeout(() => elFlash.classList.remove("active"), 2000);
  }

  /* ── END GAME ─────────────────────────────────────────────── */
  function endGame(won) {
    state.running = false;
    state.gameOver = true;
    stopAllMusic();
    playAudio(won ? "levelup" : "die");
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("spidy_best", state.best);
    }
    setTimeout(() => showOverlay(won ? "victory" : "gameover"), 600);
  }

  /* ── SHOOT ─────────────────────────────────────────────── */
  function playerShoot(e, coords) {
    if (state.player.shootTimer > 0) return;
    state.player.shootTimer = 18;
    state.player.isShooting = true;
    playAudio("shoot");

    let tx, ty;
    if (coords) { tx = coords.x; ty = coords.y; }
    else if (e) {
      const r = canvas.getBoundingClientRect();
      tx = (e.clientX - r.left) * (W / r.width);
      ty = (e.clientY - r.top)  * (H / r.height);
    } else return;

    const px = state.player.x + state.player.w / 2;
    const py = state.player.y + state.player.h / 2;
    const dx = tx - px, dy = ty - py;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    state.player.webs.push({
      x: px, y: py,
      vx: (dx / dist) * CFG.webSpeed,
      vy: (dy / dist) * CFG.webSpeed,
      w: 14, h: 14,
      life: 60,
    });
    state.player.facing = dx > 0 ? 1 : -1;
  }

  /* ── MAIN LOOP ─────────────────────────────────────────────── */
  function loop() {
    if (!state.running || state.paused) return;
    update();
    render();
    state.raf = requestAnimationFrame(loop);
  }

  /* ── UPDATE ─────────────────────────────────────────────── */
  function update() {
    const P = state.player;
    const keys = state.keys;

    /* horizontal movement */
    let moving = false;
    if (keys["ArrowLeft"]  || keys["KeyA"]) { P.vx = -CFG.playerSpeed; P.facing = -1; moving = true; }
    else if (keys["ArrowRight"] || keys["KeyD"]) { P.vx = CFG.playerSpeed; P.facing = 1; moving = true; }
    else P.vx *= 0.65;

    /* gravity */
    P.vy += CFG.gravity;

    /* move */
    P.x += P.vx;
    P.y += P.vy;

    /* shoot timer */
    if (P.shootTimer > 0) P.shootTimer--;
    if (P.shootTimer === 0) P.isShooting = false;
    if (P.invincible > 0) P.invincible--;

    /* ── SCROLL WORLD ── */
    const scrollThreshold = W * 0.55;
    if (P.x > scrollThreshold) {
      const shift = P.x - scrollThreshold;
      P.x = scrollThreshold;
      state.worldX += shift;
      state.buildings.forEach(b => { b.x -= shift; b.enemies.forEach(en => en.x -= shift); });
    }

    /* generate new buildings */
    while (state.nextBldX - state.worldX < W + 100) {
      state.buildings.push(makeBldg(state.nextBldX - state.worldX + W));
      state.nextBldX += CFG.buildingW + CFG.buildingGap;
    }

    /* remove far-left buildings */
    state.buildings = state.buildings.filter(b => b.x + b.w > -50);

    /* ── COLLISION: player vs buildings ── */
    P.onGround = false;
    state.buildings.forEach(b => {
      // roof collision (land on top)
      if (
        P.x + P.w > b.x + 8 && P.x < b.x + b.w - 8 &&
        P.y + P.h >= b.roofY && P.y + P.h <= b.roofY + 14 &&
        P.vy >= 0
      ) {
        P.y = b.roofY - P.h;
        P.vy = 0;
        P.onGround = true;
      }
    });

    /* floor safety */
    if (P.y + P.h > H) {
      P.y = H - P.h;
      P.vy = 0;
      P.onGround = true;
    }
    if (P.x < 0) P.x = 0;

    /* ── PLAYER WEBS ── */
    P.webs.forEach(w => {
      w.x += w.vx; w.y += w.vy; w.life--;
    });
    P.webs = P.webs.filter(w => w.life > 0);

    /* ── ENEMIES ── */
    state.buildings.forEach(b => {
      b.enemies.forEach(en => {
        if (!en.alive) return;
        /* AI: move toward player slowly */
        const dx = P.x - en.x;
        en.dir = dx > 0 ? 1 : -1;
        en.vx = en.dir * 0.8;
        en.vy += CFG.gravity;
        en.x += en.vx;
        en.y += en.vy;

        /* land on building roof */
        if (en.y + en.h >= b.roofY && en.vy >= 0) {
          en.y = b.roofY - en.h;
          en.vy = 0;
        }
        /* clamp to building width */
        if (en.x < b.x + 4) { en.x = b.x + 4; }
        if (en.x + en.w > b.x + b.w - 4) { en.x = b.x + b.w - en.w - 4; }

        /* fire bullet */
        en.fireTimer--;
        if (en.fireTimer <= 0) {
          en.fireTimer = CFG.lvlFireRate[state.level] + Math.floor(Math.random() * 40);
          const pdx = P.x + P.w / 2 - (en.x + en.w / 2);
          const pdy = P.y + P.h / 2 - (en.y + en.h / 2);
          const d = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
          en.bullets.push({
            x: en.x + en.w / 2, y: en.y + en.h / 2,
            vx: (pdx / d) * CFG.bulletSpeed,
            vy: (pdy / d) * CFG.bulletSpeed,
            life: 120,
          });
        }

        /* bullet vs player */
        en.bullets.forEach(bl => {
          bl.x += bl.vx; bl.y += bl.vy; bl.life--;
          if (bl.life <= 0) return;
          if (P.invincible > 0) return;
          if (
            bl.x > P.x && bl.x < P.x + P.w &&
            bl.y > P.y && bl.y < P.y + P.h
          ) {
            bl.life = 0;
            P.hp--;
            P.invincible = 90;
            playAudio("hit");
            spawnParticles(P.x + P.w / 2, P.y + P.h / 2, "#e61a1a", 8);
            updateHUD();
            if (P.hp <= 0) endGame(false);
          }
        });
        en.bullets = en.bullets.filter(bl => bl.life > 0);

        /* web vs enemy */
        P.webs.forEach(w => {
          if (w.life <= 0) return;
          if (
            w.x + w.w / 2 > en.x && w.x - w.w / 2 < en.x + en.w &&
            w.y + w.h / 2 > en.y && w.y - w.h / 2 < en.y + en.h
          ) {
            w.life = 0;
            en.hp--;
            spawnParticles(en.x + en.w / 2, en.y + en.h / 2, "#39ff14", 6);
            if (en.hp <= 0) {
              en.alive = false;
              state.score += 10 * (state.level + 1);
              state.totalKills++;
              if (state.score > state.best) {
                state.best = state.score;
                localStorage.setItem("spidy_best", state.best);
              }
              playAudio("die");
              spawnParticles(en.x + en.w / 2, en.y, "#7b2fff", 14);
              checkLevelUp();
              updateHUD();
            }
          }
        });
      });
    });

    /* ── PARTICLES ── */
    state.particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--;
    });
    state.particles = state.particles.filter(p => p.life > 0);
  }

  function playerJump() {
    if (state.player.onGround) {
      state.player.vy = CFG.jumpForce;
      state.player.onGround = false;
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1 + Math.random() * 3;
      state.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 1,
        r: 3 + Math.random() * 4,
        color,
        life: 25 + Math.floor(Math.random() * 20),
        maxLife: 45,
      });
    }
  }

  /* ── RENDER ─────────────────────────────────────────────── */
  function render() {
    ctx.clearRect(0, 0, W, H);

    /* ── BACKGROUND ── */
    if (IMG.background.complete && IMG.background.naturalWidth) {
      ctx.drawImage(IMG.background, 0, 0, W, H);
    } else {
      /* fallback gradient */
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#07070d");
      bg.addColorStop(1, "#1a0533");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
    }

    /* subtle parallax grid overlay */
    ctx.strokeStyle = "rgba(123,47,255,0.06)";
    ctx.lineWidth = 1;
    const gx = (state.worldX * 0.3) % 60;
    for (let x = -gx; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    /* ── BUILDINGS ── */
    state.buildings.forEach(b => renderBuilding(b));

    /* ── ENEMY BULLETS ── */
    state.buildings.forEach(b => {
      b.enemies.forEach(en => {
        en.bullets.forEach(bl => {
          ctx.save();
          ctx.shadowColor = "#e61a1a";
          ctx.shadowBlur  = 8;
          ctx.fillStyle   = "#ff4444";
          ctx.beginPath();
          ctx.arc(bl.x, bl.y, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
      });
    });

    /* ── PLAYER WEBS ── */
    const P = state.player;
    P.webs.forEach(w => {
      if (IMG.web.complete && IMG.web.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = w.life / 60;
        ctx.drawImage(IMG.web, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
        ctx.restore();
      } else {
        ctx.save();
        ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 12;
        ctx.fillStyle   = "#39ff14";
        ctx.globalAlpha = w.life / 60;
        ctx.beginPath(); ctx.arc(w.x, w.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    });

    /* ── PLAYER ── */
    renderPlayer();

    /* ── PARTICLES ── */
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillStyle   = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    /* ── CUSTOM CURSOR ── */
    if (state.cursor) {
      const { x, y } = state.cursor;
      if (IMG.web.complete && IMG.web.naturalWidth) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(IMG.web, x - 12, y - 12, 24, 24);
        ctx.restore();
      } else {
        ctx.save();
        ctx.strokeStyle = "#39ff14"; ctx.lineWidth = 2;
        ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y);
        ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10);
        ctx.stroke();
        ctx.restore();
      }
    }

    /* ── INVINCIBLE FLASH ── */
    if (P.invincible > 0 && Math.floor(P.invincible / 6) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = "rgba(230,26,26,0.18)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function renderBuilding(b) {
    if (b.x + b.w < 0 || b.x > W) return;

    if (IMG.building.complete && IMG.building.naturalWidth) {
      ctx.drawImage(IMG.building, b.x, b.y, b.w, b.h);
    } else {
      /* fallback drawn building */
      ctx.fillStyle = "#1a0030";
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(123,47,255,0.5)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      /* windows */
      ctx.fillStyle = "rgba(57,255,20,0.15)";
      for (let wy = b.y + 12; wy < b.y + b.h - 20; wy += 22) {
        for (let wx = b.x + 12; wx < b.x + b.w - 12; wx += 28) {
          ctx.fillRect(wx, wy, 14, 10);
        }
      }
      /* roof line */
      ctx.fillStyle = "#2a0045";
      ctx.fillRect(b.x - 4, b.y, b.w + 8, 10);
    }

    /* render enemies on this building */
    b.enemies.forEach(en => { if (en.alive) renderEnemy(en); });
  }

  function renderEnemy(en) {
    /* HP bar */
    const barW = en.w;
    const barX = en.x, barY = en.y - 8;
    ctx.fillStyle = "#333";
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = en.hp > en.maxHp * 0.5 ? "#39ff14" : en.hp > en.maxHp * 0.25 ? "#ffaa00" : "#e61a1a";
    ctx.fillRect(barX, barY, barW * (en.hp / en.maxHp), 5);

    if (IMG.thug.complete && IMG.thug.naturalWidth) {
      ctx.save();
      if (en.dir < 0) {
        ctx.translate(en.x + en.w, en.y);
        ctx.scale(-1, 1);
        ctx.drawImage(IMG.thug, 0, 0, en.w, en.h);
      } else {
        ctx.drawImage(IMG.thug, en.x, en.y, en.w, en.h);
      }
      ctx.restore();
    } else {
      /* fallback enemy */
      ctx.fillStyle = "#8800cc";
      ctx.fillRect(en.x, en.y, en.w, en.h);
      ctx.fillStyle = "#ff3333";
      ctx.fillRect(en.x + 5, en.y + 5, en.w - 10, 14);
    }
  }

  function renderPlayer() {
    const P = state.player;
    let imgKey = "standing";
    if (P.isShooting) imgKey = "shoot";
    else if (Math.abs(P.vx) > 0.5) imgKey = "running";

    if (IMG[imgKey].complete && IMG[imgKey].naturalWidth) {
      ctx.save();
      if (P.facing < 0) {
        ctx.translate(P.x + P.w, P.y);
        ctx.scale(-1, 1);
        ctx.drawImage(IMG[imgKey], 0, 0, P.w, P.h);
      } else {
        ctx.drawImage(IMG[imgKey], P.x, P.y, P.w, P.h);
      }
      ctx.restore();
    } else {
      /* fallback player */
      ctx.fillStyle = P.invincible > 0 ? "#ff6666" : "#1a1a99";
      ctx.fillRect(P.x, P.y, P.w, P.h);
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(P.x + 6, P.y + 4, P.w - 12, 18);
    }

    /* web line from hand to nearest web projectile */
    if (P.webs.length > 0 && P.isShooting) {
      const w = P.webs[P.webs.length - 1];
      ctx.save();
      ctx.strokeStyle = "rgba(57,255,20,0.6)";
      ctx.lineWidth   = 2;
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur  = 6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(P.x + (P.facing > 0 ? P.w : 0), P.y + P.h * 0.35);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  /* ── BOOT ─────────────────────────────────────────────── */
  function boot() {
    initDom();
    loadAssets(() => {
      /* assets ready, update menu scores */
      const best = parseInt(localStorage.getItem("spidy_best") || "0");
      if (elMenuBest)  elMenuBest.textContent  = best;
      if (elMenuScore) elMenuScore.textContent = 0;
    });
    /* play menu music on first user interaction */
    document.addEventListener("click", () => {
      if (!state.running) playAudio("menu");
    }, { once: true });
  }

  document.addEventListener("DOMContentLoaded", boot);
})();