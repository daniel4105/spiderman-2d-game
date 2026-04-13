/* ============================================================
   MILES MORALES SPIDER-MAN 2D  |  main.js  (v2 – fixed)
   ============================================================ */
(function () {
  "use strict";

  /* ── CONFIG ──────────────────────────────────────────────── */
  const CFG = {
    gravity: 0.55,
    playerSpeed: 4.5,
    jumpForce: -13,
    webSpeed: 12,
    bulletSpeed: 4.5,
    buildingMinW: 200,
    buildingMaxW: 260,
    buildingGap: 80,
    maxHp: 5,
    maxBldEnemies: 5,
    /* kills needed to ENTER each level (index = level index) */
    lvlThresholds: [0, 5, 15, 30, 50, 75],
    lvlEnemyHp: [2, 3, 4, 5, 6, 8],
    lvlEnemyCount: [2, 2, 3, 3, 4, 5],
    lvlFireRate: [130, 105, 85, 68, 52, 38],   /* frames between shots */
    TOTAL_LEVELS: 5,
  };

  /* ── CANVAS / CTX (assigned once in boot) ─────────────────── */
  let canvas, ctx;
  let W = 900, H = 506;   /* safe defaults until real size is known */

  /* ── STATE ──────────────────────────────────────────────────*/
  let G = null;   /* game state object */

  /* ── IMAGES ─────────────────────────────────────────────── */
  const IMG = {};
  const IMG_SRC = {
    standing: "assets/img/standing.png",
    shoot: "assets/img/shoot.png",
    running: "assets/img/running.png",
    jump:       "assets/img/jump.png",       // ← AGREGA ESTA LÍNEA
    thug: "assets/img/thug.png",
    background: "assets/img/background.png",
    building: "assets/img/building.png",
    web: "assets/img/web.png",
  };

  function loadImages(cb) {
    let pending = Object.keys(IMG_SRC).length;
    Object.entries(IMG_SRC).forEach(([k, src]) => {
      const im = new Image();
      im.onload = im.onerror = () => { if (--pending === 0) cb(); };
      im.src = src;
      IMG[k] = im;
    });
  }

  function imgReady(key) {
    return IMG[key] && IMG[key].complete && IMG[key].naturalWidth > 0;
  }

  /* ── AUDIO ──────────────────────────────────────────────── */
  const SFX = {};
  function mkAudio(id, src, loop, vol) {
    try { const a = new Audio(src); a.loop = loop; a.volume = vol; SFX[id] = a; } catch (_) { }
  }
  mkAudio("menu", "assets/audio/menumusic.mp3", true, 0.40);
  mkAudio("game", "assets/audio/gamemusic.mp3", true, 0.35);
  mkAudio("shoot", "assets/audio/shoot.mp3", false, 0.40);

  function play(id) { const a = SFX[id]; if (!a) return; a.currentTime = 0; a.play().catch(() => { }); }
  function stop(id) { const a = SFX[id]; if (!a) return; a.pause(); a.currentTime = 0; }
  function stopMusic() { stop("menu"); stop("game"); }

  /* ── RESIZE ─────────────────────────────────────────────── */
  function syncSize() {
    /* canvas must be visible for offsetWidth to work */
    W = canvas.offsetWidth || 900;
    H = canvas.offsetHeight || 506;
    canvas.width = W;
    canvas.height = H;
  }

  /* ── FACTORIES ─────────────────────────────────────────── */
  function makePlayer() {
    return {
      x: 60, y: H * 0.3,
      w: 44, h: 52,
      vx: 0, vy: 0,
      onGround: false,
      hp: CFG.maxHp,
      shootTimer: 0,
      isShooting: false,
      facing: 1,
      invincible: 0,
      webs: [],
    };
  }

  function makeEnemy(x, roofY) {
    const lv = G ? G.level : 0;
    return {
      x,
      y: roofY - 42,
      w: 36, h: 42,
      vx: 0, vy: 0,
      hp: CFG.lvlEnemyHp[lv],
      maxHp: CFG.lvlEnemyHp[lv],
      fireTimer: 30 + Math.floor(Math.random() * CFG.lvlFireRate[lv]),
      alive: true,
      dir: -1,
      bullets: [],
    };
  }

  function makeBuilding(x) {
    const bw = CFG.buildingMinW + Math.random() * (CFG.buildingMaxW - CFG.buildingMinW);
    const bh = H * 0.38 + Math.random() * H * 0.18;
    const roofY = H - bh;
    const lv = G ? G.level : 0;
    const cnt = Math.min(CFG.maxBldEnemies,
      1 + Math.floor(Math.random() * CFG.lvlEnemyCount[lv]));
    const enemies = [];
    for (let i = 0; i < cnt; i++) {
      const ex = x + 16 + Math.random() * Math.max(0, bw - 52);
      enemies.push(makeEnemy(ex, roofY));
    }
    return { x, w: bw, h: bh, roofY, enemies };
  }

  /* ── INIT STATE ─────────────────────────────────────────── */
  function initState() {
    G = {
      running: true,   /* ← true from the start */
      paused: false,
      over: false,
      score: 0,
      best: parseInt(localStorage.getItem("spidy_best") || "0"),
      level: 0,
      kills: 0,
      keys: {},
      cursor: null,
      player: makePlayer(),
      buildings: [],
      
      particles: [],
      raf: null,
    };

    /* seed first buildings starting at x=0, all in screen-space */
    let bx = 0;
    for (let i = 0; i < 8; i++) {
      const nb = makeBuilding(bx);
      G.buildings.push(nb);
      bx = nb.x + nb.w + CFG.buildingGap + Math.random() * 50;
    }

    /* place player on first building's roof */
    const firstBld = G.buildings[0];
    G.player.x = firstBld.x + 20;
    G.player.y = firstBld.roofY - G.player.h;

    updateHUD();
  }

  /* ── DOM HELPERS ────────────────────────────────────────── */
  /* Hearts */
  let heartEls = [];
  function updateHearts() {
    heartEls.forEach((h, i) => h.classList.toggle("empty", i >= G.player.hp));
  }

  function updateHUD() {
    if (!G) return;
    setEl("hud-score", G.score);
    setEl("hud-best", G.best);
    setEl("hud-level", G.level + 1);
    const nxt = CFG.lvlThresholds[G.level + 1];
    setEl("hud-enemies", nxt !== undefined ? Math.max(0, nxt - G.kills) : "MAX");
    setEl("nav-best", G.best);
    updateHearts();
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── OVERLAY ─────────────────────────────────────────────── */
  function showOverlay(type) {
    const ov = document.getElementById("overlay");
    const oc = document.getElementById("overlay-card");
    if (!ov || !oc) return;

    let html = "";
    if (type === "paused") {
      html = `
        <div class="ol-title c-purple">PAUSA</div>
        <div class="ol-sub">— JUEGO EN PAUSA —</div>
        <div class="ol-stat c-white">Puntaje: <span class="c-neon">${G.score}</span></div>
        <div class="ol-stat c-white">Nivel: <span class="c-neon">${G.level + 1}</span></div>
        <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.55rem">
          <button class="btn-spidy" id="ov-resume">▶ CONTINUAR</button>
          <button class="btn-outline-spidy" id="ov-restart">↺ REINICIAR</button>
          <button class="btn-outline-spidy" id="ov-menu">⌂ MENÚ</button>
        </div>`;
    } else if (type === "gameover") {
      const nb = G.score >= G.best;
      html = `
        <div class="ol-title c-red">GAME OVER</div>
        <div class="ol-sub">— MILES CAYÓ —</div>
        <div class="ol-stat">Puntaje: <span class="c-neon">${G.score}</span></div>
        <div class="ol-stat">Enemigos: <span class="c-neon">${G.kills}</span></div>
        <div class="ol-stat">Nivel: <span class="c-neon">${G.level + 1}</span></div>
        ${nb ? '<div class="ol-stat c-neon">★ NUEVO RÉCORD ★</div>' : ""}
        <div class="ol-stat">Récord: <span class="c-neon">${G.best}</span></div>
        <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.55rem">
          <button class="btn-spidy" id="ov-restart">↺ REINTENTAR</button>
          <button class="btn-outline-spidy" id="ov-menu">⌂ MENÚ</button>
        </div>`;
    } else if (type === "victory") {
      html = `
        <div class="ol-title c-neon">¡VICTORIA!</div>
        <div class="ol-sub">— BROOKLYN ESTÁ SEGURA —</div>
        <div class="ol-stat">Puntaje: <span class="c-neon">${G.score}</span></div>
        <div class="ol-stat">Enemigos: <span class="c-neon">${G.kills}</span></div>
        <div class="ol-stat">Récord: <span class="c-neon">${G.best}</span></div>
        <div style="margin-top:1rem;display:flex;flex-direction:column;gap:.55rem">
          <button class="btn-spidy" id="ov-restart">↺ JUGAR DE NUEVO</button>
          <button class="btn-outline-spidy" id="ov-menu">⌂ MENÚ</button>
        </div>`;
    }

    oc.innerHTML = html;
    ov.classList.add("active");

    /* wire buttons created dynamically */
    const el = id => document.getElementById(id);
    if (el("ov-resume")) el("ov-resume").onclick = doResume;
    if (el("ov-restart")) el("ov-restart").onclick = doRestart;
    if (el("ov-menu")) el("ov-menu").onclick = doMenu;
  }

  function hideOverlay() {
    const ov = document.getElementById("overlay");
    if (ov) ov.classList.remove("active");
  }

  function showLevelFlash(txt) {
    const el = document.getElementById("level-flash");
    const tx = el && el.querySelector(".flash-txt");
    if (!el || !tx) return;
    tx.textContent = txt;
    el.classList.remove("active");
    void el.offsetWidth;
    el.classList.add("active");
    setTimeout(() => el.classList.remove("active"), 2000);
  }

  /* ── GAME ACTIONS ────────────────────────────────────────── */
  function doStart() {
    const gs = document.getElementById("game-section");
    const ms = document.getElementById("menu-section");
    if (!gs || !ms) return;

    stopMusic();
    play("game");
    ms.style.display = "none";
    gs.style.display = "block";
    hideOverlay();

    /* MUST sync size after section is visible */
    syncSize();
    initState();
    loop();
  }

  function doPause() {
    if (!G || !G.running || G.paused) return;
    G.paused = true;
    showOverlay("paused");
  }

  function doResume() {
    if (!G || !G.paused) return;
    G.paused = false;
    hideOverlay();
    loop();
  }

  function doRestart() {
    if (G && G.raf) cancelAnimationFrame(G.raf);
    hideOverlay();
    stopMusic();
    play("game");
    syncSize();
    initState();
    loop();
  }

  function doMenu() {
    if (G && G.raf) cancelAnimationFrame(G.raf);
    stopMusic();
    play("menu");
    const gs = document.getElementById("game-section");
    const ms = document.getElementById("menu-section");
    if (gs) gs.style.display = "none";
    if (ms) ms.style.display = "";
    hideOverlay();
    window.scrollTo({ top: 0, behavior: "smooth" });
    const sc = document.getElementById("menu-score");
    const bst = document.getElementById("menu-best");
    if (sc) sc.textContent = G ? G.score : 0;
    if (bst) bst.textContent = G ? G.best : 0;
    G = null;
  }

  function endGame(won) {
    if (!G || G.over) return;
    G.running = false;
    G.over = true;
    stopMusic();
    play(won ? "levelup" : "die");
    if (G.score > G.best) {
      G.best = G.score;
      localStorage.setItem("spidy_best", G.best);
    }
    setTimeout(() => showOverlay(won ? "victory" : "gameover"), 500);
  }

  /* ── LEVEL UP ──────────────────────────────────────────── */
  function checkLevel() {
    if (G.level >= CFG.TOTAL_LEVELS) return;
    const nxt = CFG.lvlThresholds[G.level + 1];
    if (nxt !== undefined && G.kills >= nxt) {
      G.level++;
      play("levelup");
      showLevelFlash("NIVEL " + (G.level + 1));
      updateHUD();
      if (G.level >= CFG.TOTAL_LEVELS) { endGame(true); }
    }
  }

  /* ── SHOOT ─────────────────────────────────────────────── */
  function doShoot(tx, ty) {
    if (!G || G.paused || !G.running) return;
    const P = G.player;
    if (P.shootTimer > 0) return;
    P.shootTimer = 18;
    P.isShooting = true;
    play("shoot");

    const ox = P.x + P.w / 2;
    const oy = P.y + P.h * 0.35;
    const dx = tx - ox, dy = ty - oy;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    P.webs.push({
      x: ox, y: oy,
      vx: (dx / d) * CFG.webSpeed,
      vy: (dy / d) * CFG.webSpeed,
      w: 14, h: 14, life: 65,
    });
    P.facing = dx >= 0 ? 1 : -1;
  }

  /* ── PARTICLES ─────────────────────────────────────────── */
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 3.2;
      G.particles.push({
        x, y,
        vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2,
        r: 2.5 + Math.random() * 3.5,
        color, life: 28 + Math.floor(Math.random() * 22), maxLife: 50,
      });
    }
  }

  /* ── MAIN LOOP ──────────────────────────────────────────── */
  function loop() {
    if (!G || !G.running || G.paused) return;
    update();
    render();
    G.raf = requestAnimationFrame(loop);
  }

  /* ── UPDATE ─────────────────────────────────────────────── */
  function update() {
    const P = G.player;
    const k = G.keys;

    /* ── player horizontal ── */
    if (k["ArrowLeft"] || k["KeyA"]) { P.vx = -CFG.playerSpeed; P.facing = -1; }
    else if (k["ArrowRight"] || k["KeyD"]) { P.vx = CFG.playerSpeed; P.facing = 1; }
    else { P.vx *= 0.6; }

    /* ── gravity ── */
    P.vy += CFG.gravity;
    if (P.vy > 18) P.vy = 18;   /* terminal velocity */

    /* ── move ── */
    P.x += P.vx;
    P.y += P.vy;

    /* ── timers ── */
    if (P.shootTimer > 0) { P.shootTimer--; if (P.shootTimer === 0) P.isShooting = false; }
    if (P.invincible > 0) P.invincible--;

    /* ── scroll: keep player left of 55% of screen ── */
    const scrollTrigger = W * 0.55;
    if (P.x > scrollTrigger) {
      const shift = P.x - scrollTrigger;
      P.x = scrollTrigger;
      G.buildings.forEach(b => {
        b.x -= shift;
        b.enemies.forEach(en => { en.x -= shift; en.bullets.forEach(bl => bl.x -= shift); });
      });
    }

    /* ── generate new buildings on right edge ── */
    /* Always work in SCREEN space — find rightmost edge and fill ahead */
    {
      let rightEdge = 0;
      G.buildings.forEach(b => { const r = b.x + b.w; if (r > rightEdge) rightEdge = r; });
      while (rightEdge < W + 320) {
        const gap = CFG.buildingGap + Math.random() * 50;
        const newX = rightEdge + gap;
        const nb = makeBuilding(newX);
        G.buildings.push(nb);
        rightEdge = newX + nb.w;
      }
    }

    /* ── cull off-screen buildings ── */
    G.buildings = G.buildings.filter(b => b.x + b.w > -60);

    /* ── platform collision ── */
    P.onGround = false;
    G.buildings.forEach(b => {
      if (P.x + P.w < b.x + 6 || P.x > b.x + b.w - 6) return;
      const feet = P.y + P.h;
      const prevFeet = feet - P.vy;
      if (P.vy >= 0 && prevFeet <= b.roofY + 4 && feet >= b.roofY) {
        P.y = b.roofY - P.h;
        P.vy = 0;
        P.onGround = true;
      }
    });

    /* ── world floor safety ── */
    if (P.y + P.h > H + 80) {
      /* fell off — respawn on nearest building */
      const nearest = G.buildings.reduce((best, b) =>
        Math.abs((b.x + b.w / 2) - P.x) < Math.abs((best.x + best.w / 2) - P.x) ? b : best,
        G.buildings[0]);
      if (nearest) {
        P.x = nearest.x + nearest.w / 2 - P.w / 2;
        P.y = nearest.roofY - P.h;
        P.vy = 0;
        P.hp--;
        P.invincible = 90;
        play("hit");
        updateHUD();
        if (P.hp <= 0) { endGame(false); return; }
      }
    }

    /* ── clamp left edge ── */
    if (P.x < 0) { P.x = 0; P.vx = 0; }

    /* ── webs ── */
    P.webs = P.webs.filter(w => w.life > 0);
    P.webs.forEach(w => { w.x += w.vx; w.y += w.vy; w.life--; });

    /* ── enemies ── */
    G.buildings.forEach(b => {
      b.enemies.forEach(en => {
        if (!en.alive) return;

        /* AI: drift toward player on roof */
        const pdx = (P.x + P.w / 2) - (en.x + en.w / 2);
        en.dir = pdx > 0 ? 1 : -1;
        en.vx = en.dir * 0.7;
        en.vy += CFG.gravity;
        en.x += en.vx;
        en.y += en.vy;

        /* land enemy on roof */
        if (en.y + en.h >= b.roofY) { en.y = b.roofY - en.h; en.vy = 0; }
        /* clamp to building */
        if (en.x < b.x + 2) { en.x = b.x + 2; }
        if (en.x + en.w > b.x + b.w - 2) { en.x = b.x + b.w - en.w - 2; }

        /* fire */
        en.fireTimer--;
        if (en.fireTimer <= 0) {
          en.fireTimer = CFG.lvlFireRate[G.level] + Math.floor(Math.random() * 40);
          const ex = en.x + en.w / 2, ey = en.y + en.h / 2;
          const px = P.x + P.w / 2, py = P.y + P.h / 2;
          const ddx = px - ex, ddy = py - ey;
          const dd = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
          en.bullets.push({
            x: ex, y: ey,
            vx: (ddx / dd) * CFG.bulletSpeed,
            vy: (ddy / dd) * CFG.bulletSpeed,
            life: 140,
          });
        }

        /* bullet ↔ player */
        en.bullets.forEach(bl => {
          bl.x += bl.vx; bl.y += bl.vy; bl.life--;
          if (bl.life <= 0 || P.invincible > 0) return;
          if (bl.x > P.x && bl.x < P.x + P.w && bl.y > P.y && bl.y < P.y + P.h) {
            bl.life = 0;
            P.hp--;
            P.invincible = 90;
            play("hit");
            burst(P.x + P.w / 2, P.y + P.h / 2, "#e61a1a", 8);
            updateHUD();
            if (P.hp <= 0) { endGame(false); return; }
          }
        });
        en.bullets = en.bullets.filter(bl => bl.life > 0);

        /* web ↔ enemy */
        P.webs.forEach(w => {
          if (w.life <= 0) return;
          if (w.x > en.x && w.x < en.x + en.w && w.y > en.y && w.y < en.y + en.h) {
            w.life = 0;
            en.hp--;
            burst(en.x + en.w / 2, en.y + en.h / 2, "#39ff14", 6);
            if (en.hp <= 0) {
              en.alive = false;
              G.score += 10 * (G.level + 1);
              G.kills++;
              if (G.score > G.best) {
                G.best = G.score;
                localStorage.setItem("spidy_best", G.best);
              }
              play("die");
              burst(en.x + en.w / 2, en.y, "#7b2fff", 14);
              checkLevel();
              updateHUD();
            }
          }
        });
      });
    });

    /* ── particles ── */
    G.particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life--; });
    G.particles = G.particles.filter(p => p.life > 0);
  }

  /* ── RENDER ─────────────────────────────────────────────── */
  function render() {
    ctx.clearRect(0, 0, W, H);

    /* background */
    if (imgReady("background")) {
      ctx.drawImage(IMG.background, 0, 0, W, H);
    } else {
      /* fallback: night-city gradient */
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#07070d");
      grd.addColorStop(0.6, "#0d0020");
      grd.addColorStop(1, "#1a0035");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      /* city silhouette */
      ctx.fillStyle = "#0a0018";
      const cols = [
        [0, H * 0.35, 60, H * 0.65],
        [50, H * 0.25, 50, H * 0.75],
        [90, H * 0.30, 70, H * 0.70],
        [150, H * 0.20, 55, H * 0.80],
        [200, H * 0.32, 80, H * 0.68],
        [270, H * 0.22, 65, H * 0.78],
        [325, H * 0.28, 45, H * 0.72],
        [360, H * 0.18, 90, H * 0.82],
        [440, H * 0.26, 70, H * 0.74],
        [500, H * 0.30, 50, H * 0.70],
        [540, H * 0.22, 80, H * 0.78],
        [610, H * 0.28, 55, H * 0.72],
        [655, H * 0.20, 70, H * 0.80],
        [715, H * 0.32, 60, H * 0.68],
        [765, H * 0.25, 75, H * 0.75],
        [830, H * 0.30, 70, H * 0.70],
      ];
      cols.forEach(([x, y, w, h]) => ctx.fillRect(x, y, w, h));

      /* grid overlay */
      ctx.strokeStyle = "rgba(123,47,255,0.055)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 55) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 55) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
    }

    /* buildings */
    G.buildings.forEach(b => drawBuilding(b));

    /* enemy bullets */
    G.buildings.forEach(b =>
      b.enemies.forEach(en =>
        en.bullets.forEach(bl => {
          ctx.save();
          ctx.shadowColor = "#e61a1a"; ctx.shadowBlur = 10;
          ctx.fillStyle = "#ff3333";
          ctx.beginPath(); ctx.arc(bl.x, bl.y, 4, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        })
      )
    );

    /* player webs */
    const P = G.player;
    P.webs.forEach(w => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, w.life / 40);
      if (imgReady("web")) {
        ctx.drawImage(IMG.web, w.x - w.w / 2, w.y - w.h / 2, w.w, w.h);
      } else {
        ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 14;
        ctx.fillStyle = "#39ff14";
        ctx.beginPath(); ctx.arc(w.x, w.y, 6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });

    /* web rope */
    if (P.isShooting && P.webs.length > 0) {
      const w = P.webs[P.webs.length - 1];
      ctx.save();
      ctx.strokeStyle = "rgba(57,255,20,0.55)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 6;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(P.x + (P.facing > 0 ? P.w - 4 : 4), P.y + P.h * 0.35);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    /* player */
    drawPlayer();

    /* particles */
    G.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.shadowColor = p.color; ctx.shadowBlur = 10;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });

    /* cursor */
    if (G.cursor) {
      const { x, y } = G.cursor;
      ctx.save();
      if (imgReady("web")) {
        ctx.globalAlpha = 0.88;
        ctx.drawImage(IMG.web, x - 13, y - 13, 26, 26);
      } else {
        ctx.strokeStyle = "#39ff14"; ctx.lineWidth = 2;
        ctx.shadowColor = "#39ff14"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x + 11, y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x, y + 11); ctx.stroke();
      }
      ctx.restore();
    }

    /* hit flash */
    if (P.invincible > 0 && Math.floor(P.invincible / 7) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = "rgba(230,26,26,0.15)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function drawBuilding(b) {
    if (b.x + b.w < -10 || b.x > W + 10) return;

    if (imgReady("building")) {
      ctx.drawImage(IMG.building, b.x, b.roofY, b.w, b.h);
    } else {
      /* fallback building */
      const bg = ctx.createLinearGradient(b.x, b.roofY, b.x, b.roofY + b.h);
      bg.addColorStop(0, "#1a0035");
      bg.addColorStop(1, "#0a0015");
      ctx.fillStyle = bg;
      ctx.fillRect(b.x, b.roofY, b.w, b.h);

      /* side border */
      ctx.strokeStyle = "rgba(123,47,255,0.45)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.roofY, b.w, b.h);

      /* roof ledge */
      ctx.fillStyle = "#2a0050";
      ctx.fillRect(b.x - 5, b.roofY, b.w + 10, 10);
      ctx.strokeStyle = "rgba(123,47,255,0.7)";
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x - 5, b.roofY, b.w + 10, 10);

      /* windows */
      for (let wy = b.roofY + 18; wy < b.roofY + b.h - 16; wy += 24) {
        for (let wx = b.x + 14; wx < b.x + b.w - 20; wx += 30) {
          const lit = Math.random() > 0.35;
          ctx.fillStyle = lit
            ? `rgba(57,255,20,${0.1 + Math.random() * 0.15})`
            : "rgba(123,47,255,0.07)";
          ctx.fillRect(wx, wy, 16, 11);
        }
      }
    }

    /* enemies */
    b.enemies.forEach(en => { if (en.alive) drawEnemy(en); });
  }

  function drawEnemy(en) {
    /* hp bar */
    ctx.fillStyle = "#222";
    ctx.fillRect(en.x, en.y - 9, en.w, 5);
    const pct = en.hp / en.maxHp;
    ctx.fillStyle = pct > 0.5 ? "#39ff14" : pct > 0.25 ? "#ffaa00" : "#e61a1a";
    ctx.fillRect(en.x, en.y - 9, en.w * pct, 5);

    if (imgReady("thug")) {
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
      /* fallback enemy shape */
      ctx.fillStyle = "#7b0099";
      ctx.fillRect(en.x + 6, en.y, en.w - 12, 20);        /* head */
      ctx.fillStyle = "#550077";
      ctx.fillRect(en.x + 2, en.y + 20, en.w - 4, 22);    /* body */
      ctx.fillStyle = "#e61a1a";
      ctx.fillRect(en.x + 8, en.y + 4, en.w - 16, 10);    /* face */
    }
  }

  function drawPlayer() {
  const P = G.player;
  let key = "standing";
  if (!P.onGround)              key = "jump";      // ← AGREGA ESTA LÍNEA PRIMERO
  else if (P.isShooting)        key = "shoot";
  else if (Math.abs(P.vx) > 0.8) key = "running";

    if (imgReady(key)) {
      ctx.save();
      if (P.facing < 0) {
        ctx.translate(P.x + P.w, P.y);
        ctx.scale(-1, 1);
        ctx.drawImage(IMG[key], 0, 0, P.w, P.h);
      } else {
        ctx.drawImage(IMG[key], P.x, P.y, P.w, P.h);
      }
      ctx.restore();
    } else {
      /* fallback player shape (Miles colors: black/red/purple) */
      const flash = P.invincible > 0 && Math.floor(P.invincible / 5) % 2 === 0;
      /* body */
      ctx.fillStyle = flash ? "#880000" : "#0a0a1a";
      ctx.fillRect(P.x + 4, P.y, P.w - 8, P.h);
      /* chest web pattern */
      ctx.fillStyle = flash ? "#ff6666" : "#e61a1a";
      ctx.fillRect(P.x + 9, P.y + 8, P.w - 18, 16);
      /* mask */
      ctx.fillStyle = flash ? "#880000" : "#0a0a1a";
      ctx.beginPath();
      ctx.ellipse(P.x + P.w / 2, P.y + 8, (P.w - 10) / 2, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      /* eyes */
      ctx.fillStyle = "#39ff14";
      ctx.fillRect(P.x + 10, P.y + 4, 9, 6);
      ctx.fillRect(P.x + P.w - 19, P.y + 4, 9, 6);
      /* purple accent stripes */
      ctx.fillStyle = "#7b2fff";
      ctx.fillRect(P.x + 4, P.y + 26, P.w - 8, 4);
      ctx.fillRect(P.x + 4, P.y + 36, P.w - 8, 3);
    }
  }

  /* ── INPUT HANDLING ─────────────────────────────────────── */
  function onKeyDown(e) {
    if (!G) return;
    G.keys[e.code] = true;
    if (e.code === "Escape" && G.running) {
      G.paused ? doResume() : doPause();
    }
    if (e.code === "Space" && G.running && !G.paused) {
      e.preventDefault();
      if (G.player.onGround) { G.player.vy = CFG.jumpForce; G.player.onGround = false; }
    }
    /* Arrow keys: prevent page scroll during gameplay */
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code) && G.running) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) { if (G) G.keys[e.code] = false; }

  /* ── BOOT ────────────────────────────────────────────────── */
  function boot() {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");
    heartEls = Array.from(document.querySelectorAll(".heart"));

    /* button wiring (static buttons only — overlay buttons wired dynamically) */
    const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    wire("btn-play", doStart);
    wire("btn-instructions", () =>
      document.getElementById("instructions-section").scrollIntoView({ behavior: "smooth" })
    );

    /* nav play link */
    const navPlay = document.getElementById("nav-play-link");
    if (navPlay) navPlay.onclick = e => { e.preventDefault(); doStart(); };

    /* canvas events */
    canvas.addEventListener("click", e => {
      if (!G || !G.running || G.paused) return;
      const r = canvas.getBoundingClientRect();
      doShoot(
        (e.clientX - r.left) * (W / r.width),
        (e.clientY - r.top) * (H / r.height)
      );
    });
    canvas.addEventListener("touchstart", e => {
      if (!G || !G.running || G.paused) return;
      e.preventDefault();
      const t = e.touches[0];
      const r = canvas.getBoundingClientRect();
      doShoot(
        (t.clientX - r.left) * (W / r.width),
        (t.clientY - r.top) * (H / r.height)
      );
    }, { passive: false });
    canvas.addEventListener("mousemove", e => {
      if (!G) return;
      const r = canvas.getBoundingClientRect();
      G.cursor = {
        x: (e.clientX - r.left) * (W / r.width),
        y: (e.clientY - r.top) * (H / r.height),
      };
    });
    canvas.addEventListener("mouseleave", () => { if (G) G.cursor = null; });

    /* keyboard */
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", () => { if (G && G.running) syncSize(); });

    /* load images in background (game uses fallbacks while loading) */
    loadImages(() => {
      /* update menu best score once images are done */
      const best = localStorage.getItem("spidy_best") || "0";
      setEl("menu-best", best);
      setEl("nav-best", best);
    });

    /* menu music on first interaction */
    document.addEventListener("click", () => play("menu"), { once: true });

    /* update menu best immediately from storage */
    const best = localStorage.getItem("spidy_best") || "0";
    setEl("menu-best", best);
    setEl("nav-best", best);
  }

  document.addEventListener("DOMContentLoaded", boot);

})();