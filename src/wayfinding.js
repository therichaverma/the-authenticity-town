/* ---------- Finding your way around town ----------
   From the middle of the wide square you can't see much of the town, so three things help:
     signposts  wooden signposts at the square's exits, pointing to the pond, the market and the houses
     map        a small map of the whole town in the bottom-left corner, with a dot for where you are and a
                box for what's on screen; clicking it (or the M key) opens the big map
     zoom       the camera starts pulled back, so more of the town fits on screen; the Z key
                switches to a closer view and back (there's no button for it). The choice is remembered.
   None of them say where the green book is. */
const Wayfinding = (() => {
  const ZOOM_KEY = 'authenticity-town-zoom';
  let wide = true;
  try { wide = localStorage.getItem(ZOOM_KEY) !== 'close'; } catch { /* Wide. */ }

  // Places worth knowing about, in town coordinates.
  const PLACES = () => {
    const door = (to) => world.town.doors.find((d) => d.to === to);
    const cafe = door('cafe'), shop = door('bookshop'), pub = door('pub'), studio = door('studio');
    return [
      { name: 'The café', x: cafe.cx, y: cafe.spawnY },
      { name: 'The bookshop', x: shop.cx, y: shop.spawnY },
      { name: 'The library', x: door('library').cx, y: door('library').spawnY },
      { name: 'Launderette', x: door('launderette').cx, y: door('launderette').spawnY },
      { name: 'Town hall', x: door('hall').cx, y: door('hall').spawnY },
      { name: 'Community garden', x: 88, y: 128 },
      { name: 'Cinema', x: door('cinema').cx, y: door('cinema').spawnY + 10 },
      { name: 'Ice cream', x: door('icecream').cx, y: door('icecream').spawnY + 10 },
      { name: 'Chapel', x: door('chapel').cx, y: door('chapel').spawnY + 10 },
      { name: 'Post office', x: 578, y: 448 },
      { name: 'Playground', x: 74, y: 360 },
      { name: 'Rose Lane (homes)', x: 820, y: 650 },
      { name: 'The Lantern (pub)', x: pub.cx, y: pub.spawnY },
      { name: 'The art studio', x: studio.cx, y: studio.spawnY },
      { name: 'Food stalls', x: 859, y: 246 },
      { name: 'The park', x: 394, y: 548 },
      { name: 'The fountain', x: 394, y: 220 },
      { name: 'The pond', x: 80, y: 262 },
    ];
  };

  /* ---------- Signposts ---------- */
  // Each stands at an exit of the square; x and y are where its post meets the ground.
  const SIGNPOSTS = [
    { x: 236, y: 202, boards: [['left', 'The pond'], ['left', 'Playground']] },
    { x: 552, y: 202, boards: [['right', 'The market'], ['right', 'The pub']] },
    { x: 418, y: 322, boards: [['down', 'The houses'], ['down', 'The park']] },
  ];
  let posts = null, postScale = 0;
  function buildPosts() {
    posts?.forEach((p) => p.remove());
    postScale = view.scale;
    posts = SIGNPOSTS.map((sp) => {
      const el = document.createElement('div');
      el.className = 'signpost';
      el.style.setProperty('--px', `${view.scale}px`);
      for (const [dir, text] of sp.boards) {
        const b = document.createElement('div');
        b.className = `sp-board ${dir}`;
        b.textContent = dir === 'left' ? `← ${text}` : dir === 'right' ? `${text} →` : `↓ ${text}`;
        el.append(b);
      }
      $('labels').append(el);
      return el;
    });
  }
  function placePosts(s) {
    if (!posts || postScale !== view.scale) buildPosts();
    const show = s.id === 'town' && screen === 'play';
    const night = nightAt(clockHour);
    posts.forEach((el, i) => {
      el.hidden = !show;
      if (!show) return;
      el.style.left = `${(SIGNPOSTS[i].x - view.x) * view.scale}px`;
      el.style.top = `${(SIGNPOSTS[i].y - view.y) * view.scale}px`;
      el.style.filter = night > 0.01 ? `brightness(${(1 - night * 0.45).toFixed(2)})` : '';
    });
  }

  /* ---------- The map ---------- */
  let mapArt = null;
  // The whole town drawn once, small: the ground and every building, tree and bench, but no people and no book.
  function townPicture() {
    if (mapArt) return mapArt;
    const s = world.town, c = makeCanvas(s.w, s.h), g = c.getContext('2d');
    g.drawImage(s.ground, 0, 0);
    [...s.objects].sort((a, b) => a.base - b.base).forEach((o) => g.drawImage(o.canvas, o.x, o.y));
    mapArt = c;
    return c;
  }
  function drawMap() {
    const s = world.town, art = townPicture(), k = 2;
    const c = $('map-canvas'), g = c.getContext('2d');
    c.width = s.w * k; c.height = s.h * k;
    g.imageSmoothingEnabled = false;
    g.drawImage(art, 0, 0, c.width, c.height);
    g.fillStyle = 'rgba(248, 232, 196, 0.18)'; g.fillRect(0, 0, c.width, c.height);
    g.font = "600 32px 'Fredoka', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of PLACES()) {
      const w = g.measureText(p.name).width + 20, x = p.x * k, y = p.y * k - 34;
      g.fillStyle = 'rgba(54, 44, 56, 0.85)'; g.fillRect(x - w / 2, y - 21, w, 42);
      g.fillStyle = '#fff8e4'; g.fillText(p.name, x, y + 1);
    }
    // You are here, if you're out in town.
    const me = state.me;
    if (me && me.scene === 'town') {
      const x = me.x * k, y = me.y * k;
      g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fillStyle = '#d64a46'; g.fill();
      g.lineWidth = 5; g.strokeStyle = '#fff8e4'; g.stroke();
      g.font = "600 30px 'Fredoka', sans-serif";
      const w = g.measureText('You are here').width + 18;
      g.fillStyle = '#d64a46'; g.fillRect(x - w / 2, y + 24, w, 40);
      g.fillStyle = '#fff8e4'; g.fillText('You are here', x, y + 45);
    }
    $('map-where').textContent = me && me.scene !== 'town' ? `You're inside ${world[me.scene].name} right now.` : '';
  }
  // The small map in the corner, redrawn every frame: the town, a box for what's on screen, and you.
  let miniAt = '';
  function drawMini(s) {
    const box = $('minimap'), show = screen === 'play';
    box.hidden = !show;
    if (!show) return;
    const town = world.town, me = state.me;
    // Drawn at the box's real pixel size, so the dot and frame stay sharp at any screen size.
    const cw = Math.round((box.clientWidth - 6 || 162) * (devicePixelRatio || 1)), k = cw / town.w, u = cw / 162;
    const inside = me.scene !== 'town';
    const door = inside && town.doors.find((d) => d.to === me.scene);
    const px = inside ? (door ? door.cx : town.w / 2) : me.x, py = inside ? (door ? door.spawnY : town.h / 2) : me.y;
    const key = `${cw},${Math.round(px)},${Math.round(py)},${view.x},${view.y},${view.w},${view.h},${inside},${Math.floor(time * 2) % 2}`;
    if (key === miniAt) return;
    miniAt = key;
    const c = $('minimap-canvas'), g = c.getContext('2d');
    if (c.width !== cw) { c.width = cw; c.height = Math.round(town.h * k); }
    g.imageSmoothingEnabled = true; // Shrinking the town smoothly keeps it from looking speckled.
    g.drawImage(townPicture(), 0, 0, c.width, c.height);
    if (!inside) {
      g.lineWidth = 1.5 * u; g.strokeStyle = 'rgba(255, 248, 228, 0.9)';
      g.strokeRect(view.x * k, view.y * k, view.w * k, view.h * k);
    }
    // Your dot gently blinks so it's easy to spot; inside a building, it sits at that building's door.
    const r = (Math.floor(time * 2) % 2 ? 5 : 4) * u;
    g.beginPath(); g.arc(px * k, py * k, r, 0, Math.PI * 2);
    g.fillStyle = '#d64a46'; g.fill(); g.lineWidth = 2 * u; g.strokeStyle = '#fff8e4'; g.stroke();
  }
  function openMap() {
    if (screen !== 'play' || modal) return;
    modal = 'map';
    drawMap();
    $('map-screen').hidden = false;
    $('map-close').focus();
  }
  function closeMap() {
    $('map-screen').hidden = true;
    if (modal === 'map') modal = null;
    releaseFocus();
  }

  return {
    get wide() { return wide; },
    // Called every frame while drawing labels.
    update(s) { placePosts(s); drawMini(s); },
    // Switches between seeing more of the town and a closer view.
    toggleZoom() {
      wide = !wide;
      try { localStorage.setItem(ZOOM_KEY, wide ? 'wide' : 'close'); } catch { /* Not remembered. */ }
      resize();
    },
    openMap,
    closeMap,
  };
})();
