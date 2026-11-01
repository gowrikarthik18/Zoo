/* Babai-Abbai: will Abbai get all his food?
 * Plain JavaScript + <canvas>. Open index.html in a browser to play.
 *
 * Heads (cut out of the photos) live in assets/: hero-head.png (Basha Bhai),
 * caught-head.png (his shocked face) and villain-head.png (Mental Balayya).
 * game-over.jpg is shown on the Game Over screen.
 * Sounds: burp.mp3 (eating), hit.mp3 (caught), game-over.mp3 (game over).
 */
(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const VW = 960, VH = 560, T = 40, ROWS = 14;
  const TAU = Math.PI * 2;
  const GRAV = 2000, MAXFALL = 1000;
  // Hero movement tuning (pixels; one block = 40px)
  const MOVE = {
    walk: 200,        // walking speed
    run: 285,         // speed while RUN is held
    accelGround: 1500,
    accelAir: 1100,
    brakeGround: 2400, // stops quickly, no ice-skating
    brakeAir: 700,
    jumpV: 960,        // full (held) jump: ~5 blocks high
    riseGrav: 2300,
    fallGrav: 3000,    // falls faster than he rises: snappier, less floaty
    cutV: 470,         // early release: still clears ~3 blocks
    minHold: 0.11,
  };
  const SS = 2; // supersampling for cached sprites
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FONT_DISPLAY = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
  const FONT_UI = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
  let R = 1; // canvas backing-store scale

  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function radial(c, x, y, r0, r1, stops, fx = x, fy = y) {
    const g = c.createRadialGradient(fx, fy, r0, x, y, r1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }
  function linear(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  // ------------------------------------------------------------------ Heads
  // Cut-out heads (face + hair, transparent background) from the photos, in assets/:
  //   hero-head.png    Basha Bhai while playing
  //   caught-head.png  Basha Bhai's shocked face when Mental Balayya catches him
  //   villain-head.png Mental Balayya, on every goon
  const heads = { hero: null, caught: null, villain: null };

  function loadImage(src) {
    return new Promise(res => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src;
    });
  }
  function loadHeads() {
    return Promise.all(Object.keys(heads).map(async k => { heads[k] = await loadImage(`assets/${k}-head.png`); }));
  }

  // Draw a cut-out head centred at (cx, cy), h pixels tall, with a soft contact shadow.
  function drawHead(c, img, cx, cy, h) {
    const w = h * img.width / img.height;
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.35)'; c.shadowBlur = h * 0.08; c.shadowOffsetY = h * 0.03;
    c.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    c.restore();
  }

  // r = half the head height. kind 'caught' = shocked face (falls back to the normal head)
  function drawHeroFace(c, cx, cy, r, dir, kind = 'hero') {
    const img = (kind === 'caught' && heads.caught) || heads.hero;
    if (img) { drawHead(c, img, cx, cy, r * 2); return; }
    // illustrated fallback
    c.fillStyle = radial(c, cx, cy, r * 0.1, r, [[0, '#e3a976'], [1, '#a8683e']], cx - r * 0.3, cy - r * 0.3);
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.fillStyle = '#1d140e';
    c.beginPath(); c.arc(cx, cy - r * 0.15, r, Math.PI * 1.05, Math.PI * 1.95); c.fill();
    const ex = dir * r * 0.12;
    c.beginPath(); c.arc(cx - r * 0.35 + ex, cy - r * 0.05, r * 0.1, 0, TAU); c.arc(cx + r * 0.35 + ex, cy - r * 0.05, r * 0.1, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(cx - r * 0.22, cy + r * 0.32, r * 0.26, r * 0.1, -0.25, 0, TAU);
    c.ellipse(cx + r * 0.22, cy + r * 0.32, r * 0.26, r * 0.1, 0.25, 0, TAU); c.fill();
  }

  function drawVeggieFace(c, cx, cy, r) {
    if (heads.villain) { drawHead(c, heads.villain, cx, cy, r * 2); return; }
    c.fillStyle = '#f2f2e8';
    c.beginPath(); c.ellipse(cx - r * 0.38, cy, r * 0.28, r * 0.22, 0.25, 0, TAU); c.ellipse(cx + r * 0.38, cy, r * 0.28, r * 0.22, -0.25, 0, TAU); c.fill();
    c.fillStyle = '#7a0d0d';
    c.beginPath(); c.arc(cx - r * 0.34, cy + r * 0.03, r * 0.12, 0, TAU); c.arc(cx + r * 0.34, cy + r * 0.03, r * 0.12, 0, TAU); c.fill();
  }

  function drawPreviews() {
    const hp = document.getElementById('heroPreview').getContext('2d');
    hp.clearRect(0, 0, 192, 192); drawHeroFace(hp, 96, 98, 88, 1);
    const vp = document.getElementById('veggiePreview').getContext('2d');
    vp.clearRect(0, 0, 192, 192); drawVeggieFace(vp, 96, 98, 88);
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
    decodeSamples();
    return actx;
  }

  // Sound clips from assets/. Decoded into Web Audio so they can play without a fresh tap
  // (needed on iPhone). Each falls back to a built-in sound if its file is missing.
  //   game-over.mp3 -> game over      hit.mp3 -> a villain catches the hero
  const samples = {};
  function loadSample(name, url) {
    const s = samples[name] = { bytes: null, buf: null, el: null };
    fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(b => { s.bytes = b; decodeSamples(); }).catch(() => {
      const el = new Audio(); el.preload = 'auto';
      el.addEventListener('canplaythrough', () => { s.el = el; }, { once: true });
      el.src = url;
    });
  }
  function decodeSamples() {
    if (!actx) return;
    for (const s of Object.values(samples)) {
      if (s.buf || !s.bytes) continue;
      const bytes = s.bytes; s.bytes = null;
      actx.decodeAudioData(bytes, buf => { s.buf = buf; }, () => {});
    }
  }
  function playSample(name, fallback, vol = 1.2, rate = 1) {
    if (muted) return;
    const s = samples[name], a = audio();
    if (s && a && s.buf) {
      const src = a.createBufferSource(); src.buffer = s.buf; src.playbackRate.value = rate;
      const g = a.createGain(); g.gain.value = vol;
      src.connect(g).connect(master); src.start();
    } else if (s && s.el) {
      s.el.currentTime = 0; s.el.playbackRate = rate; s.el.play().catch(fallback);
    } else fallback();
  }
  loadSample('gameover', 'assets/game-over.mp3');
  loadSample('hit', 'assets/hit.mp3');
  loadSample('burp', 'assets/burp.mp3');   // eating: your burp clip (slightly varied pitch each time)

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

    const lfo = a.createOscillator();
    lfo.frequency.value = 16 + Math.random() * 14;
    const lfoGain = a.createGain(); lfoGain.gain.value = base * 0.4;
    lfo.connect(lfoGain).connect(osc.frequency);

    const filt = a.createBiquadFilter();
    filt.type = 'lowpass'; filt.Q.value = 5;
    filt.frequency.setValueAtTime(1000, t);
    filt.frequency.linearRampToValueAtTime(380, t + dur);

    const am = a.createGain(); am.gain.value = 0.6;
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
  let noiseBuf = null;
  function noise(a) {
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = a.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    return n;
  }
  function synthFart() {
    const a = audio(); if (!a || muted) return;
    const t = a.currentTime;
    const dur = 0.45 + Math.random() * 0.55;
    const base = 50 + Math.random() * 45;

    const osc = a.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * (1.1 + Math.random() * 0.4), t);
    osc.frequency.linearRampToValueAtTime(base * (0.7 + Math.random() * 0.3), t + dur);
    const wob = a.createOscillator(); wob.frequency.value = 5 + Math.random() * 6;   // slow pitch wobble
    const wobG = a.createGain(); wobG.gain.value = base * 0.25;
    wob.connect(wobG).connect(osc.frequency);

    const flutter = a.createGain(); flutter.gain.value = 0.5;                        // the "brrrr"
    const fl = a.createOscillator(); fl.type = 'square'; fl.frequency.value = 22 + Math.random() * 20;
    const flG = a.createGain(); flG.gain.value = 0.5;
    fl.connect(flG).connect(flutter.gain);

    const n = noise(a);                                                              // airy rasp
    const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260 + Math.random() * 200; bp.Q.value = 1.2;
    const nG = a.createGain(); nG.gain.value = 0.35;
    n.connect(bp).connect(nG).connect(flutter);

    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(300, t + dur);

    const env = a.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.025);
    env.gain.setValueAtTime(0.85, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(flutter);
    flutter.connect(lp).connect(env).connect(master);
    for (const o of [osc, wob, fl, n]) { o.start(t); o.stop(t + dur + 0.05); }
  }
  // Eating makes the hero burp or fart (random). Returns which one, for the on-screen text.
  function eatSound() {
    if (Math.random() < 0.65) { burp(); return 'burp'; }
    synthFart(); return 'fart';
  }
  function burp() {
    playSample('burp', synthBurp, 1.1, 0.9 + Math.random() * 0.2);
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
    jump: () => tone(220, 480, 0.14, 'triangle', 0.12),
    stomp: () => { tone(420, 70, 0.2, 'triangle', 0.32); tone(120, 50, 0.14, 'sawtooth', 0.06); },
    hurt: () => { tone(300, 60, 0.5, 'sawtooth', 0.14); tone(90, 40, 0.4, 'square', 0.08); },
    bump: () => tone(120, 80, 0.08, 'triangle', 0.15),
    win: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.35, 'triangle', 0.14, i * 0.12)),
    lose: () => [330, 277, 233, 175].forEach((f, i) => tone(f, f * 0.97, 0.4, 'triangle', 0.2, i * 0.25)),
  };

  // ------------------------------------------------------------------ Food art
  const FOOD = {
    b: { name: 'Bawarchi Biryani', pts: 500 },
    c: { name: 'Whole BBQ Chicken', pts: 300 },
    i: { name: 'Idli', pts: 100 },
    o: { name: 'Bonda', pts: 100 },
  };

  function bananaLeaf(c, w, y) {
    c.fillStyle = linear(c, 0, y - 6, 0, y + 6, [[0, '#4f9d3a'], [1, '#225a1c']]);
    c.beginPath(); c.moveTo(-w, y); c.quadraticCurveTo(0, y - 10, w, y - 2); c.quadraticCurveTo(0, y + 10, -w, y); c.fill();
    c.strokeStyle = 'rgba(200,240,160,0.5)'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-w + 2, y); c.quadraticCurveTo(0, y - 2, w - 2, y - 2); c.stroke();
  }

  function drawBiryani(c, x, y, s = 1, steam = true) {
    c.save(); c.translate(x, y); c.scale(s, s);
    if (steam) {
      const st = performance.now() / 500;
      c.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        const ph = (st + i * 0.7) % 1;
        c.strokeStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(i * 6, -12 - ph * 6);
        c.bezierCurveTo(i * 6 + 4, -16 - ph * 8, i * 6 - 4, -20 - ph * 8, i * 6 + 1, -26 - ph * 8); c.stroke();
      }
      c.lineCap = 'butt';
    }
    // rice dome
    c.fillStyle = radial(c, -3, -8, 1, 17, [[0, '#fff6dc'], [0.55, '#f6cf75'], [1, '#d9902f']]);
    c.beginPath(); c.ellipse(0, -2, 15, 11, 0, Math.PI, 0); c.fill();
    const r = rng(42);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + r() * Math.PI, d = r() * 13;
      c.fillStyle = i % 3 === 0 ? '#e6731e' : i % 3 === 1 ? '#fffaf0' : '#f9d27a';
      c.save(); c.translate(Math.cos(a) * d, -2 + Math.sin(a) * d * 0.7); c.rotate(r() * 3);
      c.fillRect(-1.5, -0.6, 3, 1.2); c.restore();
    }
    // egg half + garnish
    c.fillStyle = '#fbfbf5'; c.beginPath(); c.ellipse(6, -7, 4.5, 3.4, -0.3, 0, TAU); c.fill();
    c.fillStyle = '#f2b02a'; c.beginPath(); c.arc(6.3, -7.2, 1.8, 0, TAU); c.fill();
    c.fillStyle = '#6b3410'; c.fillRect(-7, -9, 3, 1.5); c.fillRect(-2, -12, 3, 1.5); c.fillRect(-10, -4, 3, 1.5);
    c.fillStyle = '#3f9a3a';
    c.beginPath(); c.ellipse(-4, -11, 3.2, 1.6, -0.6, 0, TAU); c.ellipse(1, -8, 2.6, 1.3, 0.5, 0, TAU); c.fill();
    // copper handi
    c.fillStyle = radial(c, -5, 3, 2, 20, [[0, '#f0b07a'], [0.45, '#b8642d'], [1, '#5a2a10']]);
    c.beginPath(); c.ellipse(0, 6, 16.5, 11.5, 0, 0, TAU); c.fill();
    c.fillStyle = linear(c, 0, -3, 0, 2, [[0, '#f3c089'], [1, '#8a4419']]);
    rrect(c, -17.5, -3, 35, 4.5, 2); c.fill();
    c.fillStyle = 'rgba(255,240,220,0.5)'; c.beginPath(); c.ellipse(-8, 3, 3, 6, 0.5, 0, TAU); c.fill();
    c.restore();
  }
  function drawChicken(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    // plate
    c.fillStyle = linear(c, 0, 6, 0, 13, [[0, '#f4f1ea'], [1, '#a9a49a']]);
    c.beginPath(); c.ellipse(0, 10, 20, 5, 0, 0, TAU); c.fill();
    // drumsticks
    for (const sgn of [-1, 1]) {
      c.save(); c.translate(sgn * 10, -4); c.rotate(sgn * 0.7);
      c.fillStyle = radial(c, -1, -2, 1, 9, [[0, '#e99a4a'], [1, '#7a2f0e']]);
      c.beginPath(); c.ellipse(0, 0, 5.5, 8, 0, 0, TAU); c.fill();
      c.fillStyle = '#f1e6cf'; c.fillRect(-1.3, -13, 2.6, 6);
      c.beginPath(); c.arc(-1.6, -13.5, 2, 0, TAU); c.arc(1.6, -13.5, 2, 0, TAU); c.fill();
      c.restore();
    }
    // body
    c.fillStyle = radial(c, -5, -3, 2, 19, [[0, '#f2a656'], [0.5, '#b8501a'], [1, '#5e1f07']]);
    c.beginPath(); c.ellipse(0, 1, 16, 11.5, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(40,10,0,0.55)'; c.lineWidth = 1.6;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 6 - 3, -7); c.lineTo(i * 6 + 3, 9); c.stroke(); }
    c.fillStyle = 'rgba(255,240,210,0.55)';
    c.beginPath(); c.ellipse(-6, -5, 5, 2, -0.3, 0, TAU); c.fill();
    // lemon + onion
    c.fillStyle = '#f5d33c'; c.beginPath(); c.arc(15, 8, 3.4, Math.PI, 0); c.fill();
    c.strokeStyle = '#d8a9c8'; c.lineWidth = 1.2; c.beginPath(); c.arc(-15, 8, 3, 0, TAU); c.stroke();
    c.restore();
  }
  function drawIdli(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    bananaLeaf(c, 21, 8);
    for (const [dx, dy] of [[-8, 3], [8, 3], [0, -3]]) {
      c.fillStyle = radial(c, dx - 3, dy - 4, 1, 12, [[0, '#ffffff'], [0.7, '#efe9d6'], [1, '#c9c0a2']]);
      c.beginPath(); c.ellipse(dx, dy, 10, 6.5, 0, 0, TAU); c.fill();
      c.fillStyle = 'rgba(160,150,120,0.35)';
      c.fillRect(dx - 3, dy - 1, 1.2, 1.2); c.fillRect(dx + 3, dy + 1, 1.2, 1.2); c.fillRect(dx, dy - 3, 1.2, 1.2);
    }
    c.fillStyle = '#f3efe1'; c.beginPath(); c.arc(-15, 5, 3.2, 0, TAU); c.fill();
    c.fillStyle = '#c8461f'; c.beginPath(); c.arc(15, 5, 3.2, 0, TAU); c.fill();
    c.restore();
  }
  function drawBonda(c, x, y, s = 1) {
    c.save(); c.translate(x, y); c.scale(s, s);
    bananaLeaf(c, 19, 9);
    const r = rng(9);
    for (const [dx, dy, rr] of [[-7, 2, 9.5], [7, 2, 9.5], [0, -7, 9.5]]) {
      c.fillStyle = radial(c, dx - 3, dy - 3, 1, rr * 1.2, [[0, '#ffd27a'], [0.5, '#d48a2a'], [1, '#7a3e0a']]);
      c.beginPath(); c.arc(dx, dy, rr, 0, TAU); c.fill();
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU, d = r() * rr * 0.85;
        c.fillStyle = r() < 0.5 ? 'rgba(90,40,5,0.5)' : 'rgba(255,225,150,0.6)';
        c.fillRect(dx + Math.cos(a) * d, dy + Math.sin(a) * d, 1.4, 1.4);
      }
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
      kind, x: col * T - 4, y: (row + 1) * T - 72, w: 48, h: 72,
      vx: 0, vy: 0, dir: -1, speed: 55 + Math.random() * 20, onGround: false,
      dead: false, squash: 0, gone: false, phase: Math.random() * TAU,
    });

    // 1 — warm-up
    ground(0, 30);
    line(7, 10, 5, ['i', 'o']);
    plat(14, 8, 4); food(15, 7, 'b'); food(16, 7, 'c');
    enemy(20, 11, 'lungi'); enemy(26, 11, 'lathi');
    food(31, 9, 'o'); food(32, 8, 'i'); food(33, 9, 'o');

    // 2 — platforms and a tower jump
    ground(34, 60);
    plat(38, 9, 3); line(38, 8, 3, ['i']);
    plat(43, 6, 4); food(44, 5, 'c'); food(45, 5, 'b');
    enemy(46, 11, 'shawl'); enemy(51, 11, 'lungi');
    stairsUp(55, 4); tower(59, 4); tower(60, 4);
    food(62, 6, 'b');
    ground(64, 92);
    tower(64, 4); tower(65, 4); stairsDown(66, 3);

    // 3 — floating slabs
    line(70, 10, 3, ['o', 'i']);
    plat(74, 8, 3); plat(79, 8, 3); plat(84, 8, 3);
    food(75, 7, 'c'); food(85, 7, 'b');
    enemy(80, 7, 'lathi'); enemy(77, 11, 'lungi'); enemy(88, 11, 'shawl');
    plat(94, 9, 2); food(94, 8, 'i'); food(95, 8, 'o');

    // 4 — goon army
    ground(97, 132);
    line(99, 10, 4, ['i', 'o']);
    plat(104, 8, 5); food(105, 7, 'b'); food(107, 7, 'c');
    plat(106, 5, 3); food(107, 4, 'b');
    enemy(106, 7, 'lungi');
    enemy(110, 11, 'lungi'); enemy(115, 11, 'lathi'); enemy(120, 11, 'shawl');
    tower(124, 2); tower(128, 3);
    line(125, 8, 3, ['o']);
    food(134, 9, 'c');

    // 5 — sky steps
    ground(136, 172);
    plat(139, 9, 3); plat(143, 7, 3); plat(147, 5, 3); plat(151, 7, 3); plat(155, 9, 3);
    food(144, 6, 'i'); food(148, 4, 'b'); food(149, 4, 'c'); food(152, 6, 'o');
    enemy(148, 4, 'shawl');
    enemy(141, 11, 'lungi'); enemy(150, 11, 'lathi'); enemy(158, 11, 'lungi'); enemy(163, 11, 'shawl');
    line(160, 10, 6, ['i', 'o', 'i', 'o', 'c', 'b']);

    // 6 — the final climb to the Ultimate Gift
    ground(176, 219);
    enemy(182, 11, 'lathi'); enemy(186, 11, 'lungi');
    stairsUp(189, 6); stairsDown(195, 6);
    food(194, 4, 'b'); food(195, 4, 'c');
    line(201, 10, 3, ['b', 'c', 'b']);
    gift = { x: 204 * T, y: 12 * T - 230, w: 260, h: 230, open: 0 }; // the compound gate
    start = { x: 3 * T, y: 12 * T - 54 };
  }

  function solid(c, r) {
    if (r < 0 || r >= ROWS) return false;
    if (c < 0 || c >= W) return true;
    return grid[r][c] > 0;
  }
  const tileAt = (c, r) => (r >= 0 && r < ROWS && c >= 0 && c < W) ? grid[r][c] : 0;
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
      if (state === 'title' || state === 'over' || state === 'win') startGame();
      else if (state === 'pause') togglePause();
    }
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) release(k); });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });

  const touchEl = document.getElementById('touch');
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) touchEl.classList.remove('hidden');
  touchEl.querySelectorAll('button').forEach(b => {
    const k = b.dataset.key;
    const down = e => {
      e.preventDefault(); audio(); press(k); b.classList.add('on');
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* not supported */ }
    };
    const up = e => { e.preventDefault(); release(k); b.classList.remove('on'); };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  });

  // ------------------------------------------------------------------ State
  let state = 'title';
  let player, camX = 0, score = 0, eaten = 0, lives = 3, time = 0, winTimer = 0, caughtTimer = 0, shake = 0;
  let particles = [], texts = [];
  const CAUGHT_TIME = 1.8;

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
    camX = 0; score = 0; eaten = 0; lives = 3; time = 0; winTimer = 0; caughtTimer = 0; shake = 0;
    particles = []; texts = [];
    state = 'play';
    showOnly(null);
  }

  // Game Over title, drawn with the same title template into a canvas in the panel
  function drawOverTitle() {
    const cv = document.getElementById('overTitle');
    const g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, cv.width, cv.height);
    g.scale(2, 2);
    drawTitleTemplate(g, ['CHAALA AMATEURISH GA', 'AADAV BIDDA'], cv.width / 4, cv.height / 4 + 2, 54, cv.width / 2 - 40);
  }

  const screens = ['titleScreen', 'pauseScreen', 'overScreen', 'winScreen'];
  function showOnly(id) {
    for (const s of screens) document.getElementById(s).classList.toggle('hidden', s !== id);
  }
  function togglePause() {
    if (state === 'play') { state = 'pause'; showOnly('pauseScreen'); }
    else if (state === 'pause') { state = 'play'; showOnly(null); }
  }

  function addText(x, y, text, kind = 'info') { texts.push({ x, y, text, kind, t: 0 }); }
  function burst(x, y, colors, n = 12, speed = 220, grav = 600, glow = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random() * 0.6);
      particles.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life: 0.6 + Math.random() * 0.5, max: 1.1,
        color: colors[i % colors.length], size: 1.5 + Math.random() * 2.5, grav, glow, rot: Math.random() * TAU, confetti: false,
      });
    }
  }

  function loseLife(reason) {
    lives--;
    if (reason === 'hit') caughtTimer = CAUGHT_TIME;
    shake = 12;
    if (lives > 0) {
      if (reason === 'hit') playSample('hit', () => sfx.hurt());
      else sfx.hurt();
    }
    if (lives <= 0) {
      state = 'over';
      playSample('gameover', () => sfx.lose());
      drawOverTitle();
      const img = document.getElementById('overImg');
      img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop');
      document.getElementById('overStats').innerHTML = `Score <b>${score.toLocaleString()}</b> &nbsp;·&nbsp; Food eaten <b>${eaten}</b>`;
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
    shake = Math.max(0, shake - dt * 40);
    if (caughtTimer > 0) caughtTimer -= dt;

    if (p.won) { updateWin(dt); return; }

    const maxV = keys.run ? MOVE.run : MOVE.walk;
    const acc = p.onGround ? MOVE.accelGround : MOVE.accelAir;
    const turn = (dir) => (Math.sign(p.vx) === -dir ? 2 : 1); // reverse direction faster
    if (keys.left && !keys.right) { p.vx -= acc * turn(-1) * dt; p.face = -1; }
    else if (keys.right && !keys.left) { p.vx += acc * turn(1) * dt; p.face = 1; }
    else {
      const f = (p.onGround ? MOVE.brakeGround : MOVE.brakeAir) * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    }
    if (Math.abs(p.vx) > maxV) p.vx -= Math.sign(p.vx) * Math.min(Math.abs(p.vx) - maxV, MOVE.brakeGround * dt);

    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    p.jumpBuf = jumpPressed ? 0.12 : p.jumpBuf - dt;
    jumpPressed = false;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -MOVE.jumpV; p.coyote = 0; p.jumpBuf = 0; p.jumpTime = 0; sfx.jump();
      burst(p.x + p.w / 2, p.y + p.h, ['rgba(230,200,160,0.8)'], 6, 90, 200);
    }
    // releasing jump early gives a shorter jump, but even a quick tap clears ~3 blocks
    p.jumpTime = (p.jumpTime || 0) + dt;
    if (!keys.jump && p.jumpTime > MOVE.minHold && p.vy < -MOVE.cutV) p.vy = -MOVE.cutV;
    p.vy = Math.min(p.vy + (p.vy < 0 ? MOVE.riseGrav : MOVE.fallGrav) * dt, MAXFALL);

    p.prevY = p.y;
    const wasAir = !p.onGround, fallV = p.vy;
    if (moveX(p, p.vx * dt)) p.vx = 0;
    if (moveY(p, p.vy * dt) === 'head') sfx.bump();
    if (wasAir && p.onGround && fallV > 500) burst(p.x + p.w / 2, p.y + p.h, ['rgba(230,200,160,0.8)'], 8, 110, 250);

    if (p.onGround) {
      const l = Math.floor(p.x / T), r = Math.floor((p.x + p.w - 0.001) / T), row = Math.floor((p.y + p.h + 1) / T);
      if (solid(l, row) && solid(r, row)) { p.lastSafe.x = p.x; p.lastSafe.y = p.y; }
    }
    if (p.invuln > 0) p.invuln -= dt;
    if (p.y > ROWS * T + 80) { loseLife('pit'); if (state !== 'play') return; }

    for (const f of foods) {
      if (f.got) continue;
      const fy = f.y + Math.sin(time * 2.5 + f.phase) * 3;
      const cx = clamp(f.x, p.x, p.x + p.w), cy = clamp(fy, p.y, p.y + p.h);
      if ((f.x - cx) ** 2 + (fy - cy) ** 2 < 17 * 17) {
        f.got = true;
        eaten++;
        score += FOOD[f.type].pts;
        p.fat = 1 + Math.min(0.45, eaten * 0.015);
        eatSound();
        burst(f.x, fy, ['#ffe39a', '#ffb347', '#fff6dc'], 14, 170, 300, true);
      }
    }

    for (const e of enemies) {
      if (e.gone) continue;
      if (e.dead) { e.squash -= dt; if (e.squash <= 0) e.gone = true; continue; }
      if (Math.abs(e.x - p.x) > VW + 100) continue;
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
          shake = 5;
          sfx.stomp();
          addText(e.x + e.w / 2, e.y - 6, '+200  SQUASHED', 'info');
          burst(e.x + e.w / 2, e.y + e.h / 2, ['#2f7a2c', '#6fbf5a', '#a5d6a7', '#1b4d1b'], 18, 230);
        } else if (p.invuln <= 0) {
          p.vy = -420;
          p.vx = (p.x + p.w / 2 < e.x + e.w / 2) ? -280 : 280;
          loseLife('hit');
          if (state !== 'play') return;
        }
      }
    }

    if (overlap(p, gift)) {
      p.won = true; winTimer = 0;
      p.vx = 0;
      tone(110, 70, 0.9, 'sawtooth', 0.05); // gate creak
    }

    updateFx(dt);
    updateCamera(dt);
  }

  function updateWin(dt) {
    const p = player;
    winTimer += dt;
    gift.open = Math.min(1, gift.open + dt * 1.1);       // gate swings open
    p.vy = Math.min(p.vy + GRAV * dt, MAXFALL);
    if (!p.dancing) {
      p.vx = 0;
      if (gift.open > 0.45) {                              // walk into the gateway
        const dx = gift.x + gift.w / 2 - p.w / 2 - p.x;
        const stepX = Math.sign(dx) * Math.min(Math.abs(dx), 170 * dt);
        p.x += stepX; p.vx = stepX / dt; p.face = dx >= 0 ? 1 : -1;
        if (Math.abs(dx) < 1) { p.dancing = true; p.danceStart = winTimer; p.vx = 0; sfx.win(); burp(); }
      }
    } else {
      const t = winTimer - p.danceStart;
      p.face = Math.sin(t * 4.7) > 0 ? 1 : -1;            // turn side to side
      if (p.onGround && t % 0.55 < dt) p.vy = -330;       // hop on the beat
      for (let i = 0; i < 2; i++) {
        particles.push({
          x: gift.x + gift.w / 2 + (Math.random() - 0.5) * 200, y: gift.y,
          vx: (Math.random() - 0.5) * 300, vy: -200 - Math.random() * 300, life: 2.2, max: 2.2,
          color: ['#f6c90e', '#ffffff', '#ffd77a', '#e8a33c', '#c0392b'][Math.floor(Math.random() * 5)],
          size: 3 + Math.random() * 3, grav: 400, glow: false, rot: Math.random() * TAU, confetti: true,
        });
      }
    }
    moveY(p, p.vy * dt);
    if (p.dancing && winTimer - p.danceStart > 2.8 && state === 'play') {
      state = 'win';
      const timeBonus = Math.max(0, Math.round(300 - time)) * 10;
      const lifeBonus = lives * 1000;
      score += timeBonus + lifeBonus + 5000;
      document.getElementById('winStats').innerHTML =
        `<div class="row"><span>Food eaten</span><b>${eaten}</b></div>` +
        `<div class="row"><span>Compound Entry bonus</span><b>5,000</b></div>` +
        `<div class="row"><span>Time bonus</span><b>${timeBonus.toLocaleString()}</b></div>` +
        `<div class="row"><span>Lives bonus</span><b>${lifeBonus.toLocaleString()}</b></div>` +
        `<div class="row"><span>Time</span><b>${time.toFixed(1)}s</b></div>` +
        `<div class="row total"><span>Final score</span><b>${score.toLocaleString()}</b></div>`;
      showOnly('winScreen');
    }
    updateFx(dt);
    updateCamera(dt);
  }

  function updateFx(dt) {
    for (const q of particles) {
      q.life -= dt; q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.confetti) { q.vx *= 0.98; q.rot += dt * 8; }
    }
    particles = particles.filter(q => q.life > 0);
    for (const t of texts) { t.t += dt; t.y -= 34 * dt; }
    texts = texts.filter(t => t.t < 1.3);
  }
  function updateCamera(dt) {
    const target = clamp(player.x + player.w / 2 - VW * 0.4, 0, W * T - VW);
    camX += (target - camX) * Math.min(1, dt * 8);
  }

  // ------------------------------------------------------------------ Backdrop (pre-rendered)
  const LW = 1600;
  let skyGrad, vignette, layers = null;

  function buildBackdrop() {
    skyGrad = linear(ctx, 0, 0, 0, VH, [
      [0, '#1b2350'], [0.32, '#4b3a78'], [0.58, '#b9607a'], [0.76, '#f19a62'], [0.9, '#ffcf8f'], [1, '#ffe2b3'],
    ]);
    vignette = radial(ctx, VW / 2, VH * 0.55, VH * 0.35, VW * 0.72, [[0, 'rgba(10,5,20,0)'], [1, 'rgba(10,5,20,0.55)']]);

    // clouds: long lit streaks
    const clouds = makeCanvas(LW, 260), cg = clouds.getContext('2d'), rc = rng(3);
    for (let i = 0; i < 22; i++) {
      const x = rc() * LW, y = 20 + rc() * 200, rx = 90 + rc() * 220, ry = 5 + rc() * 12;
      const a = 0.25 + rc() * 0.3;
      for (const off of [0, LW]) {
        cg.fillStyle = `rgba(96,64,128,${a})`;
        cg.beginPath(); cg.ellipse(x - off, y, rx, ry, 0, 0, TAU); cg.fill();
        cg.fillStyle = `rgba(255,190,150,${a})`;
        cg.beginPath(); cg.ellipse(x - off + 10, y + ry * 0.5, rx * 0.8, ry * 0.45, 0, 0, TAU); cg.fill();
      }
    }

    // far skyline: domes, minarets and a four-minaret gate
    const far = makeCanvas(LW, 300), fg = far.getContext('2d'), rf = rng(11);
    const farFill = linear(fg, 0, 80, 0, 300, [[0, '#6c4f86'], [1, '#c4808a']]);
    fg.fillStyle = farFill;
    const rects = [];
    let x = 0;
    while (x < LW - 60) {
      const w = 30 + rf() * 70, h = 40 + rf() * 110;
      if (x > 640 && x < 980) { x = 980; continue; }
      fg.fillRect(x, 300 - h, w, h); rects.push([x, 300 - h, w, h]);
      if (rf() < 0.35) { fg.beginPath(); fg.arc(x + w / 2, 300 - h, w * 0.32, Math.PI, 0); fg.fill(); fg.fillRect(x + w / 2 - 1, 300 - h - w * 0.32 - 9, 2, 9); }
      if (rf() < 0.25) {
        const mx = x + w + 3, mh = h + 30 + rf() * 50;
        fg.fillRect(mx, 300 - mh, 7, mh);
        fg.beginPath(); fg.arc(mx + 3.5, 300 - mh, 5.5, Math.PI, 0); fg.fill();
        fg.fillRect(mx + 2.8, 300 - mh - 13, 1.4, 9); x += 10;
      }
      x += w + 2 + rf() * 14;
    }
    // gate monument
    const gx = 740, gw = 180, gh = 120;
    fg.fillRect(gx, 300 - gh, gw, gh);
    for (const mx of [gx - 8, gx + gw - 12]) {
      fg.fillRect(mx, 300 - gh - 90, 20, gh + 90);
      for (let k = 0; k < 3; k++) fg.fillRect(mx - 3, 300 - gh - 20 - k * 28, 26, 4);
      fg.beginPath(); fg.arc(mx + 10, 300 - gh - 90, 11, Math.PI, 0); fg.fill();
      fg.fillRect(mx + 9, 300 - gh - 116, 2, 16);
    }
    fg.globalCompositeOperation = 'destination-out';
    fg.beginPath(); fg.moveTo(gx + 55, 300); fg.lineTo(gx + 55, 300 - 60);
    fg.quadraticCurveTo(gx + 90, 300 - 105, gx + 125, 300 - 60); fg.lineTo(gx + 125, 300); fg.fill();
    for (let k = 0; k < 4; k++) { fg.beginPath(); fg.arc(gx + 30 + k * 40, 300 - gh + 18, 6, Math.PI, 0); fg.rect(gx + 24 + k * 40, 300 - gh + 18, 12, 10); fg.fill(); }
    fg.globalCompositeOperation = 'source-over';
    fg.fillStyle = 'rgba(255,214,150,0.55)';
    for (const [rx, ry, rw, rh] of rects) {
      for (let k = 0; k < rw * rh / 900; k++) if (rf() < 0.5) fg.fillRect(rx + 4 + rf() * (rw - 8), ry + 6 + rf() * (rh - 12), 2, 2.5);
    }
    fg.fillStyle = linear(fg, 0, 180, 0, 300, [[0, 'rgba(255,190,150,0)'], [1, 'rgba(255,190,150,0.55)']]);
    fg.fillRect(0, 0, LW, 300);

    // mid layer: palms, low houses, water tanks
    const mid = makeCanvas(LW, 260), mg = mid.getContext('2d'), rm = rng(23);
    const midFill = linear(mg, 0, 60, 0, 260, [[0, '#3f2b52'], [1, '#6b4258']]);
    mg.fillStyle = midFill; mg.strokeStyle = midFill;
    x = 0;
    while (x < LW) {
      const w = 50 + rm() * 90, h = 30 + rm() * 60;
      mg.fillRect(x, 260 - h, w, h);
      if (rm() < 0.5) { mg.fillRect(x + w * 0.6, 260 - h - 14, 16, 14); mg.fillRect(x + w * 0.6 - 2, 260 - h - 16, 20, 3); }
      x += w + rm() * 40;
    }
    for (let i = 0; i < 14; i++) {
      const px = rm() * LW, ph = 90 + rm() * 70, lean = (rm() - 0.5) * 40;
      mg.lineWidth = 5; mg.lineCap = 'round';
      mg.beginPath(); mg.moveTo(px, 260); mg.quadraticCurveTo(px + lean * 0.3, 260 - ph * 0.5, px + lean, 260 - ph); mg.stroke();
      mg.lineWidth = 3;
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.5, len = 26 + rm() * 14;
        const ex = px + lean + Math.cos(a) * len * 1.3, ey = 260 - ph + Math.sin(a) * len * 0.4 + len * 0.5;
        mg.beginPath(); mg.moveTo(px + lean, 260 - ph);
        mg.quadraticCurveTo(px + lean + Math.cos(a) * len * 0.8, 260 - ph - 12, ex, ey); mg.stroke();
      }
    }
    mg.fillStyle = linear(mg, 0, 160, 0, 260, [[0, 'rgba(255,170,130,0)'], [1, 'rgba(255,170,130,0.35)']]);
    mg.fillRect(0, 0, LW, 260);

    // near layer: dark foliage
    const near = makeCanvas(LW, 180), ng = near.getContext('2d'), rn = rng(31);
    ng.fillStyle = '#2a1c33';
    for (let i = 0; i < 70; i++) {
      const bx = rn() * LW, br = 14 + rn() * 26;
      for (const off of [0, LW, -LW]) { ng.beginPath(); ng.arc(bx + off, 180 - br * 0.5, br, 0, TAU); ng.fill(); }
    }
    for (let i = 0; i < 8; i++) {
      const tx = rn() * LW, th = 70 + rn() * 50;
      ng.fillRect(tx - 3, 180 - th, 6, th);
      for (const off of [0, LW, -LW]) {
        ng.beginPath(); ng.arc(tx + off, 180 - th, 28 + rn() * 10, 0, TAU);
        ng.arc(tx + off - 22, 180 - th + 14, 20, 0, TAU); ng.arc(tx + off + 22, 180 - th + 12, 22, 0, TAU); ng.fill();
      }
    }
    ng.fillStyle = 'rgba(255,170,110,0.08)';
    ng.fillRect(0, 0, LW, 180);

    layers = { clouds, far, mid, near };
  }

  function drawLayer(img, par, y) {
    const off = ((camX * par) % LW + LW) % LW;
    ctx.drawImage(img, -off, y);
    if (LW - off < VW) ctx.drawImage(img, LW - off, y);
  }

  function drawBackground() {
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, VW, VH);
    // sun + glow + rays
    const sx = 700 - camX * 0.02, sy = 330;
    ctx.fillStyle = radial(ctx, sx, sy, 10, 320, [[0, 'rgba(255,236,190,0.75)'], [0.25, 'rgba(255,170,110,0.28)'], [1, 'rgba(255,140,90,0)']]);
    ctx.fillRect(0, 0, VW, VH);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(sx, sy);
    for (let i = 0; i < 9; i++) {
      ctx.rotate(TAU / 9);
      const a = time * 0.03;
      ctx.fillStyle = 'rgba(255,210,160,0.035)';
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 700, Math.sin(a) * 700);
      ctx.lineTo(Math.cos(a + 0.12) * 700, Math.sin(a + 0.12) * 700); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = radial(ctx, sx, sy, 0, 44, [[0, '#fffbe8'], [0.7, '#ffe6a8'], [1, 'rgba(255,214,140,0)']]);
    ctx.beginPath(); ctx.arc(sx, sy, 44, 0, TAU); ctx.fill();

    drawLayer(layers.clouds, 0.04, 30);
    drawLayer(layers.far, 0.12, 210);
    drawLayer(layers.mid, 0.3, 255);
    drawLayer(layers.near, 0.55, 350);
  }

  // ------------------------------------------------------------------ Tiles (pre-rendered, supersampled)
  const tileCache = new Map();
  const TILE_OVER = 8; // room above the tile for grass blades

  function tileSprite(t, top, v) {
    const key = t * 100 + (top ? 10 : 0) + v;
    let spr = tileCache.get(key);
    if (spr) return spr;
    spr = makeCanvas(T * SS, (T + TILE_OVER) * SS);
    const g = spr.getContext('2d');
    g.scale(SS, SS); g.translate(0, TILE_OVER);
    const r = rng(key * 7 + 1);
    if (t === 1) {
      g.fillStyle = linear(g, 0, 0, 0, T, [[0, '#6a432a'], [1, '#3a2314']]);
      g.fillRect(0, 0, T, T);
      for (let i = 0; i < 10; i++) {
        const sx = r() * T, sy = (top ? 12 : 0) + r() * (T - (top ? 12 : 0)), rx = 1.5 + r() * 3.5, ry = 1 + r() * 2.2;
        g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(sx, sy + 0.8, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = r() < 0.5 ? '#7d5638' : '#5a3a24'; g.beginPath(); g.ellipse(sx, sy, rx, ry, 0, 0, TAU); g.fill();
        g.fillStyle = 'rgba(255,225,190,0.18)'; g.beginPath(); g.ellipse(sx - rx * 0.3, sy - ry * 0.3, rx * 0.4, ry * 0.35, 0, 0, TAU); g.fill();
      }
      if (top) {
        g.fillStyle = linear(g, 0, 10, 0, 20, [[0, 'rgba(0,0,0,0.4)'], [1, 'rgba(0,0,0,0)']]);
        g.fillRect(0, 10, T, 10);
        g.fillStyle = linear(g, 0, 0, 0, 12, [[0, '#9ccf5e'], [1, '#3f7a2a']]);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(T, 0);
        for (let i = 0; i <= 8; i++) g.lineTo(T - i * 5, 9 + (i % 2 ? 3 : 0) + r() * 2);
        g.closePath(); g.fill();
        for (let i = 0; i < 18; i++) {
          const bx = r() * T, h = 2.5 + r() * 6;
          g.fillStyle = r() < 0.5 ? '#a9da6c' : '#5c9a36';
          g.beginPath(); g.moveTo(bx - 1.2, 1.5); g.lineTo(bx + 1.2, 1.5); g.lineTo(bx + (r() - 0.5) * 3, -h); g.fill();
        }
        g.fillStyle = 'rgba(230,255,180,0.55)'; g.fillRect(0, 0, T, 1);
      }
    } else if (t === 2) {
      g.fillStyle = linear(g, 0, 0, 0, T, [[0, '#e3ac72'], [1, '#a9693b']]);
      g.fillRect(0, 0, T, T);
      g.fillStyle = '#f7d6a2'; g.fillRect(0, 0, T, 2.5);
      g.fillStyle = '#6e3c1b'; g.fillRect(0, T - 3, T, 3);
      g.fillStyle = 'rgba(255,240,210,0.3)'; g.fillRect(0, 0, 1.5, T);
      g.fillStyle = 'rgba(60,25,5,0.35)'; g.fillRect(T - 1.5, 0, 1.5, T);
      g.strokeStyle = 'rgba(90,45,15,0.3)'; g.lineWidth = 1; g.strokeRect(6.5, 8.5, T - 13, T - 18);
      g.strokeStyle = 'rgba(255,235,200,0.25)'; g.strokeRect(7.5, 9.5, T - 13, T - 18);
      for (let i = 0; i < 14; i++) { g.fillStyle = r() < 0.6 ? 'rgba(90,45,15,0.35)' : 'rgba(255,235,200,0.3)'; g.fillRect(r() * T, r() * T, 1.2, 1.2); }
      if (v === 2) { g.strokeStyle = 'rgba(70,30,10,0.45)'; g.beginPath(); g.moveTo(28, 3); g.lineTo(24, 12); g.lineTo(27, 18); g.stroke(); }
    } else {
      g.fillStyle = linear(g, 0, 0, T, T, [[0, '#76717f'], [1, '#403c4a']]);
      g.fillRect(0, 0, T, T);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(0, 0, T, 2.5); g.fillRect(0, 0, 2.5, T);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, T - 3, T, 3); g.fillRect(T - 3, 0, 3, T);
      for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.18)'; g.fillRect(3 + r() * (T - 6), 3 + r() * (T - 6), 1.3, 1.3); }
    }
    tileCache.set(key, spr);
    return spr;
  }

  function drawTiles() {
    const c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(W - 1, Math.floor((camX + VW) / T) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = grid[r][c]; if (!t) continue;
        const x = Math.round(c * T - camX), y = r * T;
        const top = t === 1 && !tileAt(c, r - 1);
        ctx.drawImage(tileSprite(t, top, (c * 31 + r * 17) % 4), x, y - TILE_OVER, T, T + TILE_OVER);
        if (!tileAt(c - 1, r)) { ctx.fillStyle = 'rgba(255,220,170,0.12)'; ctx.fillRect(x, y, 2, T); }
        if (!tileAt(c + 1, r)) { ctx.fillStyle = 'rgba(10,0,10,0.3)'; ctx.fillRect(x + T - 3, y, 3, T); }
        if (t !== 1 && !tileAt(c, r + 1) && r + 1 < ROWS) {
          ctx.fillStyle = linear(ctx, 0, y + T, 0, y + T + 16, [[0, 'rgba(10,0,15,0.28)'], [1, 'rgba(10,0,15,0)']]);
          ctx.fillRect(x, y + T, T, 16);
        }
      }
    }
  }

  function drawShadow(cx, feetY, w) {
    const col = Math.floor((cx + camX) / T);
    let gy = null;
    for (let r = Math.max(0, Math.floor((feetY - 2) / T)); r < ROWS; r++) if (tileAt(col, r)) { gy = r * T; break; }
    if (gy === null) return;
    const s = clamp(1 - (gy - feetY) / 220, 0.15, 1);
    ctx.fillStyle = `rgba(15,5,15,${0.38 * s})`;
    ctx.beginPath(); ctx.ellipse(cx, gy + 1, w * 0.55 * s, 4.5 * s, 0, 0, TAU); ctx.fill();
  }

  // ------------------------------------------------------------------ Gift
  function drawGift() {
    const g = gift, x = g.x - camX, y = g.y;
    if (x < -360 || x > VW + 360) return;
    const gcx = x + g.w / 2, gcy = y + g.h / 2;
    // god rays
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(gcx, gcy);
    ctx.rotate(time * 0.25);
    for (let i = 0; i < 12; i++) {
      ctx.rotate(TAU / 12);
      ctx.fillStyle = linear(ctx, 0, 0, 300, 0, [[0, 'rgba(255,214,140,0.22)'], [1, 'rgba(255,214,140,0)']]);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(300, -24); ctx.lineTo(300, 24); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = radial(ctx, gcx, gcy, 10, 170 + g.open * 60, [[0, `rgba(255,225,160,${0.55 + g.open * 0.3})`], [1, 'rgba(255,225,160,0)']]);
    ctx.fillRect(gcx - 240, gcy - 240, 480, 480);

    // label
    const bob = Math.sin(time * 2) * 3;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `30px ${FONT_DISPLAY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '4px';
    ctx.shadowColor = 'rgba(255,190,90,0.9)'; ctx.shadowBlur = 16;
    ctx.fillStyle = linear(ctx, 0, y - 104, 0, y - 76, [[0, '#fff3c4'], [1, '#e7a93a']]);
    ctx.fillText('COMPOUND ENTRY', gcx, y - 88 + bob);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,214,140,0.7)';
    ctx.fillRect(gcx - 120, y - 78 + bob, 240, 1);
    ctx.restore();

    drawShadow(gcx, y + g.h, g.w * 1.05);
    drawGate(gcx, y + g.h, g.open);

    if (Math.random() < 0.15 && state === 'play') {
      particles.push({ x: g.x + Math.random() * g.w, y: y + Math.random() * g.h, vx: 0, vy: -30, life: 1, max: 1,
        color: '#fff2c4', size: 1.5 + Math.random() * 1.5, grav: 0, glow: true, rot: 0, confetti: false });
    }
  }


  // The final goal: the compound gate. Iron doors swing open when Basha Bhai arrives.
  function drawGate(cx, by, open) {
    const span = 180, PW = 36, pillarH = 186, doorH = 150;
    const inL = cx - span / 2, inR = cx + span / 2;
    const stone = x0 => linear(ctx, x0, 0, x0 + PW, 0, [[0, '#f3d49c'], [0.45, '#d9a866'], [1, '#8f5f2e']]);

    // compound wall stubs
    for (const [x0, x1] of [[inL - PW - 70, inL - PW], [inR + PW, inR + PW + 70]]) {
      ctx.fillStyle = linear(ctx, 0, by - 84, 0, by, [[0, '#f4ead2'], [1, '#c8b58e']]);
      ctx.fillRect(x0, by - 84, x1 - x0, 84);
      ctx.fillStyle = '#f6c90e'; ctx.fillRect(x0, by - 70, x1 - x0, 8);
      ctx.fillStyle = '#9a7d52'; ctx.fillRect(x0 - 3, by - 90, x1 - x0 + 6, 7);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x0, by - 83, x1 - x0, 4);
    }

    // light pouring through the gateway
    ctx.save();
    ctx.globalAlpha = 0.25 + open * 0.75;
    ctx.fillStyle = radial(ctx, cx, by - doorH * 0.45, 10, span * 0.75, [[0, 'rgba(255,248,215,0.95)'], [1, 'rgba(255,214,140,0)']]);
    ctx.fillRect(inL, by - doorH - 20, span, doorH + 20);
    ctx.restore();

    // iron doors (hinged on the pillars, swing inward)
    const swing = Math.cos(open * Math.PI * 0.46);
    const drawDoor = (hx, dir) => {
      const w = (span / 2) * Math.max(0.1, swing);
      const topAt = u => by - doorH - Math.sin(u * Math.PI / 2) * 22 * Math.max(0.25, swing); // arched top toward the centre
      ctx.save();
      ctx.strokeStyle = '#17171d'; ctx.lineCap = 'round';
      // rails
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(hx, by - 10); ctx.lineTo(hx + dir * w, by - 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, by - doorH * 0.55); ctx.lineTo(hx + dir * w, by - doorH * 0.55); ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k <= 12; k++) { const u = k / 12; const x = hx + dir * w * u; k ? ctx.lineTo(x, topAt(u)) : ctx.moveTo(x, topAt(u)); }
      ctx.stroke();
      // bars with gold spear tips
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = hx + dir * w * u, yt = topAt(u);
        ctx.lineWidth = i === 0 || i === n ? 4 : 2.6;
        ctx.strokeStyle = '#1d1d24';
        ctx.beginPath(); ctx.moveTo(x, by - 6); ctx.lineTo(x, yt - 4); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(x - 0.8, by - 8); ctx.lineTo(x - 0.8, yt - 2); ctx.stroke();
        ctx.fillStyle = linear(ctx, 0, yt - 16, 0, yt - 4, [[0, '#fff0b0'], [1, '#b67a1c']]);
        ctx.beginPath(); ctx.moveTo(x, yt - 15); ctx.lineTo(x + 3.2, yt - 5); ctx.lineTo(x - 3.2, yt - 5); ctx.closePath(); ctx.fill();
      }
      // gold rosette
      const rx = hx + dir * w * 0.5, ry = by - doorH * 0.32;
      ctx.strokeStyle = '#d9a43a'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(rx, ry, 13 * Math.max(0.15, swing), 13, 0, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(rx, ry, 5 * Math.max(0.15, swing), 5, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    };
    drawDoor(inL, 1);
    drawDoor(inR, -1);

    // pillars with lamps
    for (const x0 of [inL - PW, inR]) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x0 + PW, by - pillarH, 5, pillarH);
      ctx.fillStyle = stone(x0); ctx.fillRect(x0, by - pillarH, PW, pillarH);
      ctx.fillStyle = 'rgba(90,50,15,0.25)';
      for (let yy = by - pillarH + 22; yy < by - 10; yy += 22) ctx.fillRect(x0, yy, PW, 1.5);
      ctx.fillStyle = stone(x0 - 5); ctx.fillRect(x0 - 5, by - 16, PW + 10, 16);          // plinth
      ctx.fillStyle = stone(x0 - 6); ctx.fillRect(x0 - 6, by - pillarH - 12, PW + 12, 14); // capital
      ctx.fillStyle = '#f6c90e'; ctx.fillRect(x0, by - pillarH + 6, PW, 6);
      // lantern
      const lx = x0 + PW / 2, ly = by - pillarH - 30;
      ctx.fillStyle = radial(ctx, lx, ly, 2, 46, [[0, 'rgba(255,230,150,0.75)'], [1, 'rgba(255,200,100,0)']]);
      ctx.beginPath(); ctx.arc(lx, ly, 46, 0, TAU); ctx.fill();
      ctx.fillStyle = '#1d1d24'; ctx.fillRect(lx - 9, ly - 14, 18, 3); ctx.fillRect(lx - 7, ly + 11, 14, 3);
      ctx.fillStyle = radial(ctx, lx, ly, 1, 12, [[0, '#fffbe0'], [1, '#f2b440']]);
      ctx.fillRect(lx - 7, ly - 11, 14, 22);
      ctx.strokeStyle = '#1d1d24'; ctx.lineWidth = 1.5; ctx.strokeRect(lx - 7, ly - 11, 14, 22);
      ctx.beginPath(); ctx.moveTo(lx - 9, ly - 14); ctx.lineTo(lx, ly - 22); ctx.lineTo(lx + 9, ly - 14); ctx.fillStyle = '#1d1d24'; ctx.fill();
    }

    // arch beam with WELCOME plaque
    const beamY = by - pillarH - 12 - 18;
    ctx.fillStyle = linear(ctx, 0, beamY - 34, 0, beamY + 18, [[0, '#f4ead2'], [1, '#c7ad7c']]);
    ctx.beginPath();
    ctx.moveTo(inL - PW + 4, beamY + 18); ctx.lineTo(inL - PW + 4, beamY);
    ctx.quadraticCurveTo(cx, beamY - 62, inR + PW - 4, beamY); ctx.lineTo(inR + PW - 4, beamY + 18);
    ctx.quadraticCurveTo(cx, beamY - 30, inL - PW + 4, beamY + 18); ctx.fill();
    ctx.strokeStyle = '#d9a43a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(inL - PW + 4, beamY + 2); ctx.quadraticCurveTo(cx, beamY - 58, inR + PW - 4, beamY + 2); ctx.stroke();
    ctx.fillStyle = linear(ctx, 0, beamY - 40, 0, beamY - 12, [[0, '#9b1a2c'], [1, '#5a0a14']]);
    rrect(ctx, cx - 54, beamY - 42, 108, 28, 5); ctx.fill();
    ctx.strokeStyle = '#e2a83b'; ctx.lineWidth = 1.5; rrect(ctx, cx - 51, beamY - 39, 102, 22, 4); ctx.stroke();
    ctx.save();
    ctx.font = `20px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    ctx.fillStyle = linear(ctx, 0, beamY - 38, 0, beamY - 18, [[0, '#fff3c4'], [1, '#e7a93a']]);
    ctx.fillText('WELCOME', cx + 1, beamY - 27);
    ctx.restore();

    // yellow flags on the pillars
    for (const fx of [inL - PW / 2, inR + PW / 2]) {
      const top = by - pillarH - 92;
      ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, by - pillarH - 46); ctx.lineTo(fx, top); ctx.stroke();
      const wv = Math.sin(time * 5 + fx) * 4;
      ctx.fillStyle = linear(ctx, fx, 0, fx + 34, 0, [[0, '#f6c90e'], [1, '#e0a800']]);
      ctx.beginPath(); ctx.moveTo(fx, top);
      ctx.quadraticCurveTo(fx + 17, top + 2 + wv, fx + 34, top + 10 + wv);
      ctx.quadraticCurveTo(fx + 17, top + 16 - wv, fx, top + 22); ctx.closePath(); ctx.fill();
    }
  }

  function drawGateIcon(x, y) {
    ctx.save();
    ctx.fillStyle = '#e2b26a'; ctx.fillRect(x - 11, y - 18, 5, 18); ctx.fillRect(x + 6, y - 18, 5, 18);
    ctx.strokeStyle = '#e2b26a'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x - 9, y - 18); ctx.quadraticCurveTo(x, y - 27, x + 9, y - 18); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i += 2) { ctx.beginPath(); ctx.moveTo(x + i, y); ctx.lineTo(x + i, y - 14); ctx.stroke(); }
    ctx.restore();
  }

  // ------------------------------------------------------------------ Food, enemies, hero
  function drawFoods() {
    for (const f of foods) {
      if (f.got) continue;
      const x = f.x - camX; if (x < -50 || x > VW + 50) continue;
      const y = f.y + Math.sin(time * 2.5 + f.phase) * 3;
      const pulse = 0.75 + Math.sin(time * 3 + f.phase) * 0.25;
      ctx.fillStyle = radial(ctx, x, y, 2, 30, [[0, `rgba(255,214,140,${0.45 * pulse})`], [1, 'rgba(255,214,140,0)']]);
      ctx.fillRect(x - 30, y - 30, 60, 60);
      FOOD_DRAW[f.type](ctx, x, y, 1);
    }
  }

  // ---- Enemies: Mental Balayya's goons. Three funny outfits, all with his head:
  //   lungi  - checked lungi, white banian, chappals, arms flapping
  //   lathi  - pink kurta-pajama, swinging a lathi over his head
  //   shawl  - white dhoti and shirt, orange shawl, shaking his fist
  const SKIN = '#b9784a';
  function limb(x0, y0, x1, y1, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  function hand(x, y, r = 2.6) {
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.5)'; ctx.lineWidth = 0.7; ctx.stroke();
  }
  function belly(fill) {
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.ellipse(0, -20, 12.5, 9.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,10,0.45)'; ctx.lineWidth = 0.8; ctx.stroke();
  }
  const ENEMY_ART = 1.5; // art is drawn in a ~38-unit-tall box, scaled 1.5x

  function drawEnemy(e) {
    const x = e.x - camX; if (x < -80 || x > VW + 80) return;
    const cx = x + e.w / 2, bottom = e.y + e.h;
    if (!e.dead) drawShadow(cx, bottom, e.w * 0.8);
    const t = time * 10 + e.phase;
    const step = Math.sin(t * 1.2) * 3;
    ctx.save();
    ctx.translate(cx, bottom);
    ctx.scale(ENEMY_ART, ENEMY_ART);
    if (e.dead) { ctx.scale(1.3, 0.3); ctx.globalAlpha = Math.max(0, e.squash / 0.5); }
    else ctx.translate(0, -Math.abs(Math.sin(t * 1.2)) * 1.6);
    ctx.scale(-e.dir, 1);
    const sway = e.dead ? 0 : Math.sin(t * 1.2) * 0.09; // the waddle
    ctx.rotate(sway);

    // chappals
    ctx.fillStyle = '#5a3220';
    ctx.beginPath(); ctx.ellipse(-6 + step, -1.2, 5, 1.8, 0, 0, TAU); ctx.ellipse(6 - step, -1.2, 5, 1.8, 0, 0, TAU); ctx.fill();

    if (e.kind === 'lungi') {
      limb(-5 + step, -7, -6 + step, -2.5, 3.6, SKIN); limb(5 - step, -7, 6 - step, -2.5, 3.6, SKIN);
      // checked lungi
      ctx.save();
      ctx.beginPath(); ctx.moveTo(-12, -17); ctx.lineTo(12, -17); ctx.lineTo(13.5, -4.5); ctx.lineTo(-13.5, -4.5); ctx.closePath();
      ctx.fillStyle = '#1f4fa0'; ctx.fill(); ctx.clip();
      ctx.strokeStyle = 'rgba(230,50,50,0.8)'; ctx.lineWidth = 1.3;
      for (let gx = -14; gx <= 14; gx += 4) { ctx.beginPath(); ctx.moveTo(gx, -18); ctx.lineTo(gx, -4); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 0.9;
      for (let gy = -16; gy <= -4; gy += 4) { ctx.beginPath(); ctx.moveTo(-15, gy); ctx.lineTo(15, gy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(4, -18, 10, 14);
      ctx.restore();
      ctx.fillStyle = '#f4f1ea'; ctx.fillRect(-13.5, -5.5, 27, 1.4);       // hem
      ctx.fillStyle = '#163c7a'; ctx.beginPath(); ctx.moveTo(-2, -17); ctx.lineTo(3, -17); ctx.lineTo(1, -10); ctx.fill(); // knot
      // back arm, banian belly, front arm (flapping)
      const fl = Math.sin(t * 1.2);
      limb(-10, -25, -16 - fl * 3, -16 + fl * 4, 4, SKIN); hand(-16 - fl * 3, -16 + fl * 4);
      belly(radial(ctx, -4, -24, 1, 15, [[0, '#ffffff'], [1, '#d9d4c8']]));
      ctx.fillStyle = SKIN;
      ctx.beginPath(); ctx.arc(-9.5, -27, 3.6, 0, TAU); ctx.arc(9.5, -27, 3.6, 0, TAU); ctx.fill(); // bare shoulders
      ctx.beginPath(); ctx.ellipse(0, -28.5, 4.5, 2.5, 0, 0, Math.PI); ctx.fill();                  // neckline
      ctx.fillStyle = 'rgba(40,20,10,0.5)';
      for (const [hx, hy] of [[-10, -28], [-8.5, -26], [10, -28], [8.6, -26]]) ctx.fillRect(hx, hy, 0.7, 0.7);
      limb(10, -25, 16 + fl * 3, -16 - fl * 4, 4, SKIN); hand(16 + fl * 3, -16 - fl * 4);
    } else if (e.kind === 'lathi') {
      limb(-4, -10, -5 + step, -2.5, 5, '#f1ede4'); limb(4, -10, 5 - step, -2.5, 5, '#f1ede4');
      const sw = Math.sin(t * 0.9);
      limb(-9, -25, -14 - sw * 2, -15, 4, '#c2255c'); hand(-14 - sw * 2, -14.5);
      // pink kurta
      ctx.fillStyle = linear(ctx, -14, 0, 14, 0, [[0, '#a61e4d'], [0.45, '#f06595'], [1, '#a61e4d']]);
      ctx.beginPath(); ctx.moveTo(-10.5, -29); ctx.lineTo(10.5, -29); ctx.quadraticCurveTo(15, -18, 14.5, -8); ctx.lineTo(-14.5, -8); ctx.quadraticCurveTo(-15, -18, -10.5, -29); ctx.fill();
      ctx.strokeStyle = 'rgba(60,5,20,0.5)'; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = '#f6c453'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -28.5); ctx.lineTo(0, -19); ctx.stroke();
      ctx.fillStyle = '#f6c453'; for (const by of [-26, -23, -20]) { ctx.beginPath(); ctx.arc(0.8, by, 0.8, 0, TAU); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.ellipse(-5, -20, 3, 7, 0.2, 0, TAU); ctx.fill();
      // raised arm swinging a lathi
      const hx = 13 + sw * 1.5, hy = -36 + Math.abs(sw) * 2;
      limb(9, -26, hx, hy, 4, '#c2255c');
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.9 + sw * 0.9);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#3a2210'; ctx.lineWidth = 4.4;
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -28); ctx.stroke();
      ctx.strokeStyle = '#c98a45'; ctx.lineWidth = 2.8;
      ctx.beginPath(); ctx.moveTo(0, 9); ctx.lineTo(0, -28); ctx.stroke();
      ctx.strokeStyle = '#f6c453'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -23); ctx.lineTo(0, -19); ctx.stroke();
      ctx.restore();
      hand(hx, hy);
    } else {
      // white dhoti
      ctx.fillStyle = linear(ctx, 0, -17, 0, -3, [[0, '#ffffff'], [1, '#ddd8cc']]);
      ctx.beginPath(); ctx.moveTo(-11.5, -17); ctx.lineTo(11.5, -17); ctx.lineTo(9 - step * 0.5, -3); ctx.lineTo(2, -6.5); ctx.lineTo(-2, -6.5); ctx.lineTo(-9 + step * 0.5, -3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(120,110,95,0.6)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(-3, -16); ctx.lineTo(-6, -5); ctx.moveTo(3, -16); ctx.lineTo(6, -5); ctx.stroke();
      ctx.fillStyle = '#e0a800'; ctx.fillRect(-11.5, -9, 23, 1.2); // border on the dhoti
      // hand on hip (back)
      limb(-10, -25, -15, -20, 4, '#f7f4ee'); limb(-15, -20, -11.5, -16, 3.5, SKIN);
      belly(radial(ctx, -4, -24, 1, 15, [[0, '#ffffff'], [1, '#e1dccf']]));
      ctx.fillStyle = '#cfc7ba'; for (const by of [-25, -21, -17.5]) { ctx.beginPath(); ctx.arc(0.5, by, 0.8, 0, TAU); ctx.fill(); }
      // orange shawl draped over the shoulders
      ctx.fillStyle = linear(ctx, -12, -30, 12, -10, [[0, '#ff922b'], [1, '#d9480f']]);
      ctx.beginPath();
      ctx.moveTo(-12, -28); ctx.quadraticCurveTo(0, -32, 12, -28); ctx.lineTo(13, -12); ctx.lineTo(8, -12); ctx.lineTo(8, -24);
      ctx.quadraticCurveTo(0, -26, -8, -24); ctx.lineTo(-8, -12); ctx.lineTo(-13, -12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(-13, -12.5); ctx.lineTo(-8, -12.5); ctx.moveTo(8, -12.5); ctx.lineTo(13, -12.5); ctx.stroke();
      // fist shaking in the air
      const sh = Math.sin(t * 2.2) * 2.5;
      limb(10, -26, 15, -37 + sh, 4, '#f7f4ee');
      hand(15.5, -38.5 + sh, 3.4);
    }

    ctx.rotate(-sway);
    ctx.scale(-e.dir, 1); // don't mirror the photo
    ctx.save();
    ctx.translate(0, -27);
    ctx.rotate(e.dead ? 0 : Math.sin(t * 0.6) * 0.09); // head wobble
    drawVeggieFace(ctx, 0, -11, 16);
    ctx.restore();
    ctx.restore();
  }

  function drawPlayer() {
    const p = player;
    const cx = p.x - camX + p.w / 2, feet = p.y + p.h;
    drawShadow(cx, feet, p.w);
    if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
    const running = Math.abs(p.vx) > 20 && p.onGround;
    const step = p.dancing ? Math.sin(time * 9) : running ? Math.sin(time * 18) : 0;
    const air = !p.onGround;
    const lean = p.dancing ? Math.sin(time * 9) * 0.2 : clamp(p.vx / 2600, -0.12, 0.12);
    const raise1 = p.dancing ? 20 + Math.sin(time * 9) * 8 : (air ? 14 : 0); // hands up when dancing
    const raise2 = p.dancing ? 20 - Math.sin(time * 9) * 8 : (air ? 14 : 0);
    const OUT = 'rgba(25,12,6,0.7)';

    ctx.save();
    ctx.translate(cx, feet);
    ctx.rotate(lean);
    ctx.lineWidth = 1.2; ctx.strokeStyle = OUT;

    // legs
    const legG = linear(ctx, -12, 0, 12, 0, [[0, '#191b28'], [0.5, '#363b54'], [1, '#191b28']]);
    ctx.fillStyle = legG;
    const l1 = air ? -3 : step * 4, l2 = air ? 3 : -step * 4;
    rrect(ctx, -11 + l1, -17, 10, 14, 3); ctx.fill(); ctx.stroke();
    rrect(ctx, 1 + l2, -17, 10, 14, 3); ctx.fill(); ctx.stroke();
    for (const lx of [-6 + l1, 6 + l2]) {
      ctx.fillStyle = linear(ctx, 0, -6, 0, 0, [[0, '#5a3a28'], [1, '#1e120b']]);
      ctx.beginPath(); ctx.ellipse(lx + p.face * 2, -3, 7.5, 3.8, 0, 0, TAU); ctx.fill(); ctx.stroke();
    }

    const bw = 18 * p.fat, bh = 17 + (p.fat - 1) * 6, by = -28;
    const arm = air ? -1 : step;
    const skin = '#c98b5a';
    const shirt = (x0, y0, r) => radial(ctx, x0, y0, 1, r, [[0, '#ffffff'], [0.55, '#ebe5dc'], [1, '#a9a196']], x0 - r * 0.4, y0 - r * 0.5);

    // back arm
    ctx.fillStyle = shirt(-bw * p.face, by - 4, 10);
    ctx.beginPath(); ctx.ellipse(-(bw - 1) * p.face, by - 4 - arm * 4 * p.face, 6, 10, 0.5 * p.face, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(-(bw + 3) * p.face, by + 4 - arm * 4 * p.face - raise1, 4.5, 0, TAU); ctx.fill(); ctx.stroke();

    // belly
    ctx.fillStyle = shirt(0, by, bw * 1.3);
    ctx.beginPath(); ctx.ellipse(0, by, bw, bh, 0, 0, TAU); ctx.fill(); ctx.stroke();
    // open collar with chest + gold chain
    ctx.fillStyle = linear(ctx, 0, by - bh, 0, by - bh + 14, [[0, '#a96d42'], [1, skin]]);
    ctx.beginPath(); ctx.moveTo(-7, by - bh + 1.5); ctx.lineTo(7, by - bh + 1.5); ctx.lineTo(0, by - bh + 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#f4efe6';
    ctx.beginPath(); ctx.moveTo(-8, by - bh + 1); ctx.lineTo(-1, by - bh + 13); ctx.lineTo(-10, by - bh + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, by - bh + 1); ctx.lineTo(1, by - bh + 13); ctx.lineTo(10, by - bh + 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#e9b949'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-6, by - bh + 2); ctx.quadraticCurveTo(0, by - bh + 16, 6, by - bh + 2); ctx.stroke();
    ctx.fillStyle = '#fff2b8'; ctx.beginPath(); ctx.arc(-2, by - bh + 8.5, 0.9, 0, TAU); ctx.arc(2.5, by - bh + 8.5, 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    // buttons + placket
    ctx.strokeStyle = 'rgba(120,110,100,0.5)';
    ctx.beginPath(); ctx.moveTo(0, by - bh + 14); ctx.lineTo(0, by + bh * 0.45); ctx.stroke();
    ctx.fillStyle = '#cfc7ba';
    ctx.beginPath(); ctx.arc(1.5, by - 1, 1.3, 0, TAU); ctx.arc(1.5, by + 6, 1.3, 0, TAU); ctx.fill();
    // belt
    const dy = bh * 0.55, hw = bw * Math.sqrt(Math.max(0, 1 - (dy / bh) ** 2));
    ctx.fillStyle = linear(ctx, 0, by + dy - 2.5, 0, by + dy + 2.5, [[0, '#4a3326'], [1, '#1d120c']]);
    ctx.fillRect(-hw, by + dy - 2.5, hw * 2, 5);
    ctx.fillStyle = linear(ctx, 0, by + dy - 3, 0, by + dy + 3, [[0, '#fbe08a'], [1, '#a8741c']]);
    ctx.fillRect(-3.5, by + dy - 3, 7, 6);
    ctx.strokeStyle = OUT;

    // front arm
    ctx.fillStyle = shirt(bw * p.face, by - 4, 10);
    ctx.beginPath(); ctx.ellipse((bw - 1) * p.face, by - 4 + arm * 4 * p.face, 6, 10, -0.5 * p.face, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = radial(ctx, (bw + 3) * p.face, by + 4, 0.5, 5, [[0, '#dba274'], [1, '#a06a40']]);
    ctx.beginPath(); ctx.arc((bw + 3) * p.face, by + 4 + arm * 4 * p.face - raise2, 4.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();

    // head
    // head sits on the collar: chin overlaps the top of the shirt
    const HEAD_R = 29, chinY = p.y + 17;
    const hx = cx + Math.sin(lean) * 60, hy = chinY - HEAD_R;
    drawHeroFace(ctx, hx, hy, HEAD_R, p.face);
  }

  function drawFx() {
    for (const q of particles) {
      const a = clamp(q.life / q.max * 1.6, 0, 1);
      const x = q.x - camX;
      if (q.confetti) {
        ctx.save(); ctx.globalAlpha = a; ctx.translate(x, q.y); ctx.rotate(q.rot);
        ctx.fillStyle = q.color; ctx.fillRect(-q.size, -q.size * 0.4, q.size * 2, q.size * 0.8); ctx.restore();
      } else if (q.glow) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        ctx.fillStyle = radial(ctx, x, q.y, 0, q.size * 3, [[0, q.color], [1, 'rgba(255,200,120,0)']]);
        ctx.beginPath(); ctx.arc(x, q.y, q.size * 3, 0, TAU); ctx.fill(); ctx.restore();
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(x, q.y, q.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center';
    for (const t of texts) {
      const a = Math.max(0, 1 - t.t / 1.3);
      const pop = t.kind === 'burp' ? 1 + Math.max(0, 0.35 - t.t) * 1.4 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(t.x - camX, t.y); ctx.scale(pop, pop);
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      if (t.kind === 'burp') {
        ctx.font = `34px ${FONT_DISPLAY}`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
        ctx.fillStyle = linear(ctx, 0, -26, 0, 0, [[0, '#fff3c4'], [1, '#f0a83a']]);
        ctx.fillText(t.text, 0, 0);
      } else {
        ctx.font = `600 13px ${FONT_UI}`;
        ctx.fillStyle = 'rgba(255,248,235,0.95)';
        ctx.fillText(t.text, 0, 0);
      }
      ctx.restore();
    }
  }

  function hudLabel(x, y, s) {
    ctx.font = `600 10px ${FONT_UI}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2.5px';
    ctx.fillStyle = 'rgba(255,236,210,0.6)'; ctx.fillText(s, x, y);
  }
  function hudValue(x, y, s) {
    ctx.font = `30px ${FONT_DISPLAY}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    ctx.fillStyle = '#fff'; ctx.fillText(s, x, y);
  }

  function drawHUD() {
    ctx.fillStyle = linear(ctx, 0, 0, 0, 90, [[0, 'rgba(8,4,16,0.6)'], [1, 'rgba(8,4,16,0)']]);
    ctx.fillRect(0, 0, VW, 90);
    ctx.save();
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 6;
    hudLabel(28, 28, 'SCORE'); hudValue(28, 56, score.toLocaleString());
    drawBiryani(ctx, 178, 46, 0.62, false);
    hudLabel(198, 28, 'FEAST'); hudValue(198, 56, String(eaten));
    hudLabel(274, 28, 'TIME'); hudValue(274, 56, `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`);
    ctx.shadowBlur = 0;

    // journey bar
    const bx = 400, bw = 300, byy = 42;
    const prog = clamp((player.x + player.w - start.x) / (gift.x - start.x), 0, 1);
    ctx.textAlign = 'center';
    hudLabel(bx + bw / 2, 26, 'JOURNEY TO COMPOUND ENTRY');
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; rrect(ctx, bx, byy - 2, bw, 4, 2); ctx.fill();
    ctx.fillStyle = linear(ctx, bx, 0, bx + bw, 0, [[0, '#f0a83a'], [1, '#fff0b0']]);
    rrect(ctx, bx, byy - 2, Math.max(4, bw * prog), 4, 2); ctx.fill();
    drawGateIcon(bx + bw + 18, byy + 8);
    drawHeroFace(ctx, bx + bw * prog, byy - 2, 12, 1);

    // lives as hero heads
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.globalAlpha = i < lives ? 1 : 0.22;
      drawHeroFace(ctx, 852 + i * 34, 44, 13, 1);
      ctx.restore();
    }
    ctx.textAlign = 'right';
    hudLabel(920, 22, 'LIVES');
    if (muted) { ctx.textAlign = 'right'; hudLabel(930, 76, 'MUTED'); }
    ctx.restore();
  }

  // Big shocked hero face when a goon catches him
  function drawCaught() {
    if (caughtTimer <= 0) return;
    const age = CAUGHT_TIME - caughtTimer;
    const a = Math.min(1, caughtTimer * 3);
    const pop = Math.min(1, age * 7);
    const r = Math.max(4, 82 * (pop < 1 ? pop * 1.12 : 1));
    const sh = Math.sin(age * 70) * 7 * Math.max(0, 1 - age * 1.5);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = radial(ctx, VW / 2, VH / 2, 80, VW * 0.65, [[0, 'rgba(120,0,0,0)'], [1, 'rgba(110,0,0,0.6)']]);
    ctx.fillRect(0, 0, VW, VH);
    ctx.translate(VW / 2 + sh, 210);
    ctx.fillStyle = radial(ctx, 0, 0, r * 0.8, r * 1.8, [[0, 'rgba(255,60,40,0.55)'], [1, 'rgba(255,60,40,0)']]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, TAU); ctx.fill();
    drawHeroFace(ctx, 0, 0, r, 1, 'caught');
    ctx.restore();
    drawCaughtCaption(VW / 2, 210 + 82 + 64, a);
  }

  // Static "movie title" text template: gold metallic face, deep 3D extrusion,
  // dark outline + bevel rim, and a lens-flare sparkle. Used for the caught popup
  // and the Game Over title.
  const FONT_TITLE = '"Anton", "Bebas Neue", Impact, sans-serif';
  function drawTitleTemplate(c, lines, cx, cy, size, maxW, opts = {}) {
    const lh = size * (opts.lineHeight || 1.08);
    c.save();
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.miterLimit = 2;
    if ('letterSpacing' in c) c.letterSpacing = `${Math.round(size * 0.03)}px`;
    // shrink to fit the widest line
    c.font = `${size}px ${FONT_TITLE}`;
    const widest = Math.max(...lines.map(l => c.measureText(l).width));
    if (widest > maxW) { size *= maxW / widest; c.font = `${size}px ${FONT_TITLE}`; }
    const depth = Math.max(4, Math.round(size * 0.1));
    const top = cy - (lines.length - 1) * lh / 2;
    lines.forEach((line, i) => {
      const y = top + i * lh;
      // drop shadow + extrusion
      c.save();
      c.shadowColor = 'rgba(0,0,0,0.6)'; c.shadowBlur = size * 0.25; c.shadowOffsetY = size * 0.12;
      c.fillStyle = '#1a0603';
      c.fillText(line, cx + depth, y + depth);
      c.restore();
      for (let d = depth; d >= 1; d--) {
        const k = d / depth;
        c.fillStyle = `rgb(${Math.round(110 - 70 * k)},${Math.round(28 - 18 * k)},${Math.round(10 - 6 * k)})`;
        c.fillText(line, cx + d * 0.6, y + d);
      }
      // outline + bevel rim
      c.lineWidth = size * 0.12; c.strokeStyle = '#120402'; c.strokeText(line, cx, y);
      c.lineWidth = size * 0.055;
      c.strokeStyle = linear(c, 0, y - size / 2, 0, y + size / 2, [[0, '#fff3c4'], [0.5, '#a8681a'], [1, '#f0c45e']]);
      c.strokeText(line, cx, y);
      // metallic face with a hard horizon
      c.fillStyle = linear(c, 0, y - size * 0.5, 0, y + size * 0.5, [
        [0, '#fffdf0'], [0.3, '#ffe28a'], [0.49, '#f2b440'], [0.5, '#9a5a12'], [0.62, '#c47f22'], [0.85, '#f6c95c'], [1, '#fff1b8'],
      ]);
      c.fillText(line, cx, y);
      // top shine
      c.save();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = linear(c, 0, y - size * 0.5, 0, y - size * 0.1, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]);
      c.fillText(line, cx, y);
      c.restore();
      if (i === 0 && opts.sparkle !== false) {
        const w = c.measureText(line).width;
        sparkle(c, cx + w / 2 + size * 0.12, y - size * 0.5, size * 0.45);
      }
    });
    c.restore();
  }
  function sparkle(c, x, y, s) {
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.fillStyle = radial(c, x, y, 0, s * 0.6, [[0, 'rgba(255,250,220,0.9)'], [0.3, 'rgba(255,220,140,0.35)'], [1, 'rgba(255,200,120,0)']]);
    c.beginPath(); c.arc(x, y, s * 0.6, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,252,235,0.95)';
    for (const [w, h] of [[s, s * 0.06], [s * 0.06, s * 0.8]]) {
      c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU); c.fill();
    }
    c.restore();
  }

  // Caught popup caption: the title template on a dark lower-third plate with gold rules
  function drawCaughtCaption(x, y, alpha) {
    const text = 'KAAPAADU THATHAAA!';
    const size = 64, pw = 720, ph = 104;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = linear(ctx, 0, -ph / 2, 0, ph / 2, [[0, 'rgba(70,6,10,0.95)'], [1, 'rgba(25,2,5,0.95)']]);
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 26, -ph / 2); ctx.lineTo(pw / 2, -ph / 2); ctx.lineTo(pw / 2 - 26, ph / 2); ctx.lineTo(-pw / 2, ph / 2); ctx.closePath();
    ctx.fill();
    ctx.restore();
    const gold = linear(ctx, -pw / 2, 0, pw / 2, 0, [[0, 'rgba(168,112,26,0)'], [0.2, '#e2a83b'], [0.5, '#fff0b0'], [0.8, '#e2a83b'], [1, 'rgba(168,112,26,0)']]);
    ctx.fillStyle = gold;
    ctx.fillRect(-pw / 2 + 20, -ph / 2 + 6, pw - 40, 2);
    ctx.fillRect(-pw / 2 + 20, ph / 2 - 8, pw - 40, 2);
    drawTitleTemplate(ctx, [text], 0, 2, size, pw - 90);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    drawBackground();
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawTiles();
    drawGift();
    drawFoods();
    for (const e of enemies) if (!e.gone) drawEnemy(e);
    drawPlayer();
    drawFx();
    ctx.restore();
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, VW, VH);
    if (state !== 'title') drawHUD();
    drawCaught();
  }

  // ------------------------------------------------------------------ Loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (state === 'play') update(dt);
    else if (state === 'win') updateFx(dt);
    else if (state === 'title') { time += dt; camX = (Math.sin(time * 0.12) * 0.5 + 0.5) * 1400; }
    render();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ Layout + UI
  function fit() {
    const s = Math.min(window.innerWidth / VW, window.innerHeight / VH);
    document.getElementById('wrap').style.transform = `translate(-50%, -50%) scale(${s})`;
    const nr = clamp((window.devicePixelRatio || 1) * s, 1, 2.5);
    if (Math.abs(nr - R) > 0.01 || canvas.width !== Math.round(VW * nr)) {
      R = nr;
      canvas.width = Math.round(VW * R); canvas.height = Math.round(VH * R);
    }
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
  buildBackdrop();
  buildLevel();
  player = newPlayer();
  drawPreviews();
  loadHeads().then(drawPreviews);
  if (document.fonts && document.fonts.load) {
    document.fonts.load(`30px ${FONT_DISPLAY}`).catch(() => {});
    document.fonts.load(`60px ${FONT_TITLE}`).then(() => { if (state === 'over') drawOverTitle(); }).catch(() => {});
  }
  requestAnimationFrame(frame);
})();
