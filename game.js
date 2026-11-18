/* Restructured — an isometric office roguelite. No dependencies, no assets: everything is drawn in code. */
(() => {
'use strict';

// ---------------------------------------------------------------- helpers
const $ = s => document.querySelector(s);
const cv = $('#game'), ctx = cv.getContext('2d'), overlay = $('#overlay'), dashBtn = $('#dash');
const N = 44, HW = 32, HH = 16;            // grid size, half tile width/height in px
const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sx = (x, y) => (x - y) * HW, sy = (x, y) => (x + y) * HH;   // world tile -> screen px
const I = (x, y) => y * N + x;

// ---------------------------------------------------------------- content
const PIECE_NAME = { legs: 'THE LEGS', arms: 'THE ARMS', torso: 'THE TORSO', head: 'THE HEAD', toupee: 'THE TOUPEE', trophy: 'A GOLDEN STAPLER' };
const ORDER = ['legs', 'arms', 'torso', 'head', 'toupee'];
const FLOORS = [
  { name: 'MAILROOM', carpet: ['#8a93a6', '#828b9e'], part: '#73839c',
    boss: { name: 'Dennis from the Mailroom', look: 'intern', piece: 'legs', line: 'is using THE LEGS as a coat rack.', pats: ['charge', 'burst'] } },
  { name: 'ACCOUNTING', carpet: ['#7d9c84', '#75947c'], part: '#5f7f68',
    boss: { name: 'Brenda from Accounting', look: 'acct', piece: 'arms', line: 'is using THE ARMS as back-scratchers.', pats: ['aimed', 'burst', 'aimed'] } },
  { name: 'SALES', carpet: ['#b3946f', '#ab8c67'], part: '#8f7350',
    boss: { name: 'Chad from Sales', look: 'sales', piece: 'torso', line: 'is wearing THE TORSO as a power suit.', pats: ['charge', 'charge', 'summon', 'burst'] } },
  { name: 'I.T.', carpet: ['#6f7399', '#676b91'], part: '#4f5378',
    boss: { name: 'Priya from I.T.', look: 'it', piece: 'head', line: 'is using THE HEAD for rubber-duck debugging.', pats: ['spiral', 'summon', 'aimed'] } },
  { name: 'HUMAN RESOURCES', carpet: ['#9a7391', '#926b89'], part: '#75506c',
    boss: { name: 'Linda from HR', look: 'hr', piece: 'toupee', line: "has filed THE TOUPEE under 'Miscellaneous'.", pats: ['burst', 'charge', 'spiral', 'summon', 'aimed'] } },
];
const LOOKS = {
  player: { shirt: '#f4f4f0', tie: '#d33b2f', hair: '#3a2a1a', skin: '#f0c39a', pants: '#33384a', stapler: true },
  intern: { shirt: '#8fd0ff', hair: '#b5651d', skin: '#f5d0a9', pants: '#5c6170', lanyard: true, s: .85 },
  acct:   { shirt: '#5d9b6b', hair: '#c9c9c9', skin: '#e8b88a', pants: '#444', glasses: true },
  sales:  { shirt: '#27345e', tie: '#ff4d3d', hair: '#111', skin: '#d9a070', pants: '#1c2544', s: 1.05 },
  it:     { shirt: '#2b2b2b', hair: '#5a4a2a', skin: '#c98f62', pants: '#3b4a6b', headphones: true, s: 1.1 },
  hr:     { shirt: '#8e4aa8', hair: '#e8c15a', skin: '#f3cfb0', pants: '#333', glasses: true },
};
const ENEMY = {
  intern: { look: 'intern', hp: 2, spd: 3.3, r: .26, ai: 'chase', barks: ['Got a sec?', 'Can you sign this?', 'I made a spreadsheet!', 'Is this YOUR stapler?'] },
  acct:   { look: 'acct', hp: 3, spd: 2.4, r: .3, ai: 'ranged', barks: ['Where is your receipt?', 'NOT in the budget.', 'Per my last email…'] },
  sales:  { look: 'sales', hp: 4, spd: 2.8, r: .32, ai: 'charge', barks: ["Let's circle back!", 'SYNERGY!', 'Quick win, bro!', 'Just touching base!!'] },
  it:     { look: 'it', hp: 6, spd: 1.8, r: .34, ai: 'spread', barks: ['Did you file a ticket?', 'Tried rebooting?', 'Works on my machine.'] },
};
const MIX = [
  ['intern', 'intern', 'intern', 'acct'],
  ['intern', 'intern', 'acct', 'acct', 'sales'],
  ['intern', 'acct', 'sales', 'sales', 'it'],
  ['intern', 'acct', 'sales', 'it', 'it'],
  ['intern', 'acct', 'sales', 'it'],
];
const PERKS = [
  { n: 'Double Espresso', d: 'Throw staples 25% faster', f: p => p.fireCd *= .75 },
  { n: 'Heavy-Duty Stapler', d: '+1 staple damage', f: p => p.dmg += 1 },
  { n: 'Rubber Band Ball', d: '+1 staple per throw', f: p => p.shots += 1 },
  { n: 'Ergonomic Insoles', d: 'Walk 15% faster', f: p => p.speed *= 1.15 },
  { n: 'Standing Desk', d: '+1 max coffee, full refill', f: p => { p.maxHp += 1; p.hp = p.maxHp; } },
  { n: 'Sticky Notes', d: 'Staples pierce +1 coworker', f: p => p.pierce += 1 },
  { n: 'Swivel Chair Pro', d: 'Roll recharges 35% faster', f: p => p.dashMax *= .65 },
  { n: 'Free Donuts', d: 'Refill all coffee, +10% speed', f: p => { p.hp = p.maxHp; p.speed *= 1.1; } },
];

// ---------------------------------------------------------------- state
let W = 0, H = 0, DPR = 1, Z = 1;
let state = 'title', floor = 1, level = null, player = null, time = 0, overtime = false;
let enemies = [], projs = [], pickups = [], parts = [], texts = [];
let pieces = [], trophies = 0, kills = 0, elevOpen = false, bossRef = null;
let banner = null, shake = 0, flowT = 0, flow = null, cam = { x: 0, y: 0 };
const K = {}, mouse = { x: 0, y: 0, down: false }, sticks = { move: null, aim: null };
let touchMode = false, dashQueued = false, muted = false, ac = null;

// ---------------------------------------------------------------- audio
function sfx(f, d = .08, type = 'square', v = .04, slide = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d);
  } catch (e) { /* audio is optional */ }
}

// ---------------------------------------------------------------- level generation
function bfs(L, x0, y0, max = 9999) {
  const d = new Int16Array(N * N).fill(-1), q = [I(x0, y0)];
  d[q[0]] = 0;
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % N, y = (i / N) | 0, nd = d[i] + 1;
    if (nd > max) continue;
    for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + ax, Y = y + ay, j = I(X, Y);
      if (X < 0 || Y < 0 || X >= N || Y >= N || d[j] >= 0 || L.t[j] !== 1 || L.prop[j]) continue;
      d[j] = nd; q.push(j);
    }
  }
  return d;
}

function genLevel(fl) { for (;;) { const L = buildLevel(fl); if (L) return L; } }

function buildLevel(fl) {
  const th = FLOORS[(fl - 1) % 5];
  const t = new Uint8Array(N * N), zone = new Uint8Array(N * N), prop = new Array(N * N).fill(null);
  const L = { t, zone, prop, th };
  const rooms = [], want = Math.min(5 + Math.ceil(fl / 2), 8);
  for (let a = 0; a < 300 && rooms.length < want; a++) {
    const w = ri(8, 12), h = ri(8, 12), x = ri(2, N - w - 3), y = ri(2, N - h - 3);
    if (rooms.some(r => x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), type: '' });
  }
  if (rooms.length < 5) return null;
  rooms.forEach((r, i) => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) { t[I(x, y)] = 1; zone[I(x, y)] = i + 1; } });
  const carve = (x, y) => { for (let b = 0; b < 2; b++) for (let a = 0; a < 2; a++) { const X = x + a, Y = y + b; if (X > 0 && Y > 0 && X < N - 1 && Y < N - 1) t[I(X, Y)] = 1; } };
  const link = (a, b) => {
    let x = a.cx, y = a.cy;
    const goX = () => { while (x !== b.cx) { carve(x, y); x += Math.sign(b.cx - x); } };
    const goY = () => { while (y !== b.cy) { carve(x, y); y += Math.sign(b.cy - y); } };
    if (Math.random() < .5) { goX(); goY(); } else { goY(); goX(); }
    carve(x, y);
  };
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) { const d = Math.abs(rooms[i].cx - rooms[j].cx) + Math.abs(rooms[i].cy - rooms[j].cy); if (d < bd) { bd = d; best = j; } }
    link(rooms[i], rooms[best]);
  }
  if (rooms.length > 5) link(rooms[1], rooms[rooms.length - 1]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (t[I(x, y)]) continue;
    search: for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const X = x + a, Y = y + b;
      if (X >= 0 && Y >= 0 && X < N && Y < N && t[I(X, Y)] === 1) { t[I(x, y)] = 2; break search; }
    }
  }
  // start = room 0, piece holder = farthest room
  const start = rooms[0], d0 = bfs(L, start.cx, start.cy);
  let holder = rooms[1];
  for (const r of rooms) if (r !== start && d0[I(r.cx, r.cy)] > d0[I(holder.cx, holder.cy)]) holder = r;

  // furniture: always leaves the outer ring of each room clear so doors stay connected
  const P = (x, y, k) => { const i = I(x, y); if (t[i] === 1 && zone[i] && !prop[i]) prop[i] = k; };
  rooms.forEach((r, idx) => {
    const x0 = r.x + 1, x1 = r.x + r.w - 2, y0 = r.y + 1, y1 = r.y + r.h - 2;
    r.type = r === start ? 'lobby' : r === holder ? 'arena' : pick(['cubicles', 'cubicles', 'break', 'copy', 'meeting']);
    const corners = k => { P(x0, y0, k); P(x1, y0, k); P(x0, y1, k); P(x1, y1, k); };
    if (r.type === 'lobby') { corners('plant'); for (let x = r.cx - 2; x <= r.cx + 2; x++) P(x, y0 + 1, 'desk'); }
    else if (r.type === 'arena') { P(x0, y1, 'plant'); P(x1, y1, 'plant'); P(x0, y0, 'cabinet'); P(x1, y0, 'cabinet'); }
    else if (r.type === 'cubicles') {
      for (let y = y0 + 1; y < y1; y += 3) for (let x = x0 + 1; x < x1; x++) if ((x - x0) % 3 !== 0 && Math.random() < .85) P(x, y, 'desk');
      P(x1, y0, 'plant');
    } else if (r.type === 'break') {
      P(x0, y0, 'vending'); P(x0 + 1, y0, 'cooler'); P(x1, y0, 'plant');
      for (let k = 0; k < 3; k++) P(ri(x0 + 1, x1 - 1), ri(y0 + 2, y1 - 1), 'rtable');
    } else if (r.type === 'copy') {
      for (let x = x0 + 1; x < x1; x += 2) P(x, y0, 'copier');
      for (let y = y0 + 2; y < y1; y += 2) P(x0, y, 'cabinet');
      for (let k = 0; k < 5; k++) P(ri(x0 + 2, x1), ri(y0 + 2, y1), 'boxes');
    } else {
      for (let x = Math.max(x0 + 1, r.cx - 2); x <= Math.min(x1 - 1, r.cx + 2); x++) { P(x, r.cy, 'table'); P(x, r.cy + 1, 'table'); }
      corners('plant');
    }
  });
  const elev = { x: holder.cx, y: holder.y + 1 };
  prop[I(elev.x, elev.y)] = null; prop[I(holder.cx, holder.cy)] = null; prop[I(start.cx, start.cy)] = null;
  const reach = bfs(L, start.cx, start.cy);
  if (reach[I(elev.x, elev.y)] < 0 || reach[I(holder.cx, holder.cy)] < 0) return null;

  // spawns
  const spawns = [], coffees = [];
  const spot = r => { for (let k = 0; k < 40; k++) { const x = ri(r.x, r.x + r.w - 1), y = ri(r.y, r.y + r.h - 1); if (reach[I(x, y)] >= 0) return { x: x + .5, y: y + .5 }; } return null; };
  const mix = MIX[Math.min(fl, 5) - 1];
  for (const r of rooms) {
    if (r === start) continue;
    if (r === holder) {
      spawns.push({ x: r.cx + .5, y: r.cy + .5, boss: true });
      for (let k = 0; k < 2; k++) { const s = spot(r); if (s && Math.hypot(s.x - r.cx, s.y - r.cy) > 1.5) spawns.push({ ...s, kind: pick(mix) }); }
      continue;
    }
    const n = Math.min(9, ri(2, 3) + Math.floor(fl / 2));
    for (let k = 0; k < n; k++) { const s = spot(r); if (s) spawns.push({ ...s, kind: pick(mix) }); }
    if (Math.random() < .4) { const s = spot(r); if (s) coffees.push(s); }
  }

  // pre-render the floor
  const fc = document.createElement('canvas'); fc.width = N * 2 * HW; fc.height = N * 2 * HH + 8;
  const g = fc.getContext('2d'); g.translate(N * HW, 0);
  const diamond = (x, y, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(sx(x, y), sy(x, y) - .5); g.lineTo(sx(x + 1, y) + .5, sy(x + 1, y)); g.lineTo(sx(x + 1, y + 1), sy(x + 1, y + 1) + .5); g.lineTo(sx(x, y + 1) - .5, sy(x, y + 1)); g.fill(); };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (t[I(x, y)] !== 1) continue;
    const z = zone[I(x, y)], r = z ? rooms[z - 1] : null, alt = (x + y) & 1;
    let c = ['#a9aeb6', '#a2a7af'];
    if (r) {
      c = th.carpet;
      if (r.type === 'break') c = ['#e9eef0', '#bfe0dd'];
      if (r.type === 'arena' && x > r.x && y > r.y && x < r.x + r.w - 1 && y < r.y + r.h - 1) c = ['#8a3340', '#7f2d3a'];
    }
    diamond(x, y, c[alt]);
    if (Math.random() < .03) { // stray paperwork
      g.save(); g.translate(sx(x + .5, y + .5), sy(x + .5, y + .5)); g.scale(1, .5); g.rotate(rnd(6.28));
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(-5, -7, 10, 14); g.restore();
    }
  }
  // static blocks (walls + furniture), depth-sorted at draw time with entities
  const statics = [], fl1 = (x, y) => x >= 0 && y >= 0 && x < N && y < N && t[I(x, y)] === 1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = I(x, y);
    if (t[i] === 2) {
      const tall = ![[-1, 0], [0, -1], [-1, -1], [-2, -1], [-1, -2], [-2, -2]].some(([a, b]) => fl1(x + a, y + b));
      statics.push({ k: x + y + 1, x, y, wall: true, h: tall ? 52 : 16, winL: tall && fl1(x, y + 1) && x % 3 === 1, winR: tall && fl1(x + 1, y) && y % 3 === 1 });
    } else if (prop[i]) statics.push({ k: x + y + 1, x, y, prop: prop[i] });
  }
  return { ...L, rooms, start, holder, elev, reach, spawns, coffees, fc, statics, seen: new Uint8Array(N * N), mini: null };
}

// ---------------------------------------------------------------- game flow
function newGame() {
  floor = 1; overtime = false; pieces = []; trophies = 0; kills = 0;
  player = { x: 0, y: 0, r: .28, hp: 5, maxHp: 5, speed: 4.4, dmg: 1, fireCd: .32, shots: 1, pierce: 0, dashMax: 1.2,
    cd: 0, dashCd: 0, dashT: 0, dx: 1, dy: 1, inv: 0, walk: 0, face: 1, moving: false, hurtT: 0 };
  startFloor();
}

function startFloor() {
  level = genLevel(floor);
  const p = player; p.x = level.start.cx + .5; p.y = level.start.cy + .5; p.inv = 1;
  enemies = []; projs = []; pickups = []; parts = []; texts = []; elevOpen = false; bossRef = null; flowT = 0;
  for (const s of level.spawns) enemies.push(s.boss ? makeBoss(s.x, s.y) : makeEnemy(s.kind, s.x, s.y));
  for (const c of level.coffees) pickups.push({ x: c.x, y: c.y, kind: 'coffee' });
  const th = level.th;
  say(`FLOOR ${floor} — ${th.name}${floor > 5 ? ' (OVERTIME)' : ''}`, floor > 5 ? 'Find the Golden Stapler.' : `${th.boss.name} ${th.boss.line}`);
  cam.x = sx(p.x, p.y); cam.y = sy(p.x, p.y);
  state = 'play'; overlay.className = '';
}

function makeEnemy(kind, x, y) {
  const d = ENEMY[kind], hp = Math.round(d.hp * (1 + (floor - 1) * .22));
  return { kind, x, y, r: d.r, hp, maxHp: hp, spd: d.spd * (1 + Math.min(floor, 10) * .02), ai: d.ai, look: LOOKS[d.look], barks: d.barks,
    awake: false, cd: rnd(.5, 1.5), state: '', st: 0, flash: 0, walk: rnd(9), face: 1, strafe: pick([-1, 1]), barkT: 0 };
}
function makeBoss(x, y) {
  const b = level.th.boss, hp = 26 + floor * 10;
  return { kind: 'boss', boss: true, name: b.name, x, y, r: .46, hp, maxHp: hp, spd: 2.3, ai: 'boss', look: { ...LOOKS[b.look], s: 1.55 }, pats: b.pats, pi: 0,
    piece: floor > 5 ? 'trophy' : b.piece, barks: ['This is MINE now!', 'Finders keepers!', "I'm escalating this!", 'Take it up with HR!'],
    awake: false, cd: 1.2, state: '', st: 0, flash: 0, walk: 0, face: 1, strafe: 1, barkT: 0, sa: 0, sc: 0 };
}

function say(a, b, t = 4) { banner = { a, b, t, max: t }; }
function floatText(x, y, s, c = '#fff') { texts.push({ x, y, s, c, t: 1.6 }); }

// ---------------------------------------------------------------- physics
const solid = (x, y) => x < 0 || y < 0 || x >= N || y >= N || level.t[I(x, y)] !== 1 || !!level.prop[I(x, y)];
const hitAt = (x, y, r) => solid(Math.floor(x - r), Math.floor(y - r)) || solid(Math.floor(x + r), Math.floor(y - r)) || solid(Math.floor(x - r), Math.floor(y + r)) || solid(Math.floor(x + r), Math.floor(y + r));
function moveEnt(e, dx, dy) {
  let bump = false;
  if (!hitAt(e.x + dx, e.y, e.r)) e.x += dx; else bump = true;
  if (!hitAt(e.x, e.y + dy, e.r)) e.y += dy; else bump = true;
  return bump;
}
function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / .3);
  for (let i = 1; i < n; i++) { const f = i / n; if (solid(Math.floor(x0 + (x1 - x0) * f), Math.floor(y0 + (y1 - y0) * f))) return false; }
  return true;
}
function steer(e, see, dx, dy, d) {
  if (see) return [dx / d, dy / d];
  const ex = Math.floor(e.x), ey = Math.floor(e.y);
  let best = flow[I(ex, ey)], bx = 0, by = 0;
  if (best < 0) return [dx / d, dy / d];
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
    if (!a && !b) continue;
    const X = ex + a, Y = ey + b; if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
    const v = flow[I(X, Y)];
    if (v < 0 || v >= best) continue;
    if (a && b && (solid(ex + a, ey) || solid(ex, ey + b))) continue;
    best = v; bx = X + .5 - e.x; by = Y + .5 - e.y;
  }
  const l = Math.hypot(bx, by);
  return l ? [bx / l, by / l] : [0, 0];
}

// ---------------------------------------------------------------- combat
function shootAng(e, a, spd, kind) {
  projs.push({ x: e.x + Math.cos(a) * .4, y: e.y + Math.sin(a) * .4, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 4, from: 'e', r: .16, kind });
}
function wake(e) {
  e.awake = true; bark(e);
  if (e.boss && !bossRef) { bossRef = e; say(e.name.toUpperCase(), floor > 5 ? 'is back for overtime.' : level.th.boss.line.replace(/^./, c => c.toUpperCase()), 3.5); sfx(110, .5, 'sawtooth', .05, 80); }
}
function bark(e) { if (e.barkT <= 0) { floatText(e.x, e.y, pick(e.barks), '#fff3b0'); e.barkT = rnd(4, 8); } }
function startWind(e, dx, dy, d) { e.state = 'wind'; e.st = e.boss ? .65 : .55; e.cvx = dx / d; e.cvy = dy / d; sfx(200, .3, 'triangle', .04, 300); }

function updEnemy(e, dt) {
  const p = player; e.flash -= dt; e.cd -= dt; e.barkT -= dt;
  const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || .001;
  if (!e.awake) { if (e.hurt || (d < 8.5 && los(e.x, e.y, p.x, p.y))) wake(e); else return; }
  const see = d < 13 && los(e.x, e.y, p.x, p.y);
  let vx = 0, vy = 0, spd = e.spd;
  const away = () => { vx = -dx / d; vy = -dy / d; }, toward = () => { [vx, vy] = steer(e, see, dx, dy, d); }, orbit = () => { vx = -dy / d * e.strafe; vy = dx / d * e.strafe; spd *= .6; };
  if (e.state === 'wind') { e.st -= dt; if (e.st <= 0) { e.state = 'dash'; e.st = e.boss ? .7 : .55; } }
  else if (e.state === 'dash') { e.st -= dt; vx = e.cvx; vy = e.cvy; spd = 10; if (e.st <= 0 || e.bump) { e.state = 'rest'; e.st = e.boss ? .5 : .9; if (e.bump) shake = Math.max(shake, 4); } }
  else if (e.state === 'rest') { e.st -= dt; if (e.st <= 0) e.state = ''; }
  else if (e.state === 'spiral') {
    e.st -= dt; e.sa += dt * 4.5; e.sc -= dt;
    if (e.sc <= 0) { e.sc = .1; shootAng(e, e.sa, 4.2, 'memo'); shootAng(e, e.sa + Math.PI, 4.2, 'memo'); }
    if (e.st <= 0) e.state = '';
  } else if (e.boss) {
    if (d > 5 || !see) toward(); else if (d < 2.5) away(); else orbit();
    if (e.cd <= 0 && see) {
      e.cd = 1.1 + (e.hp / e.maxHp) * 1.1;
      const pat = e.pats[e.pi++ % e.pats.length];
      if (pat === 'charge') startWind(e, dx, dy, d);
      else if (pat === 'burst') { const n = 9 + Math.min(floor, 8), o = rnd(6.28); for (let i = 0; i < n; i++) shootAng(e, o + i / n * 6.283, 4.4, 'memo'); sfx(300, .2, 'sawtooth', .04, -150); }
      else if (pat === 'aimed') { const b = Math.atan2(dy, dx); for (let k = -2; k <= 2; k++) shootAng(e, b + k * .2, 6, 'memo'); sfx(500, .12, 'square', .03, -200); }
      else if (pat === 'spiral') { e.state = 'spiral'; e.st = 1.8; e.sa = Math.atan2(dy, dx); }
      else if (pat === 'summon' && enemies.length < 14) {
        floatText(e.x, e.y, "I'm looping in the interns!", '#fff3b0');
        for (let k = 0; k < 2; k++) for (let a = 0; a < 12; a++) {
          const X = e.x + rnd(-2, 2), Y = e.y + rnd(-2, 2);
          if (!hitAt(X, Y, .3)) { const m = makeEnemy('intern', X, Y); m.awake = true; enemies.push(m); break; }
        }
      }
    }
  } else if (e.ai === 'chase') toward();
  else if (e.ai === 'ranged') {
    if (d > 5.5 || !see) toward(); else if (d < 3) away(); else orbit();
    if (see && e.cd <= 0) { e.cd = 1.7; shootAng(e, Math.atan2(dy, dx), 5.5, 'calc'); }
  } else if (e.ai === 'charge') {
    if (see && d < 6 && e.cd <= 0) { startWind(e, dx, dy, d); e.cd = 2; } else toward();
  } else if (e.ai === 'spread') {
    if (d > 3.5 || !see) toward();
    if (see && e.cd <= 0) { e.cd = 2.3; const b = Math.atan2(dy, dx); for (let k = -1; k <= 1; k++) shootAng(e, b + k * .28, 4.6, 'ticket'); }
  }
  e.moving = !!(vx || vy);
  if (e.moving) { e.bump = moveEnt(e, vx * spd * dt, vy * spd * dt); e.walk += dt; if (Math.abs(vx - vy) > .1) e.face = vx - vy > 0 ? 1 : -1; }
  else e.face = dx - dy > 0 ? 1 : -1;
  if (d < e.r + p.r + .08) hurtPlayer();
  if (Math.random() < dt * .08) bark(e);
}

function hurtPlayer() {
  const p = player;
  if (p.inv > 0 || state !== 'play') return;
  p.hp--; p.inv = 1; p.hurtT = .35; shake = 9; sfx(160, .25, 'sawtooth', .07, -100);
  if (p.hp <= 0) { state = 'dead'; setTimeout(showDead, 700); }
}

function hitEnemy(e, dmg, vx, vy) {
  e.hp -= dmg; e.flash = .1; e.hurt = true; sfx(420, .05, 'square', .03, -150);
  if (!e.boss && e.state !== 'dash') moveEnt(e, vx * .012, vy * .012);
  if (e.hp > 0) return;
  enemies.splice(enemies.indexOf(e), 1); kills++;
  confetti(e.x, e.y, e.boss ? 40 : 12, e.look.shirt); sfx(240, .18, 'square', .05, -200);
  if (e.boss) {
    pickups.push({ x: e.x, y: e.y, kind: 'piece', piece: e.piece });
    for (const q of projs) if (q.from === 'e') q.life = 0; shake = 12;
    floatText(e.x, e.y, 'I quit!', '#fff3b0');
  } else {
    floatText(e.x, e.y, pick(['Out of office!', 'Taking a sick day…', 'OOO', "I'll email you.", 'Ow, my KPIs!']), '#ddd');
    const r = Math.random(); if (r < .13) pickups.push({ x: e.x, y: e.y, kind: 'coffee' }); else if (r < .16) pickups.push({ x: e.x, y: e.y, kind: 'donut' });
  }
}
function confetti(x, y, n, c) {
  for (let i = 0; i < n; i++) parts.push({ x, y, z: rnd(8, 24), vx: rnd(-3, 3), vy: rnd(-3, 3), vz: rnd(40, 120), t: rnd(.5, 1.1), c: Math.random() < .5 ? '#fff' : c, rot: rnd(6) });
}

// ---------------------------------------------------------------- update
function screenToWorld(px, py) {
  const wx = (px - W / 2) / Z + cam.x, wy = (py - H / 2) / Z + cam.y + 16;
  return [(wx / HW + wy / HH) / 2, (wy / HH - wx / HW) / 2];
}

function update(dt) {
  time += dt;
  const p = player;
  // --- movement
  let mx = 0, my = 0, mag = 0;
  if (sticks.move) { const s = sticks.move; mx = s.dx + 2 * s.dy; my = 2 * s.dy - s.dx; mag = Math.min(1, Math.hypot(s.dx, s.dy) / 36); if (mag < .15) mag = 0; }
  else {
    const ix = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0), iy = (K.s || K.arrowdown ? 1 : 0) - (K.w || K.arrowup ? 1 : 0);
    mx = ix + iy; my = iy - ix; mag = ix || iy ? 1 : 0;
  }
  const ml = Math.hypot(mx, my);
  if (ml && mag) { mx /= ml; my /= ml; p.dx = mx; p.dy = my; }
  p.cd -= dt; p.dashCd -= dt; p.inv -= dt; p.hurtT -= dt;
  if (dashQueued && p.dashCd <= 0) { p.dashT = .18; p.dashCd = p.dashMax; p.inv = Math.max(p.inv, .28); sfx(500, .15, 'triangle', .05, 400); }
  dashQueued = false;
  if (p.dashT > 0) { p.dashT -= dt; moveEnt(p, p.dx * p.speed * 3.2 * dt, p.dy * p.speed * 3.2 * dt); if (Math.random() < .6) parts.push({ x: p.x, y: p.y, z: 4, vx: 0, vy: 0, vz: 10, t: .3, c: 'rgba(255,255,255,.6)', rot: 0 }); }
  else if (mag) moveEnt(p, mx * p.speed * mag * dt, my * p.speed * mag * dt);
  p.moving = mag > 0; if (p.moving) p.walk += dt;

  // --- aiming + firing
  let ax = 0, ay = 0, firing = false;
  if (touchMode) {
    const s = sticks.aim;
    if (s && Math.hypot(s.dx, s.dy) > 8) { ax = s.dx + 2 * s.dy; ay = 2 * s.dy - s.dx; firing = true; }
  } else { const [wx, wy] = screenToWorld(mouse.x, mouse.y); ax = wx - p.x; ay = wy - p.y; firing = mouse.down; }
  const al = Math.hypot(ax, ay);
  if (al) { ax /= al; ay /= al; if (firing || !p.moving) p.face = ax - ay > 0 ? 1 : -1; else if (Math.abs(mx - my) > .1) p.face = mx - my > 0 ? 1 : -1; }
  if (firing && al && p.cd <= 0) {
    p.cd = p.fireCd; const base = Math.atan2(ay, ax);
    for (let i = 0; i < p.shots; i++) {
      const a = base + (i - (p.shots - 1) / 2) * .15;
      projs.push({ x: p.x + Math.cos(a) * .35, y: p.y + Math.sin(a) * .35, vx: Math.cos(a) * 12, vy: Math.sin(a) * 12, life: .85, from: 'p', r: .12, kind: 'staple', pierce: p.pierce, hit: [] });
    }
    sfx(760, .05, 'square', .025, -300);
  }

  // --- flow field, fog, minimap
  flowT -= dt;
  if (flowT <= 0) {
    flowT = .25; flow = bfs(level, Math.floor(p.x), Math.floor(p.y), 28);
    const px = Math.floor(p.x), py = Math.floor(p.y);
    for (let y = py - 9; y <= py + 9; y++) for (let x = px - 9; x <= px + 9; x++) if (x >= 0 && y >= 0 && x < N && y < N) level.seen[I(x, y)] = 1;
    drawMini();
  }

  // --- enemies
  for (const e of enemies.slice()) updEnemy(e, dt);
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (!a.awake || !b.awake) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
    if (d < m && d > .001) { const f = (m - d) / d * .5; if (!a.boss) moveEnt(a, -dx * f, -dy * f); if (!b.boss) moveEnt(b, dx * f, dy * f); }
  }

  // --- projectiles
  for (let i = projs.length - 1; i >= 0; i--) {
    const q = projs[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
    let dead = q.life <= 0;
    if (!dead && solid(Math.floor(q.x), Math.floor(q.y))) { dead = true; parts.push({ x: q.x, y: q.y, z: 14, vx: 0, vy: 0, vz: 30, t: .2, c: '#fff', rot: 0 }); }
    if (!dead && q.from === 'p') {
      for (const e of enemies) {
        if (q.hit.includes(e) || Math.hypot(e.x - q.x, e.y - q.y) > e.r + q.r + .08) continue;
        q.hit.push(e); hitEnemy(e, p.dmg, q.vx, q.vy);
        if (q.pierce-- <= 0) { dead = true; break; }
      }
    } else if (!dead && p.inv <= 0 && Math.hypot(p.x - q.x, p.y - q.y) < p.r + q.r) { hurtPlayer(); dead = true; }
    if (dead) projs.splice(i, 1);
  }

  // --- pickups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; if (Math.hypot(k.x - p.x, k.y - p.y) > .7) continue;
    if (k.kind === 'piece') {
      if (k.piece === 'trophy') trophies++; else pieces.push(k.piece);
      elevOpen = true; say(`RECOVERED: ${PIECE_NAME[k.piece]}`, 'The elevator is open. Follow the arrow.', 4.5);
      [523, 659, 784, 1047].forEach((f, n) => setTimeout(() => sfx(f, .18, 'triangle', .06), n * 110));
      confetti(p.x, p.y, 30, '#ffd84a');
    } else {
      if (p.hp >= p.maxHp) continue;
      p.hp = Math.min(p.maxHp, p.hp + (k.kind === 'donut' ? 2 : 1)); floatText(p.x, p.y, k.kind === 'donut' ? 'Donut!' : 'Coffee!', '#9f9'); sfx(660, .12, 'triangle', .05, 300);
    }
    pickups.splice(i, 1);
  }

  // --- elevator
  if (elevOpen && Math.hypot(level.elev.x + .5 - p.x, level.elev.y + .5 - p.y) < .65) {
    sfx(880, .3, 'sine', .06);
    if (floor === 5 && !overtime) showWin(); else showPerks();
  }

  // --- fx
  for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.t -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.vz -= 300 * dt; if (q.z < 0) { q.z = 0; q.vx = q.vy = 0; } if (q.t <= 0) parts.splice(i, 1); }
  for (let i = texts.length - 1; i >= 0; i--) { texts[i].t -= dt; if (texts[i].t <= 0) texts.splice(i, 1); }
  if (banner && (banner.t -= dt) <= 0) banner = null;
  shake = Math.max(0, shake - dt * 30);
  const tx = sx(p.x, p.y), ty = sy(p.x, p.y), f = 1 - Math.pow(.0005, dt);
  cam.x += (tx - cam.x) * f; cam.y += (ty - cam.y) * f;
}

// ---------------------------------------------------------------- drawing primitives
function block(x, y, ins, h, ct, cl, cr, z = 0) {
  const a = x + ins, b = y + ins, c = x + 1 - ins, d = y + 1 - ins;
  const Wx = sx(a, d), Wy = sy(a, d) - z, Sx = sx(c, d), Sy = sy(c, d) - z, Ex = sx(c, b), Ey = sy(c, b) - z, Nx = sx(a, b), Ny = sy(a, b) - z;
  ctx.fillStyle = cl; ctx.beginPath(); ctx.moveTo(Wx, Wy); ctx.lineTo(Sx, Sy); ctx.lineTo(Sx, Sy - h); ctx.lineTo(Wx, Wy - h); ctx.fill();
  ctx.fillStyle = cr; ctx.beginPath(); ctx.moveTo(Sx, Sy); ctx.lineTo(Ex, Ey); ctx.lineTo(Ex, Ey - h); ctx.lineTo(Sx, Sy - h); ctx.fill();
  ctx.fillStyle = ct; ctx.beginPath(); ctx.moveTo(Nx, Ny - h); ctx.lineTo(Ex, Ey - h); ctx.lineTo(Sx, Sy - h); ctx.lineTo(Wx, Wy - h); ctx.fill();
}
function ell(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); }

function drawWall(s) {
  const th = level.th;
  if (s.h > 20) {
    block(s.x, s.y, 0, s.h, '#cfc8b4', '#efe9d8', '#ddd6c2');
    block(s.x, s.y, 0, 6, 'rgba(0,0,0,0)', '#8d8672', '#7d7663');
    ctx.fillStyle = '#a9d6ef';
    if (s.winL) { const x0 = sx(s.x + .2, s.y + 1), y0 = sy(s.x + .2, s.y + 1), x1 = sx(s.x + .8, s.y + 1), y1 = sy(s.x + .8, s.y + 1); ctx.beginPath(); ctx.moveTo(x0, y0 - 20); ctx.lineTo(x1, y1 - 20); ctx.lineTo(x1, y1 - 42); ctx.lineTo(x0, y0 - 42); ctx.fill(); }
    if (s.winR) { const x0 = sx(s.x + 1, s.y + .8), y0 = sy(s.x + 1, s.y + .8), x1 = sx(s.x + 1, s.y + .2), y1 = sy(s.x + 1, s.y + .2); ctx.beginPath(); ctx.moveTo(x0, y0 - 20); ctx.lineTo(x1, y1 - 20); ctx.lineTo(x1, y1 - 42); ctx.lineTo(x0, y0 - 42); ctx.fill(); }
  } else block(s.x, s.y, 0, s.h, '#d8dbe0', th.part, shade(th.part, -18));
}
function shade(hex, a) { const n = parseInt(hex.slice(1), 16), c = v => clamp(v + a, 0, 255); return `rgb(${c(n >> 16)},${c(n >> 8 & 255)},${c(n & 255)})`; }

function drawProp(s) {
  const { x, y } = s, cx = sx(x + .5, y + .5), cy = sy(x + .5, y + .5);
  switch (s.prop) {
    case 'desk':
      block(x, y, .06, 15, '#d2ab74', '#a9824d', '#94703f');
      block(x, y, .36, 12, '#22252b', '#3a3f48', '#15171b', 17);   // monitor
      ctx.fillStyle = '#7fd4ff'; ctx.fillRect(cx - 7, cy - 27, 9, 6);
      break;
    case 'table': block(x, y, 0, 14, '#7a5536', '#5d3f27', '#4f3520'); break;
    case 'rtable': ell(ctx, cx, cy, 14, 7, 'rgba(0,0,0,.2)'); ctx.fillStyle = '#888'; ctx.fillRect(cx - 2, cy - 14, 4, 14); ell(ctx, cx, cy - 15, 20, 10, '#f3f3f3'); ell(ctx, cx + 4, cy - 17, 4, 2.2, '#b5651d'); break;
    case 'plant':
      block(x, y, .3, 11, '#8a5a3a', '#b97a4f', '#9c6540');
      ell(ctx, cx, cy - 24, 12, 11, '#3f8f4f'); ell(ctx, cx - 7, cy - 17, 8, 7, '#357f45'); ell(ctx, cx + 7, cy - 19, 8, 7, '#4a9f5b'); ell(ctx, cx, cy - 34, 7, 7, '#4a9f5b');
      break;
    case 'copier':
      block(x, y, .1, 26, '#e3e5e8', '#c5c8cd', '#aeb1b7'); block(x, y, .2, 3, '#555a63', '#444', '#333', 26);
      ell(ctx, cx - 12, cy - 12, 2, 2, '#4f6');
      break;
    case 'cooler':
      block(x, y, .3, 22, '#f4f4f4', '#dcdcdc', '#c6c6c6');
      ctx.fillStyle = 'rgba(90,170,255,.85)'; ctx.beginPath(); ctx.roundRect(cx - 7, cy - 48, 14, 20, 5); ctx.fill();
      break;
    case 'vending':
      block(x, y, .08, 46, '#b3372b', '#d3473a', '#a83227');
      { const x0 = sx(x + .2, y + .92), y0 = sy(x + .2, y + .92), x1 = sx(x + .7, y + .92), y1 = sy(x + .7, y + .92); ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.moveTo(x0, y0 - 14); ctx.lineTo(x1, y1 - 14); ctx.lineTo(x1, y1 - 40); ctx.lineTo(x0, y0 - 40); ctx.fill(); }
      break;
    case 'cabinet':
      block(x, y, .15, 34, '#8f9684', '#a8af9c', '#7e8574');
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
      for (const h of [12, 23]) { ctx.beginPath(); ctx.moveTo(sx(x + .15, y + .85), sy(x + .15, y + .85) - h); ctx.lineTo(sx(x + .85, y + .85), sy(x + .85, y + .85) - h); ctx.stroke(); }
      break;
    case 'boxes': block(x, y, .14, 16, '#cfa46d', '#b98b55', '#a57a48'); block(x, y, .28, 12, '#d6ad78', '#c09460', '#ab804f', 16); break;
  }
}

function person(x, y, L, o) {
  const s = (L.s || 1), F = o.flash > 0, col = c => F ? '#fff' : c;
  ctx.save(); ctx.translate(x, y);
  ell(ctx, 0, 0, 13 * s, 6 * s, 'rgba(0,0,0,.25)');
  if (o.wind) { ctx.translate(rnd(-1.5, 1.5), 0); }
  ctx.scale(s * (o.face < 0 ? -1 : 1), s);
  const sw = Math.sin(o.walk * 11), bob = o.moving ? Math.abs(sw) * 2 : Math.sin(time * 3 + x) * .6, lift = o.moving ? sw * 4 : 0;
  ctx.fillStyle = col(L.pants);
  ctx.fillRect(-6, -11, 5, 11 - Math.max(0, lift)); ctx.fillRect(1, -11, 5, 11 - Math.max(0, -lift));
  ctx.fillStyle = col(L.shirt); ctx.beginPath(); ctx.roundRect(-9, -31 - bob, 18, 22, 5); ctx.fill();
  if (L.tie) { ctx.fillStyle = col(L.tie); ctx.beginPath(); ctx.moveTo(1, -30 - bob); ctx.lineTo(6, -30 - bob); ctx.lineTo(3.5, -17 - bob); ctx.fill(); }
  if (L.lanyard) { ctx.strokeStyle = col('#e44'); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-2, -30 - bob); ctx.lineTo(3, -20 - bob); ctx.lineTo(7, -30 - bob); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(1, -21 - bob, 4, 5); }
  ell(ctx, 1, -38 - bob, 9, 9, col(L.skin));
  ctx.fillStyle = col(L.hair); ctx.beginPath(); ctx.arc(0, -39.5 - bob, 9.5, Math.PI * .95, Math.PI * 1.95); ctx.fill();
  if (!F) {
    ctx.fillStyle = '#222'; ctx.fillRect(3, -39 - bob, 2, 2.5); ctx.fillRect(7, -39 - bob, 2, 2.5);
    if (L.glasses) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.strokeRect(1.5, -40.5 - bob, 4, 5); ctx.strokeRect(6.5, -40.5 - bob, 4, 5); }
    if (o.angry) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(1.5, -43 - bob); ctx.lineTo(5.5, -41.5 - bob); ctx.moveTo(10.5, -43 - bob); ctx.lineTo(6.5, -41.5 - bob); ctx.stroke(); }
  }
  if (L.headphones) { ctx.strokeStyle = col('#e33'); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, -39 - bob, 10.5, Math.PI, 0); ctx.stroke(); ctx.fillStyle = col('#e33'); ctx.fillRect(-12, -41 - bob, 4, 7); }
  if (L.stapler) { ctx.fillStyle = '#c33'; ctx.fillRect(8, -24 - bob, 9, 4); ctx.fillStyle = '#888'; ctx.fillRect(8, -20 - bob, 9, 2); }
  ctx.restore();
}

// boss body parts, drawn in "assembled" coordinates (origin = feet)
function piece(g, kind) {
  switch (kind) {
    case 'legs': g.fillStyle = '#4a4f5e'; g.fillRect(-9, -28, 8, 26); g.fillRect(1, -28, 8, 26); g.fillStyle = '#111'; g.fillRect(-11, -3, 10, 4); g.fillRect(1, -3, 10, 4); break;
    case 'torso': g.fillStyle = '#3a3f4e'; g.beginPath(); g.roundRect(-12, -58, 24, 32, 4); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, -58); g.lineTo(5, -58); g.lineTo(0, -44); g.fill(); g.fillStyle = '#c8402f'; g.beginPath(); g.moveTo(-2, -57); g.lineTo(2, -57); g.lineTo(3, -40); g.lineTo(0, -36); g.lineTo(-3, -40); g.fill(); break;
    case 'arms': g.fillStyle = '#3a3f4e'; g.fillRect(-19, -56, 6, 22); g.fillRect(13, -56, 6, 22); g.fillStyle = '#f0c39a'; g.fillRect(-19, -34, 6, 6); g.fillRect(13, -34, 6, 6); break;
    case 'head': ell(g, 0, -70, 11, 11, '#f0c39a'); g.fillStyle = '#222'; g.fillRect(-5, -72, 2.5, 3); g.fillRect(3, -72, 2.5, 3); g.fillStyle = '#5a3a1a'; g.beginPath(); g.ellipse(0, -65, 7, 2.5, 0, 0, 6.283); g.fill(); break;
    case 'toupee': ell(g, 0, -80, 11, 5, '#6b3d14'); ell(g, -5, -78, 6, 4, '#7a4718'); ell(g, 6, -81, 5, 3.5, '#7a4718'); break;
    case 'trophy': g.fillStyle = '#ffd84a'; g.fillRect(-12, -14, 24, 6); g.fillStyle = '#e0b020'; g.fillRect(-12, -8, 24, 4); g.fillRect(-12, -18, 6, 4); break;
  }
}
const PIECE_CY = { legs: -14, torso: -42, arms: -43, head: -70, toupee: -80, trophy: -10 };
function bossFigure(g, x, y, s, have) {
  g.save(); g.translate(x, y); g.scale(s, s);
  for (const k of ORDER) { g.globalAlpha = have.includes(k) ? 1 : .18; if (!have.includes(k)) g.filter = 'grayscale(1)'; piece(g, k); g.filter = 'none'; }
  g.restore(); g.globalAlpha = 1;
}

// ---------------------------------------------------------------- render
function drawMini() {
  const m = level.mini || (level.mini = document.createElement('canvas'));
  m.width = N * 3; m.height = N * 1.5 + 2;
  const g = m.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = I(x, y); if (!level.seen[i] || level.t[i] !== 1) continue;
    g.fillStyle = level.zone[i] ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)';
    g.fillRect((x - y) * 1.5 + N * 1.5 - 1, (x + y) * .75, 3, 1.6);
  }
  const dot = (x, y, c, r = 2.5) => { g.fillStyle = c; g.beginPath(); g.arc((x - y) * 1.5 + N * 1.5, (x + y) * .75, r, 0, 6.283); g.fill(); };
  const e = level.elev; if (level.seen[I(e.x, e.y)]) dot(e.x, e.y, elevOpen ? '#5f5' : '#f55');
  dot(player.x, player.y, '#ffd84a', 3);
}

function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#1b1d24'; ctx.fillRect(0, 0, W, H);
  if (!level) return;
  const p = player, shx = shake ? rnd(-shake, shake) * .5 : 0, shy = shake ? rnd(-shake, shake) * .5 : 0;
  ctx.setTransform(DPR * Z, 0, 0, DPR * Z, DPR * (W / 2 + shx), DPR * (H / 2 + shy));
  ctx.translate(-cam.x, -cam.y);
  ctx.drawImage(level.fc, -N * HW, 0);

  // elevator pad
  const ev = level.elev, ex = sx(ev.x + .5, ev.y + .5), ey = sy(ev.x + .5, ev.y + .5);
  ctx.fillStyle = elevOpen ? `rgba(110,255,140,${.55 + Math.sin(time * 5) * .25})` : '#5b606b';
  ctx.beginPath(); ctx.moveTo(ex, ey - 14); ctx.lineTo(ex + 28, ey); ctx.lineTo(ex, ey + 14); ctx.lineTo(ex - 28, ey); ctx.fill();
  ctx.strokeStyle = '#2b2e36'; ctx.lineWidth = 2; ctx.stroke();

  // charge telegraphs
  for (const e of enemies) if (e.state === 'wind') {
    ctx.strokeStyle = 'rgba(255,60,40,.45)'; ctx.lineWidth = e.boss ? 26 : 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx(e.x, e.y), sy(e.x, e.y)); ctx.lineTo(sx(e.x + e.cvx * 6, e.y + e.cvy * 6), sy(e.x + e.cvx * 6, e.y + e.cvy * 6)); ctx.stroke();
  }

  // depth-sorted scene
  const vw = W / Z / 2 + 70, vh = H / Z / 2 + 90, list = [];
  for (const s of level.statics) { const X = sx(s.x, s.y) - cam.x, Y = sy(s.x, s.y) - cam.y; if (X > -vw && X < vw && Y > -vh && Y < vh) list.push(s); }
  for (const e of enemies) list.push({ k: e.x + e.y, e });
  for (const k of pickups) list.push({ k: k.x + k.y, pk: k });
  for (const q of projs) list.push({ k: q.x + q.y, q });
  list.push({ k: p.x + p.y, me: true });
  list.sort((a, b) => a.k - b.k);
  const pk = p.x + p.y, psx = sx(p.x, p.y), psy = sy(p.x, p.y);
  for (const it of list) {
    if (it.wall) drawWall(it);
    else if (it.prop) {
      const X = sx(it.x + .5, it.y + .5) - psx, Y = sy(it.x + .5, it.y + .5) - psy;
      const hide = it.k > pk && Math.abs(X) < 34 && Y > 0 && Y < 52;
      if (hide) ctx.globalAlpha = .45; drawProp(it); ctx.globalAlpha = 1;
    } else if (it.e) {
      const e = it.e, X = sx(e.x, e.y), Y = sy(e.x, e.y);
      person(X, Y, e.look, { face: e.face, walk: e.walk, moving: e.moving, flash: e.flash, angry: e.awake, wind: e.state === 'wind' });
      const hh = 52 * (e.look.s || 1);
      if (e.boss) { ctx.save(); ctx.translate(X, Y - hh - 14 + Math.sin(time * 4) * 3 - PIECE_CY[e.piece] * .7); ctx.scale(.7, .7); piece(ctx, e.piece); ctx.restore(); }
      else if (e.hp < e.maxHp) { ctx.fillStyle = '#000a'; ctx.fillRect(X - 12, Y - hh, 24, 4); ctx.fillStyle = '#f55'; ctx.fillRect(X - 11, Y - hh + 1, 22 * e.hp / e.maxHp, 2); }
      if (!e.awake) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('z', X + 8, Y - hh - 2 + Math.sin(time * 2 + X) * 2); }
    } else if (it.pk) {
      const k = it.pk, X = sx(k.x, k.y), Y = sy(k.x, k.y), b = Math.sin(time * 4 + k.x) * 3;
      ell(ctx, X, Y, 9, 4.5, 'rgba(0,0,0,.25)');
      if (k.kind === 'coffee') { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(X - 6, Y - 20 + b, 12, 13, 2); ctx.fill(); ctx.fillStyle = '#6b3d14'; ctx.fillRect(X - 5, Y - 19 + b, 10, 3); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X + 7, Y - 13 + b, 4, -1.4, 1.4); ctx.stroke(); }
      else if (k.kind === 'donut') { ctx.strokeStyle = '#f48fb1'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(X, Y - 14 + b, 7, 5, 0, 0, 6.283); ctx.stroke(); }
      else {
        ctx.save(); ctx.translate(X, Y - 26 + b); const gl = ctx.createRadialGradient(0, 0, 2, 0, 0, 30); gl.addColorStop(0, 'rgba(255,220,90,.7)'); gl.addColorStop(1, 'rgba(255,220,90,0)'); ctx.fillStyle = gl; ctx.fillRect(-30, -30, 60, 60);
        ctx.translate(0, -PIECE_CY[k.piece]); piece(ctx, k.piece); ctx.restore();
      }
    } else if (it.q) {
      const q = it.q, X = sx(q.x, q.y), Y = sy(q.x, q.y);
      ell(ctx, X, Y, 4, 2, 'rgba(0,0,0,.25)');
      if (q.kind === 'staple') { ctx.fillStyle = '#e8eef5'; ctx.save(); ctx.translate(X, Y - 15); ctx.rotate(time * 20); ctx.fillRect(-4, -1.5, 8, 3); ctx.restore(); }
      else if (q.kind === 'calc') { ctx.fillStyle = '#333'; ctx.fillRect(X - 5, Y - 21, 10, 12); ctx.fillStyle = '#9f9'; ctx.fillRect(X - 3, Y - 19, 6, 3); }
      else { ctx.fillStyle = q.kind === 'ticket' ? '#ffe04a' : '#ff8fb0'; ctx.save(); ctx.translate(X, Y - 15); ctx.rotate(time * 6 + q.life); ctx.fillRect(-5, -5, 10, 10); ctx.restore(); }
    } else if (it.me) {
      if (p.inv > 0 && p.dashT <= 0 && Math.floor(time * 16) % 2) ctx.globalAlpha = .4;
      person(psx, psy, LOOKS.player, { face: p.face, walk: p.walk, moving: p.moving, flash: p.hurtT > .2 });
      ctx.globalAlpha = 1;
    }
  }
  // particles + world labels
  for (const q of parts) { ctx.fillStyle = q.c; ctx.save(); ctx.translate(sx(q.x, q.y), sy(q.x, q.y) - q.z); ctx.rotate(q.rot + q.t * 9); ctx.globalAlpha = Math.min(1, q.t * 3); ctx.fillRect(-2.5, -2, 5, 4); ctx.restore(); }
  ctx.globalAlpha = 1; ctx.textAlign = 'center';
  ctx.font = 'bold 12px "Courier New", monospace';
  ctx.fillStyle = elevOpen ? '#8f8' : '#f88'; ctx.fillText(elevOpen ? '▲ ELEVATOR' : 'ELEVATOR LOCKED', ex, ey - 24 + Math.sin(time * 3) * 2);
  for (const t of texts) {
    const X = sx(t.x, t.y), Y = sy(t.x, t.y) - 62 - (1.6 - t.t) * 18;
    ctx.globalAlpha = Math.min(1, t.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.strokeText(t.s, X, Y); ctx.fillStyle = t.c; ctx.fillText(t.s, X, Y);
  }
  ctx.globalAlpha = 1;
  // guide arrow: to the elevator once open, otherwise nothing (exploring is the point)
  if (elevOpen) {
    const dx = ex - psx, dy = ey - psy, d = Math.hypot(dx, dy);
    if (d > 150) { const a = Math.atan2(dy, dx); ctx.save(); ctx.translate(psx + Math.cos(a) * 70, psy - 20 + Math.sin(a) * 70); ctx.rotate(a); ctx.fillStyle = '#8f8'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9); ctx.fill(); ctx.restore(); }
  }

  // ---- HUD (screen space)
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (p.hurtT > 0) { ctx.fillStyle = `rgba(220,40,30,${p.hurtT})`; ctx.fillRect(0, 0, W, H); }
  for (let i = 0; i < p.maxHp; i++) {
    const X = 16 + i * 26, Y = 16, full = i < p.hp;
    ctx.fillStyle = full ? '#fff' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.roundRect(X, Y, 16, 18, 3); ctx.fill();
    if (full) { ctx.fillStyle = '#6b3d14'; ctx.fillRect(X + 2, Y + 2, 12, 4); }
    ctx.strokeStyle = ctx.fillStyle = full ? '#fff' : 'rgba(255,255,255,.2)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(X + 17, Y + 9, 4.5, -1.4, 1.4); ctx.stroke();
  }
  ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = 'bold 13px "Courier New", monospace';
  ctx.fillText(`FLOOR ${floor} · ${level.th.name}`, 16, 56);
  const dr = clamp(1 - p.dashCd / p.dashMax, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(16, 64, 90, 5); ctx.fillStyle = dr >= 1 ? '#8fd0ff' : '#667'; ctx.fillRect(16, 64, 90 * dr, 5);
  ctx.font = '10px "Courier New", monospace'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText('ROLL', 112, 70);
  // boss assembly + minimap
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.roundRect(W - 78, 10, 68, 112, 6); ctx.fill();
  bossFigure(ctx, W - 44, 104, 1, pieces);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px "Courier New", monospace'; ctx.fillText(`${pieces.length}/5${trophies ? ' +' + trophies : ''}`, W - 44, 118);
  if (level.mini) { ctx.globalAlpha = .9; ctx.drawImage(level.mini, W - 10 - N * 3, 130); ctx.globalAlpha = 1; }
  // boss bar
  if (bossRef && bossRef.hp > 0) {
    const bw = Math.min(360, W - 220), bx = (W - bw) / 2;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(bx - 2, 14, bw + 4, 14); ctx.fillStyle = '#d3473a'; ctx.fillRect(bx, 16, bw * bossRef.hp / bossRef.maxHp, 10);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px "Courier New", monospace'; ctx.fillText(bossRef.name, W / 2, 42);
  }
  if (banner) {
    const a = Math.min(1, banner.t * 2, (banner.max - banner.t) * 4), Y = H * .24;
    ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, Y - 30, W, 64);
    ctx.fillStyle = '#ffd84a'; ctx.font = `bold ${Math.min(24, W / 22)}px "Courier New", monospace`; ctx.fillText(banner.a, W / 2, Y - 4);
    ctx.fillStyle = '#fff'; ctx.font = `${Math.min(14, (W - 16) / (banner.b.length * .61))}px "Courier New", monospace`; ctx.fillText(banner.b, W / 2, Y + 20);
    ctx.globalAlpha = 1;
  }
  for (const s of [sticks.move, sticks.aim]) if (s) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.ox, s.oy, 40, 0, 6.283); ctx.stroke();
    const l = Math.hypot(s.dx, s.dy) || 1, m = Math.min(l, 40); ell(ctx, s.ox + s.dx / l * m, s.oy + s.dy / l * m, 18, 18, 'rgba(255,255,255,.35)');
  }
}

// ---------------------------------------------------------------- screens
function show(html) { overlay.innerHTML = `<div class="memo">${html}</div>`; overlay.className = 'on'; }
function figureCanvas(have) {
  const c = overlay.querySelector('canvas'); if (!c) return;
  c.width = 220; c.height = 200; bossFigure(c.getContext('2d'), 110, 190, 2, have);
}
function showTitle() {
  state = 'title';
  show(`<small>INTEROFFICE MEMO</small><h1>RESTRUCTURED</h1><h2>an office roguelite</h2>
  <p>Corporate announced a restructuring. Nobody expected them to mean <b>the boss himself</b>.</p>
  <p>Mr. Bossman has been taken apart, and your coworkers have… <i>repurposed</i> the pieces. Fight through five ever-changing floors, recover all five parts, and put him back together before the quarterly review.</p>
  <p class="keys"><b>Move</b> WASD / arrows &nbsp;·&nbsp; <b>Throw staples</b> aim with mouse, hold click<br><b>Chair roll</b> Space (dodges everything) &nbsp;·&nbsp; <b>Mute</b> M<br><b>Touch</b> left thumb moves, right thumb aims and fires</p>
  <div class="btns"><button id="go">CLOCK IN ▶</button></div>`);
  $('#go').onclick = newGame;
}
function showPerks() {
  state = 'perk';
  const opts = [...PERKS].sort(() => Math.random() - .5).slice(0, 3);
  show(`<small>ELEVATOR · GOING UP</small><h1>PICK A PERK</h1><h2>HR says you've earned exactly one.</h2>
  <div class="btns">${opts.map((o, i) => `<button data-i="${i}">${i + 1}. ${o.n}<span>${o.d}</span></button>`).join('')}</div>`);
  overlay.querySelectorAll('button').forEach(b => b.onclick = () => choosePerk(opts[+b.dataset.i]));
  showPerks.opts = opts;
}
function choosePerk(o) { o.f(player); floor++; startFloor(); }
function showDead() {
  show(`<small>NOTICE OF TERMINATION</small><h1>YOU'VE BEEN LET GO</h1><h2>Effective immediately.</h2>
  <p>Reached <b>floor ${floor}</b> · recovered <b>${pieces.length}/5</b> boss parts · sent <b>${kills}</b> coworkers out of office.</p>
  <canvas></canvas><div class="btns"><button id="go">RE-APPLY ▶</button></div>`);
  figureCanvas(pieces); $('#go').onclick = newGame;
}
function showWin() {
  state = 'win';
  show(`<small>PERFORMANCE REVIEW</small><h1>BOSS REASSEMBLED</h1><h2>Some assembly was required.</h2><canvas></canvas>
  <p><i>"Great. Now, where are we on those reports?"</i></p><p>${kills} coworkers are currently out of office.</p>
  <div class="btns"><button id="ot">WORK OVERTIME<span>Endless floors, harder each time</span></button><button id="go">NEW GAME</button></div>`);
  figureCanvas(pieces); $('#go').onclick = newGame; $('#ot').onclick = () => { overtime = true; showPerks(); };
}

// ---------------------------------------------------------------- input
function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; Z = clamp(Math.min(W, H) / 560, .6, 1.6); }
addEventListener('resize', resize); resize();
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); K[k] = true;
  if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
  if (k === ' ' || k === 'shift') dashQueued = true;
  if (k === 'm') muted = !muted;
  if (state === 'perk' && '123'.includes(k) && showPerks.opts) choosePerk(showPerks.opts[+k - 1]);
  if ((state === 'title' || state === 'dead') && k === 'enter') { const b = $('#go'); if (b) b.click(); }
});
addEventListener('keyup', e => { K[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; mouse.down = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') {
    touchMode = true; dashBtn.style.display = 'block';
    const side = e.clientX < W / 2 ? 'move' : 'aim';
    sticks[side] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
  } else { touchMode = false; mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 2) dashQueued = true; else mouse.down = true; }
});
addEventListener('pointermove', e => {
  if (e.pointerType === 'touch') { for (const s of [sticks.move, sticks.aim]) if (s && s.id === e.pointerId) { s.dx = e.clientX - s.ox; s.dy = e.clientY - s.oy; } }
  else { mouse.x = e.clientX; mouse.y = e.clientY; }
});
const up = e => {
  if (e.pointerType === 'touch') { for (const k of ['move', 'aim']) if (sticks[k] && sticks[k].id === e.pointerId) sticks[k] = null; }
  else mouse.down = false;
};
addEventListener('pointerup', up); addEventListener('pointercancel', up);
dashBtn.addEventListener('pointerdown', e => { e.preventDefault(); dashQueued = true; });

// ---------------------------------------------------------------- main loop
let last = 0;
function frame(ts) {
  const dt = Math.min(.033, (ts - last) / 1000 || 0); last = ts;
  if (state === 'play') update(dt); else time += dt;
  render();
  requestAnimationFrame(frame);
}
window.__game = { get s() { return { state, floor, player, enemies, pieces, level, elevOpen, pickups }; } };
showTitle();
requestAnimationFrame(frame);
})();
