// DOS AI Campus 2D: a seven-storey building, one department per floor.
// Each fictional pixel-art staff member stands for one submitted use case.
// Staff work, wander to themed amenities, and meet colleagues whose use cases are related.
const $ = id => document.getElementById(id), world = $('world');

let data;
try {
  const r = await fetch('/api/use-cases');
  if (!r.ok) throw Error('Database API unavailable');
  data = await r.json();
} catch (e) {
  $('loading').textContent = e.message;
  throw e;
}

const names = ['Statistical Planning, Methodology & Classification', 'Data Collection & Acquisition', 'Data Processing & Compilation', 'Data Validation & Quality Assurance', 'Data Analysis & Interpretation', 'Statistical Communication & Dissemination', 'Organisational Support & Enablement'];
const labels = ['Planning & Classification', 'Collection & Acquisition', 'Processing & Compilation', 'Validation & Quality', 'Analysis & Interpretation', 'Communication & Dissemination', 'Support & Enablement'];
const colors = ['#b49be8', '#69c7b2', '#78b6eb', '#f2cb70', '#ed9c7e', '#e79bc7', '#a5c67c'];

const T = 24, PX = 2, SPEED = 55;
const BW = 1000, FH = 112, ROOF = 96, GROUND = 70, BH = ROOF + FH * 7 + GROUND;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const splitList = s => (s || '').split(';').map(t => t.trim()).filter(Boolean);

function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------- Activities and furniture ----------
// act: [icon, description, min seconds, max seconds]
const acts = {
  read: ['📖', 'browsing the shelves', 6, 12], write: ['✏️', 'sketching on the whiteboard', 6, 12], water: ['💧', 'at the water cooler', 4, 8],
  coffee: ['☕', 'making coffee', 5, 9], print: ['📄', 'collecting printouts', 3, 6], rest: ['😌', 'taking a breather', 8, 14],
  play: ['🏓', 'playing ping-pong', 8, 14], meet: ['💬', 'in a stand-up', 8, 14], phone: ['📞', 'on a call', 7, 12],
  plant: ['🌱', 'watering the plants', 3, 6], server: ['⚙️', 'checking the servers', 5, 9], snack: ['🍪', 'grabbing a snack', 4, 7],
  present: ['📊', 'presenting on stage', 8, 14], watch: ['👀', 'watching a talk', 8, 14], music: ['🎙️', 'recording a podcast', 8, 14],
  inspect: ['🔍', 'inspecting data', 6, 10], help: ['🙋', 'at the help desk', 6, 10], game: ['🕹️', 'on the arcade', 6, 10],
  nap: ['💤', 'power napping', 8, 14], chart: ['📈', 'reviewing dashboards', 6, 10],
};
// w,h in tiles; spots are [dx, dy, act] relative to the item (a spot on the item itself = sit/use in place).
const ITEMS = {
  shelf: {w: 3, h: 1, spots: [[1, 1, 'read']]},
  whiteboard: {w: 3, h: 1, spots: [[0, 1, 'write'], [2, 1, 'write']]},
  cooler: {w: 1, h: 1, spots: [[0, 1, 'water']]},
  coffee: {w: 2, h: 1, spots: [[0, 1, 'coffee'], [1, 1, 'coffee']]},
  printer: {w: 2, h: 1, spots: [[0, 1, 'print']]},
  sofa: {w: 3, h: 1, sit: true, spots: [[0, 0, 'rest'], [2, 0, 'rest']]},
  beanbag: {w: 1, h: 1, sit: true, spots: [[0, 0, 'rest']]},
  pingpong: {w: 4, h: 2, spots: [[-1, 0, 'play'], [4, 1, 'play']]},
  meettable: {w: 4, h: 2, spots: [[0, -1, 'meet'], [2, -1, 'meet'], [1, 2, 'meet'], [3, 2, 'meet']]},
  booth: {w: 2, h: 2, spots: [[0, 2, 'phone']]},
  plant: {w: 1, h: 1, spots: [[1, 0, 'plant']]},
  servers: {w: 3, h: 2, spots: [[0, 2, 'server'], [2, 2, 'server']]},
  snack: {w: 2, h: 1, spots: [[0, 1, 'snack'], [1, 1, 'snack']]},
  stage: {w: 5, h: 2, sit: true, spots: [[2, 1, 'present']]},
  chair: {w: 1, h: 1, sit: true, spots: [[0, 0, 'watch']]},
  podcast: {w: 3, h: 2, sit: true, spots: [[1, 1, 'music']]},
  qa: {w: 2, h: 1, spots: [[0, 1, 'inspect'], [1, 1, 'inspect']]},
  helpdesk: {w: 4, h: 1, spots: [[0, 1, 'help'], [3, 1, 'help'], [2, -1, 'help']]},
  arcade: {w: 1, h: 1, spots: [[0, 1, 'game']]},
  nappod: {w: 2, h: 1, sit: true, spots: [[0, 0, 'nap']]},
  tv: {w: 3, h: 1, spots: [[1, 1, 'chart']]},
  rug: {w: 4, h: 3, floor: true, spots: []},
};
// One theme per level: desk style, floor finish, wall colour/decor, amenity zone (14 x 13 tiles).
const themes = [
  {name: 'The Library', style: 'rows', floor: 'wood', wall: '#cdbf9f', decor: ['clock', 'sign', 'shelfwall', 'window', 'shelfwall', 'window'],
    items: [['shelf', 1, 0], ['shelf', 5, 0], ['shelf', 9, 0], ['whiteboard', 1, 4], ['cooler', 12, 4], ['rug', 4, 8], ['sofa', 4, 10], ['beanbag', 10, 9], ['beanbag', 12, 9], ['plant', 12, 12]]},
  {name: 'Field Ops', style: 'benches', floor: 'carpet', wall: '#b9cfd0', decor: ['clock', 'sign', 'mapwall', 'window', 'board', 'window'],
    items: [['booth', 0, 0], ['booth', 3, 0], ['coffee', 8, 0], ['printer', 11, 0], ['beanbag', 1, 6], ['beanbag', 3, 6], ['beanbag', 5, 6], ['whiteboard', 9, 5], ['sofa', 2, 10], ['plant', 12, 10]]},
  {name: 'Data Factory', style: 'rows', floor: 'concrete', wall: '#b7c3d3', decor: ['clock', 'sign', 'tvwall', 'window', 'tvwall', 'window'],
    items: [['servers', 0, 0], ['servers', 4, 0], ['coffee', 10, 0], ['whiteboard', 1, 6], ['arcade', 10, 6], ['arcade', 12, 6], ['printer', 5, 10], ['beanbag', 10, 11], ['beanbag', 12, 11]]},
  {name: 'QA Lab', style: 'pods', floor: 'checker', wall: '#d6d0b4', decor: ['clock', 'sign', 'board', 'window', 'poster', 'window'],
    items: [['qa', 0, 0], ['qa', 4, 0], ['cooler', 9, 0], ['plant', 12, 2], ['pingpong', 5, 5], ['sofa', 1, 10], ['tv', 8, 10]]},
  {name: 'War Room', style: 'pods', floor: 'carpet', wall: '#d8bfb3', decor: ['clock', 'sign', 'tvwall', 'board', 'tvwall', 'window'],
    items: [['meettable', 4, 2], ['tv', 10, 0], ['whiteboard', 0, 7], ['coffee', 10, 7], ['beanbag', 1, 11], ['beanbag', 3, 11], ['beanbag', 5, 11], ['plant', 12, 11]]},
  {name: 'Studio', style: 'benches', floor: 'wood', wall: '#d9c3d2', decor: ['clock', 'sign', 'poster', 'poster', 'window', 'poster'],
    items: [['stage', 1, 0], ['chair', 1, 4], ['chair', 3, 4], ['chair', 5, 4], ['podcast', 9, 0], ['sofa', 8, 7], ['snack', 1, 9], ['printer', 11, 10], ['plant', 6, 11]]},
  {name: 'The Hub', style: 'rows', floor: 'tiles', wall: '#c7d3bd', decor: ['clock', 'sign', 'board', 'window', 'poster', 'window'],
    items: [['helpdesk', 1, 1], ['snack', 7, 0], ['nappod', 10, 0], ['nappod', 10, 2], ['pingpong', 3, 6], ['arcade', 11, 6], ['arcade', 12, 6], ['plant', 0, 11], ['sofa', 5, 11]]},
];

// ---------- Pixel-art sprites (original, generated per character) ----------
const SW = 18, SH = 21;
function palette(base, k) {
  return {
    o: mix(base, '#000000', .8), s: mix(base, '#ffffff', [.88, .8, .72][k % 3]), S: mix(base, '#ffffff', [.68, .6, .52][k % 3]),
    c: base, C: mix(base, '#000000', .3), p: mix(base, '#000000', .58), m: mix(base, '#d0354f', .6), b: mix(base, '#ff7d93', .45),
    w: mix(base, '#ffffff', .93), h: [mix(base, '#000000', .5), mix(base, '#000000', .22), mix(base, '#ffffff', .3), mix(base, '#000000', .7)][Math.floor(k / 3) % 4],
  };
}
function makeSprites(base, k) {
  const pal = palette(base, k);
  const hair = (k * 7 + 3) % 11, eyes = Math.floor(k / 2) % 4, shirt = Math.floor(k / 3) % 7, pose = Math.floor(k / 5) % 4, glasses = k % 7 === 3, blush = k % 4 === 1;
  return [0, 1, 2].map(frame => {
    const g = Array.from({length: SH}, () => Array(SW).fill(''));
    const set = (x, y, v) => { x += 1; y += 2; if (x >= 0 && x < SW && y >= 0 && y < SH) g[y][x] = v; };
    const fill = (x0, y0, x1, y1, v) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, v); };
    if (hair === 3) { fill(2, 3, 3, 11, 'h'); fill(12, 3, 13, 11, 'h'); }
    // Legs (walk cycle lifts one foot).
    fill(5, 15, 6, frame === 1 ? 15 : 16, 'p');
    fill(9, 15, 10, frame === 2 ? 15 : 16, 'p');
    fill(5, 10, 10, 14, 'c');
    if (shirt === 1) { fill(5, 11, 10, 11, 'C'); fill(5, 13, 10, 13, 'C'); }
    if (shirt === 2) for (let y = 11; y <= 14; y++) for (let x = 5; x <= 10; x++) if ((x + y) % 2) set(x, y, 'C');
    if (shirt === 3) { set(7, 11, 'C'); set(7, 13, 'C'); }
    if (shirt === 4) { set(7, 10, 's'); set(8, 10, 's'); }
    if (shirt === 5) { fill(5, 13, 10, 14, 'C'); fill(6, 10, 6, 12, 'C'); fill(9, 10, 9, 12, 'C'); }
    if (shirt === 6) fill(6, 11, 9, 13, 'w');
    const leftDown = () => { fill(4, 10, 4, 13, 'c'); set(4, 14, 's'); };
    if (pose === 0) { leftDown(); fill(11, 10, 11, 13, 'c'); set(11, 14, 's'); }
    if (pose === 1) { leftDown(); set(11, 10, 'c'); set(12, 9, 'c'); set(13, 8, 's'); set(13, 7, 's'); }
    if (pose === 2) { leftDown(); set(11, 10, 'c'); fill(11, 11, 12, 11, 'c'); set(13, 11, 's'); }
    if (pose === 3) { set(4, 10, 'c'); fill(3, 11, 4, 11, 'c'); set(2, 11, 's'); set(11, 10, 'c'); fill(11, 11, 12, 11, 'c'); set(13, 11, 's'); }
    // Head with shaded side.
    fill(3, 2, 12, 9, 's');
    fill(3, 3, 3, 8, 'S');
    for (const [x, y] of [[3, 2], [12, 2], [3, 9], [12, 9]]) set(x, y, '');
    const short = () => { fill(4, 1, 11, 1, 'h'); fill(3, 2, 12, 2, 'h'); fill(3, 3, 5, 3, 'h'); fill(9, 3, 12, 3, 'h'); set(3, 4, 'h'); set(12, 4, 'h'); };
    const bob = () => { fill(4, 1, 11, 1, 'h'); fill(3, 2, 12, 3, 'h'); fill(3, 4, 3, 8, 'h'); fill(12, 4, 12, 8, 'h'); fill(4, 4, 6, 4, 'h'); };
    if (hair === 0) short();
    if (hair === 1 || hair === 3) bob();
    if (hair === 2) { [4, 6, 8, 10].forEach(x => set(x, 0, 'h')); fill(4, 1, 11, 1, 'h'); fill(3, 2, 12, 3, 'h'); set(6, 3, 's'); set(9, 3, 's'); }
    if (hair === 4) { short(); fill(13, 2, 14, 7, 'h'); }
    if (hair === 5) { short(); fill(6, -1, 9, 0, 'h'); }
    if (hair === 6) { fill(4, 1, 11, 1, 'C'); fill(3, 2, 12, 2, 'C'); fill(2, 3, 13, 3, 'C'); }
    if (hair === 7) { fill(4, 1, 11, 1, 'h'); fill(3, 2, 12, 2, 'h'); fill(3, 3, 12, 3, 'C'); }
    if (hair === 8) { fill(3, 5, 3, 6, 'h'); fill(12, 5, 12, 6, 'h'); fill(5, 2, 6, 2, 'w'); }
    if (hair === 9) { short(); fill(3, 1, 12, 1, 'h'); for (const x of [3, 4, 11, 12]) set(x, 0, 'h'); }
    if (hair === 10) { [5, 7, 9].forEach(x => set(x, 0, 'h')); fill(3, 1, 12, 1, 'h'); fill(2, 2, 13, 3, 'h'); fill(2, 4, 2, 6, 'h'); fill(13, 4, 13, 6, 'h'); }
    // Thick dark outline around every filled shape.
    const snap = g.map(row => row.slice());
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (snap[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => snap[y + dy]?.[x + dx])) g[y][x] = 'o';
    }
    // Face.
    if (glasses) {
      fill(4, 5, 7, 5, 'o'); fill(9, 5, 12, 5, 'o'); fill(4, 7, 7, 7, 'o'); fill(9, 7, 12, 7, 'o');
      for (const x of [4, 7, 9, 12]) set(x, 6, 'o');
      set(8, 5, 'o'); set(6, 6, 'o'); set(11, 6, 'o');
    } else if (eyes === 0) { set(5, 6, 'o'); set(5, 7, 'o'); set(10, 6, 'o'); set(10, 7, 'o'); }
    else if (eyes === 1) { for (const [x, y] of [[4, 7], [5, 6], [6, 7], [9, 7], [10, 6], [11, 7]]) set(x, y, 'o'); }
    else if (eyes === 2) { fill(4, 6, 6, 6, 'o'); fill(9, 6, 11, 6, 'o'); }
    else { set(6, 6, 'o'); set(6, 7, 'o'); set(11, 6, 'o'); set(11, 7, 'o'); }
    set(7, 8, 'm');
    if (eyes !== 1) set(8, 8, 'm');
    if (blush) { set(4, 8, 'b'); set(11, 8, 'b'); }
    const cv = document.createElement('canvas');
    cv.width = SW;
    cv.height = SH;
    const g2 = cv.getContext('2d');
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (!g[y][x]) continue;
      g2.fillStyle = pal[g[y][x]];
      g2.fillRect(x, y, 1, 1);
    }
    return cv;
  });
}

// ---------- Floors: desks, amenities and a walkable tile grid ----------
function layoutDesks(style, n) {
  const desks = [], seats = [], X0 = 9, Y0 = 4;
  if (style === 'rows') {
    const cols = clamp(Math.ceil(Math.sqrt(n * 1.4)), 3, 7);
    for (let k = 0; k < n; k++) {
      const c = X0 + (k % cols) * 4, r = Y0 + Math.floor(k / cols) * 5, desk = {c, r, w: 3, h: 2};
      desks.push(desk);
      seats.push({c: c + 1, r: r + 2, x: (c + 1.5) * T, y: (r + 2.8) * T, desk});
    }
  } else if (style === 'pods') {
    const ucols = clamp(Math.ceil(Math.sqrt(Math.ceil(n / 4) * 1.5)), 1, 4);
    for (let k = 0; k < n; k++) {
      const u = Math.floor(k / 4), q = k % 4, px = X0 + (u % ucols) * 8, py = Y0 + 1 + Math.floor(u / ucols) * 8;
      const c = px + (q % 2) * 3, top = q < 2, desk = {c, r: top ? py : py + 2, w: 3, h: 2, seatAbove: top};
      desks.push(desk);
      seats.push(top ? {c: c + 1, r: py - 1, x: (c + 1.5) * T, y: py * T + 12, desk} : {c: c + 1, r: py + 4, x: (c + 1.5) * T, y: (py + 4.8) * T, desk});
    }
  } else {
    const ucols = clamp(Math.ceil(Math.sqrt(Math.ceil(n / 8))), 1, 3), benches = new Map();
    for (let k = 0; k < n; k++) {
      const u = Math.floor(k / 8), q = k % 8, bx = X0 + (u % ucols) * 14, by = Y0 + 1 + Math.floor(u / ucols) * 7;
      if (!benches.has(u)) {
        const desk = {c: bx, r: by, w: 12, h: 2, bench: true, seatsAt: []};
        benches.set(u, desk);
        desks.push(desk);
      }
      const desk = benches.get(u), top = q < 4, c = bx + 1 + (q % 4) * 3;
      const seat = top ? {c, r: by - 1, x: (c + .5) * T, y: by * T + 12, desk, above: true} : {c, r: by + 2, x: (c + .5) * T, y: (by + 2.8) * T, desk};
      desk.seatsAt.push(seat);
      seats.push(seat);
    }
  }
  return {desks, seats};
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function buildFloor(i) {
  const th = themes[i], records = data.filter(r => r['Primary category'] === names[i]);
  const {desks, seats} = layoutDesks(th.style, records.length);
  const maxC = Math.max(12, ...desks.map(d => d.c + d.w - 1)), maxR = Math.max(8, ...desks.map(d => d.r + d.h - 1), ...seats.map(s => s.r));
  const ax0 = maxC + 3, C = ax0 + 15, R = Math.max(17, maxR + 3), mid = Math.floor(R / 2);
  const f = {i, th, label: labels[i], color: colors[i], records, desks, seats, ax0, C, R, w: C * T, h: R * T, items: [], spots: [], meet: [], liftOpen: 0};
  f.blocked = new Uint8Array(C * R);
  const block = (c, r, w = 1, h = 1) => { for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) if (x >= 0 && y >= 0 && x < C && y < R) f.blocked[y * C + x] = 1; };
  block(0, 0, C, 3);
  for (let r = 3; r < R; r++) if (![3, 4, mid - 1, mid, mid + 1].includes(r)) block(7, r);
  for (const d of desks) block(d.c, d.r, d.w, d.h);
  const place = (type, c, r) => {
    const spec = ITEMS[type], it = {type, c, r, w: spec.w, h: spec.h, spec};
    f.items.push(it);
    if (!spec.floor) block(c, r, spec.w, spec.h);
    for (const [dx, dy, act] of spec.spots) {
      const sc = c + dx, sr = r + dy, onItem = dx >= 0 && dy >= 0 && dx < spec.w && dy < spec.h;
      f.spots.push({c: sc, r: sr, x: (sc + .5) * T, y: (sr + (onItem ? .7 : .8)) * T, act, item: it, floor: i, occupant: null});
    }
  };
  place('sofa', 1, R - 3);
  place('cooler', 5, 6);
  place('plant', 5, R - 2);
  for (const [type, dx, dy] of th.items) place(type, ax0 + dx, 3 + dy);
  f.lift = {c: 3, r: 3, x: 3.5 * T, y: 3.75 * T};
  // Keep only spots and seats reachable from the lift.
  const seen = new Uint8Array(C * R), queue = [f.lift.r * C + f.lift.c];
  seen[queue[0]] = 1;
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h] % C, r = Math.floor(queue[h] / C);
    for (const [dx, dy] of DIRS) {
      const n = (r + dy) * C + c + dx;
      if (c + dx < 0 || c + dx >= C || r + dy < 0 || r + dy >= R || seen[n] || f.blocked[n]) continue;
      seen[n] = 1;
      queue.push(n);
    }
  }
  const reachable = (c, r) => seen[r * C + c] || DIRS.some(([dx, dy]) => seen[(r + dy) * C + c + dx]);
  const dropped = f.spots.filter(s => !reachable(s.c, s.r));
  if (dropped.length) console.warn(`L${i + 1}: dropped unreachable spots`, dropped.map(s => s.act));
  f.spots = f.spots.filter(s => reachable(s.c, s.r));
  for (const s of seats) if (!seen[s.r * C + s.c]) console.warn(`L${i + 1}: unreachable seat at ${s.c},${s.r}`);
  // Meeting points: pairs of side-by-side tiles in open floor space.
  const used = new Set([...seats, ...f.spots].map(s => s.r * C + s.c));
  const open = (c, r) => r > 3 && c < C - 1 && !used.has(r * C + c) && [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => seen[(r + dy) * C + c + dx] && !f.blocked[(r + dy) * C + c + dx]));
  for (let r = 4; r < R - 1; r++) for (let c = 1; c < C - 2; c++) if (open(c, r) && open(c + 1, r)) f.meet.push({c, r, busy: false});
  return f;
}
const floors = names.map((_, i) => buildFloor(i));

function findPath(f, sc, sr, gc, gr) {
  const {C, R, blocked} = f;
  sc = clamp(sc, 0, C - 1);
  sr = clamp(sr, 3, R - 1);
  const start = sr * C + sc, goal = gr * C + gc;
  if (start === goal) return [];
  const prev = new Int32Array(C * R).fill(-1), queue = [start];
  prev[start] = start;
  for (let h = 0; h < queue.length && prev[goal] === -1; h++) {
    const c = queue[h] % C, r = Math.floor(queue[h] / C);
    for (const [dx, dy] of DIRS) {
      const nc = c + dx, nr = r + dy, n = nr * C + nc;
      if (nc < 0 || nr < 0 || nc >= C || nr >= R || prev[n] !== -1 || (blocked[n] && n !== goal)) continue;
      prev[n] = queue[h];
      queue.push(n);
    }
  }
  if (prev[goal] === -1) return null;
  const tiles = [];
  for (let n = goal; n !== start; n = prev[n]) tiles.push({c: n % C, r: Math.floor(n / C)});
  return tiles.reverse();
}

// ---------- People and their network ----------
const people = [];
floors.forEach(f => f.records.forEach((r, j) => {
  const seat = f.seats[j], k = people.length;
  people.push({r, home: f.i, floor: f.i, seat, x: seat.x, y: seat.y, dir: 1, state: 'desk', timer: 2 + (k * 7 % 29), path: [],
    sprites: makeSprites(f.color, k), visible: true, hidden: false, links: [], lastChat: -60, k});
}));

function relate(a, b) {
  const reasons = [];
  let score = 0;
  const tb = new Set(splitList(b.r['AI activity tags']));
  for (const t of splitList(a.r['AI activity tags'])) if (tb.has(t)) { score += 2; reasons.push({type: 'tag', value: t}); }
  if (a.r.Subcategory && a.r.Subcategory === b.r.Subcategory) { score += 2; reasons.push({type: 'subcat', value: a.r.Subcategory}); }
  if (splitList(a.r['Secondary category tags']).includes(b.r['Primary category']) || splitList(b.r['Secondary category tags']).includes(a.r['Primary category'])) { score += 2; reasons.push({type: 'cross'}); }
  const toolsB = new Set(splitList(b.r['Technologies and/or Tools Used']).map(t => t.toLowerCase()));
  for (const t of splitList(a.r['Technologies and/or Tools Used'])) if (toolsB.has(t.toLowerCase())) { score += 1; reasons.push({type: 'tool', value: t}); }
  return {score, reasons};
}
for (let x = 0; x < people.length; x++) for (let y = x + 1; y < people.length; y++) {
  const rel = relate(people[x], people[y]);
  if (rel.score < 3) continue;
  people[x].links.push({p: people[y], ...rel});
  people[y].links.push({p: people[x], ...rel});
}
for (const p of people) p.links = p.links.sort((a, b) => b.score - a.score).slice(0, 8);
// Keep links symmetric after capping.
for (const p of people) p.links = p.links.filter(l => l.p.links.some(m => m.p === p));
const edges = [];
for (const p of people) for (const l of p.links) if (p.k < l.p.k) edges.push({a: p, b: l.p, score: l.score});

function reasonText(reasons) {
  return reasons.map(r => r.type === 'tag' ? r.value : r.type === 'subcat' ? `same ${r.value.toLowerCase()}` : r.type === 'cross' ? 'linked categories' : `both use ${r.value}`).join(' · ');
}
function chatLines(reasons) {
  const r = reasons[0];
  if (r.type === 'tag') return [`You use AI for ${r.value.split(' /')[0].toLowerCase()} too?`, 'Yes! Swap prompts?', "Deal — let's pair up!"];
  if (r.type === 'subcat') return [`Same ${r.value.toLowerCase()} challenge!`, 'We should team up.', 'Lunch & learn?'];
  if (r.type === 'cross') return ['My work feeds into yours!', "Let's link our flows.", 'Great idea!'];
  return [`Any tips for ${r.value.split(' /')[0]}?`, 'Happy to share mine!', 'Thanks, you rock!'];
}

// ---------- Movement ----------
const tileOf = p => ({c: Math.floor(p.x / T), r: Math.floor(p.y / T)});
function goTo(p, floor, point, tile, onArrive) {
  p.dest = {floor, point, tile, onArrive};
  route(p);
}
function route(p) {
  const f = floors[p.floor], d = p.dest, here = tileOf(p);
  const target = d.floor === p.floor ? d.tile : f.lift;
  const tiles = findPath(f, here.c, here.r, target.c, target.r);
  if (!tiles) {
    // Should not happen after the reachability check; fall back to teleporting home.
    console.warn('No path', p.r['Submission ID']);
    Object.assign(p, {floor: p.home, x: p.seat.x, y: p.seat.y, state: 'desk', timer: 10, path: []});
    return;
  }
  const pts = tiles.map(t => ({x: (t.c + .5) * T, y: (t.r + .65) * T}));
  if (d.floor === p.floor) pts.push({...d.point, end: true});
  else pts.push({x: f.lift.x, y: f.lift.y, lift: true});
  // Drop collinear waypoints.
  p.path = pts.filter((q, n) => n === 0 || n === pts.length - 1 || !((pts[n - 1].x === q.x && pts[n + 1].x === q.x) || (pts[n - 1].y === q.y && pts[n + 1].y === q.y)));
  p.state = 'walk';
}
function goHome(p) {
  goTo(p, p.home, {x: p.seat.x, y: p.seat.y}, p.seat, () => {
    p.state = 'desk';
    p.timer = rnd(16, 40);
  });
}
function chooseActivity(p) {
  const fi = Math.random() < .15 ? Math.floor(Math.random() * 7) : p.home;
  const free = floors[fi].spots.filter(s => !s.occupant);
  if (!free.length) { p.timer = rnd(5, 10); return; }
  const s = pick(free);
  s.occupant = p;
  p.spot = s;
  goTo(p, fi, {x: s.x, y: s.y}, s, () => {
    p.state = 'act';
    p.act = s.act;
    p.timer = rnd(acts[s.act][2], acts[s.act][3]);
  });
}
function update(p, dt, now) {
  if (paused || ($('details').open && selected === p)) return;
  if (p.state === 'desk') {
    p.timer -= dt;
    if (p.timer <= 0) chooseActivity(p);
  } else if (p.state === 'act') {
    p.timer -= dt;
    if (p.timer <= 0) {
      if (p.spot) p.spot.occupant = null;
      p.spot = null;
      p.act = null;
      goHome(p);
    }
  } else if (p.state === 'lift') {
    p.timer -= dt;
    if (p.timer <= 0) {
      const f = floors[p.dest.floor];
      Object.assign(p, {floor: f.i, x: f.lift.x, y: f.lift.y, hidden: false});
      f.liftOpen = now + 1.2;
      route(p);
    }
  } else if (p.state === 'walk') {
    let step = SPEED * dt;
    while (step > 0 && p.path.length) {
      const t = p.path[0], dx = t.x - p.x, dy = t.y - p.y, dist = Math.hypot(dx, dy);
      if (Math.abs(dx) > .5) p.dir = dx > 0 ? 1 : -1;
      if (dist <= step) {
        p.x = t.x;
        p.y = t.y;
        step -= dist;
        p.path.shift();
        if (t.lift) {
          floors[p.floor].liftOpen = now + 1.2;
          Object.assign(p, {state: 'lift', hidden: true, timer: 1.4 + Math.abs(p.dest.floor - p.floor) * .35});
          return;
        }
        if (t.end) {
          p.state = 'arrived';
          p.dest.onArrive();
          return;
        }
      } else {
        p.x += dx / dist * step;
        p.y += dy / dist * step;
        step = 0;
      }
    }
  }
}

// ---------- Conversations between related staff ----------
const chats = [], recent = [];
let chatClock = 0;
function scheduleChat(now) {
  if (chats.length >= 4) return;
  const ready = p => p.state === 'desk' && now - p.lastChat > 40 && p.timer > 3;
  const pool = people.filter(p => ready(p) && p.links.some(l => ready(l.p)));
  if (!pool.length) return;
  const a = pick(pool), options = a.links.filter(l => ready(l.p)), link = options[Math.floor(Math.random() * Math.min(options.length, 3))];
  const b = link.p, f = floors[Math.random() < .5 ? a.home : b.home], free = f.meet.filter(m => !m.busy);
  if (!free.length) return;
  const m = pick(free);
  m.busy = true;
  const chat = {a, b, f, m, reasons: link.reasons, lines: chatLines(link.reasons), phase: 'gather', t: 0, start: now};
  chats.push(chat);
  a.chat = b.chat = chat;
  a.lastChat = b.lastChat = now;
  const arrive = (p, dir) => () => { p.state = 'wait'; p.dir = dir; };
  goTo(a, f.i, {x: (m.c + .5) * T, y: (m.r + .8) * T}, {c: m.c, r: m.r}, arrive(a, 1));
  goTo(b, f.i, {x: (m.c + 1.5) * T, y: (m.r + .8) * T}, {c: m.c + 1, r: m.r}, arrive(b, -1));
  renderChats();
}
function updateChat(chat, dt, now) {
  if (chat.phase === 'gather') {
    if (chat.a.state === 'wait' && chat.b.state === 'wait') {
      chat.phase = 'talk';
      chat.a.state = chat.b.state = 'chat';
    } else if (now - chat.start > 50) endChat(chat, now, true);
    return;
  }
  if (!paused) chat.t += dt;
  if (chat.t > chat.lines.length * 2.6 + 2) endChat(chat, now, false);
}
function endChat(chat, now, cancelled) {
  chats.splice(chats.indexOf(chat), 1);
  chat.m.busy = false;
  for (const p of [chat.a, chat.b]) {
    p.chat = null;
    p.lastChat = now;
    goHome(p);
  }
  if (!cancelled) {
    recent.unshift({a: chat.a, b: chat.b, reasons: chat.reasons, floor: chat.f.i});
    recent.length = Math.min(recent.length, 6);
  }
  renderChats();
}
function renderChats() {
  const entry = (a, b, reasons, floor, live) => {
    const btn = document.createElement('button');
    btn.className = 'chat';
    btn.textContent = `${live ? '💬' : '♥'} ${a.r['Submission ID']} ↔ ${b.r['Submission ID']} · L${floor + 1}`;
    const s = document.createElement('small');
    s.textContent = reasonText(reasons);
    btn.append(s);
    btn.onclick = () => focusPerson(a, false);
    return btn;
  };
  $('chats').replaceChildren(...chats.map(c => entry(c.a, c.b, c.reasons, c.f.i, true)), ...recent.slice(0, Math.max(0, 5 - chats.length)).map(c => entry(c.a, c.b, c.reasons, c.floor, false)));
}

// ---------- State and camera ----------
let view = -1, selected = null, hover = null, hoverFloor = -1, follow = false, paused = false, network = false;
const cam = {x: BW / 2, y: BH / 2, z: 1}, target = {...cam};
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.tabIndex = 0;
world.prepend(canvas);
const ctx = canvas.getContext('2d');
let W = 0, H = 0, dpr = 1;
const PAD = {l: 16, r: 84, t: 62, b: 20};

const centre = () => ({x: (PAD.l + W - PAD.r) / 2, y: (PAD.t + H - PAD.b) / 2});
function toWorld(sx, sy) {
  const c = centre();
  return {x: cam.x + (sx - c.x) / cam.z, y: cam.y + (sy - c.y) / cam.z};
}
const bounds = () => view < 0 ? {x: -20, y: 0, w: BW + 140, h: BH} : {x: -T, y: -T, w: floors[view].w + 2 * T, h: floors[view].h + 2 * T};
function fitZoom() {
  const b = bounds();
  return Math.max(.05, Math.min((W - PAD.l - PAD.r) / b.w, (H - PAD.t - PAD.b) / b.h));
}
function fit(instant = false) {
  const b = bounds();
  Object.assign(target, {x: b.x + b.w / 2, y: b.y + b.h / 2, z: fitZoom()});
  if (instant) Object.assign(cam, target);
}
const clampZoom = z => Math.min(5, Math.max(fitZoom() * .6, z));
function zoomBy(f, sx = centre().x, sy = centre().y) {
  follow = false;
  const before = toWorld(sx, sy), z = clampZoom(target.z * f), c = centre();
  Object.assign(target, {z, x: before.x - (sx - c.x) / z, y: before.y - (sy - c.y) / z});
}

// ---------- Views, filters, sidebar ----------
function enter(i, keepFollow = false) {
  view = i;
  hover = null;
  if (!keepFollow) follow = false;
  fit();
  refresh();
  history.replaceState(null, '', i < 0 ? location.pathname : '#L' + (i + 1));
}
const currentFloor = p => p.hidden && p.dest ? p.dest.floor : p.floor;

function refresh() {
  const q = $('search').value.toLowerCase(), tag = $('tags').value;
  for (const p of people) {
    p.visible = (!q || JSON.stringify(p.r).toLowerCase().includes(q)) && (!tag || splitList(p.r['AI activity tags']).includes(tag));
  }
  const list = people.filter(p => p.visible && (view < 0 || p.home === view));
  $('directory').replaceChildren(...list.map(p => {
    const b = document.createElement('button');
    b.className = 'entry';
    b.textContent = p.r['Suggested use case title'];
    const s = document.createElement('small');
    s.textContent = `${p.r['Submission ID']} · L${p.home + 1} · ${p.links.length} related`;
    b.append(s);
    b.onclick = () => focusPerson(p, true);
    return b;
  }));
  const filtered = !!(q || tag), total = people.filter(p => p.visible).length;
  $('count').textContent = view < 0 ? `${list.length} matching use cases` : `${list.length} matching on L${view + 1}` + (filtered ? ` · ${total} in building` : '');
  for (const b of document.querySelectorAll('[data-level]')) {
    const i = Number(b.dataset.level);
    b.classList.toggle('active', i === view);
    b.setAttribute('aria-pressed', String(i === view));
    const counter = b.querySelector('b');
    if (counter) {
      const pool = i < 0 ? people : people.filter(p => p.home === i), shown = pool.filter(p => p.visible).length;
      counter.textContent = filtered ? `${shown}/${pool.length}` : pool.length;
    }
  }
  $('fit').textContent = view < 0 ? 'Fit building' : 'Fit floor';
  $('help').textContent = view < 0
    ? 'Click a level to step inside • Drag to pan • Scroll to zoom • N toggles the network'
    : `${floors[view].th.name} • Click a staff member for their use case • Drag to pan • Scroll to zoom • Esc for building view`;
  canvas.setAttribute('aria-label', view < 0
    ? `Building view: seven levels, ${people.length} staff, ${edges.length} links between related use cases. Use the level buttons or the use-case list to explore.`
    : `Level ${view + 1}, ${floors[view].th.name}: ${labels[view]}, ${floors[view].records.length} staff. Use the use-case list to open a record.`);
}

function focusPerson(p, open) {
  const fl = currentFloor(p);
  if (view !== fl) enter(fl);
  selected = p;
  Object.assign(target, {x: p.x, y: p.y - 20, z: clampZoom(Math.max(target.z, 1.6))});
  if (open) show(p);
}

function levelButton(parent, i, text, cls) {
  const b = document.createElement('button');
  b.className = cls;
  b.dataset.level = i;
  b.style.setProperty('--color', i < 0 ? '#9ab1c8' : colors[i]);
  b.textContent = text;
  if (cls === 'department') b.append(document.createElement('b'));
  else b.title = `Level ${i + 1}: ${labels[i]} (${themes[i].name})`;
  b.onclick = () => enter(i);
  parent.append(b);
}
levelButton($('departments'), -1, 'Whole building', 'department');
floors.forEach(f => levelButton($('departments'), f.i, `L${f.i + 1} · ${f.label}`, 'department'));
for (let i = 6; i >= 0; i--) levelButton($('levels'), i, 'L' + (i + 1), 'level');

[...new Set(data.flatMap(r => splitList(r['AI activity tags'])))].sort().forEach(t => {
  const o = document.createElement('option');
  o.value = t;
  o.textContent = t;
  $('tags').append(o);
});
$('search').oninput = refresh;
$('tags').onchange = refresh;
$('stats').textContent = `${data.length} staff · ${edges.length} links · SQLite register`;

// ---------- Details dialog ----------
function field(label, value) {
  const section = document.createElement('section');
  section.className = 'field';
  const h = document.createElement('h3');
  h.textContent = label;
  const p = document.createElement('p');
  p.textContent = value || 'Not provided';
  section.append(h, p);
  return section;
}
function activityText(p) {
  if (p.state === 'act' && p.act) return acts[p.act][1];
  if (p.chat) return `meeting ${(p.chat.a === p ? p.chat.b : p.chat.a).r['Submission ID']}`;
  if (p.state === 'lift') return 'in the lift';
  if (p.state === 'desk') return 'at their desk';
  if (p.floor !== p.home) return `visiting L${p.floor + 1}`;
  return 'walking around';
}
function show(p) {
  selected = p;
  $('caseid').textContent = `${p.r['Submission ID']} · Source row ${p.r['Original Excel row']} · Level ${p.home + 1}`;
  $('title').textContent = p.r['Suggested use case title'];
  $('meta').textContent = p.r['Primary category'];
  const body = $('body');
  body.replaceChildren(field('Submitted by', p.r.Name));
  const tags = document.createElement('div');
  [p.r.Subcategory, ...splitList(p.r['AI activity tags'])].filter(Boolean).forEach(t => {
    const span = document.createElement('span');
    span.className = 'pill';
    span.textContent = t;
    tags.append(span);
  });
  body.append(tags);
  for (const [label, key] of [['Problem / opportunity', 'Briefly describe the problem, need or opportunity that prompted your use case.'], ['Solution', 'Briefly describe what you did to address the problem, need or opportunity above.'], ['Tools', 'Technologies and/or Tools Used'], ['Reported impact', 'How has this use case improved your work?'], ['Implementation status (as submitted)', 'Is this use case currently being implemented as part of your work processes?'], ['Secondary tags', 'Secondary category tags'], ['Supporting filename (attachment not included)', 'Have something to show us?'], ['Timestamp', 'Response Timestamp'], ['Grouping notes', 'Review note']]) {
    body.append(field(label, p.r[key]));
  }
  const rel = document.createElement('section');
  rel.className = 'field';
  const h = document.createElement('h3');
  h.textContent = `Related use cases (${p.links.length})`;
  rel.append(h);
  if (!p.links.length) rel.append(Object.assign(document.createElement('p'), {textContent: 'No closely related submissions found.'}));
  for (const l of p.links) {
    const b = document.createElement('button');
    b.className = 'related';
    b.style.setProperty('--color', colors[l.p.home]);
    b.textContent = `${l.p.r['Submission ID']} · ${l.p.r['Suggested use case title']}`;
    const s = document.createElement('small');
    s.textContent = `L${l.p.home + 1} · ${reasonText(l.reasons)}`;
    b.append(s);
    b.onclick = () => focusPerson(l.p, true);
    rel.append(b);
  }
  body.append(rel);
  body.append(field('Right now (fictional character)', activityText(p)));
  if (!$('details').open) $('details').showModal();
  body.parentElement.scrollTop = 0;
}
$('close').onclick = () => $('details').close();

// ---------- Toolbar ----------
$('home').onclick = () => enter(-1);
$('fit').onclick = () => { follow = false; fit(); };
$('zoomin').onclick = () => zoomBy(1.25);
$('zoomout').onclick = () => zoomBy(.8);
$('pause').onclick = () => {
  paused = !paused;
  $('pause').textContent = paused ? 'Resume staff' : 'Pause staff';
  $('pause').setAttribute('aria-pressed', String(paused));
};
function toggleNetwork() {
  network = !network;
  $('network').textContent = network ? 'Hide network' : 'Show network';
  $('network').setAttribute('aria-pressed', String(network));
}
$('network').onclick = toggleNetwork;
$('follow').onclick = () => {
  if (!selected) {
    $('help').textContent = 'Select a staff member first, then choose Follow selected.';
    return;
  }
  follow = !follow;
  $('follow').setAttribute('aria-pressed', String(follow));
  if (follow) {
    if (view !== currentFloor(selected)) enter(currentFloor(selected), true);
    target.z = clampZoom(Math.max(target.z, 1.6));
  }
};

// ---------- Pointer and keyboard ----------
function pickAt(sx, sy) {
  const w = toWorld(sx, sy);
  if (view < 0) {
    const k = Math.floor((w.y - ROOF) / FH);
    return {floor: w.x >= 0 && w.x <= BW && k >= 0 && k < 7 ? 6 - k : -1, person: null};
  }
  let best = null, bestY = -Infinity;
  for (const p of people) {
    if (p.floor !== view || p.hidden || !p.visible) continue;
    if (Math.abs(w.x - p.x) < 15 && w.y < p.y + 2 && w.y > p.y - 40 && p.y > bestY) [best, bestY] = [p, p.y];
  }
  return {floor: -1, person: best};
}

let drag = null, mouse = null;
const local = e => {
  const r = canvas.getBoundingClientRect();
  return {x: e.clientX - r.left, y: e.clientY - r.top};
};
canvas.addEventListener('pointerdown', e => {
  drag = {...local(e), camX: target.x, camY: target.y, moved: false};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  mouse = local(e);
  if (!drag) return;
  if (Math.hypot(mouse.x - drag.x, mouse.y - drag.y) > 4) drag.moved = true;
  if (drag.moved) {
    follow = false;
    target.x = cam.x = drag.camX - (mouse.x - drag.x) / cam.z;
    target.y = cam.y = drag.camY - (mouse.y - drag.y) / cam.z;
  }
});
canvas.addEventListener('pointerup', e => {
  const m = local(e);
  if (drag && !drag.moved) {
    const hit = pickAt(m.x, m.y);
    if (hit.floor >= 0) enter(hit.floor);
    else if (hit.person) show(hit.person);
  }
  drag = null;
});
canvas.addEventListener('pointerleave', () => { mouse = null; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const m = local(e);
  zoomBy(Math.exp(-e.deltaY * .0015), m.x, m.y);
}, {passive: false});

window.addEventListener('keydown', e => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) || $('details').open || e.ctrlKey || e.metaKey || e.altKey) return;
  const step = 60 / cam.z, moves = {ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step]};
  if (moves[e.key]) {
    follow = false;
    target.x += moves[e.key][0];
    target.y += moves[e.key][1];
  } else if (e.key === '+' || e.key === '=') zoomBy(1.25);
  else if (e.key === '-') zoomBy(.8);
  else if (e.key === '0') fit();
  else if (e.key.toLowerCase() === 'n') toggleNetwork();
  else if (e.key === 'Escape' && view >= 0) enter(-1);
  else if (/^[1-7]$/.test(e.key) && document.activeElement === canvas) enter(Number(e.key) - 1);
  else return;
  e.preventDefault();
});

// ---------- Drawing helpers ----------
const LINE = '#8f97bd', LIGHT = '#f6f7fb', MID = '#b4bad6', DARK = '#6f789f';
function rect(x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}
function box(x, y, w, h, fill, line = LINE, lw = 2) {
  rect(x, y, w, h, fill);
  if (!line) return;
  ctx.strokeStyle = line;
  ctx.lineWidth = lw;
  ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
}
function circle(x, y, r, c) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}
function text(s, x, y, size, c, align = 'left', weight = 'bold') {
  ctx.fillStyle = c;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}
const HEART = ['.##.##.', '#hh#hh#', '#hhhhh#', '.#hhh#.', '..#h#..', '...#...'];
function heart(x, y, s, fill, line) {
  HEART.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    rect(x + (i - 3.5) * s, y + j * s, s, s, ch === '#' ? line : fill);
  }));
}
function wrap(str, max) {
  const words = str.split(' '), lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > max && line) { lines.push(line); line = w; } else line = test;
  }
  lines.push(line);
  return lines;
}
function bubble(x, y, str) {
  ctx.font = '600 9px system-ui, sans-serif';
  const lines = wrap(str, 104), w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 12, h = lines.length * 11 + 8;
  const bx = x - w / 2, by = y - h - 6;
  box(bx, by, w, h, '#ffffff', '#4b5675', 1.5);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x - 4, by + h - 1);
  ctx.lineTo(x, by + h + 5);
  ctx.lineTo(x + 4, by + h - 1);
  ctx.fill();
  ctx.strokeStyle = '#4b5675';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 4, by + h);
  ctx.lineTo(x, by + h + 5);
  ctx.lineTo(x + 4, by + h);
  ctx.stroke();
  lines.forEach((l, n) => text(l, x, by + 9.5 + n * 11, 9, '#1d2433', 'center', '600'));
}
function emote(x, y, icon) {
  box(x - 10, y - 22, 20, 18, '#ffffff', '#4b5675', 1.5);
  ctx.font = '11px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x, y - 12.5);
}
function plant(x, y, s = 1) {
  box(x - 7 * s, y - 2 * s, 14 * s, 12 * s, '#c79b70', '#7d5a3f', 1.5);
  circle(x, y - 8 * s, 10 * s, '#5f9a6c');
  circle(x - 5 * s, y - 12 * s, 6 * s, '#83b88b');
  circle(x + 5 * s, y - 13 * s, 5 * s, '#4f8a5c');
}

function drawPerson(p, time, scale = 1) {
  const walking = p.state === 'walk' && !paused;
  const frame = walking ? 1 + Math.floor(time * 7 + p.k) % 2 : 0;
  const bob = walking && frame === 1 ? -1 : 0;
  const s = PX * scale, w = SW * s, h = SH * s;
  ctx.globalAlpha = p.visible ? 1 : .18;
  ctx.fillStyle = 'rgba(40,45,80,.18)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 10 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  if (scale === 1 && (p === selected || p === hover)) {
    ctx.strokeStyle = p === selected ? '#ff9f1c' : '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 15, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y + bob * s));
  if (p.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(p.sprites[frame], -w / 2, -h + 2 * s, w, h);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------- Floor rendering ----------
function drawFloorSurface(f) {
  const {C, R, th} = f, y0 = 3 * T, fw = C * T, fh = (R - 3) * T;
  const lobbyW = 7 * T;
  // Lobby always uses the light tile floor, like the reference office.
  rect(0, y0, lobbyW + T, fh, '#d4d8e2');
  ctx.strokeStyle = '#bcc2d5';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 14]);
  for (let x = 0; x <= lobbyW + T; x += T) { ctx.beginPath(); ctx.moveTo(x, y0 + 5); ctx.lineTo(x, y0 + fh); ctx.stroke(); }
  for (let y = y0; y <= y0 + fh; y += T) { ctx.beginPath(); ctx.moveTo(5, y); ctx.lineTo(lobbyW + T, y); ctx.stroke(); }
  ctx.setLineDash([]);
  const x0 = lobbyW + T, w = fw - x0;
  if (th.floor === 'wood') {
    rect(x0, y0, w, fh, '#dcc29b');
    ctx.strokeStyle = '#c7aa80';
    ctx.lineWidth = 1.5;
    for (let y = y0; y < y0 + fh; y += 12) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(fw, y); ctx.stroke();
      for (let x = x0 + ((y / 12) % 2) * 40; x < fw; x += 80) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 12); ctx.stroke(); }
    }
  } else if (th.floor === 'carpet') {
    rect(x0, y0, w, fh, mix(f.color, '#e4e2dc', .74));
    ctx.fillStyle = mix(f.color, '#e4e2dc', .6);
    for (let y = y0 + 6; y < y0 + fh; y += 12) for (let x = x0 + 6 + (y % 24 ? 6 : 0); x < fw; x += 12) ctx.fillRect(x, y, 2, 2);
  } else if (th.floor === 'concrete') {
    rect(x0, y0, w, fh, '#cfd2d6');
    ctx.strokeStyle = '#b8bcc3';
    ctx.lineWidth = 2;
    for (let x = x0; x <= fw; x += 2 * T) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + fh); ctx.stroke(); }
    for (let y = y0; y <= y0 + fh; y += 2 * T) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(fw, y); ctx.stroke(); }
  } else if (th.floor === 'checker') {
    for (let r = 3; r < R; r++) for (let c = 8; c < C; c++) rect(c * T, r * T, T, T, (r + c) % 2 ? '#e4e7ef' : '#cfd4e1');
  } else {
    rect(x0, y0, w, fh, '#d4d8e2');
    ctx.strokeStyle = '#bcc2d5';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    for (let x = x0; x <= fw; x += T) { ctx.beginPath(); ctx.moveTo(x, y0 + 5); ctx.lineTo(x, y0 + fh); ctx.stroke(); }
    for (let y = y0; y <= y0 + fh; y += T) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(fw, y); ctx.stroke(); }
    ctx.setLineDash([]);
  }
}

function drawWall(f, time) {
  const {C, th} = f, fw = C * T, wh = 3 * T;
  rect(0, 0, fw, wh, th.wall);
  rect(0, wh - 8, fw, 8, mix(th.wall, '#000000', .2));
  rect(0, wh - 2, fw, 2, LINE);
  // Lift with floor indicator; doors slide open when someone uses it.
  const open = f.liftOpen > time ? 9 : 0;
  box(1.6 * T, 8, 3.8 * T, wh - 14, '#9aa3c4', '#6f789f');
  rect(1.8 * T, 26, 1.7 * T - open, wh - 34, '#d7dcec');
  rect(3.5 * T + open, 26, 1.7 * T - open, wh - 34, '#d7dcec');
  if (open) rect(3.5 * T - open, 26, open * 2, wh - 34, '#59607e');
  box(2.9 * T, 10, 1.2 * T, 13, '#2b3147', null);
  text('L' + (f.i + 1), 3.5 * T, 17, 9, '#ffcc66', 'center');
  box(5.7 * T, 14, 1.1 * T, 30, '#f3ead2');
  text('↑↓', 6.25 * T, 29, 10, '#6f789f', 'center');
  // Themed wall decor across the office.
  let x = 8.5 * T;
  for (const d of th.decor) {
    if (x > fw - 3 * T) break;
    if (d === 'clock') {
      circle(x + 22, 34, 20, LINE);
      circle(x + 22, 34, 16, '#eef0f8');
      ctx.strokeStyle = '#59607e';
      ctx.lineWidth = 2.5;
      const a = time * .2;
      ctx.beginPath(); ctx.moveTo(x + 22, 34); ctx.lineTo(x + 22 + Math.cos(a) * 10, 34 + Math.sin(a) * 10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 22, 34); ctx.lineTo(x + 22, 24); ctx.stroke();
      x += 64;
    } else if (d === 'sign') {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const label = `L${f.i + 1} · ${f.label}`, w = ctx.measureText(label).width + 44;
      box(x, 10, w, 46, '#ffffff', LINE, 3);
      rect(x + 10, 20, 14, 26, f.color);
      rect(x + 10, 33, 14, 13, mix(f.color, '#000000', .3));
      text(label, x + 32, 27, 15, '#2c3a73');
      text(th.name, x + 32, 44, 9, '#6f789f', 'left', '600');
      x += w + 24;
    } else if (d === 'window') {
      box(x, 10, 92, 40, '#a9d6ea', LINE, 3);
      rect(x + 45, 12, 2, 36, LINE);
      rect(x + 8, 16, 14, 4, '#e3f4fb');
      x += 112;
    } else if (d === 'shelfwall') {
      box(x, 8, 96, 50, '#a77b56', '#6e4f36');
      for (let s = 0; s < 2; s++) for (let b = 0; b < 11; b++) rect(x + 6 + b * 8, 12 + s * 23, 6, 18, ['#e07a5f', '#3d5a80', '#f2cc8f', '#81b29a', '#9a8c98'][(b + s * 2) % 5]);
      x += 116;
    } else if (d === 'mapwall') {
      box(x, 8, 110, 50, '#cfe8d8', LINE, 3);
      ctx.fillStyle = '#9fcfae';
      ctx.beginPath(); ctx.ellipse(x + 40, 32, 26, 14, .3, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 80, 30, 18, 12, -.4, 0, 7); ctx.fill();
      for (const [px, py] of [[30, 28], [52, 36], [84, 26], [74, 38]]) circle(x + px, py, 3, '#e5484d');
      x += 130;
    } else if (d === 'tvwall') {
      box(x, 10, 96, 46, '#2b3147', '#1c2133', 3);
      for (let b = 0; b < 6; b++) {
        const hgt = 8 + ((Math.sin(time + b * 1.3 + f.i) + 1) * 12);
        rect(x + 12 + b * 13, 50 - hgt, 9, hgt, b % 2 ? '#7fd1ae' : '#ffcc66');
      }
      x += 116;
    } else if (d === 'board') {
      box(x, 10, 92, 44, '#c99c6b', '#8a6440', 3);
      for (let n = 0; n < 6; n++) rect(x + 8 + (n % 3) * 28, 16 + Math.floor(n / 3) * 18, 20, 14, ['#fff3a3', '#ffc9de', '#bde0fe'][n % 3]);
      x += 112;
    } else if (d === 'poster') {
      box(x, 8, 46, 56, mix(f.color, '#ffffff', .5), LINE, 3);
      circle(x + 23, 28, 10, f.color);
      rect(x + 10, 44, 26, 4, '#59607e');
      rect(x + 10, 51, 18, 3, '#8f97bd');
      x += 66;
    }
  }
}

function drawDesk(f, d, time) {
  const x = d.c * T, y = d.r * T, w = d.w * T, h = d.h * T;
  rect(x + 4, y + h - 2, w - 8, 8, 'rgba(60,66,110,.18)');
  box(x, y, w, h - 6, LIGHT, LINE, 2.5);
  rect(x + 3, y + h - 8, w - 6, 4, MID);
  rect(x + 4, y + h - 6, 4, 8, LINE);
  rect(x + w - 8, y + h - 6, 4, 8, LINE);
  const seats = d.bench ? d.seatsAt : [f.seats.find(s => s.desk === d)];
  for (const s of seats) {
    if (!s) continue;
    const occ = people.find(p => p.seat === s), working = occ && occ.state === 'desk' && occ.floor === f.i;
    const above = d.bench ? s.above : d.seatAbove, mx = s.x;
    if (above) {
      box(mx - 13, y + 4, 26, 16, MID, DARK, 1.5);
      rect(mx - 3, y + 20, 6, 4, DARK);
    } else {
      box(mx - 14, y + 4, 28, 18, working ? '#bfe7f2' : '#dfe3f0', DARK, 2);
      if (working) rect(mx - 9, y + 9, 6 + (Math.floor(time * 3 + s.c) % 3) * 4, 2, '#5d8fb0');
      rect(mx - 3, y + 22, 6, 5, DARK);
      box(mx - 10, y + h - 20, 20, 7, MID, DARK, 1);
    }
  }
}

function drawItem(f, it, time) {
  const x = it.c * T, y = it.r * T, w = it.w * T, h = it.h * T;
  const occupied = act => f.spots.some(s => s.item === it && s.occupant && s.occupant.state === 'act' && s.occupant.floor === f.i && (!act || s.act === act));
  switch (it.type) {
    case 'shelf':
      box(x, y - 26, w, h + 26, '#a77b56', '#6e4f36');
      for (let s = 0; s < 2; s++) for (let b = 0; b < 8; b++) rect(x + 5 + b * 8, y - 22 + s * 22, 6, 17, ['#e07a5f', '#3d5a80', '#f2cc8f', '#81b29a', '#9a8c98'][(b + s * 3 + it.c) % 5]);
      break;
    case 'whiteboard':
      rect(x + 8, y + 4, 4, h, DARK);
      rect(x + w - 12, y + 4, 4, h, DARK);
      box(x, y - 30, w, 38, '#ffffff', LINE, 3);
      ctx.strokeStyle = '#e5484d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 10, y - 16); ctx.lineTo(x + 26, y - 22); ctx.lineTo(x + 40, y - 12); ctx.stroke();
      rect(x + 46, y - 22, 18, 3, '#3d5a80');
      rect(x + 46, y - 15, 12, 3, '#3d5a80');
      break;
    case 'cooler':
      box(x + 2, y - 10, w - 4, h + 10, '#b4bad6', DARK);
      box(x + 6, y - 2, w - 12, 10, '#9aa3c4', DARK, 1);
      rect(x + 8, y + 1, 3, 3, '#5ab0e6');
      rect(x + 13, y + 1, 3, 3, '#e5484d');
      box(x + 4, y - 30, w - 8, 22, '#86c9f0', DARK);
      rect(x + 7, y - 26, 4, 10, '#c5e8fb');
      break;
    case 'coffee':
      box(x, y - 4, w, h + 4, '#b08968', '#7a5c44');
      box(x + 6, y - 22, 20, 24, '#3a3f55', '#1f2333');
      rect(x + 12, y - 6, 8, 6, '#f6f7fb');
      if (occupied()) for (let n = 0; n < 2; n++) circle(x + 16 + Math.sin(time * 3 + n) * 3, y - 28 - ((time * 12 + n * 8) % 16), 2.5, 'rgba(255,255,255,.8)');
      rect(x + 32, y + 2, 6, 7, '#ffffff');
      rect(x + 40, y + 2, 6, 7, '#ffcc66');
      break;
    case 'printer':
      box(x + 4, y - 8, w - 8, h + 4, '#c9cee0', DARK);
      rect(x + 10, y - 2, w - 20, 5, '#59607e');
      rect(x + 14, y - 14 + (occupied() ? Math.sin(time * 4) * 2 : 0), w - 28, 8, '#ffffff');
      rect(x + w - 16, y + 6, 4, 3, '#7fd1ae');
      break;
    case 'sofa':
      box(x, y - 8, w, h + 6, '#9aa3c4', DARK);
      box(x + 4, y + 2, w - 8, h - 6, '#b4bad6', DARK, 1.5);
      break;
    case 'beanbag':
      ctx.fillStyle = DARK;
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 2, w / 2 + 2, h / 2 + 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#aab1d2';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 1, w / 2, h / 2, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c3c8e2';
      ctx.beginPath(); ctx.ellipse(x + w / 2 - 3, y + h / 2 - 3, 5, 3, -.5, 0, 7); ctx.fill();
      break;
    case 'pingpong': {
      box(x, y, w, h - 4, '#2f8f6b', '#1f5f47', 2.5);
      rect(x + w / 2 - 1, y + 2, 2, h - 8, '#ffffff');
      rect(x + 4, y + h / 2 - 3, w - 8, 1.5, '#ffffff');
      rect(x + 6, y + h - 4, 4, 6, DARK);
      rect(x + w - 10, y + h - 4, 4, 6, DARK);
      const players = f.spots.filter(s => s.item === it && s.occupant?.state === 'act' && s.occupant.floor === f.i).length;
      if (players === 2 && !paused) {
        const u = (Math.sin(time * 4) + 1) / 2;
        circle(x + 6 + u * (w - 12), y + 12 + Math.abs(Math.sin(time * 8)) * -8 + u * 16, 3, '#ffffff');
      }
      break;
    }
    case 'meettable':
      box(x, y, w, h - 4, '#c49a6c', '#8a6440', 2.5);
      rect(x + 10, y + 10, 18, 12, '#ffffff');
      rect(x + 50, y + 16, 14, 10, '#ffffff');
      box(x + 34, y + 8, 12, 8, '#3a3f55', null);
      break;
    case 'booth':
      box(x, y - 22, w, h + 18, 'rgba(190,220,240,.75)', DARK, 3);
      rect(x + 4, y - 18, w - 8, 10, '#59607e');
      text('PHONE', x + w / 2, y - 13, 7, '#ffffff', 'center');
      box(x + 14, y + 6, 18, 12, '#3a3f55', null);
      break;
    case 'plant':
      plant(x + w / 2, y + h - 8, 1);
      break;
    case 'servers':
      for (let n = 0; n < 3; n++) {
        box(x + n * T + 1, y - 24, T - 2, h + 22, '#2b3147', '#141826');
        for (let l = 0; l < 6; l++) rect(x + n * T + 6, y - 18 + l * 10, 4, 3, (Math.floor(time * 4 + l * 3 + n * 5) % 4) ? '#7fd1ae' : '#ffcc66');
        rect(x + n * T + 12, y - 18, 7, 50, '#3d4562');
      }
      break;
    case 'snack':
      box(x, y - 28, T, h + 26, '#e9edf7', DARK);
      rect(x + T - 6, y - 18, 2, 12, DARK);
      box(x + T, y - 4, T, h + 2, '#b08968', '#7a5c44');
      circle(x + T + 8, y + 2, 4, '#e5484d');
      circle(x + T + 16, y + 3, 3.5, '#ffcc66');
      break;
    case 'stage':
      box(x + 10, y - 44, w - 20, 34, '#2b3147', '#141826', 3);
      for (let b = 0; b < 5; b++) rect(x + 24 + b * 16, y - 18 - (8 + ((b * 7 + Math.floor(time)) % 4) * 4), 10, 8 + ((b * 7 + Math.floor(time)) % 4) * 4, f.color);
      box(x, y, w, h - 2, '#b08968', '#7a5c44', 2.5);
      rect(x + 2, y + h - 10, w - 4, 6, '#8a6440');
      break;
    case 'chair':
      box(x + 3, y + 2, w - 6, h - 4, '#9aa3c4', DARK, 1.5);
      break;
    case 'podcast':
      box(x, y - 26, w, h + 24, '#3a3f55', '#1f2333', 3);
      box(x + 4, y - 4, w - 8, h - 2, '#59607e', null);
      rect(x + w / 2 - 12, y - 22, 24, 9, occupied() ? '#e5484d' : '#7a2a33');
      text('ON AIR', x + w / 2, y - 17.5, 6, '#ffffff', 'center');
      rect(x + w / 2 + 10, y + 4, 3, 16, '#c9cee0');
      circle(x + w / 2 + 11.5, y + 4, 4, '#9aa3c4');
      break;
    case 'qa':
      box(x, y - 4, w, h + 2, '#e9edf7', DARK);
      box(x + 6, y - 2, 18, 10, '#bfe7f2', DARK, 1);
      circle(x + w - 12, y + 2, 6, DARK);
      circle(x + w - 12, y + 2, 4, '#dff3fb');
      rect(x + w - 8, y + 6, 6, 3, DARK);
      break;
    case 'helpdesk':
      box(x, y - 6, w, h + 4, '#b08968', '#7a5c44', 2.5);
      box(x + w / 2 - 20, y - 22, 40, 14, '#ffcc66', '#8a6440', 1.5);
      text('HELP', x + w / 2, y - 15, 8, '#3a2f20', 'center');
      break;
    case 'arcade':
      box(x + 1, y - 30, w - 2, h + 28, mix(f.color, '#3a3f55', .5), '#1f2333');
      rect(x + 4, y - 24, w - 8, 14, `hsl(${(time * 60) % 360} 70% 70%)`);
      circle(x + 8, y - 4, 2.5, '#e5484d');
      circle(x + 15, y - 4, 2.5, '#ffcc66');
      break;
    case 'nappod':
      box(x, y - 6, w, h + 4, '#e9edf7', DARK, 2.5);
      box(x + 4, y - 2, 12, 12, '#ffffff', MID, 1);
      box(x + 18, y - 2, w - 22, 14, mix(f.color, '#ffffff', .4), null);
      break;
    case 'tv':
      rect(x + w / 2 - 3, y - 4, 6, h + 2, DARK);
      box(x, y - 34, w, 32, '#2b3147', '#141826', 3);
      ctx.strokeStyle = '#7fd1ae';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let n = 0; n < 8; n++) ctx.lineTo(x + 8 + n * 7.5, y - 12 - Math.abs(Math.sin(n + time * .8)) * 12);
      ctx.stroke();
      break;
    case 'rug':
      box(x, y, w, h, mix(f.color, '#ffffff', .45), mix(f.color, '#000000', .2), 3);
      box(x + 8, y + 8, w - 16, h - 16, 'transparent', mix(f.color, '#ffffff', .2), 2);
      break;
  }
}

function drawFloor(f, time) {
  rect(-T, -T, f.w + 2 * T, f.h + 2 * T, '#3a4565');
  drawFloorSurface(f);
  drawWall(f, time);
  // Glass partition between lobby and office.
  const mid = Math.floor(f.R / 2);
  for (let r = 3; r < f.R; r++) if (![3, 4, mid - 1, mid, mid + 1].includes(r)) {
    rect(7 * T + 6, r * T, T - 12, T, 'rgba(170,205,230,.55)');
    rect(7 * T + 6, r * T, 2, T, LINE);
    rect(8 * T - 8, r * T, 2, T, LINE);
  }
  for (const it of f.items) if (it.spec.floor) drawItem(f, it, time);
  // Depth-sort furniture and staff by their base line.
  const drawables = [];
  for (const d of f.desks) drawables.push({y: (d.r + d.h) * T, draw: () => drawDesk(f, d, time)});
  for (const it of f.items) if (!it.spec.floor) drawables.push({y: it.spec.sit ? it.r * T + 1 : (it.r + it.h) * T, draw: () => drawItem(f, it, time)});
  const here = people.filter(p => p.floor === f.i && !p.hidden);
  for (const p of here) drawables.push({y: p.y, draw: () => drawPerson(p, time)});
  drawables.sort((a, b) => a.y - b.y).forEach(d => d.draw());
  drawNetworkFloor(f, here);
  // Labels, activity icons and conversations on top.
  for (const p of here) {
    if (!p.visible) continue;
    if (cam.z >= 1.3 || p === selected || p === hover) {
      text(p.r['Submission ID'], p.x, p.y + 10, p === selected ? 11 : 9, '#111827', 'center');
    }
    if (p.state === 'act' && p.act && !p.chat) emote(p.x, p.y - 40, acts[p.act][0]);
  }
  for (const c of chats) {
    if (c.f !== f || c.phase !== 'talk') continue;
    const n = Math.floor(c.t / 2.6);
    if (n < c.lines.length) {
      const sp = n % 2 ? c.b : c.a;
      bubble(sp.x, sp.y - 44, c.lines[n]);
    } else {
      const bob = Math.sin(time * 6) * 2;
      for (const p of [c.a, c.b]) heart(p.x, p.y - 62 + bob, 2.5, mix(colors[p.home], '#ffb3c6', .5), mix(colors[p.home], '#000000', .8));
    }
  }
  for (const c of chats) if (c.f === f && c.phase === 'gather') for (const p of [c.a, c.b]) if (p.state === 'wait' && p.floor === f.i) emote(p.x, p.y - 40, '…');
}

function link(ax, ay, bx, by, color, width, dash) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.quadraticCurveTo((ax + bx) / 2, Math.min(ay, by) - 30 - Math.abs(ax - bx) * .12, bx, by);
  ctx.stroke();
  ctx.setLineDash([]);
}
function drawNetworkFloor(f, here) {
  const onFloor = new Set(here);
  if (network) for (const e of edges) {
    if (!onFloor.has(e.a) || !onFloor.has(e.b) || !e.a.visible || !e.b.visible) continue;
    link(e.a.x, e.a.y - 22, e.b.x, e.b.y - 22, `rgba(255,${e.score >= 5 ? 120 : 170},60,${.25 + e.score * .06})`, 1.5);
  }
  if (selected && onFloor.has(selected)) {
    let away = 0;
    for (const l of selected.links) {
      if (onFloor.has(l.p)) link(selected.x, selected.y - 22, l.p.x, l.p.y - 22, '#ff9f1c', 2.5, [6, 4]);
      else away++;
    }
    if (away) {
      link(selected.x, selected.y - 22, f.lift.x, f.lift.y - 10, 'rgba(255,159,28,.6)', 2, [3, 5]);
      box(f.lift.x - 46, f.lift.y + 6, 92, 16, '#fff4dc', '#ff9f1c', 1.5);
      text(`+${away} related elsewhere`, f.lift.x, f.lift.y + 14, 8, '#7a4a00', 'center');
    }
  }
}

// ---------- Building rendering ----------
function miniPos(p) {
  const f = floors[p.floor];
  return {x: 160 + clamp(p.x / f.w, 0, 1) * (BW - 190), y: f_y(p.floor) + FH - 10};
}
const f_y = i => ROOF + (6 - i) * FH;
function drawBuilding(time) {
  rect(-600, BH - GROUND, BW + 1300, GROUND + 600, '#7da088');
  rect(-600, BH - GROUND, BW + 1300, 10, '#6a8d75');
  rect(-10, ROOF - 20, BW + 20, FH * 7 + 24, '#4b5a6b');
  box(BW / 2 - 230, 8, 460, 52, '#24415a', '#1a2f42', 3);
  rect(BW / 2 - 200, 60, 12, 16, '#4b5a6b');
  rect(BW / 2 + 188, 60, 12, 16, '#4b5a6b');
  text('DOS AI DISCOVERY CAMPUS', BW / 2, 35, 26, '#ffdb92', 'center');
  for (const f of floors) {
    const y = f_y(f.i), visible = people.filter(p => p.home === f.i && p.visible).length;
    rect(0, y, BW, FH - 6, f.i === hoverFloor ? mix(f.th.wall, '#ffffff', .55) : mix(f.th.wall, '#ffffff', .35));
    rect(150, y + FH - 30, BW - 150, 24, f.th.floor === 'wood' ? '#dcc29b' : f.th.floor === 'carpet' ? mix(f.color, '#e4e2dc', .74) : f.th.floor === 'checker' ? '#dde1ea' : '#d4d8e2');
    rect(0, y + FH - 14, BW, 8, f.color);
    box(6, y + 8, 76, FH - 28, f.color, mix(f.color, '#000000', .5), 2);
    text('L' + (f.i + 1), 44, y + 34, 26, '#1b2b3d', 'center');
    text(String(f.records.length), 44, y + 62, 13, '#1b2b3d', 'center', '600');
    for (let wx = 560; wx < BW - 30; wx += 64) box(wx, y + 8, 46, 22, '#a9d6ea', LINE, 2);
    text(f.label, 160, y + 22, 15, '#26384c');
    text(`${f.th.name} · ${visible === f.records.length ? f.records.length + ' staff' : visible + ' of ' + f.records.length + ' match'}`, 160, y + 42, 11, '#4b5d72', 'left', '600');
  }
  const shaftX = 92, carY = ROOF + (Math.sin(time * .35) * .5 + .5) * (FH * 6) + 18;
  rect(shaftX, ROOF, 44, FH * 7 - 6, '#8d9aa5');
  box(shaftX + 4, carY, 36, FH - 40, '#c9d2d9', '#6f789f', 2);
  const riding = people.filter(p => p.state === 'lift').length;
  if (riding) text(String(riding), shaftX + 22, carY + 36, 12, '#2b3147', 'center');
  // Network across floors.
  if (network) {
    const counts = new Map();
    for (const e of edges) {
      if (!e.a.visible || !e.b.visible || e.a.home === e.b.home) continue;
      const key = Math.min(e.a.home, e.b.home) * 10 + Math.max(e.a.home, e.b.home);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    for (const [key, n] of counts) {
      const a = Math.floor(key / 10), b = key % 10, ya = f_y(a) + FH / 2, yb = f_y(b) + FH / 2;
      ctx.strokeStyle = `rgba(255,159,28,${Math.min(.9, .25 + n * .08)})`;
      ctx.lineWidth = 1 + n * .5;
      ctx.beginPath();
      ctx.moveTo(BW + 4, ya);
      ctx.bezierCurveTo(BW + 30 + Math.abs(a - b) * 16, ya, BW + 30 + Math.abs(a - b) * 16, yb, BW + 4, yb);
      ctx.stroke();
    }
    text('Links between levels', BW + 8, ROOF - 8, 10, '#26384c', 'left', '600');
  }
  // Mini staff at their actual positions.
  const minis = people.filter(p => !p.hidden).sort((a, b) => a.y - b.y);
  for (const p of minis) {
    const m = miniPos(p);
    drawPerson({...p, x: m.x, y: m.y}, time, .55);
    if (p.chat?.phase === 'talk') heart(m.x, m.y - 34, 1.4, '#ffb3c6', '#5a1f2b');
    if (p === selected) heart(m.x, m.y - 34, 1.4, '#ffcc66', '#7a4a00');
  }
  if (selected && !selected.hidden) {
    const s = miniPos(selected);
    for (const l of selected.links) if (!l.p.hidden) {
      const m = miniPos(l.p);
      link(s.x, s.y - 14, m.x, m.y - 14, 'rgba(255,159,28,.85)', 2, [5, 4]);
    }
  }
  rect(BW / 2 - 50, BH - GROUND - 6, 100, 6, '#3c4a59');
  plant(BW / 2 - 80, BH - GROUND + 20, 1.4);
  plant(BW / 2 + 80, BH - GROUND + 20, 1.4);
}

function draw(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (view < 0) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fc2d8');
    g.addColorStop(1, '#d5e8ec');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#16263a';
  ctx.fillRect(0, 0, W, H);
  const c = centre();
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (c.x - cam.x * cam.z), dpr * (c.y - cam.y * cam.z));
  if (view < 0) drawBuilding(time);
  else drawFloor(floors[view], time);
}

function updateHover() {
  const tip = $('tooltip');
  if (!mouse || drag?.moved || $('details').open) {
    hover = null;
    hoverFloor = -1;
    tip.style.display = 'none';
    canvas.style.cursor = drag?.moved ? 'grabbing' : '';
    return;
  }
  const hit = pickAt(mouse.x, mouse.y);
  hover = hit.person;
  hoverFloor = hit.floor;
  let label = '';
  if (hover) label = `${hover.r['Submission ID']} · ${hover.r['Suggested use case title']} — ${activityText(hover)}`;
  else if (hoverFloor >= 0) label = `Level ${hoverFloor + 1} · ${labels[hoverFloor]} (${themes[hoverFloor].name}) — click to enter`;
  canvas.style.cursor = label ? 'pointer' : 'grab';
  if (!label) {
    tip.style.display = 'none';
    return;
  }
  tip.textContent = label;
  tip.style.display = 'block';
  tip.style.left = Math.min(mouse.x + 16, W - tip.offsetWidth - 8) + 'px';
  tip.style.top = Math.min(mouse.y + 16, H - tip.offsetHeight - 8) + 'px';
}

// ---------- Loop ----------
function resize() {
  W = world.clientWidth;
  H = world.clientHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  fit(true);
}
new ResizeObserver(resize).observe(world);
resize();
refresh();
renderChats();
// Deep links: #L3 opens level 3; add "network" (e.g. #L3,network) to show links.
{
  const parts = location.hash.slice(1).toLowerCase().split(',');
  const level = parts.find(s => /^l[1-7]$/.test(s));
  if (parts.includes('network')) toggleNetwork();
  if (level) {
    enter(Number(level[1]) - 1);
    fit(true);
  }
}
$('loading').style.display = 'none';

let previous = performance.now(), simTime = previous / 1000;
function tick(dt) {
  simTime += dt;
  const now = simTime;
  for (const p of people) update(p, dt, now);
  for (const c of [...chats]) updateChat(c, dt, now);
  if (!paused && (chatClock -= dt) <= 0) {
    chatClock = rnd(2, 4);
    scheduleChat(now);
  }
  if (follow && selected) {
    const fl = currentFloor(selected);
    if (view !== fl) enter(fl, true);
    if (!selected.hidden) {
      target.x = selected.x;
      target.y = selected.y - 20;
    }
  }
  const k = Math.min(1, dt * 8);
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.z += (target.z - cam.z) * k;
}
function frame(nowMs) {
  tick(Math.min((nowMs - previous) / 1000, .05));
  previous = nowMs;
  updateHover();
  draw(simTime);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook: advance the simulation without animation frames (e.g. in a hidden tab).
window.campusStep = (seconds = 1) => {
  for (let s = 0; s < seconds; s += .05) tick(.05);
  updateHover();
  draw(simTime);
  return window.campusDiagnostics();
};

// Small diagnostic surface for local automated tests, not an administrative API.
window.campusDiagnostics = () => ({
  view, staff: people.length, levels: floors.length, links: edges.length, visible: people.filter(p => p.visible).length,
  states: people.reduce((m, p) => (m[p.state] = (m[p.state] || 0) + 1, m), {}), chats: chats.length, recentChats: recent.length,
  spots: floors.map(f => f.spots.length), meet: floors.map(f => f.meet.length), selected: selected?.r['Submission ID'] || null, follow, paused, network, zoom: +cam.z.toFixed(3),
});
