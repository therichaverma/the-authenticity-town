// Original pixel art for the town, drawn from rectangles in the Sunny Square palette.
const PAL = {
  grass: ['#78be52', '#68ae48', '#8ece60'],
  path: '#e2c694', pathd: '#ccac7a', pathe: '#a6865c',
  water: ['#54aad8', '#70c0e6', '#bee8f4'], sand: '#ecd8a4',
  roofs: [['#ce5442', '#a03834', '#e87a58'], ['#467cb0', '#325c8c', '#689ecc'],
          ['#e2963e', '#b46a30', '#f4b860'], ['#7a60aa', '#5a4686', '#9a80c6']],
  wall: '#f8e8c4', walld: '#d6be96', wood: '#96603a', woodd: '#643e2a',
  leaf: ['#2e7c4a', '#469c50', '#74be5c'], trunk: '#70482e',
  line: '#322830', glass: '#7ec8e2', glassl: '#d2f2f8', stone: '#b2b4ba', stoned: '#7e808e',
  awn: ['#d64a46', '#faf0dc'], flowers: ['#f05a6e', '#fad650', '#fafaf0', '#b478e6'],
  book: '#3a9e5a', bookl: '#8adc8c',
  shirts: ['#e25454', '#4882c8', '#f6be46', '#825abe', '#46aa8c', '#e88aa8', '#5c6a78', '#f08c4a'],
  shadow: 'rgba(44,52,40,0.32)',
  lit: '#ffd06e', litl: '#fff0b0', litbar: '#784c42',
};
const SKINS = ['#f6c8a0', '#e4ac7c', '#b87a50', '#7a4c32'];
const HAIRS = ['#603a28', '#282432', '#d8a046', '#aa4632', '#8c8c98'];

function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

class Painter {
  constructor(ctx, ox = 0, oy = 0) { this.ctx = ctx; this.ox = ox; this.oy = oy; }
  r(x, y, w, h, c) { this.ctx.fillStyle = c; this.ctx.fillRect(x - this.ox, y - this.oy, w, h); }
  px(x, y, c) { this.r(x, y, 1, 1, c); }
  // Filled ellipse with hard edges, so it stays pixel art.
  ell(x0, y0, x1, y1, c) {
    const rx = (x1 - x0) / 2, ry = (y1 - y0) / 2, cx = x0 + rx, cy = y0 + ry;
    for (let y = Math.ceil(y0); y <= y1; y++) {
      const dy = (y - cy) / (ry || 1);
      const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const a = Math.round(cx - half), b = Math.round(cx + half);
      this.r(a, y, b - a + 1, 1, c);
    }
  }
}

// Capital letters five pixels tall, for words painted on signs.
const SIGN_FONT = {
  ' ': ['.', '.', '.', '.', '.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  E: ['###', '#..', '##.', '#..', '###'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  W: ['#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
};
// A wooden board on the roof with a little picture of what the place is, like the café's coffee cup
// and the bookshop's row of books. icon draws into a 28 x 7 space starting at (x, y).
function roofBadge(p, cx, y, icon) {
  p.r(cx - 16, y, 32, 11, PAL.line);
  p.r(cx - 15, y + 1, 30, 9, PAL.wood);
  icon(p, cx - 14, y + 2);
}
const BADGES = {
  // A cup of coffee with steam.
  cafe: (p, x, y) => {
    p.r(x + 9, y + 2, 9, 5, PAL.line); p.r(x + 10, y + 2, 7, 4, PAL.wall); p.r(x + 10, y + 2, 7, 1, '#c88a4a');
    p.r(x + 18, y + 3, 2, 1, PAL.line); p.r(x + 19, y + 3, 1, 3, PAL.line); p.r(x + 18, y + 5, 2, 1, PAL.line);
    p.px(x + 11, y, PAL.wall); p.px(x + 14, y + 1, PAL.wall); p.px(x + 15, y, PAL.wall);
  },
  // A row of books on a shelf.
  bookshop: (p, x, y) => {
    for (let i = 0; i < 8; i++) p.r(x + 3 + i * 3, y + (i % 3 === 1 ? 1 : 0), 2, 7 - (i % 3 === 1 ? 1 : 0), PAL.shirts[i % 8]);
  },
  // An open book.
  library: (p, x, y) => {
    p.r(x + 6, y, 16, 7, PAL.line); p.r(x + 7, y + 1, 6, 5, PAL.wall); p.r(x + 15, y + 1, 6, 5, PAL.wall);
    for (const ry of [y + 2, y + 4]) { p.r(x + 8, ry, 4, 1, PAL.stoned); p.r(x + 16, ry, 4, 1, PAL.stoned); }
  },
  // A T-shirt, fresh from the wash.
  launderette: (p, x, y) => {
    p.r(x + 8, y, 12, 3, PAL.line); p.r(x + 10, y, 8, 7, PAL.line);
    p.r(x + 9, y + 1, 10, 1, '#bee8f4'); p.r(x + 11, y + 1, 6, 5, '#bee8f4'); p.px(x + 14, y + 1, PAL.line);
    p.px(x + 5, y + 1, PAL.wall); p.px(x + 23, y + 4, PAL.wall); p.px(x + 4, y + 5, PAL.wall);
  },
  // A noticeboard with a pinned note.
  hall: (p, x, y) => {
    p.r(x + 7, y, 14, 7, PAL.line); p.r(x + 8, y + 1, 12, 5, '#c89a62');
    p.r(x + 9, y + 2, 5, 3, PAL.wall); p.r(x + 15, y + 2, 4, 3, '#fad650'); p.px(x + 11, y + 2, '#d64a46');
  },
  // A mug of ginger beer with a frothy top.
  pub: (p, x, y) => {
    p.r(x + 9, y, 8, 7, PAL.line); p.r(x + 10, y + 1, 6, 2, PAL.wall); p.r(x + 10, y + 3, 6, 3, '#d8a046');
    p.r(x + 17, y + 2, 2, 1, PAL.line); p.r(x + 18, y + 2, 1, 3, PAL.line); p.r(x + 17, y + 4, 2, 1, PAL.line);
  },
  // A painter's palette with a brush.
  studio: (p, x, y) => {
    p.r(x + 6, y, 14, 7, PAL.line); p.r(x + 7, y + 1, 12, 5, '#e2b46c'); p.r(x + 15, y + 4, 3, 2, PAL.line);
    [['#d64a46', 8, 1], ['#fad650', 11, 1], ['#4882c8', 14, 1], ['#78be52', 9, 4]].forEach(([c, a, b]) => p.r(x + a, y + b, 2, 2, c));
    for (let i = 0; i < 5; i++) p.px(x + 21 + i, y + 5 - i, PAL.woodd);
    p.r(x + 25, y, 2, 2, '#d64a46');
  },
  // A strip of film.
  cinema: (p, x, y) => {
    p.r(x + 2, y, 24, 7, PAL.line);
    for (let i = 0; i < 3; i++) p.r(x + 4 + i * 8, y + 2, 6, 3, ['#4882c8', '#fad650', '#d64a46'][i]);
    for (let i = x + 3; i < x + 26; i += 3) { p.px(i, y, PAL.wall); p.px(i, y + 6, PAL.wall); }
  },
  // A pink ice-cream cone.
  icecream: (p, x, y) => {
    p.r(x + 10, y, 8, 3, PAL.line); p.r(x + 11, y, 6, 2, '#f4b4c8'); p.px(x + 12, y, PAL.wall);
    p.r(x + 11, y + 3, 6, 1, '#e2b46c'); p.r(x + 12, y + 4, 4, 1, '#e2b46c'); p.r(x + 13, y + 5, 2, 2, '#c88a4a');
  },
  // A lit candle.
  chapel: (p, x, y) => {
    p.r(x + 12, y + 3, 4, 4, PAL.line); p.r(x + 13, y + 3, 2, 4, PAL.wall);
    p.px(x + 13, y + 1, PAL.flowers[1]); p.px(x + 14, y, '#f08c4a'); p.px(x + 14, y + 2, PAL.flowers[1]);
  },
  // An envelope.
  post: (p, x, y) => {
    p.r(x + 7, y, 14, 7, PAL.line); p.r(x + 8, y + 1, 12, 5, PAL.wall);
    for (let i = 0; i < 6; i++) { p.px(x + 8 + i, y + 1 + Math.min(i, 3), PAL.line); p.px(x + 19 - i, y + 1 + Math.min(i, 3), PAL.line); }
  },
};

// Writes capital letters in SIGN_FONT, centred on cx, with the top at y.
function signWord(p, cx, y, text, colour) {
  const width = [...text].reduce((n, ch, i) => n + SIGN_FONT[ch][0].length + (i ? 1 : 0), 0);
  let x = Math.round(cx - width / 2);
  for (const ch of text) {
    const g = SIGN_FONT[ch];
    g.forEach((bits, gy) => [...bits].forEach((b, gx) => { if (b === '#') p.px(x + gx, y + gy, colour); }));
    x += g[0].length + 1;
  }
}
const Art = {
  grass(s, rng) {
    const g = s.g;
    g.r(0, 0, s.w, s.h, PAL.grass[0]);
    for (let y = 0; y < s.h; y += 16) for (let x = 0; x < s.w; x += 16) {
      if ((x / 16 * 7 + y / 16 * 3) % 5 === 0) g.r(x, y, 16, 16, PAL.grass[1]);
    }
    for (let i = 0; i < s.w * s.h / 150; i++) {
      const x = Math.floor(rng() * s.w), y = Math.floor(rng() * s.h);
      const c = PAL.grass[rng() < 0.5 ? 1 : 2];
      g.px(x, y, c); g.px(x + 1, y - 1, c); g.px(x + 2, y, c);
    }
  },

  surface(s, rects, kind) {
    const inside = (x, y) => rects.some(([a, b, w, h]) => x >= a && x < a + w && y >= b && y < b + h);
    for (const [a, b, w, h] of rects) {
      for (let y = Math.max(0, b); y < Math.min(s.h, b + h); y++) {
        for (let x = Math.max(0, a); x < Math.min(s.w, a + w); x++) {
          const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([p, q]) => {
            const nx = x + p, ny = y + q;
            return nx >= 0 && ny >= 0 && nx < s.w && ny < s.h && !inside(nx, ny);
          });
          let c;
          if (kind === 'path') {
            const bx = (x + (Math.floor(y / 8) % 2 ? 4 : 0)) % 8;
            c = edge ? PAL.pathe : (bx === 0 || y % 8 === 0 ? PAL.pathd : PAL.path);
          } else {
            c = PAL.water[0];
            if (edge) c = PAL.sand;
            else if ((x + Math.floor(y / 6) * 11) % 23 < 5 && y % 6 === 0) c = PAL.water[1];
            else if ((x * 3 + Math.floor(y / 7) * 17) % 53 < 3 && y % 7 === 0) c = PAL.water[2];
          }
          s.g.px(x, y, c);
        }
      }
    }
  },

  tree(s, x, y, rng) {
    s.g.ell(x - 12, y + 1, x + 14, y + 8, PAL.shadow);
    s.solid(x - 3, y - 3, 7, 5);
    const dots = Array.from({ length: 9 }, () => [Math.floor(rng() * 18) - 9, Math.floor(rng() * 16) - 27]);
    s.add(x - 16, y - 40, 34, 46, y + 2, (p) => {
      p.r(x - 2, y - 10, 5, 13, PAL.trunk);
      p.r(x + 1, y - 10, 2, 13, PAL.line);
      p.ell(x - 14, y - 32, x + 15, y - 6, PAL.line);
      p.ell(x - 13, y - 31, x + 14, y - 7, PAL.leaf[0]);
      p.ell(x - 11, y - 31, x + 10, y - 12, PAL.leaf[1]);
      p.ell(x - 8, y - 30, x + 4, y - 22, PAL.leaf[2]);
      for (const [a, b] of dots) p.px(x + a, y + b, PAL.leaf[2]);
    });
  },

  bush(s, x, y) {
    s.solid(x + 1, y + 5, 14, 6);
    s.add(x, y, 16, 12, y + 11, (p) => {
      p.ell(x, y, x + 15, y + 11, PAL.line);
      p.ell(x + 1, y + 1, x + 14, y + 10, PAL.leaf[0]);
      p.ell(x + 3, y + 1, x + 11, y + 7, PAL.leaf[1]);
      p.px(x + 5, y + 3, PAL.leaf[2]); p.px(x + 9, y + 4, PAL.flowers[0]);
    });
  },

  flowers(s, x, y, n, rng, w = 22, h = 10) {
    for (let i = 0; i < n; i++) {
      const a = x + Math.floor(rng() * w), b = y + Math.floor(rng() * h);
      s.g.px(a, b + 1, PAL.leaf[0]);
      s.g.px(a, b, PAL.flowers[Math.floor(rng() * 4)]);
    }
  },

  window(p, lit, x, y) {
    p.r(x - 1, y - 1, 12, 12, PAL.woodd);
    p.r(x, y, 10, 10, PAL.glass);
    p.r(x + 1, y + 1, 3, 3, PAL.glassl);
    p.r(x + 4, y, 2, 10, PAL.woodd); p.r(x, y + 4, 10, 2, PAL.woodd);
    p.r(x - 1, y + 10, 12, 2, PAL.wood);
    if (lit) {
      lit.r(x, y, 10, 10, PAL.lit);
      lit.r(x, y, 3, 3, PAL.litl);
      lit.r(x + 4, y, 2, 10, PAL.litbar); lit.r(x, y + 4, 10, 2, PAL.litbar);
    }
  },

  shell(p, x, y, w, roof, rh, wh, door) {
    const [base, dark, light] = roof;
    p.r(x, y + rh, w, wh, PAL.line);
    p.r(x + 2, y + rh, w - 4, wh - 1, PAL.wall);
    p.r(x + 2, y + rh + wh - 6, w - 4, 5, PAL.walld);
    p.r(x + 2, y + rh, w - 4, 3, PAL.walld);
    p.r(x - 3, y, w + 6, rh + 2, PAL.line);
    p.r(x - 2, y + 1, w + 4, rh, base);
    for (let row = y + 5; row < y + rh; row += 5) {
      p.r(x - 2, row, w + 4, 1, dark);
      for (let sx = x + (Math.floor(row / 5) % 2) * 4; sx < x + w; sx += 8) {
        p.px(sx, row - 1, dark); p.px(sx, row - 2, dark);
      }
    }
    p.r(x - 2, y + 1, w + 4, 2, light);
    p.r(x - 2, y + rh - 1, w + 4, 2, dark);
    p.r(x + w - 12, y - 8, 7, 12, PAL.line);
    p.r(x + w - 11, y - 7, 5, 11, PAL.stoned);
    const b = y + rh + wh;
    p.r(door - 1, b - 21, 16, 21, PAL.woodd);
    p.r(door, b - 20, 14, 20, PAL.wood);
    p.r(door + 6, b - 20, 2, 20, PAL.woodd);
    p.px(door + 11, b - 10, PAL.sand);
    p.r(door - 1, b, 16, 2, PAL.stoned);
  },

  building(s, x, y, w, rh, wh, draw, door) {
    const b = y + rh + wh;
    s.g.r(x + 2, b, w, 5, PAL.shadow);
    s.solid(x - 3, y, w + 6, rh + wh);
    s.add(x - 4, y - 9, w + 8, rh + wh + 12, b + 1, draw, true);
    s.lamps.push({ x: door.x + 7, y: b + 4, r: 18 });
    return s.addDoor({ ...door, y: b, building: [x - 3, y - 9, w + 6, rh + wh + 9] });
  },

  house(s, x, y, w, roof, owner) {
    const dx = x + Math.floor(w / 2) - 7;
    Art.building(s, x, y, w, 32, 30, (p, lit) => {
      Art.shell(p, x, y, w, roof, 32, 30, dx);
      Art.window(p, lit, x + 7, y + 37);
      Art.window(p, lit, x + w - 17, y + 37);
    }, { x: dx, owner });
  },

  cafe(s, x, y) {
    const w = 104, dx = x + w / 2 - 7;
    Art.building(s, x, y, w, 34, 38, (p, lit) => {
      Art.shell(p, x, y, w, PAL.roofs[0], 34, 38, dx);
      Art.window(p, lit, x + 9, y + 50); Art.window(p, lit, x + 22, y + 50);
      Art.window(p, lit, x + w - 32, y + 50); Art.window(p, lit, x + w - 19, y + 50);
      p.r(x + 22, y + 35, w - 44, 9, PAL.line); p.r(x + 23, y + 36, w - 46, 7, '#a03834');
      signWord(p, x + w / 2, y + 37, 'CAFE', PAL.wall);
      for (let i = 0; i < w - 4; i += 8) {
        const iw = Math.min(8, w - 4 - i);
        p.r(x + 2 + i, y + 44, iw, 4, PAL.awn[(i / 8) % 2]);
        p.r(x + 2 + i, y + 48, iw, 1, PAL.line);
      }
      p.r(x + 2, y + 43, w - 4, 1, PAL.line);
      roofBadge(p, x + w / 2, y + 22, BADGES.cafe);
    }, { x: dx, to: 'cafe', label: 'the café' });
    s.lamps.push({ x: x + w / 2, y: y + 76, r: 44 });
  },

  bookshop(s, x, y) {
    const w = 76, dx = x + w / 2 - 7;
    Art.building(s, x, y, w, 30, 34, (p, lit) => {
      Art.shell(p, x, y, w, PAL.roofs[1], 30, 34, dx);
      Art.window(p, lit, x + 7, y + 40); Art.window(p, lit, x + 59, y + 40);
      roofBadge(p, x + w / 2, y + 18, BADGES.bookshop);
      p.r(x + 12, y + 31, w - 24, 8, PAL.line); p.r(x + 13, y + 32, w - 26, 6, PAL.roofs[1][1]);
      signWord(p, x + w / 2, y + 32, 'BOOKSHOP', PAL.wall);
    }, { x: dx, to: 'bookshop', label: 'the bookshop' });
  },

  table(s, x, y) {
    s.g.r(x + 1, y + 11, 18, 3, PAL.shadow);
    s.solid(x, y + 1, 20, 11);
    s.surfaces.push({ x: x + 12, y: y + 1, base: y + 15, kind: 'table', hit: [x, y, 20, 14] });
    s.add(x, y, 20, 14, y + 14, (p) => {
      p.r(x, y, 20, 8, PAL.line);
      p.r(x + 1, y + 1, 18, 5, PAL.wood);
      p.r(x + 8, y + 8, 4, 5, PAL.woodd);
      p.r(x + 3, y + 2, 3, 2, PAL.wall);
    });
  },

  bench(s, x, y) {
    s.g.r(x, y + 8, 22, 3, PAL.shadow);
    s.solid(x, y + 2, 22, 8);
    s.surfaces.push({ x: x + 11, y: y + 1, base: y + 10, kind: 'bench', hit: [x, y, 22, 10] });
    s.add(x, y, 22, 10, y + 9, (p) => {
      p.r(x, y, 22, 5, PAL.line); p.r(x + 1, y + 1, 20, 3, PAL.wood);
      p.r(x + 2, y + 5, 2, 4, PAL.woodd); p.r(x + 18, y + 5, 2, 4, PAL.woodd);
    });
  },

  // A flowerbed set into the paving: a low border of stones around grass and flowers.
  flowerbed(s, x, y, w, h, rng) {
    s.solid(x, y, w, h);
    s.g.r(x, y, w, h, PAL.line);
    s.g.r(x + 1, y + 1, w - 2, h - 2, PAL.stoned);
    s.g.r(x + 2, y + 2, w - 4, h - 4, PAL.grass[1]);
    for (let i = 0; i < (w * h) / 14; i++) {
      const a = x + 3 + Math.floor(rng() * (w - 6)), b = y + 3 + Math.floor(rng() * (h - 6));
      s.g.px(a, b + 1, PAL.leaf[0]);
      s.g.px(a, b, PAL.flowers[Math.floor(rng() * 4)]);
    }
  },

  lamp(s, x, y) {
    s.g.r(x - 3, y + 1, 7, 2, PAL.shadow);
    s.solid(x - 1, y - 1, 4, 3);
    s.lamps.push({ x: x + 1, y: y - 8, r: 40 });
    s.add(x - 2, y - 27, 6, 28, y + 1, (p, lit) => {
      p.r(x, y - 22, 2, 23, PAL.line);
      p.r(x - 2, y - 27, 6, 6, PAL.line); p.r(x - 1, y - 26, 4, 4, PAL.flowers[1]);
      lit.r(x - 1, y - 26, 4, 4, PAL.litl);
    }, true);
  },

  fountain(s, cx, cy) {
    s.g.ell(cx - 25, cy - 14, cx + 25, cy + 17, PAL.shadow);
    s.solid(cx - 24, cy - 14, 49, 28);
    s.sparkles.push(...[[-9, -20], [9, -19], [-13, -11], [13, -10], [-5, -24], [6, -24], [-1, -26], [2, -27]]
      .map(([a, b]) => ({ x: cx + a, y: cy + b, c: PAL.water[2] })));
    s.add(cx - 25, cy - 28, 50, 44, cy + 15, (p) => {
      p.ell(cx - 24, cy - 16, cx + 24, cy + 14, PAL.line);
      p.ell(cx - 23, cy - 15, cx + 23, cy + 13, PAL.stone);
      p.ell(cx - 18, cy - 11, cx + 18, cy + 9, PAL.water[0]);
      p.ell(cx - 11, cy - 7, cx + 8, cy + 3, PAL.water[1]);
      p.r(cx - 3, cy - 18, 7, 18, PAL.line); p.r(cx - 2, cy - 18, 5, 18, PAL.stone);
      p.r(cx - 7, cy - 21, 15, 4, PAL.line); p.r(cx - 6, cy - 20, 13, 2, PAL.stoned);
      p.r(cx - 1, cy - 27, 3, 6, PAL.water[2]);
    });
  },

  // A wooden board on two posts with words carved into a cream panel, in a tiny pixel font.
  signboard(s, x, y, lines) {
    const width = (t) => [...t].reduce((n, ch, i) => n + SIGN_FONT[ch][0].length + (i ? 1 : 0), 0);
    const w = Math.max(...lines.map(width)) + 10, h = lines.length * 7 + 5;
    s.g.r(x + 2, y + h + 6, w - 4, 3, PAL.shadow);
    s.solid(x + 4, y + h + 3, 4, 4); s.solid(x + w - 8, y + h + 3, 4, 4);
    s.add(x, y, w, h + 8, y + h + 7, (p) => {
      p.r(x + 4, y + h - 1, 4, 9, PAL.line); p.r(x + 5, y + h - 1, 2, 8, PAL.woodd);
      p.r(x + w - 8, y + h - 1, 4, 9, PAL.line); p.r(x + w - 7, y + h - 1, 2, 8, PAL.woodd);
      p.r(x, y, w, h, PAL.line);
      p.r(x + 1, y + 1, w - 2, h - 2, PAL.wood);
      p.r(x + 2, y + 2, w - 4, h - 4, PAL.wall);
      p.r(x + 2, y + h - 3, w - 4, 1, PAL.walld);
      lines.forEach((t, row) => {
        let cx = x + Math.round((w - width(t)) / 2);
        const cy = y + 3 + row * 7;
        for (const ch of t) {
          const g = SIGN_FONT[ch];
          g.forEach((bits, gy) => [...bits].forEach((b, gx) => { if (b === '#') p.px(cx + gx, cy + gy, PAL.woodd); }));
          cx += g[0].length + 1;
        }
      });
    });
  },

  fence(s, x, y, n) {
    s.solid(x, y + 3, n * 7 - 3, 5);
    s.add(x, y, n * 7, 10, y + 8, (p) => {
      p.r(x, y + 3, n * 7, 2, PAL.woodd);
      for (let i = 0; i < n; i++) { p.r(x + i * 7, y, 3, 9, PAL.line); p.r(x + i * 7 + 1, y + 1, 1, 7, PAL.wall); }
    });
  },

  stall(s, x, y, c) {
    s.g.r(x + 1, y + 21, 32, 3, PAL.shadow);
    s.solid(x + 1, y + 13, 32, 10);
    s.surfaces.push({ x: x + 17, y: y + 13, base: y + 24, kind: 'market stall', hit: [x, y, 34, 24] });
    s.add(x, y, 34, 24, y + 23, (p) => {
      p.r(x + 2, y + 8, 2, 13, PAL.woodd); p.r(x + 30, y + 8, 2, 13, PAL.woodd);
      p.r(x + 1, y + 14, 32, 8, PAL.line); p.r(x + 2, y + 15, 30, 5, PAL.wood);
      for (let i = 0; i < 5; i++) p.r(x + 4 + i * 6, y + 12, 4, 3, PAL.flowers[i % 4]);
      for (let i = 0; i < 34; i += 6) p.r(x + i, y, Math.min(6, 34 - i), 8, (i / 6) % 2 ? c : PAL.wall);
      p.r(x, y + 8, 34, 1, PAL.line);
    });
  },

  // A market food stall: a striped canopy with the stall's name on it, a counter with its goods,
  // and room behind for the stallholder. Food is free: you walk up and ask.
  kiosk(s, x, y, colour, word, goods) {
    s.g.r(x + 1, y + 26, 44, 3, PAL.shadow);
    s.solid(x, y + 4, 46, 23);
    s.surfaces.push({ x: x + 23, y: y + 13, base: y + 27, kind: 'market stall', hit: [x, y, 46, 28] });
    s.add(x - 1, y - 12, 48, 40, y + 26, (p) => {
      p.r(x + 2, y - 2, 3, 18, PAL.line); p.r(x + 41, y - 2, 3, 18, PAL.line);
      p.r(x + 3, y - 2, 1, 17, PAL.woodd); p.r(x + 42, y - 2, 1, 17, PAL.woodd);
      p.r(x - 1, y - 12, 48, 9, PAL.line);
      for (let i = 0; i < 46; i += 6) p.r(x + i, y - 11, Math.min(6, 46 - i), 7, (i / 6) % 2 ? colour : PAL.wall);
      p.r(x + 4, y - 4, 38, 9, PAL.line); p.r(x + 5, y - 3, 36, 7, PAL.wall);
      signWord(p, x + 23, y - 2, word, PAL.woodd);
      p.r(x, y + 14, 46, 13, PAL.line); p.r(x + 1, y + 15, 44, 4, '#c28a58'); p.r(x + 1, y + 19, 44, 7, PAL.wood);
      for (let i = 6; i < 44; i += 10) p.r(x + i, y + 20, 1, 6, PAL.woodd);
      goods.forEach((c, i) => {
        const gx = x + 4 + i * 7;
        p.r(gx, y + 11, 6, 4, PAL.line); p.r(gx + 1, y + 11, 4, 3, c); p.px(gx + 1, y + 11, PAL.wall);
      });
    });
  },

  // The pub, the Lantern: a green roof, a name board over the door and a lantern beside it.
  pub(s, x, y) {
    const w = 86, dx = x + w / 2 - 7, roof = ['#3e7a58', '#2c5a40', '#5c9a72'];
    Art.building(s, x, y, w, 30, 38, (p, lit) => {
      Art.shell(p, x, y, w, roof, 30, 38, dx);
      Art.window(p, lit, x + 8, y + 46); Art.window(p, lit, x + 20, y + 46);
      Art.window(p, lit, x + w - 30, y + 46); Art.window(p, lit, x + w - 18, y + 46);
      p.r(x + 12, y + 34, w - 24, 9, PAL.line); p.r(x + 13, y + 35, w - 26, 7, '#2c5a40');
      signWord(p, x + w / 2, y + 36, 'THE LANTERN', '#f4dcae');
      roofBadge(p, x + w / 2, y + 18, BADGES.pub);
      p.r(dx + 17, y + 47, 1, 4, PAL.line);
      p.r(dx + 15, y + 51, 5, 6, PAL.line); p.r(dx + 16, y + 52, 3, 4, PAL.flowers[1]);
      lit.r(dx + 16, y + 52, 3, 4, PAL.litl);
    }, { x: dx, to: 'pub', label: 'the Lantern' });
    s.lamps.push({ x: dx + 17, y: y + 54, r: 26 });
  },

  // The art studio: a purple roof with a skylight, a big window, and its name over the door.
  studio(s, x, y) {
    const w = 82, dx = x + w / 2 - 7;
    Art.building(s, x, y, w, 32, 38, (p, lit) => {
      Art.shell(p, x, y, w, PAL.roofs[3], 32, 38, dx);
      p.r(x + 12, y + 6, 26, 14, PAL.line); p.r(x + 13, y + 7, 24, 12, PAL.glass); p.r(x + 24, y + 7, 2, 12, PAL.line);
      p.r(x + 14, y + 8, 4, 3, PAL.glassl);
      p.r(x + 6, y + 44, 22, 18, PAL.woodd); p.r(x + 7, y + 45, 20, 16, PAL.glass);
      p.r(x + 16, y + 45, 2, 16, PAL.woodd); p.r(x + 8, y + 46, 4, 3, PAL.glassl);
      if (lit) lit.r(x + 7, y + 45, 20, 16, PAL.lit);
      Art.window(p, lit, x + w - 18, y + 46);
      p.r(x + 10, y + 34, w - 20, 9, PAL.line); p.r(x + 11, y + 35, w - 22, 7, PAL.wall);
      signWord(p, x + w / 2, y + 36, 'ART STUDIO', PAL.roofs[3][1]);
      roofBadge(p, x + w / 2 + 12, y + 20, BADGES.studio);
      [PAL.flowers[0], PAL.flowers[1], PAL.shirts[1], PAL.shirts[4]].forEach((c, i) => p.r(x + 13 + i * 3, y + 40, 2, 2, c));
    }, { x: dx, to: 'studio', label: 'the art studio' });
  },

  // The library: grey stone, columns either side of the door, and its name over the entrance.
  library(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7, roof = ['#7e808e', '#5e606e', '#a4a6b2'];
    Art.building(s, x, y, w, 30, 34, (p, lit) => {
      Art.shell(p, x, y, w, roof, 30, 34, dx);
      p.r(x + 2, y + 30, w - 4, 34, PAL.line); p.r(x + 3, y + 31, w - 6, 32, '#dcdad2'); p.r(x + 3, y + 58, w - 6, 5, '#c4c0b4');
      for (const cx of [x + 6, x + w - 11]) { p.r(cx, y + 40, 5, 24, PAL.line); p.r(cx + 1, y + 40, 3, 23, '#f2f0ea'); p.r(cx - 1, y + 38, 7, 3, PAL.line); }
      Art.window(p, lit, x + 14, y + 42); Art.window(p, lit, x + w - 25, y + 42);
      p.r(x + 10, y + 32, w - 20, 8, PAL.line); p.r(x + 11, y + 33, w - 22, 6, '#2c4e3c');
      signWord(p, x + w / 2, y + 33, 'LIBRARY', '#f4dcae');
      roofBadge(p, x + w / 2, y + 18, BADGES.library);
      const b = y + 64;
      p.r(dx - 1, b - 21, 16, 21, PAL.line); p.r(dx, b - 20, 14, 20, '#2c4e3c'); p.r(dx + 6, b - 20, 2, 20, PAL.line); p.px(dx + 11, b - 10, PAL.flowers[1]);
    }, { x: dx, to: 'library', label: 'the library' });
  },

  // The launderette: a teal front with a wide window full of round machine doors.
  launderette(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7, roof = ['#4a9aa0', '#337a80', '#6cbcc0'];
    Art.building(s, x, y, w, 28, 34, (p, lit) => {
      Art.shell(p, x, y, w, roof, 28, 34, dx);
      p.r(x + 4, y + 30, w - 8, 8, PAL.line); p.r(x + 5, y + 31, w - 10, 6, '#337a80');
      signWord(p, x + w / 2, y + 31, 'LAUNDERETTE', PAL.wall);
      roofBadge(p, x + w / 2, y + 16, BADGES.launderette);
      for (const wx of [x + 4, x + w - 21]) {
        p.r(wx, y + 41, 17, 14, PAL.line); p.r(wx + 1, y + 42, 15, 12, PAL.glassl);
        p.ell(wx + 3, y + 44, wx + 9, y + 50, PAL.line); p.ell(wx + 4, y + 45, wx + 8, y + 49, PAL.glass);
        if (lit) lit.r(wx + 1, y + 42, 15, 12, PAL.lit);
      }
    }, { x: dx, to: 'launderette', label: 'the launderette' });
  },

  // The town hall: cream walls, a red roof with a little clock on top, and its name over the door.
  townhall(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7;
    Art.building(s, x, y, w, 30, 36, (p, lit) => {
      Art.shell(p, x, y, w, PAL.roofs[0], 30, 36, dx);
      const cx = x + Math.floor(w / 2);
      p.r(cx - 7, y - 6, 14, 16, PAL.line); p.r(cx - 6, y - 5, 12, 14, PAL.wall);
      p.ell(cx - 5, y - 3, cx + 5, y + 7, PAL.line); p.ell(cx - 4, y - 2, cx + 4, y + 6, '#fff8e4');
      p.r(cx, y - 1, 1, 3, PAL.line); p.r(cx, y + 2, 3, 1, PAL.line);
      Art.window(p, lit, x + 7, y + 42); Art.window(p, lit, x + w - 17, y + 42);
      p.r(x + 10, y + 32, w - 20, 8, PAL.line); p.r(x + 11, y + 33, w - 22, 6, PAL.roofs[0][1]);
      signWord(p, cx, y + 33, 'TOWN HALL', PAL.wall);
      roofBadge(p, cx, y + 18, BADGES.hall);
    }, { x: dx, to: 'hall', label: 'the town hall' });
  },

  // The cinema: a dark red front with a lit marquee over the door and two film posters.
  cinema(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7, roof = ['#5a2e3a', '#3e1e28', '#7a4652'];
    Art.building(s, x, y, w, 30, 32, (p, lit) => {
      Art.shell(p, x, y, w, roof, 30, 32, dx);
      p.r(x + 2, y + 30, w - 4, 31, PAL.line); p.r(x + 3, y + 31, w - 6, 30, '#8a3a46');
      p.r(x + 4, y + 32, w - 8, 10, PAL.line); p.r(x + 5, y + 33, w - 10, 8, '#2a1a20');
      signWord(p, x + w / 2, y + 34, 'CINEMA', PAL.flowers[1]);
      roofBadge(p, x + w / 2, y + 18, BADGES.cinema);
      for (let i = x + 6; i < x + w - 6; i += 4) { p.px(i, y + 32, PAL.flowers[1]); if (lit) lit.px(i, y + 32, PAL.litl); }
      for (const px of [x + 5, x + w - 17]) {
        p.r(px, y + 44, 12, 15, PAL.line); p.r(px + 1, y + 45, 10, 13, PAL.wall);
        p.r(px + 2, y + 46, 8, 7, px === x + 5 ? PAL.shirts[1] : PAL.shirts[5]); p.r(px + 2, y + 54, 8, 1, PAL.line); p.r(px + 2, y + 56, 6, 1, PAL.line);
      }
    }, { x: dx, to: 'cinema', label: 'the cinema' });
  },

  // The ice-cream parlour: a pink and white awning, and a big cone over the door.
  icecream(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7, roof = ['#e88aa8', '#b0507a', '#f4b4c8'];
    Art.building(s, x, y, w, 30, 32, (p, lit) => {
      Art.shell(p, x, y, w, roof, 30, 32, dx);
      p.r(x + 4, y + 31, w - 8, 8, PAL.line); p.r(x + 5, y + 32, w - 10, 6, PAL.wall);
      signWord(p, x + w / 2, y + 32, 'ICE CREAM', '#b0507a');
      roofBadge(p, x + w / 2, y + 18, BADGES.icecream);
      for (let i = 0; i < w - 4; i += 6) { p.r(x + 2 + i, y + 40, Math.min(6, w - 4 - i), 5, (i / 6) % 2 ? '#e88aa8' : PAL.wall); }
      p.r(x + 2, y + 45, w - 4, 1, PAL.line);
      Art.window(p, lit, x + 6, y + 48); Art.window(p, lit, x + w - 16, y + 48);
    }, { x: dx, to: 'icecream', label: 'the ice-cream parlour' });
  },

  // The chapel: grey stone, a little bell tower, and a tall coloured window.
  chapel(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7, roof = ['#6e7080', '#50525e', '#8e909c'];
    Art.building(s, x, y, w, 36, 30, (p, lit) => {
      Art.shell(p, x, y, w, roof, 36, 30, dx);
      p.r(x + 2, y + 36, w - 4, 29, PAL.line); p.r(x + 3, y + 37, w - 6, 28, '#d6d2c8');
      for (let ry = y + 40; ry < y + 62; ry += 6) p.r(x + 3, ry, w - 6, 1, '#c0bcb0');
      const cx = x + Math.floor(w / 2);
      p.r(cx - 6, y - 12, 12, 16, PAL.line); p.r(cx - 5, y - 11, 10, 15, '#d6d2c8'); p.r(cx - 3, y - 8, 6, 6, PAL.line); p.r(cx - 2, y - 7, 4, 5, PAL.flowers[1]);
      p.r(cx - 7, y - 15, 14, 4, PAL.line); p.r(cx - 6, y - 14, 12, 2, roof[0]);
      for (const wx of [x + 6, x + w - 14]) {
        p.r(wx, y + 40, 8, 14, PAL.line);
        p.r(wx + 1, y + 41, 3, 6, '#4882c8'); p.r(wx + 4, y + 41, 3, 6, '#d64a46'); p.r(wx + 1, y + 47, 3, 6, '#fad650'); p.r(wx + 4, y + 47, 3, 6, PAL.leaf[1]);
        if (lit) lit.r(wx + 1, y + 41, 6, 12, PAL.lit);
      }
      p.r(x + 16, y + 37, w - 32, 7, PAL.line); p.r(x + 17, y + 38, w - 34, 5, '#50525e');
      signWord(p, cx, y + 38, 'CHAPEL', PAL.wall);
      roofBadge(p, cx, y + 22, BADGES.chapel);
    }, { x: dx, to: 'chapel', label: 'the chapel' });
  },

  // The post office: red, with its name over the door. You can't go in, but the postbox outside works.
  postoffice(s, x, y, w) {
    const dx = x + Math.floor(w / 2) - 7;
    Art.building(s, x, y, w, 30, 32, (p, lit) => {
      Art.shell(p, x, y, w, PAL.roofs[0], 30, 32, dx);
      p.r(x + 2, y + 30, w - 4, 31, PAL.line); p.r(x + 3, y + 31, w - 6, 30, '#c84a3e'); p.r(x + 3, y + 56, w - 6, 5, '#a03834');
      p.r(x + 4, y + 32, w - 8, 8, PAL.line); p.r(x + 5, y + 33, w - 10, 6, PAL.wall);
      signWord(p, x + w / 2, y + 33, 'POST OFFICE', '#a03834');
      roofBadge(p, x + w / 2, y + 18, BADGES.post);
      Art.window(p, lit, x + 6, y + 44); Art.window(p, lit, x + w - 16, y + 44);
      const b = y + 62;
      p.r(dx - 1, b - 21, 16, 21, PAL.line); p.r(dx, b - 20, 14, 20, '#2c4e3c'); p.r(dx + 6, b - 20, 2, 20, PAL.line);
    }, { x: dx, label: 'the post office' });
  },

  // A red pillar box for posting letters.
  postbox(s, x, y) {
    s.g.r(x - 1, y + 16, 10, 2, PAL.shadow);
    s.solid(x, y + 10, 8, 7);
    s.add(x - 1, y - 1, 10, 18, y + 17, (p) => {
      p.r(x - 1, y - 1, 10, 18, PAL.line); p.r(x, y, 8, 16, '#d64a46'); p.r(x, y, 8, 3, '#a03834');
      p.r(x + 2, y + 5, 4, 1, PAL.line); p.r(x, y + 14, 8, 2, PAL.line);
    });
  },

  // The playground: a set of swings, a slide and a sandpit.
  swings(s, x, y) {
    s.g.r(x + 2, y + 24, 34, 3, PAL.shadow);
    s.solid(x, y + 20, 4, 5); s.solid(x + 34, y + 20, 4, 5);
    s.add(x, y, 38, 26, y + 24, (p) => {
      p.r(x, y, 38, 3, PAL.line); p.r(x + 1, y + 1, 36, 1, '#4882c8');
      p.r(x, y, 3, 25, PAL.line); p.r(x + 1, y + 1, 1, 23, '#4882c8');
      p.r(x + 35, y, 3, 25, PAL.line); p.r(x + 36, y + 1, 1, 23, '#4882c8');
      for (const sx of [x + 9, x + 24]) { p.r(sx, y + 3, 1, 14, PAL.line); p.r(sx + 5, y + 3, 1, 14, PAL.line); p.r(sx - 1, y + 17, 8, 3, PAL.line); p.r(sx, y + 18, 6, 1, '#d64a46'); }
    });
  },
  slide(s, x, y) {
    s.g.r(x + 2, y + 28, 34, 3, PAL.shadow);
    s.solid(x, y + 14, 12, 16); s.solid(x + 12, y + 22, 24, 8);
    s.add(x, y, 38, 31, y + 30, (p) => {
      p.r(x, y, 12, 30, PAL.line); p.r(x + 1, y + 1, 10, 4, '#fad650');
      for (let ry = y + 7; ry < y + 29; ry += 5) p.r(x + 1, ry, 10, 2, '#d8a046');
      for (let i = 0; i < 24; i++) { p.r(x + 11 + i, y + 3 + Math.round(i * 0.95), 2, 5, PAL.line); p.r(x + 11 + i, y + 4 + Math.round(i * 0.95), 2, 3, '#d64a46'); }
    });
  },

  // A small garden shed for the community garden (you can't go in).
  shed(s, x, y) {
    s.g.r(x + 2, y + 26, 28, 3, PAL.shadow);
    s.solid(x, y + 8, 30, 19);
    s.add(x - 2, y, 34, 28, y + 27, (p) => {
      p.r(x - 2, y, 34, 10, PAL.line); p.r(x - 1, y + 1, 32, 8, '#46aa8c'); p.r(x - 1, y + 7, 32, 2, '#2e7c6a');
      p.r(x, y + 9, 30, 18, PAL.line); p.r(x + 1, y + 10, 28, 16, PAL.wood);
      for (let i = 4; i < 28; i += 4) p.r(x + 1 + i, y + 10, 1, 16, PAL.woodd);
      p.r(x + 10, y + 13, 10, 13, PAL.line); p.r(x + 11, y + 14, 8, 12, '#46aa8c');
    });
  },

  // A raised vegetable bed: dark soil with rows of greens. Solid.
  vegbed(s, x, y, w, h, rng) {
    s.solid(x, y, w, h);
    s.g.r(x, y, w, h, PAL.line); s.g.r(x + 1, y + 1, w - 2, h - 2, PAL.wood); s.g.r(x + 2, y + 2, w - 4, h - 4, '#5a3e2a');
    for (let ry = y + 4; ry < y + h - 3; ry += 4) {
      for (let rx = x + 4; rx < x + w - 3; rx += 4) {
        s.g.r(rx, ry, 2, 2, PAL.leaf[rng() < 0.5 ? 1 : 2]);
        if (rng() < 0.15) s.g.px(rx + 1, ry, [PAL.flowers[0], '#f08c4a'][Math.floor(rng() * 2)]);
      }
    }
  },

  // The bandstand in the park: a round stone floor, slim posts and a striped roof. Its steps are a
  // place to leave the book.
  bandstand(s, cx, cy) {
    s.g.ell(cx - 32, cy - 6, cx + 32, cy + 16, PAL.shadow);
    s.solid(cx - 28, cy - 8, 56, 18);
    s.surfaces.push({ x: cx, y: cy + 9, base: cy + 16, kind: 'bandstand step', hit: [cx - 28, cy - 46, 56, 62] });
    s.add(cx - 31, cy - 50, 62, 66, cy + 13, (p) => {
      p.ell(cx - 29, cy - 10, cx + 29, cy + 12, PAL.line);
      p.ell(cx - 28, cy - 9, cx + 28, cy + 11, PAL.stone);
      p.ell(cx - 24, cy - 8, cx + 24, cy + 6, '#d8d2c4');
      p.r(cx - 9, cy + 9, 18, 5, PAL.line); p.r(cx - 8, cy + 10, 16, 3, PAL.stoned);
      for (const px of [-25, -13, 11, 23]) { p.r(cx + px, cy - 28, 3, 30, PAL.line); p.r(cx + px + 1, cy - 28, 1, 29, PAL.wall); }
      for (let r = 0; r < 20; r++) {
        const half = 6 + r * 1.35;
        p.r(Math.round(cx - half - 1), cy - 48 + r, Math.round(half * 2 + 2), 1, PAL.line);
        p.r(Math.round(cx - half), cy - 48 + r, Math.round(half * 2), 1, PAL.line);
        for (let i = -half; i < half; i += 6) {
          const c = Math.floor((i + 40) / 6) % 2 ? '#d64a46' : PAL.wall;
          p.r(Math.round(cx + i), cy - 48 + r, Math.min(6, Math.round(half - i)), 1, c);
        }
      }
      p.r(cx - 34, cy - 29, 68, 3, PAL.line); p.r(cx - 33, cy - 28, 66, 1, '#a03834');
      p.r(cx - 1, cy - 54, 3, 7, PAL.line); p.r(cx, cy - 53, 1, 5, PAL.flowers[1]);
    });
  },

  // A duck on the water, bobbing in place.
  duck(s, x, y) {
    s.add(x, y, 8, 6, y + 6, (p) => {
      p.r(x, y + 2, 7, 4, PAL.line); p.r(x + 1, y + 3, 5, 2, PAL.wall);
      p.r(x + 4, y, 4, 4, PAL.line); p.r(x + 5, y + 1, 2, 2, PAL.leaf[0]); p.px(x + 7, y + 2, PAL.flowers[1]);
    });
  },

  // Interior pieces.
  room(s, floorA, floorB, wallColor, trim) {
    const g = s.g, { w, h } = s;
    g.r(0, 0, w, h, floorA);
    for (let y = 44; y < h; y += 8) {
      g.r(0, y, w, 1, floorB);
      for (let x = (y / 8 % 2) * 12; x < w; x += 24) g.r(x, y, 1, 8, floorB);
    }
    g.r(0, 0, w, 40, wallColor);
    g.r(0, 32, w, 8, trim);
    g.r(0, 32, w, 1, PAL.line);
    g.r(0, 40, w, 2, PAL.line);
    g.r(0, 42, w, 3, 'rgba(44,32,40,0.22)');
    g.r(0, 0, 4, h, PAL.line); g.r(w - 4, 0, 4, h, PAL.line); g.r(0, 0, w, 4, PAL.line);
    g.r(0, h - 5, w, 5, PAL.line);
    const mx = w / 2 - 12;
    g.r(mx, h - 12, 24, 12, '#b4483e');
    g.r(mx + 2, h - 10, 20, 8, '#d6705a');
    s.solid(0, 0, w, 44); s.solid(0, 0, 5, h); s.solid(w - 5, 0, 5, h);
    s.solid(0, h - 3, mx, 3); s.solid(mx + 24, h - 3, w - mx - 24, 3);
    s.exit = { x: mx, y: h - 8, w: 24, h: 8 };
  },

  roomWindow(s, x, y) {
    const g = s.g;
    g.r(x - 1, y - 1, 22, 20, PAL.woodd);
    g.r(x, y, 20, 18, '#a8dcf0');
    g.r(x + 2, y + 2, 5, 4, PAL.glassl);
    g.r(x + 9, y, 2, 18, PAL.woodd); g.r(x, y + 8, 20, 2, PAL.woodd);
    s.panes.push([x, y, 20, 18]);
  },

  plant(s, x, y) {
    s.solid(x, y + 8, 10, 6);
    s.add(x - 2, y - 8, 14, 22, y + 14, (p) => {
      p.ell(x - 2, y - 8, x + 11, y + 6, PAL.line);
      p.ell(x - 1, y - 7, x + 10, y + 5, PAL.leaf[0]);
      p.ell(x + 1, y - 7, x + 7, y, PAL.leaf[2]);
      p.r(x, y + 6, 10, 8, PAL.line); p.r(x + 1, y + 6, 8, 7, '#c86a46');
    });
  },

  cafeTable(s, x, y) {
    Art.table(s, x, y);
    s.solid(x - 8, y + 3, 36, 9);
    for (const sx of [x - 8, x + 21]) {
      s.add(sx, y + 2, 7, 12, y + 12, (p) => {
        p.r(sx, y + 2, 7, 6, PAL.line); p.r(sx + 1, y + 3, 5, 4, '#c86a46');
        p.r(sx + 1, y + 8, 1, 4, PAL.woodd); p.r(sx + 5, y + 8, 1, 4, PAL.woodd);
      });
    }
  },

  counter(s, x, y, w, machine) {
    s.solid(x, y, w, 15);
    s.add(x, y - 12, w, 28, y + 15, (p) => {
      p.r(x, y, w, 15, PAL.line);
      p.r(x + 1, y + 1, w - 2, 4, '#c28a58');
      p.r(x + 1, y + 5, w - 2, 9, PAL.wood);
      for (let i = 8; i < w - 2; i += 14) p.r(x + i, y + 6, 1, 8, PAL.woodd);
      if (machine) {
        p.r(x + 10, y - 11, 22, 13, PAL.line); p.r(x + 11, y - 10, 20, 11, PAL.stone);
        p.r(x + 13, y - 8, 7, 3, PAL.stoned); p.r(x + 23, y - 8, 2, 2, '#d64a46'); p.r(x + 27, y - 8, 2, 2, PAL.lit);
        for (let i = 0; i < 3; i++) { p.r(x + 40 + i * 7, y - 4, 5, 5, PAL.line); p.r(x + 41 + i * 7, y - 3, 3, 3, PAL.wall); }
        p.r(x + w - 34, y - 10, 26, 12, PAL.line); p.r(x + w - 33, y - 9, 24, 10, PAL.glassl);
        for (let i = 0; i < 3; i++) p.ell(x + w - 31 + i * 7, y - 5, x + w - 26 + i * 7, y, '#c88a4a');
      } else {
        for (let i = 0; i < 3; i++) p.r(x + 6 + i * 9, y - 3, 7, 4, PAL.shirts[i + 1]);
      }
    });
  },

  bookcase(s, x, y, w, rng) {
    const rows = [];
    for (let row = 0; row < 3; row++) {
      const spines = [];
      for (let i = 2; i < w - 3;) {
        const t = rng() < 0.7 ? 2 : 3;
        spines.push([i, t, PAL.shirts[Math.floor(rng() * 8)], 5 + Math.floor(rng() * 3)]);
        i += t + 1;
      }
      rows.push(spines);
    }
    s.solid(x, y + 16, w, 14);
    s.add(x, y, w, 31, y + 30, (p) => {
      p.r(x, y, w, 31, PAL.line); p.r(x + 1, y + 1, w - 2, 29, PAL.woodd);
      rows.forEach((spines, row) => {
        const by = y + 9 + row * 10;
        p.r(x + 1, by, w - 2, 1, PAL.wood);
        for (const [i, t, c, sh] of spines) p.r(x + i, by - sh, t, sh, c);
      });
    });
  },

  armchair(s, x, y) {
    s.solid(x, y + 8, 18, 8);
    s.add(x, y, 18, 17, y + 16, (p) => {
      p.r(x, y, 18, 16, PAL.line); p.r(x + 1, y + 1, 16, 8, '#467c70'); p.r(x + 3, y + 8, 12, 6, '#5ca08e');
      p.r(x + 1, y + 7, 3, 8, '#467c70'); p.r(x + 14, y + 7, 3, 8, '#467c70');
    });
  },

  // An easel with a half-finished painting on it.
  easel(s, x, y, rng) {
    s.solid(x + 1, y + 20, 14, 5);
    const blobs = Array.from({ length: 6 }, () => [1 + Math.floor(rng() * 9), 1 + Math.floor(rng() * 7), PAL.shirts[Math.floor(rng() * 8)]]);
    s.add(x, y, 16, 26, y + 25, (p) => {
      p.r(x + 2, y + 8, 2, 17, PAL.woodd); p.r(x + 12, y + 8, 2, 17, PAL.woodd); p.r(x + 7, y + 4, 2, 21, PAL.wood);
      p.r(x + 1, y, 14, 12, PAL.line); p.r(x + 2, y + 1, 12, 10, PAL.wall);
      for (const [a, b, c] of blobs) p.r(x + 2 + a, y + 1 + b, 3, 2, c);
      p.r(x, y + 12, 16, 2, PAL.woodd);
    });
  },

  // The long worktable in the studio, scattered with paint pots and brushes. A place for the book.
  worktable(s, x, y, w) {
    s.g.r(x + 2, y + 15, w - 2, 3, PAL.shadow);
    s.solid(x, y + 2, w, 13);
    s.surfaces.push({ x: x + Math.round(w * 0.7), y: y + 2, base: y + 17, kind: 'worktable', hit: [x, y, w, 17] });
    s.add(x, y - 4, w, 21, y + 16, (p) => {
      p.r(x, y, w, 10, PAL.line); p.r(x + 1, y + 1, w - 2, 7, '#d8c4a0'); p.r(x + 1, y + 7, w - 2, 1, '#b89c74');
      p.r(x + 3, y + 10, 3, 6, PAL.woodd); p.r(x + w - 6, y + 10, 3, 6, PAL.woodd);
      [PAL.flowers[0], PAL.shirts[1], PAL.flowers[1], PAL.shirts[4]].forEach((c, i) => {
        p.r(x + 6 + i * 6, y - 3, 5, 5, PAL.line); p.r(x + 7 + i * 6, y - 2, 3, 3, c);
      });
      p.r(x + w - 26, y + 2, 12, 1, PAL.woodd); p.r(x + w - 26, y + 4, 9, 1, PAL.woodd); p.px(x + w - 14, y + 2, PAL.shirts[0]);
      p.r(x + w - 40, y + 2, 10, 5, PAL.wall); p.r(x + w - 39, y + 3, 3, 2, PAL.shirts[2]);
    });
  },

  // The bar in the pub: a long dark counter with pumps on top. A place for the book.
  bar(s, x, y, w) {
    s.solid(x, y, w, 15);
    s.surfaces.push({ x: x + w - 14, y: y + 1, base: y + 16, kind: 'bar', hit: [x, y - 4, w, 20] });
    s.add(x, y - 12, w, 28, y + 15, (p) => {
      p.r(x, y, w, 15, PAL.line);
      p.r(x + 1, y + 1, w - 2, 4, '#8a5a38');
      p.r(x + 1, y + 5, w - 2, 9, '#5a3624');
      for (let i = 8; i < w - 2; i += 14) p.r(x + i, y + 6, 1, 8, '#3e2418');
      for (let i = 0; i < 3; i++) {
        const px = x + 12 + i * 9;
        p.r(px, y - 9, 3, 10, PAL.line); p.r(px + 1, y - 8, 1, 8, PAL.stone);
        p.r(px - 1, y - 12, 5, 4, PAL.line); p.r(px, y - 11, 3, 2, [PAL.flowers[1], PAL.flowers[0], PAL.leaf[1]][i]);
      }
      p.r(x + w - 30, y - 4, 5, 5, PAL.line); p.r(x + w - 29, y - 3, 3, 3, '#f4c95a');
    });
  },

  // A row of washing machines along the launderette's wall, each with a round door.
  machines(s, x, y, n) {
    s.solid(x, y, n * 22, 22);
    s.add(x, y - 2, n * 22, 24, y + 22, (p) => {
      for (let i = 0; i < n; i++) {
        const mx = x + i * 22;
        p.r(mx, y - 2, 21, 24, PAL.line); p.r(mx + 1, y - 1, 19, 22, '#f2f2f4'); p.r(mx + 1, y - 1, 19, 4, '#d8dce4');
        p.r(mx + 14, y, 4, 2, i % 2 ? PAL.leaf[1] : '#d64a46');
        p.ell(mx + 3, y + 5, mx + 17, y + 19, PAL.line); p.ell(mx + 4, y + 6, mx + 16, y + 18, '#a8dcf0');
        p.ell(mx + 6, y + 9, mx + 13, y + 16, PAL.shirts[(i * 3) % 8]);
      }
    });
  },

  // A row of plastic chairs, for waiting or for listening.
  chairs(s, x, y, n, colour) {
    s.solid(x, y + 2, n * 10, 8);
    s.add(x, y - 4, n * 10, 14, y + 10, (p) => {
      for (let i = 0; i < n; i++) {
        const cx = x + i * 10;
        p.r(cx, y - 4, 9, 6, PAL.line); p.r(cx + 1, y - 3, 7, 4, colour);
        p.r(cx, y + 2, 9, 4, PAL.line); p.r(cx + 1, y + 3, 7, 2, colour);
        p.r(cx + 1, y + 6, 1, 4, PAL.line); p.r(cx + 7, y + 6, 1, 4, PAL.line);
      }
    });
  },

  // The cinema screen across the top wall, faintly glowing, with red curtains either side.
  screen(s, x, y, w) {
    const g = s.g;
    g.r(x - 8, y, w + 16, 30, '#7a2c36'); for (let i = x - 8; i < x + w + 8; i += 4) g.r(i, y, 1, 30, '#5a1e28');
    g.r(x, y + 2, w, 26, PAL.line); g.r(x + 1, y + 3, w - 2, 24, '#dce8f4'); g.r(x + 1, y + 3, w - 2, 6, '#c4d8ec');
    s.lamps.push({ x: x + w / 2, y: y + 30, r: 50 });
  },

  // An upright piano.
  piano(s, x, y) {
    s.solid(x, y + 6, 30, 12);
    s.add(x, y - 10, 30, 28, y + 18, (p) => {
      p.r(x, y - 10, 30, 28, PAL.line); p.r(x + 1, y - 9, 28, 18, '#3a2418'); p.r(x + 1, y + 9, 28, 8, '#4e3020');
      p.r(x + 2, y + 6, 26, 4, PAL.wall); for (let i = 3; i < 28; i += 3) p.r(x + i, y + 6, 1, 3, PAL.line);
      p.r(x + 8, y - 6, 14, 8, PAL.wall); p.r(x + 10, y - 4, 10, 1, PAL.line); p.r(x + 10, y - 2, 8, 1, PAL.line);
    });
  },

  rug(s, x, y, w, h, a, b) {
    s.g.r(x, y, w, h, a); s.g.r(x + 3, y + 3, w - 6, h - 6, b);
    s.g.r(x + 6, y + 6, w - 12, h - 12, a);
  },
};

// Walk cycle: stand, left foot, stand, right foot for each direction.
const DIRS = { down: 0, up: 1, right: 2, left: 3 };
const CELL_W = 13, CELL_H = 20, FEET_X = 6, FEET_Y = 18;
const sheets = new Map();

function drawPerson(p, look, dir, step) {
  const x = 2, y = 4;
  const skin = SKINS[look.skin], hair = HAIRS[look.hair], shirt = PAL.shirts[look.shirt];
  p.r(x - 1, y + 13, 11, 2, 'rgba(40,40,50,0.3)');
  if (look.style === 'bun') { p.r(x + 3, y - 3, 3, 3, PAL.line); p.r(x + 4, y - 2, 1, 2, hair); }
  p.r(x, y, 9, 8, PAL.line);
  p.r(x + 1, y + 1, 7, 6, skin);
  p.r(x + 1, y + 1, 7, 3, hair);
  if (look.style === 'curly') { p.r(x - 1, y + 1, 11, 3, PAL.line); p.r(x, y + 1, 9, 2, hair); p.px(x, y + 3, hair); p.px(x + 8, y + 3, hair); }
  if (dir === 'down') {
    p.px(x + 2, y + 5, PAL.line); p.px(x + 6, y + 5, PAL.line);
    if (look.style === 'long') { p.r(x + 1, y + 4, 1, 4, hair); p.r(x + 7, y + 4, 1, 4, hair); }
  } else if (dir === 'up') {
    p.r(x + 1, y + 1, 7, 6, hair);
    if (look.style === 'long') p.r(x + 1, y + 7, 7, 2, hair);
  } else {
    const back = dir === 'right' ? x + 1 : x + 6, eye = dir === 'right' ? x + 6 : x + 2;
    p.r(back, y + 3, 2, look.style === 'long' ? 6 : 4, hair);
    p.px(eye, y + 5, PAL.line);
  }
  p.r(x + 1, y + 8, 7, 5, PAL.line);
  p.r(x + 2, y + 8, 5, 4, shirt);
  if (dir === 'down' || dir === 'up') { p.px(x + 1, y + 10, skin); p.px(x + 7, y + 10, skin); }
  else p.px(dir === 'right' ? x + 5 : x + 3, y + 10, skin);
  const l = step === 1 ? 1 : 2, rr = step === 3 ? 1 : 2;
  p.r(x + 2, y + 12, 2, l, PAL.line);
  p.r(x + 5, y + 12, 2, rr, PAL.line);
}

function personSheet(look) {
  const key = JSON.stringify(look);
  if (sheets.has(key)) return sheets.get(key);
  const c = makeCanvas(CELL_W * 4, CELL_H * 4);
  const ctx = c.getContext('2d');
  for (const [dir, row] of Object.entries(DIRS)) {
    for (let f = 0; f < 4; f++) drawPerson(new Painter(ctx, -f * CELL_W, -row * CELL_H), look, dir, f);
  }
  sheets.set(key, c);
  return c;
}

/* ---------- How guests look ----------
   Guests haven't signed in, so they can't open the book or talk. They're drawn with all colour
   drained, like an old photo, so people can tell at a glance. The greys are kept fairly light
   so guests still show up in the dark. */
const guestSheets = new Map();
function guestSheet(look) {
  const key = JSON.stringify(look);
  if (guestSheets.has(key)) return guestSheets.get(key);
  const src = personSheet(look);
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const grey = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    const v = grey + (225 - grey) * 0.25;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  guestSheets.set(key, c);
  return c;
}

// A closed hardback seen from above and slightly in front: cover, spine, page block and ribbon.
const BOOK_W = 13, BOOK_H = 11;
function bookSprite(p, x, y) {
  const spine = '#236b3e', gold = '#f0d890';
  p.r(x + 1, y, 11, 1, PAL.line); p.r(x, y + 1, 13, 8, PAL.line); p.r(x + 1, y + 9, 11, 1, PAL.line);
  p.r(x + 1, y + 1, 11, 6, PAL.book);
  p.r(x + 3, y + 1, 9, 1, PAL.bookl);
  p.r(x + 1, y + 1, 2, 8, spine);
  p.px(x + 1, y + 2, PAL.book); p.px(x + 1, y + 5, PAL.book);
  p.r(x + 5, y + 3, 5, 2, gold);
  p.r(x + 3, y + 7, 9, 1, '#fff4d8');
  p.r(x + 3, y + 8, 9, 1, PAL.walld);
  p.r(x + 10, y + 8, 1, 3, PAL.awn[0]);
}

/* ---------- Hazel, the town's guide ----------
   Hazel looks after newcomers and lights the lamps. She's drawn apart from everyone else:
   a straw hat with a green band, a green scarf the colour of the book, a long plum coat
   and a small lantern in her hand. Columns 0-3 are walking; 4 and 5 are a wave (facing down only). */
const GUIDE_LOOK = { skin: 1, hair: 0, coat: '#8a4f78', coatd: '#64385a', straw: '#f0cf78', strawd: '#c89e48' };
let guideSheetCanvas = null;
function drawGuide(p, dir, step, wave) {
  const x = 2, y = 4, L = GUIDE_LOOK;
  const skin = SKINS[L.skin], hair = HAIRS[L.hair];
  p.r(x - 1, y + 14, 11, 2, 'rgba(40,40,50,0.3)');
  // Head and long hair.
  p.r(x, y, 9, 8, PAL.line);
  p.r(x + 1, y + 1, 7, 6, skin);
  p.r(x + 1, y + 1, 7, 3, hair);
  if (dir === 'down') {
    p.px(x + 2, y + 5, PAL.line); p.px(x + 6, y + 5, PAL.line);
    p.r(x + 1, y + 4, 1, 4, hair); p.r(x + 7, y + 4, 1, 4, hair);
  } else if (dir === 'up') {
    p.r(x + 1, y + 1, 7, 6, hair); p.r(x + 1, y + 7, 7, 2, hair);
  } else {
    const back = dir === 'right' ? x + 1 : x + 6, eye = dir === 'right' ? x + 6 : x + 2;
    p.r(back, y + 3, 2, 6, hair);
    p.px(eye, y + 5, PAL.line);
  }
  // A wide straw hat with a green band.
  p.r(x - 2, y, 13, 2, PAL.line); p.r(x - 1, y, 11, 1, L.straw);
  p.r(x + 1, y - 3, 7, 3, PAL.line); p.r(x + 2, y - 2, 5, 2, L.straw);
  p.r(x + 2, y - 1, 5, 1, PAL.book);
  p.px(x - 1, y, L.strawd); p.px(x + 9, y, L.strawd);
  // A long coat, a little wider than a shirt, and the green scarf.
  p.r(x, y + 8, 9, 6, PAL.line);
  p.r(x + 1, y + 8, 7, 5, L.coat);
  p.r(x + 4, y + 9, 1, 4, L.coatd);
  p.r(x + 1, y + 8, 7, 1, PAL.book);
  if (dir === 'down') p.r(x + 6, y + 9, 1, 2, PAL.book);
  if (dir === 'up') p.r(x + 2, y + 9, 1, 2, PAL.book);
  // Hands, and the lantern in one of them.
  const lanternX = dir === 'left' ? x - 2 : x + 8;
  if (wave) {
    // The other arm is up, hand swinging side to side.
    const hx = wave === 1 ? x - 2 : x - 3;
    p.r(hx, y + 4, 3, 5, PAL.line); p.r(hx + 1, y + 5, 1, 3, L.coat); p.px(hx + 1, y + 4, skin);
  } else if (dir === 'down' || dir === 'up') p.px(x + 1, y + 11, skin);
  p.r(lanternX, y + 10, 3, 4, PAL.line);
  p.px(lanternX + 1, y + 11, PAL.litl); p.px(lanternX + 1, y + 12, PAL.lit);
  const l = step === 1 ? 1 : 2, rr = step === 3 ? 1 : 2;
  p.r(x + 2, y + 14, 2, l, PAL.line);
  p.r(x + 5, y + 14, 2, rr, PAL.line);
}
function guideSheet() {
  if (guideSheetCanvas) return guideSheetCanvas;
  const c = makeCanvas(CELL_W * 6, CELL_H * 4);
  const ctx = c.getContext('2d');
  for (const [dir, row] of Object.entries(DIRS)) {
    for (let f = 0; f < 4; f++) drawGuide(new Painter(ctx, -f * CELL_W, -row * CELL_H), dir, f, 0);
  }
  for (let w = 1; w <= 2; w++) drawGuide(new Painter(ctx, -(3 + w) * CELL_W, 0), 'down', 0, w);
  guideSheetCanvas = c;
  return c;
}

