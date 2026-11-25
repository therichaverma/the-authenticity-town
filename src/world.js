// The places in town: what is drawn, what blocks you, and where each door leads.
class Scene {
  constructor(id, w, h, name) {
    Object.assign(this, { id, w, h, name, objects: [], solids: [], lamps: [], doors: [], surfaces: [], sparkles: [], panes: [], places: [], spots: [], hangouts: [] });
    this.ground = makeCanvas(w, h);
    this.g = new Painter(this.ground.getContext('2d'));
  }
  solid(x, y, w, h) { this.solids.push([x, y, w, h]); }
  add(x, y, w, h, base, draw, hasLit) {
    const canvas = makeCanvas(w, h);
    const lit = hasLit ? makeCanvas(w, h) : null;
    draw(new Painter(canvas.getContext('2d'), x, y), lit && new Painter(lit.getContext('2d'), x, y));
    this.objects.push({ x, y, w, h, base, canvas, lit });
  }
  addDoor(d) {
    const door = { ...d, cx: d.x + 7, spawnY: d.y + 6, zone: [d.x - 1, d.y, 16, 6] };
    this.doors.push(door);
    return door;
  }
  free(x, y) {
    const a = x - 3, b = y - 2, c = x + 3, d = y + 1;
    if (a < 0 || b < 0 || c >= this.w || d >= this.h) return false;
    return !this.solids.some(([sx, sy, sw, sh]) => c > sx && a < sx + sw && d > sy && b < sy + sh);
  }
  placeAt(x, y) {
    const hit = this.places.find(([, a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h);
    return hit ? hit[0] : this.name;
  }
  buildNav() {
    const cell = 4;
    this.cell = cell;
    this.cols = Math.floor(this.w / cell);
    this.rows = Math.floor(this.h / cell);
    this.open = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      this.open[r * this.cols + c] = this.free(c * cell + 2, r * cell + 2) ? 1 : 0;
    }
    this.prev = new Int32Array(this.cols * this.rows);
  }
  nearestOpen(x, y) {
    const { cell, cols, rows, open } = this;
    const c0 = Math.floor(x / cell), r0 = Math.floor(y / cell);
    for (let rad = 0; rad < 40; rad++) {
      let best = -1, bd = Infinity;
      for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) {
        if (Math.max(Math.abs(r - r0), Math.abs(c - c0)) !== rad) continue;
        if (r < 0 || c < 0 || r >= rows || c >= cols || !open[r * cols + c]) continue;
        const d = (r - r0) ** 2 + (c - c0) ** 2;
        if (d < bd) { bd = d; best = r * cols + c; }
      }
      if (best >= 0) return best;
    }
    return -1;
  }
  clearLine(x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
    for (let i = 1; i <= n; i++) {
      if (!this.free(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n)) return false;
    }
    return true;
  }
  findPath(sx, sy, tx, ty) {
    const { cell, cols, open, prev } = this;
    const start = this.nearestOpen(sx, sy), goal = this.nearestOpen(tx, ty);
    if (start < 0 || goal < 0) return null;
    prev.fill(-1);
    prev[start] = start;
    const queue = [start];
    for (let head = 0; head < queue.length && prev[goal] < 0; head++) {
      const cur = queue[head], r = Math.floor(cur / cols), c = cur % cols;
      for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= this.rows || nc >= cols) continue;
        const n = nr * cols + nc;
        if (!open[n] || prev[n] >= 0) continue;
        if (dr && dc && (!open[r * cols + nc] || !open[nr * cols + c])) continue;
        prev[n] = cur;
        queue.push(n);
      }
    }
    if (prev[goal] < 0) return null;
    const pts = [];
    for (let n = goal; n !== start; n = prev[n]) pts.push({ x: (n % cols) * cell + 2, y: Math.floor(n / cols) * cell + 2 });
    pts.reverse();
    if (this.free(tx, ty)) pts.push({ x: tx, y: ty });
    // Pull the path tight so people do not zigzag along the grid.
    const out = [];
    let from = { x: sx, y: sy }, i = 0;
    while (i < pts.length) {
      let j = i;
      while (j + 1 < pts.length && this.clearLine(from.x, from.y, pts[j + 1].x, pts[j + 1].y)) j++;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  }
}

const OX = 168, OY = 80;

// The town is laid out around one wide, open square with the fountain in the middle.
// The café and bookshop face it from the north, the houses sit in a tidy row along a lane to the south,
// and the pond and market are off to the west and east, out of the way of the square.
// Further east, Market Street has the pub, the art studio and the food stalls; south of the houses is the park.
// (The town only ever grows east and south, so every spot that's already been used stays where it is.)
function buildTown() {
  const s = new Scene('town', 1040, 720, 'the town');
  const rng = mulberry(7);
  const SQUARE = [56, 86, 340, 150];
  const paths = [
    SQUARE,
    [250, 66, 22, 22], [46, 68, 18, 20], [342, 74, 18, 14],          // up to the bookshop, Asha's and Tom's
    [-168, 128, 226, 26], [394, 128, 478, 26],                          // the high street, west and east (Market Street)
    [-86, 72, 18, 58], [437, 70, 18, 60],                               // up to Nora's and Sam's
    [216, 234, 20, 124], [-20, 356, 492, 14],                           // down to the south lane
    [43, 352, 16, 6], [133, 352, 16, 6], [313, 352, 16, 6], [403, 352, 16, 6],
    [594, 100, 18, 30], [722, 98, 18, 32],                              // up to the pub and the art studio
    [556, 154, 300, 96],                                                // the market's paving
    [216, 368, 20, 44],                                                 // down to the park
    [40, 410, 380, 14], [40, 410, 14, 200], [406, 410, 14, 200], [40, 596, 380, 14], // the park's loop
    [216, 410, 20, 200], [168, 462, 116, 80],                           // across the park, and the bandstand's paving
    [420, 560, 452, 14], [458, 370, 14, 190],                           // Rose Lane, and the path down to it
    [512, 552, 16, 8], [602, 552, 16, 8], [692, 552, 16, 8], [782, 552, 16, 8],
    [-30, 154, 14, 90], [-160, 236, 140, 14],                           // down to the playground
  ].map(([x, y, w, h]) => [x + OX, y + OY, w, h]);
  const pond = [[-136, 162, 96, 40], [-124, 156, 72, 52], [300, 436, 90, 42], [310, 430, 70, 54]].map(([x, y, w, h]) => [x + OX, y + OY, w, h]);
  Art.grass(s, rng);
  Art.surface(s, paths, 'path');
  Art.surface(s, pond, 'water');
  pond.forEach(([x, y, w, h]) => s.solid(x + 2, y + 2, w - 4, h - 2));
  for (const [x, y] of [[-110, 172], [-84, 186], [-64, 170], [-98, 196], [-72, 196], [318, 446], [350, 462], [372, 444]]) {
    s.sparkles.push({ x: x + OX, y: y + OY, c: PAL.water[2] });
  }

  const at = (fn, x, y, ...a) => fn(s, x + OX, y + OY, ...a);
  // Flowers only out in the fields at the edges of town, never around the square.
  for (const [x, y, n, w, h] of [[-150, 340, 14, 150, 20], [470, 236, 30, 70, 60], [-140, 90, 9], [470, 92, 10],
    [70, 440, 24, 120, 30], [70, 560, 24, 120, 26], [250, 560, 20, 140, 26], [800, 60, 14, 60, 30]]) {
    Art.flowers(s, x + OX, y + OY, n, rng, w, h);
  }

  // North of the square, all public places: the library, the café, the bookshop, the launderette and
  // the town hall, with the community garden at the west end. (They stand where houses used to be.)
  at(Art.library, 22, 6, 64);
  at(Art.cafe, 116, 6);
  at(Art.bookshop, 232, 2);
  at(Art.launderette, 322, 12, 58);
  at(Art.townhall, 414, 8, 62);
  // The community garden: raised vegetable beds, a shed, a table for tea and a bench, behind a low fence.
  at(Art.shed, -118, 10);
  at(Art.vegbed, -80, 10, 46, 16, rng); at(Art.vegbed, -80, 34, 46, 16, rng);
  at(Art.table, -116, 48); at(Art.bench, -60, 56);
  at(Art.fence, -120, 74, 4); at(Art.fence, -62, 74, 5);
  // The south lane, facing the square: the cinema, the ice-cream parlour, the chapel and the post office.
  at(Art.cinema, 20, 290, 60);
  at(Art.icecream, 110, 290, 60);
  at(Art.chapel, 290, 286, 60);
  at(Art.postoffice, 380, 290, 60);
  at(Art.postbox, 446, 336); s.spots.push({ x: 450 + OX, y: 358 + OY, r: 14, action: 'postbox' }); at(Art.bench, 180, 376); at(Art.bench, 296, 376);
  // Rose Lane, a quiet row of homes tucked away east of the park. The residents live here.
  at(Art.house, 490, 490, 60, PAL.roofs[0], 'ines');
  at(Art.house, 580, 490, 60, PAL.roofs[1], 'mei');
  at(Art.house, 670, 490, 60, PAL.roofs[2], 'kofi');
  at(Art.house, 760, 490, 60, PAL.roofs[3], 'leo');
  // The playground, west of the square below the pond: swings, a slide, a sandpit and benches.
  s.g.r(-150 + OX, 300 + OY, 44, 26, PAL.line); s.g.r(-149 + OX, 301 + OY, 42, 24, PAL.sand);
  s.solid(-150 + OX, 300 + OY, 44, 26); // (so no tree grows in the sandpit)
  for (const [a, b] of [[-140, 306], [-126, 314], [-118, 304]]) s.g.r(a + OX, b + OY, 3, 2, '#d8c088');
  at(Art.swings, -150, 244); at(Art.slide, -92, 248);
  at(Art.bench, -94, 306); at(Art.bench, -60, 330);

  at(Art.fence, 456, 78, 8);
  // The fountain in the middle, and a lamp at each corner of the square.
  at(Art.fountain, 226, 140);
  at(Art.lamp, 64, 94); at(Art.lamp, 388, 94); at(Art.lamp, 64, 228); at(Art.lamp, 388, 228);
  at(Art.lamp, -50, 124); at(Art.lamp, 470, 124); at(Art.lamp, 244, 350);
  // A garden square: a flowerbed either side of the fountain, each with a bench in front of it facing
  // the fountain, and two small trees near the south end.
  at(Art.flowerbed, 126, 128, 50, 16, rng); at(Art.flowerbed, 276, 128, 50, 16, rng);
  at(Art.bench, 140, 150); at(Art.bench, 290, 150);
  at(Art.tree, 104, 214, rng); at(Art.tree, 348, 214, rng);
  at(Art.bench, -90, 150); at(Art.bench, -30, 208); at(Art.bench, 470, 196);

  // Market Street: the pub and the art studio on the north side; the food stalls on the south side,
  // with a couple of tables and a bench for sitting with what you've been given.
  at(Art.pub, 560, 32);
  at(Art.studio, 690, 28);
  at(Art.kiosk, 572, 176, '#e2963e', 'FRUIT', ['#d64a46', '#fad650', '#f08c4a', '#78be52', '#d64a46']);
  at(Art.kiosk, 636, 176, '#4882c8', 'JUICE', ['#f08c4a', '#78be52', '#e88aa8', '#fad650', '#f08c4a']);
  at(Art.kiosk, 700, 176, '#d64a46', 'SNACKS', ['#fad650', '#c88a4a', '#e2b46c', '#fad650', '#c88a4a']);
  at(Art.kiosk, 764, 176, '#825abe', 'BAKERY', ['#e2b46c', '#c88a4a', '#f4dcae', '#e2b46c', '#c88a4a']);
  at(Art.table, 600, 224); at(Art.table, 742, 224); at(Art.bench, 668, 228);
  at(Art.lamp, 560, 150); at(Art.lamp, 856, 150); at(Art.lamp, 560, 248); at(Art.lamp, 856, 248);
  at(Art.lamp, 660, 124); at(Art.lamp, 790, 124);
  // The sign stands where the old flower stalls were, at the start of the market.
  at(Art.signboard, 440, 162, ['MARKET STREET']);
  // Walk up to a stall and ask; the stallholders are in people.js and what they give is in market.js.
  for (const [i, shop] of ['fruit', 'juice', 'snacks', 'bakery'].entries()) {
    s.spots.push({ x: 572 + i * 64 + 23 + OX, y: 210 + OY, r: 16, action: 'shop', shop });
  }

  // The park, south of the houses: a loop of paths, the bandstand in the middle, a duck pond,
  // benches, a picnic table and flowerbeds.
  at(Art.signboard, 240, 380, ['THE PARK']);
  at(Art.bandstand, 226, 506);
  at(Art.duck, 330, 450); at(Art.duck, 360, 468);
  at(Art.bench, 96, 428); at(Art.bench, 330, 490); at(Art.bench, 96, 574); at(Art.bench, 300, 574);
  at(Art.table, 120, 500);
  at(Art.flowerbed, 64, 470, 44, 16, rng); at(Art.flowerbed, 340, 530, 44, 16, rng);
  at(Art.lamp, 60, 430); at(Art.lamp, 400, 430); at(Art.lamp, 60, 592); at(Art.lamp, 400, 592);

  // A neat row of trees along the bottom of the square, and a pair either side of it.
  const fixed = [[90, 262], [150, 262], [302, 262], [362, 262], [30, 170], [30, 222], [420, 222], [16, 40], [372, 40],
    [150, 444], [280, 448], [74, 540], [384, 556], [160, 586], [880 - 30, 100], [530, 100]];
  fixed.forEach(([x, y]) => at(Art.tree, x, y, rng));
  at(Art.bush, 196, 246); at(Art.bush, 246, 246);

  // Woods around the edge, kept off the paths and away from everything already placed.
  const blocked = (x, y, m) => paths.concat(pond).some(([a, b, w, h]) => x > a - m && x < a + w + m && y > b - m && y < b + h + m)
    || s.solids.some(([a, b, w, h]) => x > a - m && x < a + w + m && y > b - m && y < b + h + m);
  let placed = 0;
  for (let i = 0; i < 3000 && placed < 170; i++) {
    const x = 8 + Math.floor(rng() * (s.w - 16)), y = 30 + Math.floor(rng() * (s.h - 34));
    const edge = Math.min(x, s.w - x, y - 20, s.h - y);
    if (edge > 56 && rng() > 0.03) continue;
    if (blocked(x, y, 18)) continue;
    Art.tree(s, x, y, rng);
    placed++;
  }

  const P = (name, x, y, w, h) => s.places.push([name, x + OX, y + OY, w, h]);
  P('outside the café', 100, 76, 140, 30);
  P('the community garden', -122, 0, 96, 84);
  P('the playground', -168, 230, 170, 120);
  P('Rose Lane', 452, 470, 420, 120);
  P('the square', 56, 86, 340, 150);
  P('the pond', -160, 146, 150, 72);
  P('the market', 416, 130, 136, 70);
  P('Market Street', 552, 0, 320, 154);
  P('the market', 552, 154, 320, 100);
  P('the park', 20, 396, 420, 230);
  P('the south lane', -20, 240, 492, 160);
  P('the east field', 452, 232, 100, 168);
  P('the high street', -168, 120, 720, 42);

  const H = (x, y, wait = 4) => s.hangouts.push({ scene: 'town', x: x + OX, y: y + OY, wait });
  H(150, 116); H(196, 116); H(258, 116); H(151, 166, 8); H(301, 166, 8); H(121, 222, 7); H(331, 222, 7);
  H(100, 140); H(352, 140); H(226, 210); H(-79, 146, 9); H(-30, 222, 8); H(445, 186); H(495, 186, 6);
  H(226, 330); H(100, 362); H(340, 362); H(-20, 140); H(520, 140); H(480, 212, 9);
  H(620, 250, 8); H(760, 250, 8); H(680, 246, 9); H(700, 140); H(820, 140);
  H(-50, 74, 9); H(-100, 66, 8); H(-83, 322, 9); H(-49, 346, 8); H(-130, 290, 6); H(191, 392, 8); H(307, 392, 8);
  H(107, 444, 9); H(341, 506, 9); H(107, 590, 8); H(311, 590, 8); H(226, 530, 7); H(160, 520, 6); H(380, 420);
  s.buildNav();
  s.start = { x: 203 + OX, y: 198 + OY };
  return s;
}

function buildCafe() {
  const s = new Scene('cafe', 224, 152, 'the café');
  Art.room(s, '#b98a5e', '#9a7048', '#f0dcb4', '#8a5a38');
  Art.roomWindow(s, 136, 8); Art.roomWindow(s, 176, 8);
  s.g.r(40, 6, 54, 22, PAL.woodd); s.g.r(42, 8, 50, 18, '#3a3a40');
  for (const [y, w] of [[11, 34], [16, 42], [21, 26]]) s.g.r(46, y, w, 2, PAL.wall);
  Art.rug(s, 128, 62, 76, 72, '#a8483e', '#c86a50');
  s.solid(5, 44, 12, 28); s.solid(128, 44, 4, 28);
  Art.counter(s, 17, 58, 111, true);
  Art.cafeTable(s, 140, 72); Art.cafeTable(s, 180, 72);
  Art.cafeTable(s, 140, 110); Art.cafeTable(s, 36, 110); Art.cafeTable(s, 82, 110);
  Art.plant(s, 204, 44); Art.plant(s, 8, 130);
  s.spots.push({ x: 72, y: 84, r: 18, action: 'coffee' });
  s.hangouts.push({ scene: 'cafe', x: 60, y: 96, wait: 8 }, { scene: 'cafe', x: 118, y: 92, wait: 8 }, { scene: 'cafe', x: 170, y: 100, wait: 10 });
  s.buildNav();
  s.start = { x: 112, y: 142 };
  return s;
}

function buildBookshop() {
  const s = new Scene('bookshop', 192, 136, 'the bookshop');
  const rng = mulberry(21);
  Art.room(s, '#a88462', '#8a6a4c', '#dfe6d8', '#5c7468');
  Art.roomWindow(s, 8, 8);
  Art.rug(s, 66, 76, 60, 44, '#467c70', '#5ca08e');
  Art.bookcase(s, 36, 14, 50, rng); Art.bookcase(s, 92, 14, 50, rng);
  Art.bookcase(s, 8, 60, 44, rng); Art.bookcase(s, 8, 96, 44, rng);
  Art.armchair(s, 72, 78); Art.armchair(s, 104, 78);
  s.surfaces.push({ x: 92, y: 86, base: 96, kind: 'reading table', hit: [90, 86, 12, 11] });
  s.solid(90, 92, 12, 4);
  s.add(90, 86, 12, 11, 96, (p) => { p.r(90, 86, 12, 5, PAL.line); p.r(91, 87, 10, 3, PAL.wood); p.r(95, 91, 2, 5, PAL.woodd); });
  s.solid(146, 44, 41, 3);
  Art.counter(s, 150, 58, 37, false);
  // Ravi's desk, where a book can be left for whoever comes in next.
  s.surfaces.push({ x: 176, y: 60, base: 74, kind: 'desk', hit: [150, 50, 37, 24] });
  s.solid(150, 44, 2, 14);
  Art.plant(s, 174, 118);
  s.spots.push({ x: 158, y: 80, r: 16, action: 'bookseller' }, { x: 62, y: 62, r: 22, action: 'shelf' }, { x: 62, y: 106, r: 20, action: 'shelf' });
  s.hangouts.push({ scene: 'bookshop', x: 62, y: 70, wait: 9 }, { scene: 'bookshop', x: 134, y: 112, wait: 7 });
  s.buildNav();
  s.start = { x: 96, y: 126 };
  return s;
}

// The Lantern: a warm, low-lit pub with a long bar, booths, a fireplace and a dartboard.
// It pours only soft drinks these days.
function buildPub() {
  const s = new Scene('pub', 224, 152, 'the Lantern');
  Art.room(s, '#8a5c3c', '#74492e', '#8c4a3a', '#4e2c22');
  const g = s.g;
  // Shelves of bottles behind the bar.
  g.r(14, 8, 90, 22, '#4e2c22');
  for (const sy of [14, 24]) {
    g.r(16, sy, 86, 2, '#2e1a12');
    for (let i = 0; i < 14; i++) g.r(18 + i * 6, sy - 5, 3, 5, ['#3a9e5a', '#d8a046', '#a03834', '#bee8f4'][i % 4]);
  }
  // The dartboard and the fireplace.
  g.ell(124, 8, 142, 26, PAL.line); g.ell(125, 9, 141, 25, '#2a2a2a'); g.ell(128, 12, 138, 22, '#d64a46'); g.ell(131, 15, 135, 19, '#f4dcae');
  g.r(166, 6, 44, 34, PAL.line); g.r(168, 8, 40, 32, PAL.stoned); g.r(176, 18, 24, 22, PAL.line); g.r(178, 22, 20, 18, '#d6602a'); g.r(182, 28, 12, 12, PAL.flowers[1]);
  s.lamps.push({ x: 188, y: 34, r: 30 });
  Art.rug(s, 104, 84, 64, 48, '#7a2c26', '#a8483e');
  Art.bar(s, 14, 56, 96);
  Art.cafeTable(s, 140, 66); Art.cafeTable(s, 140, 108); Art.cafeTable(s, 40, 112);
  Art.plant(s, 206, 120); Art.plant(s, 8, 76);
  s.spots.push({ x: 62, y: 84, r: 18, action: 'shop', shop: 'pub' }, { x: 133, y: 46, r: 16, action: 'darts' });
  s.hangouts.push({ scene: 'pub', x: 120, y: 100, wait: 10 }, { scene: 'pub', x: 176, y: 96, wait: 9 }, { scene: 'pub', x: 80, y: 128, wait: 8 });
  s.buildNav();
  s.start = { x: 112, y: 142 };
  return s;
}

// The art studio: bright and white, with big windows, easels, and a long worktable covered in paint.
function buildStudio() {
  const s = new Scene('studio', 208, 144, 'the art studio');
  const rng = mulberry(33);
  Art.room(s, '#dcc8a4', '#c8b088', '#eef0f4', '#8aa0b4');
  Art.roomWindow(s, 20, 8); Art.roomWindow(s, 48, 8); Art.roomWindow(s, 140, 8); Art.roomWindow(s, 168, 8);
  const g = s.g;
  // Paintings pinned to the wall, and paint spilled on the floor over the years.
  for (const [x, c] of [[84, PAL.shirts[1]], [100, PAL.flowers[0]], [116, PAL.leaf[1]]]) { g.r(x, 10, 12, 14, PAL.line); g.r(x + 1, 11, 10, 12, PAL.wall); g.r(x + 3, 14, 6, 6, c); }
  for (let i = 0; i < 26; i++) g.r(8 + Math.floor(rng() * 190), 50 + Math.floor(rng() * 84), 2, 2, PAL.shirts[Math.floor(rng() * 8)]);
  Art.worktable(s, 56, 84, 96);
  Art.easel(s, 18, 54, rng); Art.easel(s, 172, 54, rng); Art.easel(s, 20, 104, rng); Art.easel(s, 176, 102, rng);
  Art.plant(s, 186, 126);
  s.spots.push({ x: 26, y: 84, r: 14, action: 'easel' }, { x: 180, y: 84, r: 14, action: 'easel' }, { x: 28, y: 134, r: 14, action: 'easel' }, { x: 184, y: 132, r: 14, action: 'easel' },
    { x: 104, y: 72, r: 16, action: 'teacher' });
  s.hangouts.push({ scene: 'studio', x: 70, y: 112, wait: 10 }, { scene: 'studio', x: 140, y: 114, wait: 9 }, { scene: 'studio', x: 40, y: 88, wait: 12 });
  s.buildNav();
  s.start = { x: 104, y: 134 };
  return s;
}

// The library: tall shelves, long reading tables and a returns desk, where Agnes keeps an eye on things.
function buildLibrary() {
  const s = new Scene('library', 224, 152, 'the library');
  const rng = mulberry(41);
  Art.room(s, '#b89a74', '#a0825e', '#e8e4d4', '#5c7468');
  Art.bookcase(s, 10, 14, 50, rng); Art.bookcase(s, 66, 14, 50, rng); Art.bookcase(s, 122, 14, 30, rng);
  Art.bookcase(s, 8, 60, 44, rng); Art.bookcase(s, 8, 96, 44, rng);
  Art.rug(s, 70, 60, 84, 70, '#3e6a5c', '#4e8270');
  for (const [x, y] of [[84, 70], [84, 110], [130, 90]]) { Art.cafeTable(s, x, y); s.surfaces[s.surfaces.length - 1].kind = 'reading table'; }
  Art.counter(s, 162, 58, 56, false);
  s.surfaces.push({ x: 198, y: 60, base: 74, kind: 'returns desk', hit: [162, 50, 56, 24] });
  s.solid(212, 44, 6, 14);
  Art.plant(s, 204, 126);
  s.spots.push({ x: 60, y: 62, r: 20, action: 'libshelf' }, { x: 60, y: 104, r: 20, action: 'libshelf' }, { x: 90, y: 50, r: 18, action: 'libshelf' },
    { x: 186, y: 82, r: 16, action: 'librarian' });
  s.hangouts.push({ scene: 'library', x: 112, y: 100, wait: 12 }, { scene: 'library', x: 160, y: 120, wait: 10 }, { scene: 'library', x: 66, y: 80, wait: 9 });
  s.buildNav();
  s.start = { x: 112, y: 142 };
  return s;
}

// The launderette: a row of machines, a line of chairs to wait on, a folding table and a noticeboard.
function buildLaunderette() {
  const s = new Scene('launderette', 192, 128, 'the launderette');
  Art.room(s, '#d8dce4', '#c4c8d2', '#bfe4e2', '#337a80');
  const g = s.g;
  // The noticeboard, covered in cards.
  g.r(150, 8, 34, 24, PAL.line); g.r(151, 9, 32, 22, '#c89a62');
  for (const [x, y, c] of [[153, 11, PAL.wall], [163, 12, '#fad650'], [172, 10, '#e88aa8'], [155, 21, '#bee8f4'], [167, 21, PAL.wall]]) g.r(x, y, 8, 7, c);
  Art.machines(s, 8, 46, 6);
  Art.table(s, 154, 56); s.surfaces[s.surfaces.length - 1].kind = 'folding table';
  Art.chairs(s, 30, 98, 7, '#4882c8');
  Art.plant(s, 172, 104);
  s.spots.push({ x: 40, y: 76, r: 18, action: 'machine' }, { x: 106, y: 76, r: 18, action: 'machine' }, { x: 166, y: 50, r: 16, action: 'notices' });
  s.hangouts.push({ scene: 'launderette', x: 64, y: 92, wait: 12 }, { scene: 'launderette', x: 140, y: 100, wait: 9 });
  s.buildNav();
  s.start = { x: 96, y: 118 };
  return s;
}

// The town hall: rows of chairs facing a little stage, a piano, a WELCOME banner and an urn of tea.
function buildHall() {
  const s = new Scene('hall', 224, 152, 'the town hall');
  Art.room(s, '#c09a6c', '#a8825a', '#f0e6cc', '#a03834');
  const g = s.g;
  g.r(64, 6, 96, 14, PAL.line); g.r(65, 7, 94, 12, '#d64a46');
  signWord(g, 112, 10, 'WELCOME', PAL.wall);
  // The stage, a step up from the floor. Its edge is a place to leave the book.
  g.r(56, 44, 112, 20, PAL.line); g.r(57, 44, 110, 16, '#8a5a38'); g.r(57, 60, 110, 3, '#643e2a');
  for (let x = 60; x < 166; x += 12) g.r(x, 44, 1, 16, '#7a4c2e');
  s.solid(56, 44, 112, 20);
  s.surfaces.push({ x: 112, y: 52, base: 66, kind: 'stage', hit: [56, 40, 112, 26] });
  Art.piano(s, 180, 50);
  Art.table(s, 14, 56); s.surfaces[s.surfaces.length - 1].kind = 'tea table';
  s.add(18, 46, 8, 12, 57, (p) => { p.r(18, 46, 8, 11, PAL.line); p.r(19, 47, 6, 9, PAL.stone); p.r(20, 49, 4, 1, PAL.stoned); });
  Art.chairs(s, 62, 86, 10, '#c86a46'); Art.chairs(s, 62, 108, 10, '#c86a46');
  Art.plant(s, 8, 126); Art.plant(s, 206, 126);
  s.spots.push({ x: 195, y: 76, r: 16, action: 'piano' }, { x: 24, y: 80, r: 16, action: 'tea' });
  s.hangouts.push({ scene: 'hall', x: 100, y: 100, wait: 12 }, { scene: 'hall', x: 40, y: 104, wait: 9 }, { scene: 'hall', x: 180, y: 110, wait: 9 });
  s.buildNav();
  s.start = { x: 112, y: 142 };
  return s;
}

// The cinema: a glowing screen, three rows of red seats, and a snack counter by the door.
function buildCinema() {
  const s = new Scene('cinema', 224, 152, 'the cinema');
  Art.room(s, '#5a2e3a', '#4a2430', '#2a2430', '#1a141e');
  Art.screen(s, 40, 4, 144);
  for (const y of [70, 92, 114]) {
    Art.chairs(s, 52, y, 12, '#c84a3e');
    s.surfaces.push({ x: 112, y: y - 2, base: y + 10, kind: 'cinema seat', hit: [52, y - 4, 120, 14] });
  }
  Art.counter(s, 6, 112, 36, false);
  s.surfaces.push({ x: 24, y: 114, base: 128, kind: 'snack counter', hit: [6, 104, 36, 24] });
  s.spots.push({ x: 30, y: 136, r: 14, action: 'shop', shop: 'cinema' }, { x: 112, y: 62, r: 22, action: 'film' }, { x: 112, y: 106, r: 18, action: 'film' });
  s.hangouts.push({ scene: 'cinema', x: 112, y: 84, wait: 14 }, { scene: 'cinema', x: 190, y: 104, wait: 10 });
  s.buildNav();
  s.start = { x: 112, y: 142 };
  return s;
}

// The ice-cream parlour: pink walls, a counter of tubs, and two little tables.
function buildIcecream() {
  const s = new Scene('icecream', 176, 120, 'the ice-cream parlour');
  Art.room(s, '#f4ecd8', '#e4d8c0', '#f4c4d4', '#b0507a');
  Art.counter(s, 14, 56, 84, false);
  s.surfaces.push({ x: 80, y: 58, base: 72, kind: 'counter', hit: [14, 48, 84, 24] });
  s.add(20, 46, 60, 10, 57, (p) => { ['#fafaf0', '#e88aa8', '#6a4428', '#9ee0b8', '#fad650'].forEach((c, i) => { p.r(22 + i * 11, 48, 9, 7, PAL.line); p.r(23 + i * 11, 49, 7, 3, c); }); });
  Art.cafeTable(s, 128, 64); Art.cafeTable(s, 128, 96);
  Art.plant(s, 8, 96);
  s.spots.push({ x: 56, y: 82, r: 18, action: 'shop', shop: 'icecream' });
  s.hangouts.push({ scene: 'icecream', x: 116, y: 88, wait: 10 }, { scene: 'icecream', x: 60, y: 100, wait: 8 });
  s.buildNav();
  s.start = { x: 88, y: 110 };
  return s;
}

// The chapel: quiet, with rows of pews, candles you can light, and coloured light from the windows.
function buildChapel() {
  const s = new Scene('chapel', 192, 152, 'the chapel');
  Art.room(s, '#b8b4aa', '#a4a096', '#e4e0d4', '#6e7080');
  const g = s.g;
  for (const wx of [24, 148]) {
    g.r(wx, 6, 20, 26, PAL.line);
    [['#4882c8', 0, 0], ['#d64a46', 10, 0], ['#fad650', 0, 12], ['#78be52', 10, 12]].forEach(([c, a, b]) => g.r(wx + 1 + a, 7 + b, 9, 11, c));
    s.panes.push([wx + 1, 7, 18, 24]);
  }
  // A long table at the front with candles on it.
  g.r(70, 30, 52, 4, PAL.line);
  s.solid(66, 44, 60, 10);
  s.add(66, 36, 60, 18, 54, (p) => {
    p.r(66, 44, 60, 10, PAL.line); p.r(67, 45, 58, 4, '#f4ecd8'); p.r(67, 49, 58, 4, PAL.wood);
    for (let i = 0; i < 7; i++) { p.r(72 + i * 8, 39, 2, 5, PAL.wall); p.px(72 + i * 8, 37, PAL.flowers[1]); p.px(73 + i * 8, 38, '#f08c4a'); }
  });
  s.lamps.push({ x: 96, y: 40, r: 34 });
  for (const y of [72, 94, 116]) {
    Art.bench(s, 34, y); Art.bench(s, 58, y); Art.bench(s, 112, y); Art.bench(s, 136, y);
    for (let i = 0; i < 4; i++) s.surfaces[s.surfaces.length - 1 - i].kind = 'pew';
  }
  s.spots.push({ x: 96, y: 62, r: 18, action: 'candle' });
  s.hangouts.push({ scene: 'chapel', x: 47, y: 86, wait: 16 }, { scene: 'chapel', x: 147, y: 108, wait: 14 });
  s.buildNav();
  s.start = { x: 96, y: 142 };
  return s;
}

function buildWorld() {
  const town = buildTown();
  const cafe = buildCafe();
  const bookshop = buildBookshop();
  const pub = buildPub();
  const studio = buildStudio();
  const library = buildLibrary();
  const launderette = buildLaunderette();
  const hall = buildHall();
  const cinema = buildCinema();
  const icecream = buildIcecream();
  const chapel = buildChapel();
  return { town, cafe, bookshop, pub, studio, library, launderette, hall, cinema, icecream, chapel };
}
