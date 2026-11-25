/* ---------- The town's name ----------
   A walnut board with the name hangs from the top edge of the screen on two ropes, over the gate
   from the start. It stays up there as the gate slides open, until you join the town (style 6).
   The other ways we tried are still here to compare, by address only (?name=1 to 5):
     1. A title card: "Welcome to / The Authenticity Town" fades in over the square, then away.
     2. Bunting: one letter on each little flag, strung across the top of the square between the lamps.
     3. A stone tablet at the foot of the fountain, with the name carved in.
     4. Set into the paving of the square, so people walk over it.
     5. A wooden signboard on two posts, standing just behind the fountain.
   Those stay hidden behind the gate on the way in, and appear once the gate is open. */
const TownName = (() => {
  const TEXT = 'The Authenticity Town';
  const STYLE = (() => { const n = parseInt(new URLSearchParams(location.search).get('name'), 10); return n >= 1 && n <= 6 ? n : 6; })();
  const FOUNTAIN = { x: 394, y: 220 };
  const ROPE = { x0: 233, x1: 557, y: 156, sag: 22 };
  let shown = true, shownAt = -10, el = null, built = 0, board = null;

  const k = () => view.scale;
  // The world-anchored versions are lettering laid over the canvas, built once per zoom level.
  function build() {
    if (el) el.remove();
    built = k();
    el = document.createElement('div');
    if (STYLE === 2) {
      el.className = 'name-bunting';
      const W = ROPE.x1 - ROPE.x0, sp = 12, chars = [...TEXT], total = chars.length * sp;
      const yAt = (x) => { const t = x / W; return 4 * ROPE.sag * t * (1 - t); };
      el.style.width = `${W * built}px`;
      el.style.height = `${(ROPE.sag + 20) * built}px`;
      el.innerHTML = `<svg width="${W * built}" height="${(ROPE.sag + 4) * built}" aria-hidden="true"><path d="M0 0 Q ${W * built / 2} ${ROPE.sag * 2 * built} ${W * built} 0" fill="none" stroke="#6a4428" stroke-width="${Math.max(1.5, built * 0.7)}"/></svg>`;
      const colours = ['#d64a46', '#f4c95a', '#3a9e5a', '#4882c8', '#fff8e4'];
      chars.forEach((ch, i) => {
        if (ch === ' ') return;
        const x = W / 2 - total / 2 + i * sp + sp / 2;
        const f = document.createElement('span');
        f.className = 'flag';
        f.textContent = ch;
        f.style.left = `${x * built}px`;
        f.style.top = `${(yAt(x) - 0.5) * built}px`;
        f.style.background = colours[i % colours.length];
        f.style.color = i % colours.length === 4 ? '#362c38' : '#fff8e4';
        f.style.animationDelay = `${(-i * 0.37).toFixed(2)}s`;
        el.append(f);
      });
    } else {
      el.className = STYLE === 3 ? 'name-tablet' : 'name-signboard';
      el.textContent = TEXT;
    }
    el.style.setProperty('--px', `${built}px`);
    $('labels').append(el);
  }

  // Positions the name each frame (called from main.js while drawing labels).
  function place(s) {
    if (STYLE === 1 || STYLE === 4 || STYLE === 6) return;
    if (!el || built !== k()) build();
    el.hidden = s.id !== 'town' || !shown;
    if (el.hidden) return;
    const at = STYLE === 2 ? [ROPE.x0, ROPE.y] : STYLE === 3 ? [FOUNTAIN.x, FOUNTAIN.y + 22] : [FOUNTAIN.x, FOUNTAIN.y - 37];
    el.style.left = `${(at[0] - view.x) * k()}px`;
    el.style.top = `${(at[1] - view.y) * k()}px`;
    const night = nightAt(clockHour);
    el.style.filter = night > 0.01 ? `brightness(${(1 - night * 0.45).toFixed(2)})` : '';
  }

  // 4: the name set into the paving, drawn straight onto the town so people walk over it.
  // Nothing else on the page uses the font then, so ask for it up front.
  let inlay = null;
  if (STYLE === 4 && document.fonts) document.fonts.load("700 8px 'Pixelify Sans'").catch(() => {});
  function inlayCanvas() {
    if (inlay) return inlay;
    if (!document.fonts.check("700 8px 'Pixelify Sans'")) return null;
    const m = makeCanvas(1, 1).getContext('2d');
    m.font = "700 8px 'Pixelify Sans'";
    const tw = Math.ceil(m.measureText(TEXT).width), w = tw + 16, h = 16;
    // The letters as hard-edged pixels, like stones, with no soft blur around them.
    const mask = makeCanvas(w, h), mg = mask.getContext('2d');
    mg.font = "700 8px 'Pixelify Sans'"; mg.textBaseline = 'top'; mg.fillStyle = '#fff';
    mg.fillText(TEXT, 8, 4);
    const md = mg.getImageData(0, 0, w, h), on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && md.data[(y * w + x) * 4 + 3] > 110;
    const c = makeCanvas(w, h), p = new Painter(c.getContext('2d'));
    // A band of darker paving with a double border, and the letters in pale stone with a shadow below.
    p.r(0, 0, w, h, PAL.pathe); p.r(1, 1, w - 2, h - 2, '#b8955f'); p.r(2, 2, w - 4, h - 4, PAL.pathe); p.r(3, 3, w - 6, h - 6, '#a07c4e');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (on(x, y)) p.px(x, y, '#fff0c8');
      else if (on(x, y - 1)) p.px(x, y, '#5e4024');
    }
    inlay = c;
    return c;
  }
  function drawGround(c, s) {
    if (STYLE !== 4 || s.id !== 'town' || !shown) return;
    const img = inlayCanvas();
    if (!img) return;
    c.globalAlpha = Math.min(1, (performance.now() / 1000 - shownAt) / 1.2);
    c.drawImage(img, Math.round(FOUNTAIN.x - img.width / 2 - view.x), Math.round(FOUNTAIN.y + 70 - view.y));
    c.globalAlpha = 1;
  }

  function titleCard() {
    const t = document.createElement('div');
    t.className = 'name-title';
    t.innerHTML = '<small>Welcome to</small><span>The Authenticity Town</span>';
    document.body.append(t);
    setTimeout(() => t.remove(), 4800);
  }

  // 6: a wooden board hanging from the top edge of the screen on two ropes. It drops in, swings,
  // and keeps rocking gently, tilted just a little, like a real sign on ropes.
  // The board is dark walnut with a thin brass inlay and cream letters, hanging on two ropes.
  function dropBoard() {
    board = document.createElement('div');
    board.className = 'ent-sign hang name-board';
    board.innerHTML = `<div class="plank"><span>${TEXT}</span></div>`;
    board.style.setProperty('--px', `${k()}px`);
    document.body.append(board);
    // After the drop, it only sways (so a knock's wobble can start and finish cleanly).
    const b = board;
    // Only if it's still up: leaving the welcome early lifts it away instead.
    setTimeout(() => { if (board === b) b.classList.add('settled'); }, reducedMotion ? 0 : 1650);
  }

  return {
    style: STYLE,
    // Extra seconds before Hazel speaks, so the name has its moment.
    extraWait: STYLE === 1 ? 2.6 : STYLE === 6 ? 0.2 : 0.4,
    // A knock on the gate makes the board jolt and wobble on its ropes.
    jolt() {
      if (!board || !board.classList.contains('settled') || reducedMotion) return;
      const b = board;
      b.classList.remove('jolt');
      void b.offsetWidth;
      b.classList.add('jolt');
      clearTimeout(b.joltTimer);
      b.joltTimer = setTimeout(() => b.classList.remove('jolt'), 820);
    },
    // Leaving the welcome: the board is pulled back up out of sight.
    leave() {
      if (!board) return;
      const b = board;
      board = null;
      b.classList.add('lift');
      setTimeout(() => b.remove(), 800);
    },
    hide() { shown = false; },
    reveal() {
      shown = true;
      shownAt = performance.now() / 1000;
      if (STYLE === 1) { titleCard(); return; }
      if (STYLE === 6) { dropBoard(); return; }
      if (el) { el.classList.remove('appear'); void el.offsetWidth; el.classList.add('appear'); }
      Sound.chime();
    },
    place,
    drawGround,
  };
})();
