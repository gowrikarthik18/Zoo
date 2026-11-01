/* Burp Hero: The Great Feast Run
 * Plain JavaScript + <canvas>. Open index.html in a browser to play.
 *
 * Faces: put your photos in assets/ as
 *   hero-face.(png|jpg|jpeg|webp)    -> the hero's face
 *   veggie-face.(png|jpg|jpeg|webp)  -> the face on every green vegetable enemy
 * or upload them from the title screen (saved in the browser).
 * Optional: assets/burp.mp3 replaces the built-in synthesized burp.
 */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const VW = 960, VH = 560, T = 40, ROWS = 14;
  const TAU = Math.PI * 2;
  const GRAV = 2000, MAXFALL = 900, JUMP_V = 760;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ Faces
  const faceImg = { hero: null, veggie: null }; // square canvases

  function loadImage(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }
  function toSquare(img, size = 256) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const g = cv.getContext('2d');
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const s = Math.min(w, h) * 0.8;  // zoom in a little on the face
    const sx = (w - s) / 2;
    const sy = (h - s) * 0.35; // portraits: faces usually sit a bit above center
    g.drawImage(img, sx, sy, s, s, 0, 0, size, size);
    return cv;
  }
  async function loadFace(kind) {
    const stored = localStorage.getItem('burphero_face_' + kind);
    if (stored) {
      const img = await loadImage(stored);
      if (img) { faceImg[kind] = toSquare(img); return; }
    }
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'PNG', 'JPG', 'JPEG']) {
      const img = await loadImage(`assets/${kind}-face.${ext}`);
      if (img) { faceImg[kind] = toSquare(img); return; }
    }
    faceImg[kind] = null;
  }
  function handleUpload(kind, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const img = await loadImage(reader.result);
      if (!img) return;
      const sq = toSquare(img);
      faceImg[kind] = sq;
      try { localStorage.setItem('burphero_face_' + kind, sq.toDataURL('image/jpeg', 0.9)); } catch (e) { /* storage full */ }
      drawPreviews();
    };
    reader.readAsDataURL(file);
  }

  // Draw a photo face clipped into a circle. Returns false if no photo.
  function drawPhotoFace(c, kind, cx, cy, r) {
    const img = faceImg[kind];
    if (!img) return false;
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.closePath(); c.clip();
    c.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    c.restore();
    c.beginPath(); c.arc(cx, cy, r, 0, TAU);
    c.lineWidth = Math.max(1.5, r * 0.12);
    c.strokeStyle = kind === 'hero' ? '#5a2a10' : '#1b4d12';
    c.stroke();
    return true;
  }

  function drawHeroFace(c, cx, cy, r, dir) {
    if (drawPhotoFace(c, 'hero', cx, cy, r)) return;
    // cartoon fallback
    c.fillStyle = '#f1c27d';
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.lineWidth = r * 0.1; c.strokeStyle = '#5a2a10'; c.stroke();
    c.fillStyle = '#3b2314'; // hair
    c.beginPath(); c.arc(cx, cy - r * 0.15, r, Math.PI * 1.08, Math.PI * 1.92); c.fill();
    const ex = dir * r * 0.15;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(cx - r * 0.35 + ex, cy - r * 0.1, r * 0.2, 0, TAU); c.arc(cx + r * 0.35 + ex, cy - r * 0.1, r * 0.2, 0, TAU); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(cx - r * 0.3 + ex * 1.5, cy - r * 0.1, r * 0.1, 0, TAU); c.arc(cx + r * 0.4 + ex * 1.5, cy - r * 0.1, r * 0.1, 0, TAU); c.fill();
    c.fillStyle = '#ff8a80';
    c.beginPath(); c.arc(cx - r * 0.55, cy + r * 0.3, r * 0.15, 0, TAU); c.arc(cx + r * 0.55, cy + r * 0.3, r * 0.15, 0, TAU); c.fill();
    c.fillStyle = '#2b1a0e'; // mustache
    c.beginPath(); c.ellipse(cx - r * 0.22, cy + r * 0.3, r * 0.28, r * 0.13, -0.3, 0, TAU);
    c.ellipse(cx + r * 0.22, cy + r * 0.3, r * 0.28, r * 0.13, 0.3, 0, TAU); c.fill();
    c.strokeStyle = '#5a2a10'; c.lineWidth = r * 0.08;
    c.beginPath(); c.arc(cx, cy + r * 0.45, r * 0.25, 0.2, Math.PI - 0.2); c.stroke();
  }

  function drawVeggieFace(c, cx, cy, r) {
    if (drawPhotoFace(c, 'veggie', cx, cy, r)) {
      // angry brows over the photo
      c.strokeStyle = '#102b0a'; c.lineWidth = Math.max(2, r * 0.22); c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx - r * 0.95, cy - r * 1.05); c.lineTo(cx - r * 0.2, cy - r * 0.75);
      c.moveTo(cx + r * 0.95, cy - r * 1.05); c.lineTo(cx + r * 0.2, cy - r * 0.75);
      c.stroke(); c.lineCap = 'butt';
      return;
    }
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(cx - r * 0.4, cy, r * 0.32, 0, TAU); c.arc(cx + r * 0.4, cy, r * 0.32, 0, TAU); c.fill();
    c.fillStyle = '#000';
    c.beginPath(); c.arc(cx - r * 0.35, cy + r * 0.05, r * 0.15, 0, TAU); c.arc(cx + r * 0.35, cy + r * 0.05, r * 0.15, 0, TAU); c.fill();
    c.strokeStyle = '#102b0a'; c.lineWidth = r * 0.18; c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - r * 0.8, cy - r * 0.5); c.lineTo(cx - r * 0.15, cy - r * 0.2);
    c.moveTo(cx + r * 0.8, cy - r * 0.5); c.lineTo(cx + r * 0.15, cy - r * 0.2);
    c.stroke();
    c.lineWidth = r * 0.12;
    c.beginPath(); c.arc(cx, cy + r * 0.85, r * 0.35, Math.PI + 0.4, -0.4); c.stroke();
    c.lineCap = 'butt';
  }

  function drawPreviews() {
    const hp = document.getElementById('heroPreview').getContext('2d');
    hp.clearRect(0, 0, 96, 96); drawHeroFace(hp, 48, 48, 44, 1);
    const vp = document.getElementById('veggiePreview').getContext('2d');
    vp.clearRect(0, 0, 96, 96);
    vp.fillStyle = '#2e7d32'; vp.beginPath(); vp.arc(48, 48, 46, 0, TAU); vp.fill();
    drawVeggieFace(vp, 48, 52, 32);
  }

  // ------------------------------------------------------------------ Audio
  let actx = null, master = null, muted = false;
  function audio() {
    if (!actx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      actx = new AC();
      master = actx.createGain();
      master.gain.value = 0.8;
      master.connect(actx.destination);
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }

  let burpFile = null; // optional assets/burp.mp3
  (() => {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('canplaythrough', () => { burpFile = a; }, { once: true });
    a.src = 'assets/burp.mp3';
  })();

  function synthBurp() {
    const a = audio(); if (!a || muted) return;
    const t = a.currentTime;
    const dur = 0.35 + Math.random() * 0.4;
    const base = 65 + Math.random() * 45;

    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * 1.7, t);
    osc.frequency.exponentialRampToValueAtTime(base, t + 0.07);
    osc.frequency.linearRampToValueAtTime(base * 0.75, t + dur);

    const lfo = a.createOscillator();           // gurgly pitch wobble
    lfo.frequency.value = 16 + Math.random() * 14;
    const lfoGain = a.createGain(); lfoGain.gain.value = base * 0.4;
    lfo.connect(lfoGain).connect(osc.frequency);

    const filt = a.createBiquadFilter();
    filt.type = 'lowpass'; filt.Q.value = 5;
    filt.frequency.setValueAtTime(1000, t);
    filt.frequency.linearRampToValueAtTime(380, t + dur);

    const am = a.createGain(); am.gain.value = 0.6;  // rough rattle
    const amLfo = a.createOscillator(); amLfo.frequency.value = 30 + Math.random() * 15;
    const amDepth = a.createGain(); amDepth.gain.value = 0.4;
    amLfo.connect(amDepth).connect(am.gain);

    const env = a.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.03);
    env.gain.setValueAtTime(0.7, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(filt).connect(am).connect(env).connect(master);
    for (const o of [osc, lfo, amLfo]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  function burp() {
    if (muted) return;
    if (burpFile) {
      const s = burpFile.cloneNode();
      s.playbackRate = 0.85 + Math.random() * 0.3;
      s.play().catch(() => synthBurp());
    } else synthBurp();
  }
  function tone(f1, f2, dur, type = 'square', vol = 0.15, delay = 0) {
    const a = audio(); if (!a || muted) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    jump: () => tone(260, 620, 0.16, 'square', 0.08),
    stomp: () => { tone(500, 90, 0.18, 'triangle', 0.3); tone(150, 60, 0.12, 'square', 0.08); },
    hurt: () => tone(380, 70, 0.5, 'sawtooth', 0.15),
    bump: () => tone(140, 90, 0.08, 'square', 0.1),
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 'square', 0.1, i * 0.13)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.3, 'triangle', 0.2, i * 0.22)),
  };

  // ------------------------------------------------------------------ Food
  const FOOD = {
    b: { name: 'Bawarchi Biryani', pts: 500 },
    c: { name: 'Whole BBQ Chicken', pts: 300 },
    i: { name: 'Idli', pts: 100 },
    o: { name: 'Bonda', pts: 100 },
  };

  function drawBiryani(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    // steam
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2;
    const st = performance.now() / 300;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(i * 7, -12);
      c.quadraticCurveTo(i * 7 + Math.sin(st + i) * 4, -18, i * 7, -24); c.stroke();
    }
    // rice mound
    c.fillStyle = '#f6d36b';
    c.beginPath(); c.ellipse(0, -2, 15, 10, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#e8892b';
    for (const [px, py] of [[-8, -6], [-2, -10], [5, -7], [9, -3], [-11, -2], [1, -4]]) c.fillRect(px, py, 3, 2);
    c.fillStyle = '#c0392b'; c.fillRect(-4, -8, 3, 2); c.fillRect(6, -9, 2, 2);
    c.fillStyle = '#4caf50'; // mint leaf
    c.beginPath(); c.ellipse(3, -11, 4, 2, -0.5, 0, TAU); c.fill();
    // handi pot
    c.fillStyle = '#8a4b22';
    c.beginPath(); c.ellipse(0, 6, 16, 11, 0, 0, TAU); c.fill();
    c.fillStyle = '#b5652d';
    c.beginPath(); c.ellipse(-4, 4, 7, 5, -0.3, 0, TAU); c.fill();
    c.fillStyle = '#5e3216';
    c.fillRect(-17, -3, 34, 4);
    c.restore();
  }
  function drawChicken(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    // legs with bones
    c.fillStyle = '#a0461a';
    c.beginPath(); c.ellipse(-11, -6, 6, 9, -0.8, 0, TAU); c.ellipse(11, -6, 6, 9, 0.8, 0, TAU); c.fill();
    c.fillStyle = '#fff8e1';
    c.beginPath(); c.arc(-17, -13, 3, 0, TAU); c.arc(-14, -15, 3, 0, TAU);
    c.arc(17, -13, 3, 0, TAU); c.arc(14, -15, 3, 0, TAU); c.fill();
    // body
    c.fillStyle = '#b5561c';
    c.beginPath(); c.ellipse(0, 2, 16, 12, 0, 0, TAU); c.fill();
    c.fillStyle = '#d9822b';
    c.beginPath(); c.ellipse(-3, -1, 9, 6, -0.2, 0, TAU); c.fill();
    // grill marks
    c.strokeStyle = '#5e2a0c'; c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 6 - 3, -6); c.lineTo(i * 6 + 3, 10); c.stroke(); }
    c.restore();
  }
  function drawIdli(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = '#c9c9c9'; // plate
    c.beginPath(); c.ellipse(0, 8, 18, 5, 0, 0, TAU); c.fill();
    for (const dx of [-8, 8]) {
      c.fillStyle = '#fdfdf5';
      c.beginPath(); c.ellipse(dx, 4, 10, 9, 0, Math.PI, 0); c.lineTo(dx + 10, 6); c.lineTo(dx - 10, 6); c.fill();
      c.strokeStyle = '#d8d3bd'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#e9e5d0'; c.fillRect(dx - 3, -1, 2, 2); c.fillRect(dx + 3, 1, 2, 2);
    }
    c.fillStyle = '#7cb342'; // chutney
    c.beginPath(); c.arc(0, 7, 3, 0, TAU); c.fill();
    c.restore();
  }
  function drawBonda(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    for (const [dx, dy, r] of [[-7, 3, 10], [7, 3, 10], [0, -6, 10]]) {
      c.fillStyle = '#c87a22';
      c.beginPath(); c.arc(dx, dy, r, 0, TAU); c.fill();
      c.fillStyle = '#e8a643';
      c.beginPath(); c.arc(dx - 3, dy - 3, r * 0.5, 0, TAU); c.fill();
      c.fillStyle = '#8d4f12';
      c.fillRect(dx + 3, dy + 2, 2, 2); c.fillRect(dx - 4, dy + 4, 2, 2); c.fillRect(dx + 1, dy - 5, 2, 2);
    }
    c.restore();
  }
  const FOOD_DRAW = { b: drawBiryani, c: drawChicken, i: drawIdli, o: drawBonda };

  // ------------------------------------------------------------------ Level
  let W = 0, grid = [], foods = [], enemies = [], gift = null, start = null;

  function buildLevel() {
    W = 220;
    grid = Array.from({ length: ROWS }, () => new Array(W).fill(0));
    foods = []; enemies = [];
    const g = grid;
    const ground = (a, b) => { for (let x = a; x <= b; x++) { g[12][x] = 1; g[13][x] = 1; } };
    const plat = (x, row, w) => { for (let i = 0; i < w; i++) g[row][x + i] = 2; };
    const tower = (x, h) => { for (let r = 0; r < h; r++) g[11 - r][x] = 3; };
    const stairsUp = (x, h) => { for (let i = 0; i < h; i++) tower(x + i, i + 1); };
    const stairsDown = (x, h) => { for (let i = 0; i < h; i++) tower(x + i, h - i); };
    const food = (col, row, type) => foods.push({ x: col * T + T / 2, y: row * T + T / 2, type, phase: Math.random() * TAU, got: false });
    const line = (col, row, n, types) => { for (let i = 0; i < n; i++) food(col + i, row, types[i % types.length]); };
    const enemy = (col, row, kind) => enemies.push({
      kind, x: col * T + 1, y: (row + 1) * T - 40, w: 38, h: 40,
      vx: 0, vy: 0, dir: -1, speed: 55 + Math.random() * 20, onGround: false,
      dead: false, squash: 0, gone: false, phase: Math.random() * TAU,
    });

    // 1 — warm-up
    ground(0, 30);
    line(7, 10, 5, ['i', 'o']);
    plat(14, 8, 4); food(15, 7, 'b'); food(16, 7, 'c');
    enemy(20, 11, 'broccoli'); enemy(26, 11, 'cucumber');
    food(31, 9, 'o'); food(32, 8, 'i'); food(33, 9, 'o');

    // 2 — platforms and a tower jump
    ground(34, 60);
    plat(38, 9, 3); line(38, 8, 3, ['i']);
    plat(43, 6, 4); food(44, 5, 'c'); food(45, 5, 'b');
    enemy(46, 11, 'capsicum'); enemy(51, 11, 'broccoli');
    stairsUp(55, 4); tower(59, 4); tower(60, 4);
    food(62, 6, 'b');
    ground(64, 92);
    tower(64, 4); tower(65, 4); stairsDown(66, 3);

    // 3 — floating bricks
    line(70, 10, 3, ['o', 'i']);
    plat(74, 8, 3); plat(79, 8, 3); plat(84, 8, 3);
    food(75, 7, 'c'); food(85, 7, 'b');
    enemy(80, 7, 'cucumber'); enemy(77, 11, 'broccoli'); enemy(88, 11, 'capsicum');
    plat(94, 9, 2); food(94, 8, 'i'); food(95, 8, 'o');

    // 4 — veggie army
    ground(97, 132);
    line(99, 10, 4, ['i', 'o']);
    plat(104, 8, 5); food(105, 7, 'b'); food(107, 7, 'c');
    plat(106, 5, 3); food(107, 4, 'b');
    enemy(106, 7, 'broccoli');
    enemy(110, 11, 'broccoli'); enemy(115, 11, 'cucumber'); enemy(120, 11, 'capsicum');
    tower(124, 2); tower(128, 3);
    line(125, 8, 3, ['o']);
    food(134, 9, 'c');

    // 5 — sky steps
    ground(136, 172);
    plat(139, 9, 3); plat(143, 7, 3); plat(147, 5, 3); plat(151, 7, 3); plat(155, 9, 3);
    food(144, 6, 'i'); food(148, 4, 'b'); food(149, 4, 'c'); food(152, 6, 'o');
    enemy(148, 4, 'capsicum');
    enemy(141, 11, 'broccoli'); enemy(150, 11, 'cucumber'); enemy(158, 11, 'broccoli'); enemy(163, 11, 'capsicum');
    line(160, 10, 6, ['i', 'o', 'i', 'o', 'c', 'b']);

    // 6 — the final climb to the Ultimate Gift
    ground(176, 219);
    enemy(182, 11, 'cucumber'); enemy(186, 11, 'broccoli');
    stairsUp(189, 6); stairsDown(195, 6);
    food(194, 4, 'b'); food(195, 4, 'c');
    line(201, 10, 3, ['b', 'c', 'b']);
    gift = { x: 207 * T, y: 12 * T - 80, w: 80, h: 80, open: 0 };
    start = { x: 3 * T, y: 12 * T - 54 };
  }

  function solid(c, r) {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= W) return true;
    return grid[r][c] > 0;
  }
  function moveX(e, dx) {
    e.x += dx;
    const top = Math.floor(e.y / T), bot = Math.floor((e.y + e.h - 0.001) / T);
    if (dx > 0) {
      const c = Math.floor((e.x + e.w - 0.001) / T);
      for (let r = top; r <= bot; r++) if (solid(c, r)) { e.x = c * T - e.w; return true; }
    } else if (dx < 0) {
      const c = Math.floor(e.x / T);
      for (let r = top; r <= bot; r++) if (solid(c, r)) { e.x = (c + 1) * T; return true; }
    }
    return false;
  }
  function moveY(e, dy) {
    e.y += dy;
    e.onGround = false;
    const l = Math.floor(e.x / T), r = Math.floor((e.x + e.w - 0.001) / T);
    if (dy > 0) {
      const row = Math.floor((e.y + e.h - 0.001) / T);
      for (let c = l; c <= r; c++) if (solid(c, row)) { e.y = row * T - e.h; e.vy = 0; e.onGround = true; return 'floor'; }
    } else if (dy < 0) {
      const row = Math.floor(e.y / T);
      for (let c = l; c <= r; c++) if (solid(c, row)) { e.y = (row + 1) * T; e.vy = 0; return 'head'; }
    }
    return null;
  }
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // ------------------------------------------------------------------ Input
  const keys = { left: false, right: false, jump: false, run: false };
  let jumpPressed = false;
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyZ: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
  };
  function press(k) { if (k === 'jump' && !keys.jump) jumpPressed = true; keys[k] = true; }
  function release(k) { keys[k] = false; }

  window.addEventListener('keydown', e => {
    audio();
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); if (!e.repeat) press(k); }
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') muted = !muted;
    if (e.code === 'Enter') {
      if (state === 'title' || state === 'over' || (state === 'win' && winTimer > 1.5)) startGame();
      else if (state === 'pause') togglePause();
    }
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k); });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });

  // touch buttons
  const touchEl = document.getElementById('touch');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) touchEl.classList.remove('hidden');
  touchEl.querySelectorAll('button').forEach(b => {
    const k = b.dataset.key;
    const down = e => { e.preventDefault(); audio(); press(k); b.classList.add('on'); };
    const up = e => { e.preventDefault(); release(k); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('pointerleave', up);
  });

  // ------------------------------------------------------------------ State
  let state = 'title';
  let player, camX = 0, score = 0, eaten = 0, lives = 3, time = 0, winTimer = 0;
  let particles = [], texts = [];
  const clouds = Array.from({ length: 14 }, (_, i) => ({ x: i * 260 + Math.random() * 120, y: 40 + Math.random() * 120, s: 0.7 + Math.random() * 0.6 }));

  function newPlayer() {
    return {
      x: start.x, y: start.y, w: 36, h: 54, vx: 0, vy: 0, prevY: start.y,
      onGround: false, face: 1, invuln: 0, coyote: 0, jumpBuf: 0,
      lastSafe: { x: start.x, y: start.y }, fat: 1, won: false,
    };
  }

  function startGame() {
    audio();
    buildLevel();
    player = newPlayer();
    camX = 0; score = 0; eaten = 0; lives = 3; time = 0; winTimer = 0;
    particles = []; texts = [];
    state = 'play';
    showOnly(null);
  }

  const screens = ['titleScreen', 'pauseScreen', 'overScreen', 'winScreen'];
  function showOnly(id) {
    for (const s of screens) document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  function togglePause() {
    if (state === 'play') { state = 'pause'; showOnly('pauseScreen'); }
    else if (state === 'pause') { state = 'play'; showOnly(null); }
  }

  function addText(x, y, text, color = '#fff', size = 22) { texts.push({ x, y, text, color, size, t: 0 }); }
  function burst(x, y, colors, n = 12, speed = 220, grav = 600) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6);
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.6 + Math.random() * 0.5,
        color: colors[i % colors.length], size: 3 + Math.random() * 4, grav });
    }
  }

  function loseLife(reason) {
    lives--;
    sfx.hurt();
    if (lives <= 0) {
      state = 'over';
      sfx.lose();
      document.getElementById('overStats').innerHTML = `Score: <b>${score}</b><br>Food eaten: <b>${eaten}</b>`;
      showOnly('overScreen');
      return;
    }
    player.invuln = 2;
    if (reason === 'pit') {
      player.x = player.lastSafe.x; player.y = player.lastSafe.y - 4;
      player.vx = 0; player.vy = 0;
    }
  }

  // ------------------------------------------------------------------ Update
  function update(dt) {
    const p = player;
    time += dt;

    if (p.won) { updateWin(dt); return; }

    // horizontal
    const maxV = keys.run ? 360 : 250;
    const acc = p.onGround ? 1800 : 1200;
    if (keys.left && !keys.right) { p.vx -= acc * dt; p.face = -1; }
    else if (keys.right && !keys.left) { p.vx += acc * dt; p.face = 1; }
    else {
      const f = (p.onGround ? 1800 : 500) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (Math.abs(p.vx) > maxV) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - maxV, 900 * dt);

    // jumping (with coyote time + jump buffer)
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuf = jumpPressed ? 0.12 : p.jumpBuf - dt;
    jumpPressed = false;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -JUMP_V; p.coyote = 0; p.jumpBuf = 0; sfx.jump();
    }
    if (!keys.jump && p.vy < -320) p.vy = -320;
    p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);

    p.prevY = p.y;
    if (moveX(p, p.vx * dt)) p.vx = 0;
    if (moveY(p, p.vy * dt) === 'head') sfx.bump();

    if (p.onGround) {
      const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.001) / T), row = Math.floor((p.y + p.h + 1) / T);
      if (solid(l, row) && solid(r, row)) { p.lastSafe.x = p.x; p.lastSafe.y = p.y; }
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.y > ROWS * T + 80) { loseLife('pit'); if (state !== 'play') return; }

    // food
    for (const f of foods) {
      if (f.got) continue;
      const fy = f.y + Math.sin(time * 3 + f.phase) * 4;
      const cx = clamp(f.x, p.x, p.x + p.w), cy = clamp(fy, p.y, p.y + p.h);
      if ((f.x - cx) ** 2 + (fy - cy) ** 2 < 16 * 16) {
        f.got = true;
        eaten++;
        score += FOOD[f.type].pts;
        p.fat = 1 + Math.min(0.45, eaten * 0.015);
        burp();
        addText(f.x, fy - 10, 'BURRRP!', '#fff59d', 26);
        addText(f.x, fy + 14, `+${FOOD[f.type].pts} ${FOOD[f.type].name}`, '#fff', 15);
        burst(f.x, fy, ['#ffd54f', '#ff8a65', '#fff'], 10, 180);
      }
    }

    // enemies
    for (const e of enemies) {
      if (e.gone) continue;
      if (e.dead) { e.squash -= dt; if (e.squash <= 0) e.gone = true; continue; }
      if (Math.abs(e.x - p.x) > VW + 100) continue; // asleep until near
      e.vy = Math.min(e.vy + GRAV * dt, MAXFALL);
      if (moveX(e, e.dir * e.speed * dt)) e.dir *= -1;
      moveY(e, e.vy * dt);
      if (e.onGround) {
        const fc = Math.floor((e.dir > 0 ? e.x + e.w + 1 : e.x - 1) / T);
        const fr = Math.floor((e.y + e.h + 1) / T);
        if (!solid(fc, fr)) e.dir *= -1;
      }
      if (e.y > ROWS * T + 50) { e.gone = true; continue; }

      if (overlap(p, e)) {
        if (p.vy > 0 && p.prevY + p.h <= e.y + 14) {
          e.dead = true; e.squash = 0.5;
          p.vy = keys.jump ? -720 : -460;
          score += 200;
          sfx.stomp();
          addText(e.x + e.w / 2, e.y - 6, 'SQUASH! +200', '#c5e1a5', 20);
          burst(e.x + e.w / 2, e.y + e.h / 2, ['#2e7d32', '#66bb6a', '#a5d6a7'], 14, 200);
        } else if (p.invuln <= 0) {
          p.vy = -420;
          p.vx = (p.x + p.w / 2 < e.x + e.w / 2) ? -280 : 280;
          addText(p.x + p.w / 2, p.y - 10, 'OUCH!', '#ff8a80', 24);
          loseLife('hit');
          if (state !== 'play') return;
        }
      }
    }

    // reached the gift?
    if (overlap(p, gift)) {
      p.won = true; winTimer = 0;
      p.vx = 0;
      sfx.win();
      burp();
    }

    updateFx(dt);
    updateCamera(dt);
  }

  function updateWin(dt) {
    const p = player;
    winTimer += dt;
    p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);
    moveY(p, p.vy * dt);
    if (p.onGround && winTimer < 1.4) p.vy = -500; // happy hops
    gift.open = Math.min(1, gift.open + dt * 1.5);
    if (Math.random() < 0.5) {
      burst(gift.x + gift.w / 2, gift.y - 20, ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#e040fb'], 3, 380, 400);
    }
    if (winTimer > 1.6 && state === 'play') {
      state = 'win';
      const timeBonus = Math.max(0, Math.round(300 - time)) * 10;
      const lifeBonus = lives * 1000;
      score += timeBonus + lifeBonus + 5000;
      document.getElementById('winStats').innerHTML =
        `Food eaten: <b>${eaten}</b> (that's a lot of burps!)<br>` +
        `Gift bonus: <b>5000</b> · Time bonus: <b>${timeBonus}</b> · Lives bonus: <b>${lifeBonus}</b><br>` +
        `Time: <b>${time.toFixed(1)}s</b><br>Final score: <b>${score}</b>`;
      showOnly('winScreen');
    }
    updateFx(dt);
    updateCamera(dt);
  }

  function updateFx(dt) {
    for (const q of particles) { q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; }
    particles = particles.filter(q => q.life > 0);
    for (const t of texts) { t.t += dt; t.y -= 40 * dt; }
    texts = texts.filter(t => t.t < 1.2);
  }
  function updateCamera(dt) {
    const target = clamp(player.x + player.w / 2 - VW * 0.4, 0, W * T - VW);
    camX += (target - camX) * Math.min(1, dt * 8);
  }

  // ------------------------------------------------------------------ Render
  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, '#6ec6ff'); sky.addColorStop(1, '#e1f5fe');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, VH);
    // sun
    ctx.fillStyle = 'rgba(255,235,59,0.35)';
    ctx.beginPath(); ctx.arc(820, 90, 60, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffeb3b';
    ctx.beginPath(); ctx.arc(820, 90, 42, 0, TAU); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    const span = 14 * 260;
    for (const cl of clouds) {
      let x = ((cl.x - camX * 0.2) % span + span) % span - 200;
      ctx.beginPath();
      ctx.arc(x, cl.y, 26 * cl.s, 0, TAU); ctx.arc(x + 28 * cl.s, cl.y - 12 * cl.s, 30 * cl.s, 0, TAU);
      ctx.arc(x + 60 * cl.s, cl.y, 24 * cl.s, 0, TAU); ctx.fill();
    }
    hills(0.25, '#a5d6a7', 60, 420, 0.004);
    hills(0.5, '#66bb6a', 45, 470, 0.007);
  }
  function hills(par, color, amp, base, freq) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(0, VH);
    for (let x = 0; x <= VW; x += 16) {
      const wx = x + camX * par;
      ctx.lineTo(x, base - Math.abs(Math.sin(wx * freq)) * amp - Math.sin(wx * freq * 2.7) * amp * 0.3);
    }
    ctx.lineTo(VW, VH); ctx.fill();
  }

  function drawTiles() {
    const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(W - 1, Math.floor((camX + VW) / T) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = grid[r][c]; if (!t) continue;
        const x = Math.round(c * T - camX), y = r * T;
        if (t === 1) {
          ctx.fillStyle = '#8d5a2b'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = '#6d4220';
          const h = (c * 7 + r * 13) % 5;
          ctx.fillRect(x + 6 + h * 4, y + 14, 4, 4); ctx.fillRect(x + 26 - h * 2, y + 28, 5, 4);
          if (!solid(c, r - 1)) {
            ctx.fillStyle = '#43a047'; ctx.fillRect(x, y, T, 12);
            ctx.fillStyle = '#66bb6a'; ctx.fillRect(x, y, T, 5);
            ctx.fillStyle = '#2e7d32';
            for (let i = 0; i < 4; i++) ctx.fillRect(x + i * 10 + 3, y + 12, 4, 3);
          }
        } else if (t === 2) {
          ctx.fillStyle = '#c8642c'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = '#7a3412';
          ctx.fillRect(x, y, T, 2); ctx.fillRect(x, y + 19, T, 2); ctx.fillRect(x, y + 38, T, 2);
          ctx.fillRect(x + 19, y, 2, 20); ctx.fillRect(x + 8, y + 20, 2, 20); ctx.fillRect(x + 30, y + 20, 2, 20);
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x, y + 2, T, 3);
        } else {
          ctx.fillStyle = '#9e9e9e'; ctx.fillRect(x, y, T, T);
          ctx.fillStyle = '#d0d0d0'; ctx.fillRect(x, y, T, 4); ctx.fillRect(x, y, 4, T);
          ctx.fillStyle = '#616161'; ctx.fillRect(x, y + T - 4, T, 4); ctx.fillRect(x + T - 4, y, 4, T);
        }
      }
    }
  }

  function drawGift() {
    const g = gift, x = g.x - camX, y = g.y;
    if (x < -200 || x > VW + 200) return;
    const bob = Math.sin(time * 3) * 5;
    // sign
    ctx.save();
    ctx.font = 'bold 20px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#5a2a10'; ctx.fillRect(x + g.w / 2 - 82, y - 112 + bob, 164, 32);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(x + g.w / 2 - 78, y - 108 + bob, 156, 24);
    ctx.fillStyle = '#b71c1c'; ctx.fillText('ULTIMATE GIFT', x + g.w / 2, y - 89 + bob);
    ctx.restore();
    // glow
    const glow = ctx.createRadialGradient(x + g.w / 2, y + g.h / 2, 10, x + g.w / 2, y + g.h / 2, 110);
    glow.addColorStop(0, 'rgba(255,241,118,0.6)'); glow.addColorStop(1, 'rgba(255,241,118,0)');
    ctx.fillStyle = glow; ctx.fillRect(x - 70, y - 70, g.w + 140, g.h + 140);
    // box
    ctx.fillStyle = '#e53935'; ctx.fillRect(x, y + 14, g.w, g.h - 14);
    ctx.fillStyle = '#c62828'; ctx.fillRect(x + g.w - 14, y + 14, 14, g.h - 14);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(x + g.w / 2 - 7, y + 14, 14, g.h - 14);
    // treasure rising out when opened
    if (g.open > 0) {
      const rise = g.open * 70;
      ctx.save(); ctx.globalAlpha = g.open;
      drawBiryani(ctx, x + g.w / 2, y + 10 - rise, 2.2);
      ctx.restore();
    }
    // lid
    const lift = g.open * 60, tilt = g.open * -0.6;
    ctx.save();
    ctx.translate(x + g.w / 2, y + 14 - lift); ctx.rotate(tilt);
    ctx.fillStyle = '#ef5350'; ctx.fillRect(-g.w / 2 - 6, -16, g.w + 12, 18);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(-7, -16, 14, 18);
    ctx.beginPath(); ctx.ellipse(-14, -22, 14, 9, -0.4, 0, TAU); ctx.ellipse(14, -22, 14, 9, 0.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffb300'; ctx.beginPath(); ctx.arc(0, -20, 6, 0, TAU); ctx.fill();
    ctx.restore();
    // sparkles
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 5; i++) {
      const a = time * 1.5 + i * 1.26, rr = 60 + Math.sin(time * 2 + i) * 10;
      const sx = x + g.w / 2 + Math.cos(a) * rr, sy = y + g.h / 2 + Math.sin(a) * rr * 0.7;
      const s = 3 + Math.sin(time * 6 + i) * 2;
      ctx.fillRect(sx - s, sy - 1, s * 2, 2); ctx.fillRect(sx - 1, sy - s, 2, s * 2);
    }
  }

  function drawFoods() {
    for (const f of foods) {
      if (f.got) continue;
      const x = f.x - camX; if (x < -40 || x > VW + 40) continue;
      const y = f.y + Math.sin(time * 3 + f.phase) * 4;
      FOOD_DRAW[f.type](ctx, x, y, 1);
    }
  }

  function drawEnemy(e) {
    const x = e.x - camX; if (x < -60 || x > VW + 60) return;
    const cx = x + e.w / 2, bottom = e.y + e.h, top = e.y;
    ctx.save();
    if (e.dead) {
      ctx.translate(cx, bottom); ctx.scale(1.3, 0.35); ctx.translate(-cx, -bottom);
      ctx.globalAlpha = Math.max(0, e.squash / 0.5);
    } else {
      const bob = Math.abs(Math.sin(time * 10 + e.phase)) * 2;
      ctx.translate(0, -bob);
    }
    // feet
    const step = Math.sin(time * 12 + e.phase) * 3;
    ctx.fillStyle = '#1b5e20';
    ctx.beginPath(); ctx.ellipse(cx - 8 + step, bottom - 3, 7, 4, 0, 0, TAU); ctx.ellipse(cx + 8 - step, bottom - 3, 7, 4, 0, 0, TAU); ctx.fill();

    let fy;
    if (e.kind === 'broccoli') {
      ctx.fillStyle = '#9ccc65'; ctx.fillRect(cx - 7, bottom - 20, 14, 16);
      ctx.fillStyle = '#2e7d32';
      for (const [dx, dy, r] of [[-12, 14, 10], [12, 14, 10], [0, 7, 12], [-6, 19, 10], [6, 19, 10]]) {
        ctx.beginPath(); ctx.arc(cx + dx, top + dy, r, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#1b5e20';
      for (const [dx, dy] of [[-15, 8], [14, 6], [-3, 0], [9, 22], [-12, 22]]) ctx.fillRect(cx + dx, top + dy, 3, 3);
      fy = top + 15;
    } else if (e.kind === 'cucumber') {
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.ellipse(cx, top + 18, 14, 22, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#66bb6a'; ctx.lineWidth = 2;
      for (const dx of [-8, 0, 8]) { ctx.beginPath(); ctx.moveTo(cx + dx, top + 2); ctx.lineTo(cx + dx, top + 34); ctx.stroke(); }
      ctx.fillStyle = '#1b5e20'; ctx.fillRect(cx - 2, top - 5, 4, 5);
      fy = top + 16;
    } else { // capsicum
      ctx.fillStyle = '#43a047';
      ctx.beginPath(); ctx.arc(cx - 9, top + 22, 12, 0, TAU); ctx.arc(cx + 9, top + 22, 12, 0, TAU); ctx.arc(cx, top + 24, 13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, top + 12, 18, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#81c784'; ctx.beginPath(); ctx.ellipse(cx - 10, top + 18, 3, 7, 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = '#33691e'; ctx.fillRect(cx - 3, top - 2, 6, 8);
      fy = top + 21;
    }
    drawVeggieFace(ctx, cx, fy, 12);
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    const cx = p.x - camX + p.w / 2, feet = p.y + p.h;
    const running = Math.abs(p.vx) > 20 && p.onGround;
    const step = running ? Math.sin(time * 18) : 0;
    const air = !p.onGround;

    // legs + shoes
    ctx.fillStyle = '#283593';
    ctx.fillRect(cx - 11 + step * 4, feet - 15, 9, 12);
    ctx.fillRect(cx + 2 - step * 4, feet - 15, 9, 12);
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.ellipse(cx - 7 + step * 4 + p.face * 2, feet - 3, 8, 4, 0, 0, TAU);
    ctx.ellipse(cx + 7 - step * 4 + p.face * 2, feet - 3, 8, 4, 0, 0, TAU);
    ctx.fill();

    // big round belly
    const bw = 18 * p.fat, bh = 17 + (p.fat - 1) * 6, by = feet - 26;
    const arm = air ? -1 : step;
    ctx.fillStyle = '#e8452c';
    ctx.beginPath(); ctx.ellipse(cx - bw + 1, by - 6 + arm * 4, 6, 10, 0.5, 0, TAU); ctx.ellipse(cx + bw - 1, by - 6 - arm * 4, 6, 10, -0.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(cx - bw - 3, by + 2 + arm * 4 - (air ? 14 : 0), 5, 0, TAU); ctx.arc(cx + bw + 3, by + 2 - arm * 4 - (air ? 14 : 0), 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8452c';
    ctx.beginPath(); ctx.ellipse(cx, by, bw, bh, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7a52';
    ctx.beginPath(); ctx.ellipse(cx + 3 * p.face, by + 3, bw * 0.6, bh * 0.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3e2723'; ctx.fillRect(cx - bw * 0.8, by + bh * 0.45, bw * 1.6, 4); // belt
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(cx - 3, by + bh * 0.45 - 1, 6, 6);
    ctx.fillStyle = '#b3361f'; ctx.beginPath(); ctx.arc(cx + 2 * p.face, by + 2, 2, 0, TAU); ctx.fill(); // belly button

    // head (photo face)
    drawHeroFace(ctx, cx, p.y + 9, 18, p.face);
  }

  function drawFx() {
    for (const q of particles) {
      ctx.globalAlpha = Math.min(1, q.life * 2);
      ctx.fillStyle = q.color; ctx.fillRect(q.x - camX - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, 1 - t.t / 1.2);
      ctx.font = `bold ${t.size}px "Trebuchet MS", sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = '#3a1a08';
      ctx.strokeText(t.text, t.x - camX, t.y); ctx.fillStyle = t.color; ctx.fillText(t.text, t.x - camX, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.fillStyle = 'rgba(30,15,50,0.55)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(10, 10, 940, 44, 12) : ctx.rect(10, 10, 940, 44); ctx.fill();
    ctx.font = 'bold 22px "Trebuchet MS", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE ${score}`, 24, 40);
    drawBiryani(ctx, 250, 34, 0.8);
    ctx.fillText(`× ${eaten}`, 272, 40);
    // lives
    for (let i = 0; i < 3; i++) {
      const hx = 400 + i * 32, hy = 32;
      ctx.fillStyle = i < lives ? '#ff5252' : 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(hx - 5, hy - 3, 7, 0, TAU); ctx.arc(hx + 5, hy - 3, 7, 0, TAU);
      ctx.moveTo(hx - 12, hy); ctx.lineTo(hx, hy + 12); ctx.lineTo(hx + 12, hy); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.fillText(`TIME ${Math.floor(time)}`, 520, 40);
    // progress to gift
    const prog = clamp((player.x - start.x) / (gift.x - start.x), 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(660, 27, 220, 8);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(660, 27, 220 * prog, 8);
    ctx.fillStyle = '#e53935'; ctx.fillRect(884, 21, 18, 18);
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(891, 21, 4, 18);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(660 + 220 * prog, 31, 7, 0, TAU); ctx.fill();
    if (muted) { ctx.font = '14px sans-serif'; ctx.fillText('muted', 905, 68); }
  }

  function render() {
    drawBackground();
    drawTiles();
    drawGift();
    drawFoods();
    for (const e of enemies) if (!e.gone) drawEnemy(e);
    drawPlayer();
    drawFx();
    drawHUD();
  }

  // ------------------------------------------------------------------ Loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'win') updateFx(dt);
    else if (state === 'title') { time += dt; camX = (Math.sin(time * 0.15) * 0.5 + 0.5) * 600; }
    render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Layout + UI
  function fit() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    document.getElementById('wrap').style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  document.getElementById('startBtn').onclick = startGame;
  document.getElementById('retryBtn').onclick = startGame;
  document.getElementById('againBtn').onclick = startGame;
  document.getElementById('resumeBtn').onclick = togglePause;
  const toMenu = () => { state = 'title'; showOnly('titleScreen'); };
  document.getElementById('overMenuBtn').onclick = toMenu;
  document.getElementById('winMenuBtn').onclick = toMenu;
  document.getElementById('heroUpload').onchange = e => handleUpload('hero', e.target.files[0]);
  document.getElementById('veggieUpload').onchange = e => handleUpload('veggie', e.target.files[0]);
  document.getElementById('resetFaces').onclick = async () => {
    localStorage.removeItem('burphero_face_hero');
    localStorage.removeItem('burphero_face_veggie');
    await Promise.all([loadFace('hero'), loadFace('veggie')]);
    drawPreviews();
  };

  buildLevel();
  player = newPlayer();
  drawPreviews();
  Promise.all([loadFace('hero'), loadFace('veggie')]).then(drawPreviews);
  requestAnimationFrame(frame);
})();
