/* ---------- The entrance you see first ----------
   A full-screen, front-on way into town, drawn over the square where Hazel is waiting.
   The way in is a Japanese-style wooden gate filling the whole screen, with no roof or name on it.
   Its two doors slide apart from the centre (?opening=9, the one everyone sees); 8 is a single door
   sliding right to left. The town's name then drops in on a wooden board (see townname.js). Versions with a roof and plaque are 5, 6 and 7, and one in a smaller wall is 4.
   The earlier tries are still here to compare, by address only (?opening=1, 2 or 3):
     1. Big wooden doors that swing open towards you, then the town sign drops in on ropes.
     2. A stone archway with the name carved above it and iron gates you can see the town through.
     3. A hedge with a wooden farm gate and a painted sign hanging from a beam.
   Everything is pixel art drawn at the town's own pixel size, so it matches the rest of the game.
   Doors and gates are separate pieces, so they can slide or swing when they open. */
const Entrance = (() => {
  const SIGN = 'The Authenticity Town';
  let root = null, kind = 0, hanging = null;

  // A canvas sized in town pixels, shown at the town's zoom.
  function pixelCanvas(w, h) {
    const c = makeCanvas(w, h), k = view.scale;
    c.style.width = `${w * k}px`;
    c.style.height = `${h * k}px`;
    return c;
  }
  function place(el, x, y) {
    const k = view.scale;
    Object.assign(el.style, { position: 'absolute', left: `${x * k}px`, top: `${y * k}px` });
  }
  function sign(cls) {
    const el = document.createElement('div');
    el.className = `ent-sign ${cls}`;
    el.textContent = SIGN;
    return el;
  }
  // Draws the left piece, then a mirrored copy for the right.
  function mirrored(src) {
    const c = pixelCanvas(src.width, src.height), g = c.getContext('2d');
    g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0);
    return c;
  }
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  };

  /* ---------- 1. Big wooden doors ---------- */
  function door(w, h) {
    const c = pixelCanvas(w, h), p = new Painter(c.getContext('2d')), rng = mulberry(41);
    const woods = ['#8e5836', '#9a6340', '#84512f'];
    p.r(0, 0, w, h, '#3a2418');
    for (let x = 3, i = 0; x < w - 3; x += 10, i++) {
      const col = woods[i % 3], pw = Math.min(9, w - 3 - x);
      p.r(x, 3, pw, h - 6, col);
      p.r(x, 3, 1, h - 6, shade(col, 1.18));
      p.r(x + pw - 1, 3, 1, h - 6, shade(col, 0.72));
      // Grain and the odd knot.
      for (let g = 0; g < h / 7; g++) p.r(x + 1 + Math.floor(rng() * (pw - 2)), 3 + Math.floor(rng() * (h - 10)), 1, 3 + Math.floor(rng() * 7), shade(col, 0.82));
      if (rng() > 0.4) { const ky = 10 + Math.floor(rng() * (h - 20)); p.r(x + 3, ky, 3, 2, shade(col, 0.6)); p.px(x + 4, ky, shade(col, 0.45)); }
    }
    // A heavy frame, darker where the two doors meet.
    p.r(0, 0, w, 3, '#2a1a12'); p.r(0, h - 3, w, 3, '#2a1a12'); p.r(0, 0, 3, h, '#2a1a12');
    p.r(w - 3, 0, 3, h, '#1e120c'); p.r(w - 4, 0, 1, h, '#4a2e20');
    // Iron straps with rivets.
    for (const fy of [0.2, 0.8]) {
      const y = Math.round(h * fy);
      p.r(0, y, w, 7, '#2a2830'); p.r(0, y + 1, w, 1, '#67636f'); p.r(0, y + 6, w, 1, '#18161c');
      for (let x = 6; x < w - 4; x += 11) { p.r(x, y + 3, 2, 2, '#9c9aa8'); p.px(x, y + 3, '#dddce4'); }
    }
    // A ring handle on an iron plate, near the middle.
    const hx = w - 16, hy = Math.round(h * 0.5);
    p.r(hx - 5, hy - 7, 11, 11, '#2a2830'); p.r(hx - 4, hy - 6, 9, 9, '#45424c');
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
      const d = Math.hypot(x, y - 1);
      if (y > -1 && d >= 5.5 && d <= 7.5) p.px(hx + x, hy + y, d < 6.5 && x < 0 ? '#8a8894' : '#2a2830');
    }
    return c;
  }
  function buildDoors(W, H) {
    const half = Math.ceil(W / 2);
    const left = door(half, H), right = mirrored(left);
    left.className = 'ent-piece hinge-left'; right.className = 'ent-piece hinge-right';
    place(left, 0, 0); place(right, W - half, 0);
    root.append(left, right);
    return () => {
      left.classList.add('swing-left'); right.classList.add('swing-right');
      Sound.gate();
      setTimeout(() => { root.classList.add('gone'); }, 1500);
      setTimeout(dropSign, 1900);
      return 3.6;
    };
  }
  // After the doors, the town's name drops in on two ropes and swings to a stop.
  function dropSign() {
    hanging = sign('hang wood');
    hanging.style.setProperty('--px', `${view.scale}px`);
    document.body.append(hanging);
    setTimeout(() => Sound.thunk(), 620);
  }

  /* ---------- 2. Stone archway with iron gates ---------- */
  function buildArch(W, H) {
    const ow = Math.min(Math.round(W * 0.46), 170), r = Math.floor(ow / 2), cx = Math.floor(W / 2);
    const oTop = Math.max(46, Math.round(H * 0.3)), springY = oTop + r, ox = cx - r;
    const inside = (x, y) => y >= springY ? x >= ox && x < ox + 2 * r : y >= oTop && Math.hypot(x + 0.5 - cx, y + 0.5 - springY) < r;

    const wall = pixelCanvas(W, H), p = new Painter(wall.getContext('2d')), rng = mulberry(7);
    const stones = ['#a8a4ae', '#9b98a3', '#b5b2bb', '#908d99'];
    p.r(0, 0, W, H, '#5e5a64');
    for (let y = 0, row = 0; y < H; y += 7, row++) {
      for (let x = (row % 2) * -7; x < W; x += 14) {
        const c = stones[Math.floor(rng() * 4)];
        p.r(x + 1, y + 1, 13, 6, c); p.r(x + 1, y + 1, 13, 1, shade(c, 1.12)); p.r(x + 1, y + 6, 13, 1, shade(c, 0.86));
      }
    }
    // The arch's ring of big stones, and the side posts below it.
    for (let y = oTop - 9; y < H; y++) for (let x = ox - 9; x < ox + 2 * r + 9; x++) {
      if (inside(x, y)) continue;
      let on = false, seam = false;
      if (y < springY) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - springY), a = Math.atan2(springY - y, x - cx);
        on = d >= r && d < r + 9;
        seam = Math.abs(((a / Math.PI) * 11) % 1) < 0.09 || d >= r + 8;
      } else {
        on = (x >= ox - 9 && x < ox) || (x >= ox + 2 * r && x < ox + 2 * r + 9);
        seam = (y - springY) % 12 === 0 || x === ox - 9 || x === ox + 2 * r + 8;
      }
      if (on) p.px(x, y, seam ? '#6a6670' : (x + y) % 9 === 0 ? '#d4d0d8' : '#c6c2cc');
    }
    // The keystone at the top of the arch.
    p.r(cx - 5, oTop - 11, 11, 13, '#5e5a64'); p.r(cx - 4, oTop - 10, 9, 11, '#d4d0d8'); p.r(cx - 4, oTop + 0, 9, 1, '#a8a4ae');
    // Ivy creeping over the wall.
    const leaf = ['#2e7c4a', '#469c50', '#74be5c', '#215c38'];
    for (let i = 0; i < 140; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = Math.round(cx + side * (r + 12 + rng() * (W / 2 - r - 10)) * (rng() < 0.3 ? 0.6 : 1));
      const y = Math.round(rng() < 0.6 ? rng() * (oTop + 10) : rng() * H);
      for (let k = 0; k < 6; k++) p.px(x + Math.floor(rng() * 5) - 2, y + Math.floor(rng() * 5) - 2, leaf[Math.floor(rng() * 4)]);
    }
    // Two lanterns on brackets either side of the arch.
    for (const lx of [ox - 22, ox + 2 * r + 16]) {
      const ly = springY + 6;
      p.r(lx - 1, ly - 2, 8, 2, '#2a2830');
      p.r(lx, ly, 6, 9, '#2a2830'); p.r(lx + 1, ly + 1, 4, 6, '#ffd06e'); p.r(lx + 2, ly + 2, 2, 3, '#fff0b0');
    }
    // Cut the archway out, so the town shows through.
    const g = wall.getContext('2d');
    for (let y = oTop; y < H; y++) for (let x = ox; x < ox + 2 * r; x++) if (inside(x, y)) g.clearRect(x, y, 1, 1);
    wall.className = 'ent-piece';
    place(wall, 0, 0);
    root.append(wall);

    // Iron gates, one per half of the arch, bars only so you can see between them.
    const gw = r, gh = H - oTop;
    const gate = pixelCanvas(gw, gh), q = new Painter(gate.getContext('2d'));
    const iron = '#26242c', ironl = '#5a5664';
    const inGate = (x, y) => inside(ox + x, oTop + y);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        if (!inGate(x, y)) continue;
        const edgeTop = !inGate(x, y - 2);
        const bar = (x - 1) % 7 < 2, rail = [0.42, 0.88].some((f) => Math.abs(y - Math.round(gh * f)) < 1.5);
        const frame = x < 2 || x >= gw - 2 || edgeTop;
        if (bar || rail || frame) q.px(x, y, (bar && (x - 1) % 7 === 0) || (frame && x < 2) ? ironl : iron);
      }
    }
    // Spear tips on each bar, and a curl of scrollwork between the rails.
    for (let x = 1; x < gw; x += 7) {
      let top = 0;
      while (top < gh && !inGate(x, top + 2)) top++;
      q.r(x - 1, top + 3, 4, 2, iron); q.px(x, top + 2, ironl);
    }
    const sy = Math.round(gh * 0.65);
    for (let x = 6; x < gw - 6; x += 14) {
      for (let a = 0; a < 6.3; a += 0.25) q.px(Math.round(x + 3 + Math.cos(a) * 4), Math.round(sy + Math.sin(a) * 4), iron);
    }
    const left = gate, right = mirrored(gate);
    left.className = 'ent-piece hinge-left'; right.className = 'ent-piece hinge-right';
    place(left, ox, oTop); place(right, ox + r, oTop);
    root.append(left, right);

    // The name, carved into a stone plaque above the arch.
    const plaque = sign('carved');
    plaque.style.setProperty('--px', `${view.scale}px`);
    place(plaque, cx, oTop - 14);
    root.append(plaque);
    root.style.transformOrigin = `${cx * view.scale}px ${springY * view.scale}px`;
    return () => {
      left.classList.add('swing-left'); right.classList.add('swing-right');
      Sound.gate();
      setTimeout(() => root.classList.add('through'), 1300);
      return 3.2;
    };
  }

  /* ---------- 3. A hedge and a wooden farm gate ---------- */
  function buildFarmGate(W, H) {
    const ow = Math.min(Math.round(W * 0.38), 128), cx = Math.floor(W / 2), ox = cx - Math.floor(ow / 2);
    const hedgeTop = Math.round(H * 0.5), postTop = Math.max(30, Math.round(H * 0.2)), gateTop = hedgeTop + 4;
    const front = pixelCanvas(W, H), p = new Painter(front.getContext('2d')), rng = mulberry(19);
    const leaf = ['#2e7c4a', '#469c50', '#3a8c4e', '#74be5c', '#215c38'];
    // The hedge, with a lumpy top and a few flowers in it.
    const gap = (x) => x >= ox - 6 && x < ox + ow + 6;
    const tops = [];
    for (let x = 0; x < W; x++) {
      tops[x] = hedgeTop + Math.round(Math.sin(x * 0.35) * 2 + Math.sin(x * 0.11) * 2);
      if (!gap(x)) p.r(x, tops[x], 1, H - tops[x], '#1f5a34');
    }
    // Leaf clumps, back to front: each a rounded blob, lit from the top left.
    for (let i = 0; i < (W * (H - hedgeTop)) / 9; i++) {
      const x = Math.floor(rng() * W), y = hedgeTop - 2 + Math.floor(rng() * (H - hedgeTop + 2));
      if (gap(x) || gap(x + 4) || y < tops[x] - 1) continue;
      const c = leaf[Math.floor(rng() * 3)];
      p.r(x, y + 1, 5, 2, c); p.r(x + 1, y, 3, 4, c);
      p.r(x + 1, y, 2, 1, shade(c, 1.35)); p.px(x, y + 1, shade(c, 1.2));
      p.r(x + 1, y + 3, 3, 1, shade(c, 0.7));
    }
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rng() * W), y = hedgeTop + 6 + Math.floor(rng() * (H - hedgeTop - 8));
      if (x >= ox - 8 && x < ox + ow + 8) continue;
      const c = PAL.flowers[Math.floor(rng() * 4)];
      p.px(x, y, c); p.px(x - 1, y, c); p.px(x + 1, y, c); p.px(x, y - 1, c); p.px(x, y, '#fad650');
    }
    // Two tall posts and a beam across the top.
    const post = (x) => {
      p.r(x, postTop, 7, H - postTop, '#3a2418');
      p.r(x + 1, postTop + 1, 5, H - postTop, '#9a6a40');
      p.r(x + 1, postTop + 1, 1, H - postTop, '#b88a58');
      for (let y = postTop + 6; y < H; y += 9) p.r(x + 3 + (y % 2), y, 1, 4, '#7a5030');
      p.r(x - 1, postTop - 3, 9, 4, '#3a2418'); p.r(x, postTop - 2, 7, 2, '#7a5030');
    };
    post(ox - 7); post(ox + ow);
    p.r(ox - 10, postTop + 3, ow + 20, 6, '#3a2418');
    p.r(ox - 9, postTop + 4, ow + 18, 4, '#9a6a40');
    p.r(ox - 9, postTop + 4, ow + 18, 1, '#b88a58');
    front.className = 'ent-piece';
    place(front, 0, 0);
    root.append(front);

    // The gate itself: five rails, two uprights and a brace, with gaps you can see through.
    const gh = H - gateTop;
    const gate = pixelCanvas(ow, gh), q = new Painter(gate.getContext('2d'));
    const wood = '#d2a66e', woodd = '#a87a48', line = '#4a3020';
    const plank = (x, y, w, h) => { q.r(x, y, w, h, line); q.r(x + 1, y + 1, w - 2, h - 2, wood); q.r(x + 1, y + h - 2, w - 2, 1, woodd); };
    const rails = [0.04, 0.24, 0.44, 0.64, 0.84].map((f) => Math.round(gh * f));
    rails.forEach((y) => plank(0, y, ow, 6));
    // The diagonal brace, from the bottom by the hinge to the top by the latch.
    const y0 = rails[4] + 3, y1 = rails[0] + 3;
    for (let x = 6; x < ow - 6; x++) {
      const y = Math.round(y0 + (y1 - y0) * ((x - 6) / (ow - 12)));
      q.r(x, y - 2, 1, 5, line); q.r(x, y - 1, 1, 3, wood);
    }
    rails.forEach((y) => q.r(1, y + 1, ow - 2, 4, wood));
    plank(0, 0, 7, gh); plank(ow - 7, 0, 7, gh);
    // An iron latch and hinges.
    q.r(ow - 10, rails[1] + 1, 8, 4, '#2a2830'); q.px(ow - 9, rails[1] + 2, '#8a8894');
    for (const y of [rails[0], rails[4]]) { q.r(0, y + 1, 5, 4, '#2a2830'); q.px(1, y + 2, '#8a8894'); }
    gate.className = 'ent-piece hinge-left';
    place(gate, ox, gateTop);
    root.append(gate);

    // The sign hangs from the beam on two short chains, swaying a little.
    const board = sign('hang-short painted');
    board.style.setProperty('--px', `${view.scale}px`);
    place(board, cx, postTop + 16);
    root.append(board);
    root.style.transformOrigin = `${cx * view.scale}px ${(gateTop + gh / 2) * view.scale}px`;
    return () => {
      gate.classList.add('swing-left', 'slow');
      Sound.gate();
      setTimeout(() => root.classList.add('through'), 1500);
      return 3.4;
    };
  }

  /* ---------- 4. A Japanese wooden gate with sliding doors ----------
     A curved roof of grey tiles on two thick pillars, the name on a dark plaque between the beams,
     white plastered walls running off to each side, and paper lanterns hanging from the eaves.
     The doors sit behind the pillars and walls, so they disappear behind them as they slide open. */
  function buildJapaneseGate(W, H) {
    const cx = Math.floor(W / 2), ow = Math.min(Math.round(W * 0.44) & ~1, 160), ox = cx - ow / 2, pw = 10;
    const roofTop = Math.max(6, Math.round(H * 0.07)), roofH = 24, roofBottom = roofTop + roofH;
    const gateTop = roofBottom + 26, wallTop = Math.max(gateTop + 4, Math.round(H * 0.44)), baseTop = Math.round(H * 0.8);
    const front = pixelCanvas(W, H), p = new Painter(front.getContext('2d')), rng = mulberry(23);
    const wood = '#5a3420', woodd = '#3a2016', woodl = '#7a4a2c', line = '#1e120c';
    const tile = '#5c626e', tiled = '#40454f', tilel = '#7a808c', plaster = '#f2ead8', plasterd = '#ded4be';

    // A strip of tiled roof: rows of round tiles with a dark ridge, used on the walls and the gate.
    const tiles = (x0, x1, y, h) => {
      p.r(x0, y, x1 - x0, h, line);
      for (let x = x0; x < x1; x++) {
        const col = (x - x0) % 5;
        p.r(x, y + 1, 1, h - 2, col < 2 ? tiled : col === 2 ? tilel : tile);
      }
      p.r(x0, y, x1 - x0, 2, '#2e323a');
      for (let x = x0 + 1; x < x1; x += 5) { p.r(x, y + h - 2, 3, 2, tilel); p.px(x + 1, y + h - 1, '#9aa0ac'); }
    };

    // The walls either side: dark boards at the bottom, white plaster above, a small tiled cap on top.
    for (const [x0, x1] of [[0, ox - pw], [ox + ow + pw, W]]) {
      if (x1 <= x0) continue;
      p.r(x0, wallTop, x1 - x0, H - wallTop, plaster);
      for (let i = 0; i < (x1 - x0) * (baseTop - wallTop) / 14; i++) p.px(x0 + Math.floor(rng() * (x1 - x0)), wallTop + 3 + Math.floor(rng() * (baseTop - wallTop - 3)), plasterd);
      for (let x = x0 + 18; x < x1 - 3; x += 34) { p.r(x, wallTop + 2, 3, baseTop - wallTop - 2, wood); p.r(x, wallTop + 2, 1, baseTop - wallTop - 2, woodl); }
      p.r(x0, baseTop, x1 - x0, H - baseTop, wood);
      for (let y = baseTop; y < H; y += 5) p.r(x0, y, x1 - x0, 1, woodd);
      p.r(x0, baseTop, x1 - x0, 1, line);
      p.r(x0, wallTop, x1 - x0, 2, wood);
      tiles(x0 - 2, x1 + 2, wallTop - 7, 7);
    }

    // The pillars, with a stone footing.
    for (const x of [ox - pw, ox + ow]) {
      p.r(x, roofBottom, pw, H - roofBottom, line);
      p.r(x + 1, roofBottom, pw - 2, H - roofBottom, wood);
      p.r(x + 1, roofBottom, 2, H - roofBottom, woodl);
      p.r(x + pw - 3, roofBottom, 1, H - roofBottom, woodd);
      for (let y = roofBottom + 12; y < H - 8; y += 17) p.r(x + 4, y, 1, 6, woodd);
      p.r(x - 2, H - 6, pw + 4, 6, '#7e808e'); p.r(x - 2, H - 6, pw + 4, 1, '#b2b4ba');
    }
    // Two beams across: a wide one under the roof, and a lower one over the doors. The plaque sits between.
    const outer0 = ox - pw - 6, outer1 = ox + ow + pw + 6;
    p.r(outer0, roofBottom + 1, outer1 - outer0, 7, line);
    p.r(outer0 + 1, roofBottom + 2, outer1 - outer0 - 2, 5, wood);
    p.r(outer0 + 1, roofBottom + 2, outer1 - outer0 - 2, 1, woodl);
    p.r(ox - pw, gateTop - 6, ow + 2 * pw, 6, line);
    p.r(ox - pw + 1, gateTop - 5, ow + 2 * pw - 2, 4, wood);
    p.r(ox - pw + 1, gateTop - 5, ow + 2 * pw - 2, 1, woodl);
    p.r(cx - 1, roofBottom + 8, 3, gateTop - roofBottom - 14, wood);

    // The roof: wider at the eaves than at the ridge, with the corners turned up.
    const half0 = ow / 2 + pw + 16, half1 = ow / 2 + pw + 34;
    for (let r = 0; r < roofH; r++) {
      const f = r / (roofH - 1), half = Math.round(half0 + (half1 - half0) * f * f);
      for (let x = cx - half; x < cx + half; x++) {
        const col = ((x - cx) % 6 + 6) % 6;
        p.px(x, roofTop + r, col < 2 ? tiled : col === 2 ? tilel : tile);
      }
      p.px(cx - half, roofTop + r, line); p.px(cx + half - 1, roofTop + r, line);
    }
    // Ridge along the top, with tall end tiles; the eave edge with its row of round tile ends.
    p.r(cx - half0 - 2, roofTop - 4, 2 * half0 + 4, 6, line);
    p.r(cx - half0 - 1, roofTop - 3, 2 * half0 + 2, 4, '#2e323a');
    p.r(cx - half0 - 1, roofTop - 3, 2 * half0 + 2, 1, tilel);
    for (const ex of [cx - half0 - 4, cx + half0 - 3]) { p.r(ex, roofTop - 9, 8, 10, line); p.r(ex + 1, roofTop - 8, 6, 8, '#3a3f49'); p.r(ex + 2, roofTop - 7, 2, 2, tilel); }
    const ey = roofBottom - 3;
    p.r(cx - half1, ey, 2 * half1, 4, line);
    for (let x = cx - half1 + 1; x < cx + half1 - 1; x += 4) { p.r(x, ey + 1, 3, 2, tilel); p.px(x + 1, ey + 2, '#9aa0ac'); }
    for (const [ex, dir] of [[cx - half1, -1], [cx + half1, 1]]) {
      p.r(ex + (dir < 0 ? -4 : 0), ey - 4, 5, 4, line); p.r(ex + (dir < 0 ? -3 : 0), ey - 3, 3, 2, tile);
    }
    p.r(cx - half1 + 4, roofBottom + 1, 2 * half1 - 8, 1, 'rgba(30,18,12,0.5)');

    // Paper lanterns hanging from the beam, either side of the gate.
    for (const lx of [outer0 - 8, outer1 + 1]) {
      const ly = roofBottom + 6;
      p.r(lx + 3, roofBottom + 1, 1, 5, line);
      p.r(lx + 1, ly, 6, 2, line);
      p.r(lx, ly + 2, 8, 11, line); p.r(lx + 1, ly + 2, 6, 11, '#f6ead0');
      p.r(lx + 1, ly + 2, 6, 2, '#c4443c'); p.r(lx + 1, ly + 11, 6, 2, '#c4443c');
      for (const yy of [ly + 5, ly + 8]) p.r(lx + 1, yy, 6, 1, '#e4cfa4');
      p.r(lx + 1, ly + 13, 6, 1, line); p.r(lx + 3, ly + 14, 2, 3, '#c4443c');
    }

    // Cut out the doorway so the doors (behind) and then the town show through.
    front.getContext('2d').clearRect(ox, gateTop, ow, H - gateTop);
    front.className = 'ent-piece';
    place(front, 0, 0);

    // The doors: plain boards below, an open lattice above that you can glimpse the town through.
    const dw = ow / 2, dh = H - gateTop, split = Math.round(dh * 0.42);
    const door = pixelCanvas(dw, dh), q = new Painter(door.getContext('2d'));
    for (let x = 0; x < dw; x++) {
      const b = Math.floor(x / 6) % 2;
      q.r(x, split, 1, dh - split, x % 6 === 5 ? woodd : b ? '#8e5a36' : '#9a6440');
    }
    for (let i = 0; i < dw * (dh - split) / 40; i++) q.r(Math.floor(rng() * dw), split + Math.floor(rng() * (dh - split - 4)), 1, 3, '#7e4e2e');
    for (let x = 3; x < dw - 3; x += 5) { q.r(x, 3, 2, split - 3, '#a06a42'); q.px(x, 3, '#c08a5c'); q.r(x + 1, 3, 1, split - 3, '#7e4e2e'); }
    const rail = (y, h) => { q.r(0, y, dw, h, line); q.r(0, y + 1, dw, h - 2, wood); q.r(0, y + 1, dw, 1, woodl); };
    rail(0, 4); rail(Math.round(split * 0.5), 3); rail(split - 2, 5); rail(dh - 5, 5);
    q.r(0, 0, 3, dh, line); q.r(1, 0, 1, dh, wood);
    q.r(dw - 3, 0, 3, dh, line); q.r(dw - 2, 0, 1, dh, woodl);
    const hy = Math.round(dh * 0.6);
    q.r(dw - 9, hy, 4, 8, line); q.r(dw - 8, hy + 1, 2, 6, '#2a2830');
    const left = door, right = mirrored(door);
    left.className = 'ent-piece'; right.className = 'ent-piece';
    // The doors live in a frame the size of the doorway, so they vanish behind the pillars as they slide.
    const frame = document.createElement('div');
    place(frame, ox, gateTop);
    Object.assign(frame.style, { width: `${ow * view.scale}px`, height: `${dh * view.scale}px`, overflow: 'hidden' });
    place(left, 0, 0); place(right, dw, 0);
    frame.append(left, right);
    root.append(frame, front);

    // The name on a dark wooden plaque between the two beams.
    const plaque = sign('plaque');
    plaque.style.setProperty('--px', `${view.scale}px`);
    place(plaque, cx, Math.round((roofBottom + 8 + gateTop - 6) / 2));
    root.append(plaque);
    root.style.transformOrigin = `${cx * view.scale}px ${(gateTop + dh * 0.45) * view.scale}px`;
    return () => {
      const k = view.scale, by = (dw + pw + 2) * k;
      left.classList.add('slide'); right.classList.add('slide');
      left.style.transform = `translateX(${-by}px)`;
      right.style.transform = `translateX(${by}px)`;
      Sound.gate();
      setTimeout(() => root.classList.add('through'), 1700);
      return 3.6;
    };
  }

  /* ---------- 5, 6, 7. The Japanese gate, filling the whole screen ----------
     Nothing of the town shows until the doors slide open. A band of roof tiles runs along the top,
     with the name on a plaque in the beam below it.
       5. Two big doors fill the screen, papered behind their lattice so you can't see through.
       6. The whole screen is the gatehouse: walls either side of a doorway, all under one roof.
       7. Like 5, but the lattice is open, so you can just glimpse the town between the slats. */
  const JP = { wood: '#5a3420', woodd: '#3a2016', woodl: '#7a4a2c', line: '#1e120c', tile: '#5c626e', tiled: '#40454f', tilel: '#7a808c', paper: '#efe4cc', paperd: '#e0d2b4' };
  // One sliding door, with its meeting edge on the right. Boards below, a lattice above.
  function jpDoor(dw, dh, papered, seed) {
    const c = pixelCanvas(dw, dh), q = new Painter(c.getContext('2d')), rng = mulberry(seed);
    const split = Math.round(dh * (papered ? 0.56 : 0.72));
    for (let x = 0; x < dw; x++) {
      const b = Math.floor(x / 7) % 2;
      q.r(x, split, 1, dh - split, x % 7 === 6 ? JP.woodd : b ? '#8e5a36' : '#9a6440');
    }
    for (let i = 0; i < dw * (dh - split) / 40; i++) q.r(Math.floor(rng() * dw), split + Math.floor(rng() * (dh - split - 4)), 1, 3, '#7e4e2e');
    if (papered) {
      q.r(0, 4, dw, split - 4, JP.paper);
      for (let i = 0; i < dw * split / 30; i++) q.px(Math.floor(rng() * dw), 4 + Math.floor(rng() * (split - 4)), JP.paperd);
    }
    // The lattice: upright slats, with a few cross bars.
    for (let x = 4; x < dw - 4; x += 6) { q.r(x, 4, 2, split - 4, '#9a6440'); q.px(x, 4, '#c08a5c'); q.r(x + 1, 4, 1, split - 4, '#7e4e2e'); }
    for (let y = 4 + 16; y < split - 8; y += 18) { q.r(3, y, dw - 6, 2, '#8a5634'); q.r(3, y, dw - 6, 1, '#a87446'); }
    const rail = (y, h) => { q.r(0, y, dw, h, JP.line); q.r(0, y + 1, dw, h - 2, JP.wood); q.r(0, y + 1, dw, 1, JP.woodl); };
    rail(0, 4); rail(split - 2, 5); rail(dh - 6, 6);
    q.r(0, 0, 4, dh, JP.line); q.r(1, 0, 2, dh, JP.wood);
    q.r(dw - 4, 0, 4, dh, JP.line); q.r(dw - 3, 0, 2, dh, JP.woodl);
    // A recessed pull near the meeting edge.
    const hy = Math.round(dh * (papered ? 0.7 : 0.82));
    q.r(dw - 11, hy, 5, 10, JP.line); q.r(dw - 10, hy + 1, 3, 8, '#2a2830');
    return c;
  }
  function buildFullGate(W, H, look) {
    const cx = Math.floor(W / 2), roofH = 22, beamH = 28, gateTop = roofH + beamH;
    const front = pixelCanvas(W, H), p = new Painter(front.getContext('2d')), rng = mulberry(31);
    // Roof tiles all the way across, with their round ends along the bottom edge.
    p.r(0, 0, W, roofH, JP.line);
    for (let x = 0; x < W; x++) { const col = x % 6; p.r(x, 0, 1, roofH - 3, col < 2 ? JP.tiled : col === 2 ? JP.tilel : JP.tile); }
    for (let y = 3; y < roofH - 3; y += 4) for (let x = (y % 8 ? 0 : 3); x < W; x += 6) p.px(x, y, '#353a44');
    p.r(0, roofH - 4, W, 4, JP.line);
    for (let x = 1; x < W; x += 4) { p.r(x, roofH - 3, 3, 2, JP.tilel); p.px(x + 1, roofH - 2, '#9aa0ac'); }
    // The beam under it, with rafter ends and a shadow.
    p.r(0, roofH, W, beamH, JP.line);
    p.r(0, roofH + 1, W, beamH - 2, JP.wood);
    p.r(0, roofH + 1, W, 3, JP.woodd);
    for (let x = 3; x < W; x += 9) { p.r(x, roofH + 1, 4, 3, JP.woodl); p.px(x, roofH + 1, '#9a6a44'); }
    p.r(0, roofH + 5, W, 1, JP.woodl);
    p.r(0, gateTop - 4, W, 3, JP.woodd);
    p.r(0, gateTop - 1, W, 1, JP.line);
    // Paper lanterns hanging from the beam near each side.
    for (const lx of [Math.round(W * 0.12), Math.round(W * 0.88) - 8]) {
      const ly = gateTop + 2;
      p.r(lx + 3, gateTop - 1, 1, 3, JP.line);
      p.r(lx + 1, ly, 6, 2, JP.line);
      p.r(lx, ly + 2, 8, 12, JP.line); p.r(lx + 1, ly + 2, 6, 12, '#f6ead0');
      p.r(lx + 1, ly + 2, 6, 2, '#c4443c'); p.r(lx + 1, ly + 12, 6, 2, '#c4443c');
      for (const yy of [ly + 5, ly + 8]) p.r(lx + 1, yy, 6, 1, '#e4cfa4');
      p.r(lx + 3, ly + 14, 2, 3, '#c4443c');
    }

    let ox = 0, ow = W;
    if (look === 6) {
      // The gatehouse: walls either side of a doorway, pillars, and a floor of dark boards.
      ow = Math.min(Math.round(W * 0.5) & ~1, 180); ox = cx - ow / 2;
      const pw = 10, baseTop = Math.round(H * 0.78);
      for (const [x0, x1] of [[0, ox - pw], [ox + ow + pw, W]]) {
        if (x1 <= x0) continue;
        p.r(x0, gateTop, x1 - x0, H - gateTop, '#f2ead8');
        for (let i = 0; i < (x1 - x0) * (baseTop - gateTop) / 14; i++) p.px(x0 + Math.floor(rng() * (x1 - x0)), gateTop + Math.floor(rng() * (baseTop - gateTop)), '#ded4be');
        for (let x = x0 + 16; x < x1 - 3; x += 32) { p.r(x, gateTop, 3, baseTop - gateTop, JP.wood); p.r(x, gateTop, 1, baseTop - gateTop, JP.woodl); }
        p.r(x0, Math.round((gateTop + baseTop) / 2), x1 - x0, 3, JP.wood);
        p.r(x0, baseTop, x1 - x0, H - baseTop, JP.wood);
        for (let y = baseTop; y < H; y += 5) p.r(x0, y, x1 - x0, 1, JP.woodd);
        p.r(x0, baseTop, x1 - x0, 1, JP.line);
      }
      for (const x of [ox - pw, ox + ow]) {
        p.r(x, gateTop - 1, pw, H - gateTop + 1, JP.line);
        p.r(x + 1, gateTop, pw - 2, H - gateTop, JP.wood);
        p.r(x + 1, gateTop, 2, H - gateTop, JP.woodl);
        p.r(x + pw - 3, gateTop, 1, H - gateTop, JP.woodd);
        p.r(x - 2, H - 6, pw + 4, 6, '#7e808e'); p.r(x - 2, H - 6, pw + 4, 1, '#b2b4ba');
      }
    } else {
      // Slim posts at the screen edges, framing the doors.
      p.r(0, gateTop, 4, H - gateTop, JP.line); p.r(1, gateTop, 2, H - gateTop, JP.wood);
      p.r(W - 4, gateTop, 4, H - gateTop, JP.line); p.r(W - 3, gateTop, 2, H - gateTop, JP.woodl);
      ox = 4; ow = W - 8;
    }
    front.className = 'ent-piece';
    place(front, 0, 0);

    const dw = Math.ceil(ow / 2), dh = H - gateTop;
    const left = jpDoor(dw, dh, look !== 7, 5), right = mirrored(left);
    left.className = 'ent-piece slide'; right.className = 'ent-piece slide';
    const frame = document.createElement('div');
    place(frame, ox, gateTop);
    Object.assign(frame.style, { width: `${ow * view.scale}px`, height: `${dh * view.scale}px`, overflow: 'hidden' });
    place(left, 0, 0); place(right, ow - dw, 0);
    frame.append(left, right);
    root.append(frame, front);

    const plaque = sign('plaque');
    plaque.style.setProperty('--px', `${view.scale}px`);
    place(plaque, cx, roofH + beamH / 2 + 1);
    root.append(plaque);
    root.style.transformOrigin = `${cx * view.scale}px ${(gateTop + dh * 0.5) * view.scale}px`;
    return () => {
      const by = (dw + 6) * view.scale;
      left.style.transform = `translateX(${-by}px)`;
      right.style.transform = `translateX(${by}px)`;
      Sound.gate();
      setTimeout(() => root.classList.add('through'), 1800);
      return 3.7;
    };
  }

  /* ---------- 8 and 9. Just the gate, edge to edge ----------
     No roof and no name: the screen is nothing but sliding wooden doors, papered behind their lattice.
     They slide away to show the town straight behind them, where the town's name then lowers on its
     ropes from the frame behind the fountain (main.js does that part).
       8. One door, sliding from right to left.
       9. Two doors, sliding apart from the centre. */
  function buildScreenGate(W, H, mode) {
    const frame = document.createElement('div');
    place(frame, 0, 0);
    Object.assign(frame.style, { width: `${W * view.scale}px`, height: `${H * view.scale}px`, overflow: 'hidden' });
    let pieces, slide;
    if (mode === 'left') {
      // One wide door; its pull sits near the leading (left) edge, where you'd push it from.
      const door = mirrored(jpDoor(W, H, true, 5));
      door.className = 'ent-piece slide';
      place(door, 0, 0);
      pieces = [door];
      slide = () => { door.style.transform = `translateX(${-(W + 4) * view.scale}px)`; };
    } else {
      const dw = Math.ceil(W / 2);
      const left = jpDoor(dw, H, true, 5), right = mirrored(left);
      left.className = 'ent-piece slide'; right.className = 'ent-piece slide';
      place(left, 0, 0); place(right, W - dw, 0);
      pieces = [left, right];
      slide = () => {
        const by = (dw + 4) * view.scale;
        left.style.transform = `translateX(${-by}px)`;
        right.style.transform = `translateX(${by}px)`;
      };
    }
    frame.className = 'ent-doors';
    frame.append(...pieces);
    root.append(frame);
    return () => {
      slide();
      Sound.gate();
      return 3.8;
    };
  }

  let opener = null;
  return {
    show(n) {
      kind = n;
      root = document.createElement('div');
      root.id = 'entrance';
      root.className = `entrance entrance-${n}`;
      document.body.append(root);
      const W = Math.ceil(innerWidth / view.scale), H = Math.ceil(innerHeight / view.scale);
      opener = n === 1 ? buildDoors(W, H) : n === 2 ? buildArch(W, H) : n === 3 ? buildFarmGate(W, H) : n === 4 ? buildJapaneseGate(W, H)
        : n === 8 ? buildScreenGate(W, H, 'left') : n === 9 ? buildScreenGate(W, H, 'centre') : buildFullGate(W, H, n);
    },
    // Opens the way in and says how many seconds until Hazel should start talking.
    open() {
      if (!opener) return 0.3;
      const wait = opener();
      opener = null;
      setTimeout(() => { if (root) { root.remove(); root = null; } }, (wait + 0.2) * 1000);
      return wait;
    },
    // Leaving the welcome: clear anything still on screen, lifting the hanging sign away.
    leave() {
      if (root) { root.remove(); root = null; }
      if (hanging) {
        const h = hanging;
        hanging = null;
        h.classList.add('lift');
        setTimeout(() => h.remove(), 800);
      }
    },
  };
})();
