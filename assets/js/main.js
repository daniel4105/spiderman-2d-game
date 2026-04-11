// ============================================================
//  SPIDER-MAN: WEB SLINGER  –  game.js
// ============================================================

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

// ── Responsive canvas ──────────────────────────────────────
const BASE_W = 900;
const BASE_H = 500;
canvas.width  = BASE_W;
canvas.height = BASE_H;

// ── DOM refs ───────────────────────────────────────────────
const titleScreen   = document.getElementById('title-screen');
const overlay       = document.getElementById('overlay');
const overlayTitle  = document.getElementById('overlay-title');
const overlayMsg    = document.getElementById('overlay-msg');
const overlayScore  = document.getElementById('overlay-score');
const startBtn      = document.getElementById('start-btn');
const restartBtn    = document.getElementById('restart-btn');
const scoreDisplay  = document.getElementById('score-display');
const bestDisplay   = document.getElementById('best-display');
const levelDisplay  = document.getElementById('level-display');
const heartsEl      = document.getElementById('hearts');

// ── Game constants ─────────────────────────────────────────
const GRAVITY     = 0.55;
const JUMP_FORCE  = -13.5;
const MOVE_SPEED  = 4.5;
const MAX_HEALTH  = 5;
const WEB_SPEED   = 14;
const BULLET_SPEED = 3.5;
const GROUND_Y    = BASE_H - 80; // floor of buildings

// ── Palette ────────────────────────────────────────────────
const COL = {
  sky1: '#0a0a2e', sky2: '#1a1040',
  red:  '#e62429', blue: '#003087',
  gold: '#ffd700', white: '#ffffff',
  webStr: '#e8e8c8',
  bldDark: '#0d1a2e', bldMid: '#142542', bldLight: '#1e3560',
  windowOn: '#fffde0', windowOff: '#0a1525',
  groundTop: '#8b5e3c', groundBot: '#6b4423',
  criminalOrange: '#e8731a', criminalSkin: '#f4a574',
  bulletCol: '#ffff44',
  flashCol: '#ff4400',
};

// ── State ──────────────────────────────────────────────────
let gameRunning  = false;
let score        = 0;
let bestScore    = parseInt(localStorage.getItem('spidey_best') || '0');
let health       = MAX_HEALTH;
let level        = 1;
let cameraX      = 0;
let frameCount   = 0;
let lastDmgTime  = 0;
let flashAlpha   = 0;
let particles    = [];
let hits         = [];

// ── Input ──────────────────────────────────────────────────
const keys = {};
let mousePos = { x: 0, y: 0 };
let mouseClick = false;

window.addEventListener('keydown',  e => { keys[e.code] = true;  e.preventDefault(); });
window.addEventListener('keyup',    e => { keys[e.code] = false; });
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mousePos = { x: e.clientX - r.left, y: e.clientY - r.top };
});
canvas.addEventListener('mousedown', e => { if (e.button === 0) mouseClick = true; });
canvas.addEventListener('mouseup',   e => { if (e.button === 0) mouseClick = false; });

// ── Entities ───────────────────────────────────────────────
let player, webs, bullets, buildings, enemies;

// ── Building generator ─────────────────────────────────────
function makeBuilding(x, forceEnemy = false) {
  const w   = 130 + Math.random() * 100;
  const h   = 160 + Math.random() * 220;
  const top = GROUND_Y - h;

  // window grid
  const wCols = Math.floor(w / 28);
  const wRows = Math.floor(h / 30);
  const windows = [];
  for (let r = 0; r < wRows; r++) {
    for (let c = 0; c < wCols; c++) {
      windows.push({ c, r, on: Math.random() > 0.35 });
    }
  }

  const hasEnemy = forceEnemy || Math.random() > 0.35;
  const enemyX   = x + 20 + Math.random() * (w - 40);

  return { x, w, h, top, windows, hasEnemy, enemyX, color: Math.floor(Math.random() * 3) };
}

function initBuildings() {
  buildings = [];
  let x = 60;
  // first building under player
  const b0 = makeBuilding(x, false);
  b0.hasEnemy = false;
  buildings.push(b0);
  x += b0.w + 30 + Math.random() * 40;

  for (let i = 0; i < 8; i++) {
    buildings.push(makeBuilding(x, true));
    x += buildings[buildings.length-1].w + 20 + Math.random() * 50;
  }
}

function spawnEnemiesFromBuildings() {
  enemies = [];
  for (const b of buildings) {
    if (b.hasEnemy) {
      enemies.push(makeEnemy(b));
    }
  }
}

function makeEnemy(building) {
  return {
    x: building.enemyX,
    y: building.top,
    w: 22, h: 34,
    vx: 0, vy: 0,
    onGround: true,
    alive: true,
    health: 2,
    shootCd: 60 + Math.random() * 120,
    shootTimer: Math.random() * 80,
    dir: -1,
    walkTimer: 0,
    walkDir: Math.random() > 0.5 ? 1 : -1,
    buildingRef: building,
    deathAnim: 0,
  };
}

function initPlayer() {
  player = {
    x: buildings[0].x + 30,
    y: buildings[0].top - 46,
    w: 28, h: 46,
    vx: 0, vy: 0,
    onGround: false,
    dir: 1,
    webCd: 0,
    runFrame: 0,
    runTimer: 0,
    invincible: 0,
    jumpAnim: 0,
  };
}

// ── Init / Reset ───────────────────────────────────────────
function initGame() {
  score    = 0;
  health   = MAX_HEALTH;
  level    = 1;
  cameraX  = 0;
  frameCount = 0;
  particles  = [];
  hits       = [];
  webs       = [];
  bullets    = [];
  flashAlpha = 0;

  initBuildings();
  initPlayer();
  spawnEnemiesFromBuildings();
  updateHUD();
}

// ── HUD update ─────────────────────────────────────────────
function updateHUD() {
  scoreDisplay.textContent = score;
  bestDisplay.textContent  = bestScore;
  levelDisplay.textContent = level;

  heartsEl.innerHTML = '';
  for (let i = 0; i < MAX_HEALTH; i++) {
    const s = document.createElement('span');
    s.className = 'heart' + (i < health ? '' : ' empty');
    s.textContent = '❤';
    heartsEl.appendChild(s);
  }
}

// ── World extension ────────────────────────────────────────
function extendWorld() {
  const last = buildings[buildings.length - 1];
  const rightEdge = last.x + last.w;
  const threshold = cameraX + BASE_W + 200;

  while (rightEdge < threshold || buildings[buildings.length-1].x + buildings[buildings.length-1].w < threshold) {
    const prev = buildings[buildings.length - 1];
    const newX = prev.x + prev.w + 20 + Math.random() * 50;
    const nb = makeBuilding(newX, true);
    buildings.push(nb);
    if (nb.hasEnemy) enemies.push(makeEnemy(nb));
    if (buildings.length % 5 === 0) level++;
  }
}

// ── Shooting ───────────────────────────────────────────────
function shoot() {
  if (player.webCd > 0) return;

  // world mouse position
  const wx = mousePos.x + cameraX;
  const wy = mousePos.y;
  const dx = wx - (player.x + player.w / 2);
  const dy = wy - (player.y + player.h / 2);
  const dist = Math.hypot(dx, dy) || 1;

  webs.push({
    x: player.x + player.w / 2,
    y: player.y + player.h / 2,
    vx: (dx / dist) * WEB_SPEED,
    vy: (dy / dist) * WEB_SPEED,
    alive: true,
    trail: [],
  });
  player.webCd = 18;
  player.dir = dx > 0 ? 1 : -1;
}

// ── Particles ──────────────────────────────────────────────
function spawnParticles(x, y, color, n = 8) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 1.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 2,
      life: 1, decay: 0.03 + Math.random() * 0.04,
      r: 2 + Math.random() * 4,
      color,
    });
  }
}

function spawnHitText(x, y, text, color) {
  hits.push({ x, y, text, color, life: 1, vy: -1.2 });
}

// ── Collision helpers ──────────────────────────────────────
function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── Physics: land on buildings ─────────────────────────────
function resolveBuilding(entity) {
  entity.onGround = false;
  for (const b of buildings) {
    const eBottom = entity.y + entity.h;
    const eRight  = entity.x + entity.w;
    const inX = eRight > b.x + 4 && entity.x < b.x + b.w - 4;
    if (inX && entity.vy >= 0 && eBottom >= b.top && eBottom - entity.vy <= b.top + 4) {
      entity.y = b.top - entity.h;
      entity.vy = 0;
      entity.onGround = true;
      break;
    }
  }
  // world floor failsafe
  if (entity.y + entity.h > BASE_H - 30) {
    entity.y = BASE_H - 30 - entity.h;
    entity.vy = 0;
    entity.onGround = true;
  }
}

// ── UPDATE ─────────────────────────────────────────────────
function update() {
  if (!gameRunning) return;
  frameCount++;

  // ── Player input ───────────────────────────────────────
  const moveLeft  = keys['ArrowLeft']  || keys['KeyA'];
  const moveRight = keys['ArrowRight'] || keys['KeyD'];
  const jump      = keys['Space'] || keys['ArrowUp'] || keys['KeyW'];

  if (moveLeft)  { player.vx = -MOVE_SPEED; player.dir = -1; }
  else if (moveRight) { player.vx = MOVE_SPEED; player.dir = 1; }
  else           { player.vx *= 0.75; }

  if (jump && player.onGround) {
    player.vy = JUMP_FORCE;
    player.jumpAnim = 12;
    spawnParticles(player.x + player.w/2, player.y + player.h, '#aaa', 5);
  }

  if (mouseClick) { shoot(); mouseClick = false; }
  if (player.webCd > 0) player.webCd--;
  if (player.invincible > 0) player.invincible--;

  // ── Player physics ─────────────────────────────────────
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;
  resolveBuilding(player);
  if (player.jumpAnim > 0) player.jumpAnim--;

  // run animation
  if (Math.abs(player.vx) > 0.5 && player.onGround) {
    player.runTimer++;
    if (player.runTimer > 6) { player.runFrame = (player.runFrame + 1) % 4; player.runTimer = 0; }
  } else if (player.onGround) {
    player.runFrame = 0;
  }

  // camera follows player
  cameraX = Math.max(0, player.x - BASE_W * 0.35);

  // extend world
  extendWorld();

  // ── Webs ───────────────────────────────────────────────
  for (const w of webs) {
    if (!w.alive) continue;
    w.trail.push({ x: w.x, y: w.y });
    if (w.trail.length > 10) w.trail.shift();
    w.x += w.vx;
    w.y += w.vy;

    // off screen
    if (w.x < cameraX - 50 || w.x > cameraX + BASE_W + 50 ||
        w.y < -50 || w.y > BASE_H + 50) {
      w.alive = false; continue;
    }

    // hit enemy
    for (const e of enemies) {
      if (!e.alive || e.deathAnim > 0) continue;
      if (w.x > e.x && w.x < e.x + e.w && w.y > e.y && w.y < e.y + e.h) {
        e.health--;
        spawnParticles(w.x, w.y, '#e8e8c8', 6);
        w.alive = false;
        if (e.health <= 0) {
          e.deathAnim = 30;
          score += 10 * level;
          spawnParticles(e.x + e.w/2, e.y + e.h/2, COL.criminalOrange, 14);
          spawnHitText(e.x + e.w/2 - cameraX, e.y - 20, '+' + (10 * level), COL.gold);
          if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('spidey_best', bestScore);
          }
          updateHUD();
        } else {
          spawnHitText(e.x + e.w/2 - cameraX, e.y - 10, 'HIT!', '#fff');
        }
        break;
      }
    }
  }
  webs = webs.filter(w => w.alive);

  // ── Enemies ────────────────────────────────────────────
  for (const e of enemies) {
    if (!e.alive) continue;

    if (e.deathAnim > 0) {
      e.deathAnim--;
      if (e.deathAnim === 0) e.alive = false;
      continue;
    }

    // gravity & walk on building
    e.vy += GRAVITY;
    const b = e.buildingRef;

    // patrol on building roof
    e.walkTimer++;
    if (e.walkTimer > 80 + Math.random() * 60) {
      e.walkDir *= -1;
      e.walkTimer = 0;
    }
    e.x += e.walkDir * 0.8;
    // keep on building
    if (e.x < b.x + 4) { e.x = b.x + 4; e.walkDir = 1; }
    if (e.x + e.w > b.x + b.w - 4) { e.x = b.x + b.w - 4 - e.w; e.walkDir = -1; }
    e.y = b.top - e.h;
    e.vy = 0;
    e.onGround = true;

    // face player
    e.dir = player.x + player.w/2 > e.x + e.w/2 ? 1 : -1;

    // shoot at player
    e.shootTimer--;
    if (e.shootTimer <= 0) {
      const ex = e.x + e.w / 2;
      const ey = e.y + e.h / 2;
      const px = player.x + player.w / 2;
      const py = player.y + player.h / 2;
      const dist = Math.hypot(px - ex, py - ey);
      // only shoot if within range and on screen
      if (dist < 600 && ex > cameraX - 100 && ex < cameraX + BASE_W + 100) {
        const spd = BULLET_SPEED + level * 0.3;
        bullets.push({
          x: ex, y: ey,
          vx: ((px - ex) / dist) * spd,
          vy: ((py - ey) / dist) * spd,
          alive: true,
        });
        e.shootTimer = Math.max(40, 100 - level * 5) + Math.random() * 80;
      } else {
        e.shootTimer = 60;
      }
    }
  }
  enemies = enemies.filter(e => e.alive || e.deathAnim > 0);

  // ── Bullets ────────────────────────────────────────────
  const now = Date.now();
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < cameraX - 60 || b.x > cameraX + BASE_W + 60 ||
        b.y < -60 || b.y > BASE_H + 60) {
      b.alive = false; continue;
    }

    // hit player
    if (player.invincible === 0 &&
        b.x > player.x && b.x < player.x + player.w &&
        b.y > player.y && b.y < player.y + player.h) {
      b.alive = false;
      health--;
      player.invincible = 80;
      flashAlpha = 0.5;
      spawnParticles(player.x + player.w/2, player.y + player.h/2, COL.red, 10);
      spawnHitText(player.x + player.w/2 - cameraX, player.y - 14, 'AUCH!', '#f55');
      updateHUD();
      if (health <= 0) { endGame(); return; }
    }
  }
  bullets = bullets.filter(b => b.alive);

  // ── Particles & hit texts ──────────────────────────────
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= p.decay; }
  particles = particles.filter(p => p.life > 0);

  for (const h of hits) { h.y += h.vy; h.life -= 0.025; }
  hits = hits.filter(h => h.life > 0);

  if (flashAlpha > 0) flashAlpha -= 0.03;
}

// ── DRAW helpers ───────────────────────────────────────────
function drawSky() {
  const grad = ctx.createLinearGradient(0, 0, 0, BASE_H);
  grad.addColorStop(0, COL.sky1);
  grad.addColorStop(1, COL.sky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BASE_W, BASE_H);

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  const seed = 42;
  for (let i = 0; i < 120; i++) {
    const sx = ((i * 137 + seed) % BASE_W);
    const sy = ((i * 97  + seed) % (BASE_H * 0.65));
    const twinkle = Math.sin(frameCount * 0.04 + i) * 0.4 + 0.6;
    ctx.globalAlpha = twinkle * 0.7;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;
}

function drawBuilding(b) {
  const sx = b.x - cameraX;
  if (sx + b.w < -10 || sx > BASE_W + 10) return;

  const colors = [COL.bldDark, COL.bldMid, COL.bldLight];
  const c = colors[b.color];

  // body
  ctx.fillStyle = c;
  ctx.fillRect(sx, b.top, b.w, b.h);

  // outline
  ctx.strokeStyle = '#0a1830';
  ctx.lineWidth = 2;
  ctx.strokeRect(sx, b.top, b.w, b.h);

  // windows
  const ww = 16, wh = 12, pad = 8;
  for (const win of b.windows) {
    const wx = sx + pad + win.c * (ww + 6);
    const wy = b.top + pad + win.r * (wh + 8);
    if (wx + ww > sx + b.w - pad || wy + wh > b.top + b.h - pad) continue;
    ctx.fillStyle = win.on ? COL.windowOn : COL.windowOff;
    ctx.fillRect(wx, wy, ww, wh);
    if (win.on) {
      ctx.fillStyle = 'rgba(255,253,200,0.15)';
      ctx.fillRect(wx, wy, ww, wh / 2);
    }
  }

  // roof ledge
  ctx.fillStyle = '#1a2d50';
  ctx.fillRect(sx - 3, b.top, b.w + 6, 6);

  // ground brick facade
  const groundH = BASE_H - GROUND_Y;
  ctx.fillStyle = COL.groundTop;
  ctx.fillRect(sx, GROUND_Y, b.w, groundH);
  // brick pattern
  ctx.strokeStyle = '#5a3a22';
  ctx.lineWidth = 1;
  for (let row = 0; row < 4; row++) {
    const by = GROUND_Y + row * 14;
    const offset = row % 2 === 0 ? 0 : 20;
    for (let col = -1; col < Math.ceil(b.w / 40) + 1; col++) {
      const bx = sx + col * 40 + offset;
      ctx.strokeRect(bx, by, 38, 12);
    }
  }
}

function drawSpiderman(p) {
  const sx = p.x - cameraX;
  const blink = p.invincible > 0 && Math.floor(p.invincible / 5) % 2 === 0;
  if (blink) return;

  const cx = sx + p.w / 2;
  const cy = p.y;
  const d  = p.dir;

  ctx.save();
  ctx.translate(cx, cy);
  if (d < 0) ctx.scale(-1, 1);

  // ── Body: torso ──────────────────────────────────────
  // legs (run animation)
  const legPhase = p.onGround ? p.runFrame : 2;
  const legAngles = [
    [0.2, 0.3], [0.4, 0.1], [0.1, 0.4], [0.3, 0.2]
  ];
  const la = legAngles[legPhase];

  // left leg
  ctx.save();
  ctx.translate(-6, 28);
  ctx.rotate(la[0]);
  ctx.fillStyle = COL.blue;
  ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = COL.red;
  ctx.fillRect(-4, 14, 8, 6);
  ctx.restore();

  // right leg
  ctx.save();
  ctx.translate(6, 28);
  ctx.rotate(-la[1]);
  ctx.fillStyle = COL.blue;
  ctx.fillRect(-4, 0, 8, 18);
  ctx.fillStyle = COL.red;
  ctx.fillRect(-4, 14, 8, 6);
  ctx.restore();

  // torso
  ctx.fillStyle = COL.red;
  ctx.beginPath();
  ctx.ellipse(0, 18, 10, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // blue sides
  ctx.fillStyle = COL.blue;
  ctx.fillRect(-10, 12, 5, 16);
  ctx.fillRect(5, 12, 5, 16);

  // spider logo
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(0, 17, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  // legs of spider
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-2, 17 + i * 2 - 2);
    ctx.lineTo(-8, 16 + i * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 17 + i * 2 - 2);
    ctx.lineTo(8, 16 + i * 2);
    ctx.stroke();
  }

  // arm (web-shooting pose)
  const armRaise = p.webCd > 12 ? -0.6 : 0;
  ctx.save();
  ctx.translate(8, 12);
  ctx.rotate(armRaise);
  ctx.fillStyle = COL.red;
  ctx.fillRect(0, 0, 12, 7);
  // web shooter flash
  if (p.webCd > 14) {
    ctx.fillStyle = COL.gold;
    ctx.beginPath();
    ctx.arc(12, 3, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // left arm
  ctx.save();
  ctx.translate(-8, 12);
  ctx.rotate(0.2);
  ctx.fillStyle = COL.red;
  ctx.fillRect(-10, 0, 10, 7);
  ctx.restore();

  // head
  ctx.fillStyle = COL.red;
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // mask web lines
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-10, 4); ctx.lineTo(10, 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(0, 14); ctx.stroke();
  // curved lines
  for (let r = 4; r <= 12; r += 4) {
    ctx.beginPath();
    ctx.arc(0, 4, r, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 4, r, Math.PI * 0.2, Math.PI * 1.8);
    ctx.stroke();
  }

  // eyes
  ctx.fillStyle = COL.white;
  ctx.save();
  ctx.translate(-4, 0);
  ctx.rotate(-0.15);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(4, 0);
  ctx.rotate(0.15);
  ctx.beginPath();
  ctx.ellipse(0, 0, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawEnemy(e) {
  const sx = e.x - cameraX;
  if (sx + e.w < -10 || sx > BASE_W + 10) return;

  const cx = sx + e.w / 2;
  const cy = e.y;

  // death animation
  if (e.deathAnim > 0) {
    const prog = 1 - e.deathAnim / 30;
    ctx.save();
    ctx.globalAlpha = 1 - prog;
    ctx.translate(cx, cy + e.h/2);
    ctx.rotate(prog * Math.PI);
    ctx.scale(1 - prog * 0.5, 1 - prog * 0.5);
    ctx.translate(-cx, -(cy + e.h/2));
  }

  ctx.save();
  ctx.translate(cx, cy);
  if (e.dir < 0) ctx.scale(-1, 1);

  // legs
  ctx.fillStyle = COL.criminalOrange;
  ctx.fillRect(-5, 20, 5, 14);
  ctx.fillRect(1, 20, 5, 14);

  // body
  ctx.fillStyle = COL.criminalOrange;
  ctx.fillRect(-8, 8, 16, 16);

  // arms
  ctx.fillStyle = COL.criminalSkin;
  ctx.fillRect(-13, 10, 6, 5);
  ctx.fillRect(8, 10, 8, 5);
  // gun in right hand
  ctx.fillStyle = '#555';
  ctx.fillRect(14, 9, 8, 4);

  // head
  ctx.fillStyle = COL.criminalSkin;
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = '#333';
  ctx.fillRect(-5, -3, 3, 3);
  ctx.fillRect(2, -3, 3, 3);

  // angry brows
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-2, -4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(2, -4); ctx.stroke();

  ctx.restore();
  if (e.deathAnim > 0) ctx.restore();

  // health bar
  if (!e.deathAnim && e.health === 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx, e.y - 8, e.w, 4);
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(sx, e.y - 8, (e.health / 2) * e.w, 4);
  }

  // muzzle flash
  if (e.shootTimer < 5 && e.shootTimer >= 0) {
    ctx.fillStyle = COL.flashCol;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(sx + (e.dir > 0 ? e.w + 6 : -6), e.y + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawWeb(w) {
  if (w.trail.length < 2) return;
  ctx.save();
  ctx.strokeStyle = COL.webStr;
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur = 3;
  ctx.beginPath();
  ctx.moveTo(w.trail[0].x - cameraX, w.trail[0].y);
  for (let i = 1; i < w.trail.length; i++) {
    ctx.lineTo(w.trail[i].x - cameraX, w.trail[i].y);
  }
  ctx.lineTo(w.x - cameraX, w.y);
  ctx.stroke();
  // tip
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(w.x - cameraX, w.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBullet(b) {
  const sx = b.x - cameraX;
  ctx.save();
  ctx.fillStyle = COL.bulletCol;
  ctx.shadowColor = COL.bulletCol;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(sx, b.y, 3, 0, Math.PI * 2);
  ctx.fill();
  // trail
  ctx.strokeStyle = 'rgba(255,255,80,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(sx, b.y);
  ctx.lineTo(sx - b.vx * 3, b.y - b.vy * 3);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x - cameraX, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHitTexts() {
  for (const h of hits) {
    ctx.save();
    ctx.globalAlpha = h.life;
    ctx.font = 'bold 18px Bangers, cursive';
    ctx.fillStyle = h.color;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(h.text, h.x, h.y);
    ctx.fillText(h.text, h.x, h.y);
    ctx.restore();
  }
}

function drawCrosshair() {
  const mx = mousePos.x;
  const my = mousePos.y;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,80,80,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx, my, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx - 18, my); ctx.lineTo(mx - 14, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx + 14, my); ctx.lineTo(mx + 18, my); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my - 18); ctx.lineTo(mx, my - 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(mx, my + 14); ctx.lineTo(mx, my + 18); ctx.stroke();
  ctx.restore();
}

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(220,0,0,${flashAlpha})`;
  ctx.fillRect(0, 0, BASE_W, BASE_H);
  ctx.restore();
}

// ── DRAW ───────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, BASE_W, BASE_H);
  drawSky();

  // buildings (back to front)
  for (const b of buildings) drawBuilding(b);

  // webs
  for (const w of webs) drawWeb(w);

  // enemies
  for (const e of enemies) drawEnemy(e);

  // bullets
  for (const b of bullets) drawBullet(b);

  // player
  drawSpiderman(player);

  // particles
  drawParticles();
  drawHitTexts();
  drawCrosshair();
  drawFlash();
}

// ── GAME LOOP ──────────────────────────────────────────────
function gameLoop() {
  update();
  draw();
  if (gameRunning) requestAnimationFrame(gameLoop);
}

// ── END / START ────────────────────────────────────────────
function endGame() {
  gameRunning = false;
  overlayTitle.textContent = '¡GAME OVER!';
  overlayMsg.textContent   = 'Los criminales ganaron esta vez...';
  overlayScore.textContent = `Puntaje: ${score}  |  Mejor: ${bestScore}`;
  overlay.classList.add('show');
}

function startGame() {
  titleScreen.style.display = 'none';
  overlay.classList.remove('show');
  initGame();
  gameRunning = true;
  requestAnimationFrame(gameLoop);
}

// ── Button events ──────────────────────────────────────────
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// ── Init best score display ────────────────────────────────
bestDisplay.textContent = bestScore;