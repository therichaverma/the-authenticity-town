// Runs the town: walking, day and night, drawing, and the screens over the top.
const STORE_KEY = 'authenticity-town-v1';
const $ = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const world = buildWorld();
const canvas = $('game');
const ctx = canvas.getContext('2d');
const lightCanvas = makeCanvas(1, 1), lightCtx = lightCanvas.getContext('2d');
const glowCanvas = makeCanvas(1, 1), glowCtx = glowCanvas.getContext('2d');

function firstBookSpot() {
  const table = world.cafe.surfaces[2];
  return { scene: 'cafe', x: table.x, y: table.y, base: table.base };
}
// The book itself lives in the shared town (see server.js); this device only remembers you:
// where you were standing and what you've read.
function freshState() {
  return { me: null, book: Book.fresh(firstBookSpot()) };
}
function repairState(saved) {
  saved.book = Book.fresh(firstBookSpot());
  delete saved.seenMeToos;
  const { me } = saved;
  if (me) {
    delete me.path;
    delete me.pending;
    if (!world[me.scene]) me.scene = 'town';
    if (!Number.isFinite(me.x) || !Number.isFinite(me.y)) { me.x = world[me.scene].start.x; me.y = world[me.scene].start.y; }
    if (!DIRS.hasOwnProperty(me.dir)) me.dir = 'down';
  }
  return saved;
}
function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return raw ? repairState(raw) : freshState();
  } catch { return freshState(); }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state, (k, v) => (k === 'path' || k === 'pending' || k === 'book' ? undefined : v))); } catch { /* The town still runs without saving. */ }
}

let state = loadState();
let residents = [];
let screen = 'invite';
let modal = null;
let view = { w: 384, h: 240, scale: 3, x: 0, y: 0 };
let clockHour = realHour();
let time = 0;
let moved = false;
let toastTimer = 0;
const keys = new Set();

function realHour() {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
}

function buildResidents() {
  const rng = mulberry(Date.now() & 0xffff);
  residents = [...RESIDENTS.map((r) => new Person(r, world, rng)), new Person(HAZEL, world), new Person(BARISTA, world), new Person(BOOKSELLER, world),
    ...STALLHOLDERS.map((r) => new Person(r, world)), new Person(PUB_HOST, world), new Person(TEACHER, world), new Person(LIBRARIAN, world),
    new Person(ICE_KEEPER, world), new Person(CINEMA_KEEPER, world)];
}
buildResidents();
const hazel = () => residents.find((r) => r.guide);

/* ---------- Day and night ---------- */
const NIGHT = [76, 86, 140], SUN = [255, 255, 255], DAWN = [240, 192, 180], DUSK = [255, 190, 140];
const SKY = [[0, NIGHT], [5.5, NIGHT], [6.5, DAWN], [8, SUN], [17, SUN], [18.5, DUSK], [20, NIGHT], [24, NIGHT]];

function ambientAt(h) {
  for (let i = 1; i < SKY.length; i++) {
    if (h <= SKY[i][0]) {
      const [h0, a] = SKY[i - 1], [h1, b] = SKY[i], t = (h - h0) / (h1 - h0);
      return a.map((v, k) => Math.round(v + (b[k] - v) * t));
    }
  }
  return NIGHT;
}
function nightAt(h) {
  const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
  return h < 12 ? 1 - ramp(h, 6, 7.5) : ramp(h, 17.5, 19.5);
}
// The town's sky always follows the player's own clock.
// ?hour=12 in the address fixes the time of day, for previewing how things look in daylight or at night.
const FIXED_HOUR = (() => { const h = parseFloat(new URLSearchParams(location.search).get('hour')); return h >= 0 && h < 24 ? h : null; })();
function targetHour() {
  return FIXED_HOUR ?? realHour();
}
function updateClock(dt) {
  if (FIXED_HOUR !== null) { clockHour = FIXED_HOUR; return; }
  const gap = (targetHour() - clockHour + 24) % 24;
  clockHour = gap < 0.02 ? targetHour() : (clockHour + Math.min(gap, 8 * dt)) % 24;
}

// Stepped pools of lamplight, one size per radius.
const glowStamps = new Map();
function glowStamp(r) {
  if (glowStamps.has(r)) return glowStamps.get(r);
  const c = makeCanvas(r * 2, r * 2), g = c.getContext('2d');
  const levels = [[0.25, '#c4ac90'], [0.5, '#9e8c8c'], [0.75, '#7e788c'], [1, '#64668e']];
  for (const [limit, color] of [...levels].reverse()) {
    g.fillStyle = color;
    for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) {
      const d = Math.hypot(x - r + 0.5, (y - r + 0.5) * 1.25) / r;
      if (d <= limit) g.fillRect(x, y, 1, 1);
    }
  }
  glowStamps.set(r, c);
  return c;
}

/* ---------- Small life around town ---------- */
const rngFx = mulberry(99);
const butterflies = Array.from({ length: 9 }, () => ({ x: rngFx() * 720, y: rngFx() * 480, a: rngFx() * 6, c: PAL.flowers[Math.floor(rngFx() * 4)] }));
const fireflies = Array.from({ length: 26 }, () => ({ x: rngFx() * 720, y: rngFx() * 480, a: rngFx() * 6 }));

/* ---------- Walking ---------- */
function curScene() { return world[state.me ? state.me.scene : 'town']; }

function moveMe(dx, dy) {
  const me = state.me, s = world[me.scene];
  if (dx && s.free(me.x + dx, me.y)) me.x += dx;
  if (dy && s.free(me.x, me.y + dy)) me.y += dy;
}

function inZone(zone, x, y) {
  return x >= zone[0] && x < zone[0] + zone[2] && y >= zone[1] && y < zone[1] + zone[3];
}
function doorHere() {
  const me = state.me;
  return world[me.scene].doors.find((d) => inZone(d.zone, me.x, me.y)) || null;
}
function exitHere() {
  const me = state.me, e = world[me.scene].exit;
  return e && inZone([e.x, e.y, e.w, e.h], me.x, me.y);
}
function enter(door) {
  const inside = world[door.to], me = state.me;
  me.scene = door.to; me.x = inside.start.x; me.y = inside.start.y; me.dir = 'up'; me.path = null; me.pending = null;
  saveState();
}
function goOutside() {
  const me = state.me, door = world.town.doors.find((d) => d.to === me.scene);
  me.scene = 'town'; me.x = door.cx; me.y = door.spawnY + 2; me.dir = 'down'; me.path = null; me.pending = null;
  saveState();
}

function unstick(me) {
  const s = world[me.scene];
  if (s.free(me.x, me.y)) return;
  const cell = s.nearestOpen(me.x, me.y);
  if (cell < 0) { me.x = s.start.x; me.y = s.start.y; return; }
  me.x = (cell % s.cols) * s.cell + 2;
  me.y = Math.floor(cell / s.cols) * s.cell + 2;
}

function updateMe(dt) {
  const me = state.me;
  let dx = 0, dy = 0;
  if (keys.has('ArrowLeft') || keys.has('a')) dx -= 1;
  if (keys.has('ArrowRight') || keys.has('d')) dx += 1;
  if (keys.has('ArrowUp') || keys.has('w')) dy -= 1;
  if (keys.has('ArrowDown') || keys.has('s')) dy += 1;
  const speed = keys.has('Shift') ? 92 : 62;
  me.walking = false;
  if (dx || dy) { me.path = null; me.pending = null; }
  if (!me.path || !me.path.length) unstick(me);
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    moveMe(dx / len * speed * dt, 0);
    moveMe(0, dy / len * speed * dt);
    me.dir = dy > 0 ? 'down' : dy < 0 ? 'up' : dx > 0 ? 'right' : 'left';
    me.walking = true;
    noteMoved();
    const door = doorHere();
    if (door && door.to && dy < 0) enter(door);
    else if (dy > 0 && exitHere()) goOutside();
  } else if (me.path && me.path.length) {
    const next = me.path[0], ax = next.x - me.x, ay = next.y - me.y, dist = Math.hypot(ax, ay), step = speed * dt;
    me.walking = true;
    if (Math.abs(ax) > Math.abs(ay)) me.dir = ax > 0 ? 'right' : 'left';
    else if (dist > 0.01) me.dir = ay > 0 ? 'down' : 'up';
    if (dist <= step) {
      me.x = next.x; me.y = next.y;
      me.path.shift();
      if (!me.path.length) finishWalk();
    } else { me.x += ax / dist * step; me.y += ay / dist * step; }
  }
  if (me.walking) me.walkTime = (me.walkTime || 0) + dt;
}

function finishWalk() {
  const me = state.me, pending = me.pending;
  me.path = null; me.pending = null;
  if (pending === 'exit' && exitHere()) goOutside();
  else if (pending && pending.door && pending.door.to) enter(pending.door);
  else if (pending && pending.drop && holdingBook() && surfaceInReach() === pending.drop) offerDrop(pending.drop);
}

function walkTo(x, y, pending = null) {
  const me = state.me, path = world[me.scene].findPath(me.x, me.y, x, y);
  if (!path) return;
  me.path = path; me.pending = pending;
  if (!path.length) finishWalk();
  noteMoved();
}
function noteMoved() {
  if (moved) return;
  moved = true;
  setTimeout(() => { $('hint').hidden = true; }, 3500);
}

function clickWorld(ev) {
  if (screen === 'invite') { advanceIntro(); return; }
  if (screen !== 'play') return;
  if (modal === 'talk') closeTalk();
  if (modal) return;
  const s = curScene();
  const x = ev.clientX / view.scale + view.x, y = ev.clientY / view.scale + view.y;
  if (s.exit && inZone([s.exit.x, s.exit.y - 4, s.exit.w, s.exit.h + 8], x, y)) {
    walkTo(s.exit.x + 12, s.exit.y + 2, 'exit');
    return;
  }
  if (holdingBook()) {
    const surface = s.surfaces.find((a) => inZone([a.hit[0] - 3, a.hit[1] - 6, a.hit[2] + 6, a.hit[3] + 9], x, y));
    if (surface) {
      if (surfaceInReach() === surface) offerDrop(surface);
      else walkTo(surface.x, surface.base + 3, { drop: surface });
      return;
    }
  }
  const door = s.doors.find((d) => inZone(d.building, x, y));
  if (door) { walkTo(door.cx, door.spawnY, { door }); return; }
  walkTo(x, y);
}

/* ---------- Leaving the book somewhere ----------
   Leaving the book is the heart of the game, so every table, bench, stall and desk is a place for it.
   While you carry the book, click one (or walk up to it) and you're asked whether to leave the book there. */
// Whether the green book is lying in this place for me to see. Once I've written in it and passed it on,
// it's done its job for me: it stays hidden, so I can't see it, its sparkle or its glow, or pick it up again.
function bookLyingIn(sceneId) {
  const book = state.book;
  if (book.scene !== sceneId || !Book.isFree(book)) return false;
  return !(state.me && Book.entryBy(book, state.me.id));
}
function holdingBook() {
  return !!state.me && Book.heldBy(state.book, state.me.id);
}
function surfaceInReach() {
  const me = state.me, s = world[me.scene];
  let best = null, bd = 24;
  for (const a of s.surfaces) {
    const d = Math.hypot(a.x - me.x, a.base - me.y);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
function surfaceWords(surface) {
  const place = world[state.me.scene].placeAt(state.me.x, state.me.y);
  const article = /^[aeiou]/.test(surface.kind) ? 'an' : 'a';
  return `on ${article} ${surface.kind} ${place === 'the town' ? 'in town' : `in ${place}`}`;
}
function offerDrop(surface) {
  showTalk('The green book', `Leave it here, ${surfaceWords(surface)}, for the next person to find?`, [
    { label: 'Leave it here', run: () => { closeTalk(); leaveBookAt(surface); } },
  ]);
}
async function leaveBookAt(surface) {
  if (!holdingBook() || busy) return;
  const words = surfaceWords(surface);
  const ok = await whileBusy(() => Server.leaveBook({ scene: state.me.scene, x: surface.x, y: surface.y, base: surface.base }));
  if (!ok) return;
  Sound.bookDrop();
  if (modal === 'book') closeBook();
  toast(`You left the green book ${words}. Someone will find it.`, 5000, true);
}

/* ---------- What you can do where you stand ---------- */
function peopleHere() {
  const id = state.me.scene;
  return [...residents, ...others.values()].filter((p) => p.scene === id);
}
function currentAction() {
  const me = state.me, s = world[me.scene], book = state.book;
  if (bookLyingIn(me.scene) && Math.hypot(book.x - me.x, book.base - me.y) < 20) {
    // Guests can see the book lying here, but only people who've signed in can open it.
    if (me.guest) return { label: 'Sign in to open the green book', run: () => askToSignIn('The green book keeps everything people write in town, so each page needs a name behind it. Sign in with your email to read it, write in it, and keep your character safe.') };
    return { label: 'Open the green book', run: () => openBook() };
  }
  if (holdingBook()) {
    const surface = surfaceInReach();
    if (surface) return { label: `Leave the book on this ${surface.kind}`, run: () => leaveBookAt(surface) };
  }
  let near = null, nd = 18;
  for (const p of peopleHere()) {
    if (p.staff) continue;
    const d = Math.hypot(p.x - me.x, p.y - me.y);
    if (d < nd) { nd = d; near = p; }
  }
  if (near) return { label: `Talk to ${near.name}`, run: () => talkTo(near) };
  for (const spot of s.spots) {
    if (Math.hypot(spot.x - me.x, spot.y - me.y) > spot.r) continue;
    if (spot.action === 'coffee') return { label: 'Order a coffee', run: orderCoffee };
    if (spot.action === 'bookseller') return { label: 'Talk to Ravi', run: () => talkTo(residents.find((r) => r.id === 'ravi')) };
    if (spot.action === 'shelf') return { label: 'Browse the shelves', run: browse };
    if (spot.action === 'shop') {
      const label = spot.shop === 'pub' ? `Ask ${Market.keeperName('pub')} for a drink`
        : spot.shop === 'icecream' ? 'Ask Bruno for an ice cream' : spot.shop === 'cinema' ? 'Get something for the film' : `Visit ${Market.title(spot.shop)}`;
      return { label, run: () => Market.open(spot.shop) };
    }
    if (spot.action === 'film') return { label: 'Watch the film for a while', run: () => toast(pickLine(FILM_LINES), 6000) };
    if (spot.action === 'postbox') return { label: 'Post a letter', run: () => toast(pickLine(POST_LINES), 6000) };
    if (spot.action === 'candle') return { label: 'Light a candle', run: () => toast(pickLine(CANDLE_LINES), 6000) };
    if (spot.action === 'easel') return { label: 'Paint for a while', run: paint };
    if (spot.action === 'teacher') return { label: 'Talk to Felix', run: () => talkTo(residents.find((r) => r.id === 'felix')) };
    if (spot.action === 'darts') return { label: 'Throw some darts', run: darts };
    if (spot.action === 'libshelf') return { label: 'Browse the shelves', run: () => toast(pickLine(LIBRARY_LINES), 5500) };
    if (spot.action === 'librarian') return { label: 'Talk to Agnes', run: () => talkTo(residents.find((r) => r.id === 'agnes')) };
    if (spot.action === 'machine') return { label: 'Watch the washing go round', run: () => toast(pickLine(LAUNDRY_LINES), 5500) };
    if (spot.action === 'notices') return { label: 'Read the noticeboard', run: () => toast(pickLine(NOTICES), 6000) };
    if (spot.action === 'piano') return { label: 'Play the piano', run: () => toast(pickLine(PIANO_LINES), 5000) };
    if (spot.action === 'tea') return { label: 'Pour a cup of tea', run: () => { state.me.coffeeUntil = Date.now() + 3 * 60 * 1000; toast('You pour a cup of tea from the urn. It\'s stewed, and somehow exactly right.', 5000); } };
  }
  const door = doorHere();
  if (door && door.to) return { label: `Go into ${door.label}`, run: () => enter(door) };
  if (door && door.owner) return { label: 'Knock on the door', run: () => knock(door) };
  if (exitHere()) return { label: 'Go outside', run: goOutside };
  return null;
}

// quiet skips the usual pop, for when another sound is already marking the moment.
function toast(text, ms = 3800, quiet = false) {
  const t = $('toast');
  t.textContent = text;
  if (t.hidden && !quiet) Sound.pop();
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

function knock(door) {
  const owner = residents.find((r) => r.id === door.owner);
  toast(owner && owner.atHome ? `You knock. ${owner.name} calls out, "Not tonight, sorry. Come by tomorrow?"` : `${owner.name}'s house. You knock, but nobody's home.`);
}
const pickLine = (lines) => lines[Math.floor(Math.random() * lines.length)];
const LIBRARY_LINES = [
  'A library book with a bus ticket from 1998 still tucked inside, marking page 112.',
  'A book about birds. Someone has pencilled ticks next to the ones they\'ve seen.',
  'A cookbook that falls open at the same page. Lemon cake. It must be very good.',
  'A slim book of letters between two old friends. You read three and forget the time.',
];
const LAUNDRY_LINES = [
  'Round and round. It\'s oddly calming. You lose a few minutes to it.',
  'Someone\'s red sock is in with the whites. You decide not to get involved.',
  'The machine hums and shudders, then settles. So do you.',
];
const NOTICES = [
  '"Lost: one grey cat, answers to nothing. Comes back for tea." There\'s a phone number torn off.',
  '"Art class at the studio, Thursdays. No experience needed. No talent needed either."',
  '"Free: one armchair, slightly loved. Ask at the bookshop."',
  '"Anyone want to start a walking group? Slow walkers welcome. Very slow walkers especially."',
];
const FILM_LINES = [
  'An old black-and-white film. Two people on a train, not quite saying what they mean. You stay for longer than you planned.',
  'A cartoon about a dog who wants to fly. Someone in the back row is crying, in a good way.',
  'A film about a lighthouse keeper who writes letters he never sends. You know the feeling.',
];
const POST_LINES = [
  'You post a letter you\'ve been meaning to send for months. It feels lighter out here than it did in your pocket.',
  'You post a postcard to an old friend. Just "Thinking of you." That\'s enough.',
  'You post a thank-you note. Late, but they\'ll still be glad.',
];
const CANDLE_LINES = [
  'You light a candle and stand with it for a moment. You don\'t have to say who it\'s for.',
  'You light a candle. The flame wobbles, then settles. So do you, a little.',
  'You light one for someone you miss, and one for yourself, just because.',
];
const PIANO_LINES = [
  'You play the only tune you know. Twice. Nobody minds.',
  'A few notes, a bit out of tune. It still sounds like a Sunday afternoon.',
  'You pick out a melody you didn\'t know you remembered.',
];
const PAINT_LINES = [
  'You paint the fountain from memory. It comes out a bit wonky, and somehow more like it.',
  'You paint a window with a light on. You\'re not sure whose window it is.',
  'You mix a colour you can\'t name, and paint a whole sky with it.',
  'You paint a face. It looks a bit like someone you used to know.',
];
function paint() {
  toast(PAINT_LINES[Math.floor(Math.random() * PAINT_LINES.length)], 5500);
}
function darts() {
  const throws = ['Three darts. One on the board, one in the wall, one nobody can find.', 'Bullseye. Nobody saw it. You\'ll be telling people anyway.', 'Twenty, five and one. Gwen says that counts as a warm-up.'];
  toast(throws[Math.floor(Math.random() * throws.length)], 5000);
}
function browse() {
  toast(SHELF_LINES[Math.floor(Math.random() * SHELF_LINES.length)], 5000);
}
function orderCoffee() {
  const me = state.me;
  if (me.coffeeUntil > Date.now()) { showTalk('Bea', 'You\'ve still got one going. Sit for a bit, why don\'t you?', []); return; }
  showTalk('Bea', 'What can I get you?', [
    { label: 'A coffee, please', run: () => {
      me.coffeeUntil = Date.now() + 5 * 60 * 1000;
      saveState();
      showTalk('Bea', 'There you go. Sit anywhere you like.', []);
    } },
  ]);
}

/* ---------- Talking ---------- */
// closeLabel replaces the usual "Okay" / "Not now" on the button that closes the box.
function showTalk(name, line, actions, closeLabel) {
  modal = 'talk';
  Sound.pop();
  $('talk-name').textContent = name;
  $('talk-line').textContent = line;
  const box = $('talk-actions');
  box.textContent = '';
  actions.forEach((a, i) => box.append(button(a.label, a.run, i === 0 ? 'primary' : '')));
  box.append(button(closeLabel || (actions.length ? 'Not now' : 'Okay'), closeTalk, actions.length ? '' : 'primary'));
  $('talk').hidden = false;
  box.querySelector('button').focus();
}
function closeTalk() {
  $('talk').hidden = true;
  modal = null;
  releaseFocus();
}
// Hands the keyboard back to the game once a screen closes.
function releaseFocus() {
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
}
function button(label, run, cls = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `btn ${cls}`;
  b.textContent = label;
  b.addEventListener('click', run);
  return b;
}
function talkTo(person) {
  const me = state.me;
  if (person.guide) { talkToHazel(person); return; }
  if (person.real && me.guest) {
    showTalk(person.name, `You wave. ${person.name} waves back. Sign in to talk with people in town.`, [{ label: 'Sign in', run: () => { closeTalk(); showSignin('email'); } }]);
    return;
  }
  if (person.real) {
    // Guests can't chat yet; with signed-in players, "Talk to …" opens a chat straight away (see dm.js).
    if (person.guest) { showTalk(person.name, `You wave. ${person.name} waves back. They're looking around as a guest, so they can't chat yet.`, []); return; }
    Chat.open(person);
    return;
  }
  const facing = me.x < person.x - 3 ? 'left' : me.x > person.x + 3 ? 'right' : me.y < person.y ? 'up' : 'down';
  person.stopToTalk(facing);
  me.talkIndex = ((me.talkIndex || 0) + 1);
  showTalk(person.name, person.lines[me.talkIndex % person.lines.length], []);
}

/* ---------- The green book ---------- */
let bookPage = 0;
let bookTurning = false;
let editingEntry = false;
const narrowBook = () => innerWidth < 720;
const pagesInView = () => (narrowBook() ? 1 : 2);

// With two pages showing, the inside of the cover faces a blank page, so the note opens on the right.
function bookPages() {
  const pages = [...(narrowBook() ? [] : ['blank']), 'intro', ...state.book.entries.map((e) => e.id)];
  // Your own entry lives on its own page, so an empty page is only needed until you've written one.
  return Book.entryBy(state.book, state.me.id) ? pages : [...pages, 'write'];
}
function openBook(page = 0) {
  modal = 'book';
  Sound.bookOpen();
  bookPage = page;
  editingEntry = false;
  const me = state.me;
  me.read = Array.from(new Set([...(me.read || []), ...state.book.entries.map((e) => e.id)]));
  $('book').hidden = false;
  try {
    renderBook();
    saveState();
    openCover();
  } catch (err) {
    console.error(err);
    closeBook();
    toast('The book wouldn\'t open. Please try again.');
  }
}
function closeBook() {
  $('book').hidden = true;
  modal = null;
  releaseFocus();
}
function fillPage(box, id, holding) {
  box.textContent = '';
  if (!id || id === 'blank') return;
  if (id === 'intro') {
    INTRO_LINES.forEach((line) => { const p = document.createElement('p'); p.textContent = line; box.append(p); });
    // Signed like an entry: the name on its own line after a blank one.
    const sign = document.createElement('p'); sign.className = 'sign'; sign.textContent = INTRO_SIGNATURE;
    box.append(sign);
  } else if (id === 'write') {
    renderWritePage(box, holding);
  } else {
    const e = state.book.entries.find((x) => x.id === id);
    const mine = e.authorId === state.me.id && holding;
    if (mine && editingEntry) { renderWritePage(box, holding); return; }
    const text = document.createElement('p'); text.className = 'entry-text'; text.textContent = e.text;
    const sign = document.createElement('p'); sign.className = 'sign'; sign.textContent = e.author;
    box.append(text, sign);
    // Whether the writer is in town right now, so you can go and find them (not where, though).
    if (e.authorId !== state.me.id) {
      const here = others.has(e.authorId);
      const p = document.createElement('p'); p.className = 'in-town';
      p.textContent = here ? `${e.author} is in town right now.` : `${e.author} isn't in town right now.`;
      box.append(p);
    }
    if (mine) {
      const edit = button('Edit', () => {
        editingEntry = true;
        renderBook();
        if ($('entry-input')) $('entry-input').focus();
      }, 'small');
      box.append(edit);
    }
  }
  box.scrollTop = 0;
}
function renderBook() {
  const pages = bookPages(), book = state.book, me = state.me;
  const holding = Book.heldBy(book, me.id), step = pagesInView();
  bookPage = Math.floor(bookPage / step) * step;
  const pageNumber = (i) => (pages[i] && pages[i] !== 'blank' ? i + (step === 2 ? 0 : 1) : '');
  if (step === 2) {
    fillPage($('page-left'), pages[bookPage], holding);
    fillPage($('page-right'), pages[bookPage + 1], holding);
    $('num-left').textContent = pageNumber(bookPage);
    $('num-right').textContent = pageNumber(bookPage + 1);
  } else {
    fillPage($('page-right'), pages[bookPage], holding);
    $('num-right').textContent = pageNumber(bookPage);
  }
  $('book-prev').disabled = bookPage === 0;
  $('book-next').disabled = bookPage + step >= pages.length;
  const actions = $('book-actions');
  actions.textContent = '';
  if (holding) {
    actions.append(button('Leave it here', leaveBook, 'primary'), button('Close', closeBook));
  } else {
    // Writing means taking the book with you for an hour, so "Write in it" keeps it and turns to your page.
    actions.append(button('Put it back', closeBook), button('Write in it', keepBook, 'primary'));
  }
}
function renderWritePage(box, holding) {
  const me = state.me, mine = Book.entryBy(state.book, me.id);
  if (!holding) {
    const p = document.createElement('p');
    p.textContent = 'This page is waiting for you.';
    box.append(p);
    return;
  }
  const area = document.createElement('textarea');
  area.id = 'entry-input';
  area.maxLength = ENTRY_LIMIT;
  area.placeholder = 'Even a few words are enough.';
  area.setAttribute('aria-label', 'Your entry');
  area.value = mine ? mine.text : (me.draft || '');
  area.addEventListener('input', () => { if (!mine) me.draft = area.value; message.textContent = ''; });
  const row = document.createElement('div'); row.className = 'write-row';
  const message = document.createElement('span');
  const save = button('Save', async () => {
    if (!area.value.trim()) { message.textContent = 'Write something first, even a few words.'; return; }
    if (busy) return;
    save.disabled = true;
    let saved = null;
    const ok = await whileBusy(async () => { saved = await Server.saveEntry(area.value); });
    save.disabled = false;
    if (!ok) return;
    me.draft = '';
    editingEntry = false;
    saveState();
    bookPage = Math.floor(bookPages().indexOf(saved.id) / pagesInView()) * pagesInView();
    renderBook();
    toast('Saved. When you\'re ready, take the book to a table, bench or desk and leave it for the next person.', 6000);
  }, 'small');
  // Save stays an outline until there are words on the page, then fills in green.
  const showReady = () => {
    const ready = area.value.trim().length > 0;
    save.classList.toggle('primary', ready);
    save.classList.toggle('outline', !ready);
  };
  area.addEventListener('input', showReady);
  showReady();
  row.append(message, save);
  box.append(area, row);
}

/* The cover swinging open, and pages turning around the spine. */
function copyLeaf(id) {
  const leaf = $(id).cloneNode(true);
  leaf.removeAttribute('id');
  leaf.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  return leaf;
}
function makeFlap(front, back) {
  const flap = document.createElement('div');
  flap.className = 'flap';
  const f = document.createElement('div'); f.className = 'face'; f.append(front);
  const b = document.createElement('div'); b.className = 'face face-back'; b.append(back);
  flap.append(f, b);
  $('spread').append(flap);
  return flap;
}
// Runs once when the animation ends, or after a time limit if the browser has paused it.
function whenFinished(animation, ms, done) {
  let ran = false;
  const finish = () => { if (!ran) { ran = true; done(); } };
  animation.onfinish = finish;
  setTimeout(finish, ms);
}
function openCover() {
  const cover = document.createElement('div');
  cover.className = 'cover';
  const name = document.createElement('span'); name.className = 'cover-name'; name.textContent = BOOK_NAME;
  cover.append(name);
  if (reducedMotion || narrowBook()) {
    // Without the swing, the cover simply shows for a moment so the name is still seen.
    cover.classList.add('cover-still');
    $('spread').append(cover);
    bookTurning = true;
    setTimeout(() => { cover.remove(); bookTurning = false; }, 1100);
    return;
  }
  const left = $('leaf-left'), spread = $('spread');
  const flap = makeFlap(cover, copyLeaf('leaf-left'));
  left.style.visibility = 'hidden';
  bookTurning = true;
  // The closed cover holds for a moment so its name can be read.
  const timing = { delay: 900, duration: 750, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'backwards' };
  const slide = spread.animate([{ transform: 'translateX(-25%)' }, { transform: 'translateX(0)' }], timing);
  whenFinished(flap.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], timing), 2200, () => {
    slide.cancel();
    left.style.visibility = '';
    flap.remove();
    bookTurning = false;
  });
}
function turnPage(dir) {
  turnTo(bookPage + dir * pagesInView());
}
function canTurnTo(next) {
  return !bookTurning && next !== bookPage && next >= 0 && next < bookPages().length;
}
function turnTo(next) {
  if (!canTurnTo(next)) return;
  if (reducedMotion) { bookPage = next; renderBook(); return; }
  startTurn(next).finish(true, 0);
}
// A turning page is built from thin upright strips joined edge to edge, each tilted a little more than the last,
// so the paper curves as it turns instead of swinging like a board. It also shades as it tilts
// and casts a soft shadow on the page it uncovers.
const SLICES = 14;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
function makeSheet(front, back, single) {
  const spread = $('spread');
  const box = spread.getBoundingClientRect();
  const width = box.width / (single ? 1 : 2), strip = width / SLICES;
  const root = document.createElement('div');
  root.className = `sheet${single ? ' single' : ''}`;
  const slices = [];
  let parent = root;
  for (let i = 0; i < SLICES; i++) {
    const slice = document.createElement('div');
    slice.className = 'slice';
    slice.style.width = `${strip}px`;
    slice.style.left = i ? `${strip}px` : '0';
    const shades = [];
    for (const [page, isBack] of [[front, false], [back, true]]) {
      const face = document.createElement('div');
      face.className = `slice-face${isBack ? ' slice-back' : ''}`;
      face.style.width = `${strip + 1}px`; // A hair of overlap hides the seams between strips.
      const content = page.cloneNode(true);
      content.classList.add('slice-content');
      content.style.width = `${width}px`;
      // The back of the sheet is the page that ends up on the left, seen from behind, so its strips run the other way.
      content.style.left = `${-(isBack ? SLICES - 1 - i : i) * strip}px`;
      const shade = document.createElement('div');
      shade.className = 'slice-shade';
      face.append(content, shade);
      slice.append(face);
      shades.push(shade);
    }
    parent.append(slice);
    parent = slice;
    slices.push({ el: slice, front: shades[0], back: shades[1] });
  }
  const cast = document.createElement('div');
  cast.className = 'turn-cast';
  spread.append(cast, root);
  const spineX = single ? 0 : box.width / 2;
  return {
    // q is how far over the sheet is (0 lying on the right, 1 lying on the left); lead is how much the loose edge
    // runs ahead of the spine, which is what bends the paper.
    pose(q, lead) {
      let before = 0, reachX = 0;
      slices.forEach((s, i) => {
        const along = (i + 0.5) / SLICES;
        const angle = -180 * Math.min(1, Math.max(0, q + lead * (2 * along - 1)));
        s.el.style.transform = `rotateY(${(angle - before).toFixed(2)}deg)`;
        before = angle;
        reachX += strip * Math.cos((angle * Math.PI) / 180);
        const tilt = 1 - Math.abs(Math.cos((angle * Math.PI) / 180));
        s.front.style.opacity = (0.34 * tilt).toFixed(3);
        s.back.style.opacity = (0.34 * tilt).toFixed(3);
      });
      // The shadow falls on whichever page lies just beyond the loose edge.
      const edge = spineX + reachX; // Where the curved paper's loose edge sits, seen from the front.
      const dark = (0.42 * Math.sin(Math.PI * q)).toFixed(3), reach = 70;
      cast.style.background = edge >= spineX
        ? `linear-gradient(to right, transparent ${edge}px, rgba(30,26,42,${dark}) ${edge}px, transparent ${edge + reach}px)`
        : `linear-gradient(to left, transparent ${box.width - edge}px, rgba(30,26,42,${dark}) ${box.width - edge}px, transparent ${box.width - edge + reach}px)`;
    },
    remove() { root.remove(); cast.remove(); },
  };
}
function paperBack() {
  const back = document.createElement('div');
  back.className = 'leaf leaf-right paper-back';
  back.innerHTML = '<div class="page"></div>';
  return back;
}
// Sets up a turn to the given page, which a finger, the trackpad or an animation then moves.
// With two pages showing, the sheet has the old right page on its front and the new left page on its back.
// With one page, the sheet peels off the spine on the left and swings away, showing the next page beneath.
function startTurn(next) {
  Sound.pageTurn();
  const dir = next > bookPage ? 1 : -1, from = bookPage, single = narrowBook();
  const oldLeft = copyLeaf('leaf-left'), oldRight = copyLeaf('leaf-right');
  bookPage = next;
  renderBook();
  const newLeft = copyLeaf('leaf-left'), newRight = copyLeaf('leaf-right');
  let under = null;
  // The page beneath the moving sheet keeps showing the old spread until the sheet lands.
  if (!single || dir < 0) {
    under = document.createElement('div');
    under.className = single ? 'under single' : `under ${dir > 0 ? 'left' : 'right'}`;
    under.append(single || dir < 0 ? oldRight : oldLeft);
    $('spread').append(under);
  }
  const sheet = single
    ? makeSheet(dir > 0 ? oldRight : newRight, paperBack(), true)
    : makeSheet(dir > 0 ? oldRight : newRight, dir > 0 ? newLeft : oldLeft, false);
  bookTurning = true;
  // Progress runs from 0 (not turned) to 1 (turned). A forward turn starts with the sheet on the right,
  // a backward one with it on the left. The loose edge always leads, curling the page most halfway over.
  const set = (p) => {
    const q = dir > 0 ? p : 1 - p;
    sheet.pose(q, (dir > 0 ? 1 : -1) * 0.3 * Math.sin(Math.PI * p));
  };
  set(0);
  let ended = false;
  return {
    dir,
    set,
    finish(complete, p) {
      if (ended) return;
      ended = true;
      const to = complete ? 1 : 0;
      const ms = p === to ? 0 : p === 0 ? 820 : Math.max(220, 700 * Math.abs(to - p));
      const ease = p === 0 ? easeInOut : easeOut;
      const start = performance.now();
      let done = false;
      const land = () => {
        if (done) return;
        done = true;
        sheet.remove();
        if (under) under.remove();
        bookTurning = false;
        if (!complete) { bookPage = from; renderBook(); }
      };
      const step = (now) => {
        if (done) return;
        const t = Math.min(1, (now - start) / ms);
        set(p + (to - p) * ease(t));
        if (t < 1) requestAnimationFrame(step); else land();
      };
      requestAnimationFrame(step);
      setTimeout(land, ms + 800); // In case the browser pauses animation frames.
    },
  };
}

/* Turning pages with a finger or the mouse: drag a page sideways, or tap it. */
const pageGesture = { id: null, x: 0, y: 0, t: 0, turn: null, p: 0, lastX: 0, lastT: 0, speed: 0 };
function gestureBlocked(target) {
  return !!target.closest('textarea, input, button, a, select, .write-row');
}
function onSpreadDown(ev) {
  if (modal !== 'book' || bookTurning || editingEntry || ev.button > 0 || gestureBlocked(ev.target)) return;
  Object.assign(pageGesture, { id: ev.pointerId, x: ev.clientX, y: ev.clientY, t: ev.timeStamp, turn: null, p: 0, lastX: ev.clientX, lastT: ev.timeStamp, speed: 0 });
}
function onSpreadMove(ev) {
  const g = pageGesture;
  if (ev.pointerId !== g.id) return;
  const dx = ev.clientX - g.x, dy = ev.clientY - g.y;
  if (!g.turn) {
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.2) {
      if (Math.abs(dy) > 12) g.id = null; // Reading down the page, not turning it.
      return;
    }
    const next = bookPage + (dx < 0 ? 1 : -1) * pagesInView();
    if (!canTurnTo(next) || reducedMotion) { g.id = null; return; }
    g.turn = startTurn(next);
    try { $('spread').setPointerCapture(ev.pointerId); } catch { /* The page still follows moves over the book. */ }
  }
  // A forward turn follows the finger leftwards, a back turn rightwards, across one page's width.
  const width = $('spread').getBoundingClientRect().width / pagesInView();
  g.p = Math.min(1, Math.max(0, (g.turn.dir > 0 ? -dx : dx) / width));
  g.turn.set(g.p);
  const dt = ev.timeStamp - g.lastT;
  if (dt > 0) g.speed = ((ev.clientX - g.lastX) / dt) * (g.turn.dir > 0 ? -1 : 1);
  g.lastX = ev.clientX; g.lastT = ev.timeStamp;
}
function onSpreadUp(ev) {
  const g = pageGesture;
  if (ev.pointerId !== g.id) return;
  g.id = null;
  if (g.turn) {
    // Let go past a third of the way, or with a quick flick, and the page carries on over.
    // A finger that stopped before letting go isn't flicking.
    const flick = ev.timeStamp - g.lastT < 100 && g.speed > 0.35 && g.p > 0.04;
    g.turn.finish(g.p > 0.33 || flick, g.p);
    g.turn = null;
    return;
  }
  const moved = Math.hypot(ev.clientX - g.x, ev.clientY - g.y);
  if (ev.type !== 'pointerup' || moved > 8 || ev.timeStamp - g.t > 600) return;
  // A tap: the left page (or the left edge of a single page) goes back, anywhere else goes forward.
  const r = $('spread').getBoundingClientRect();
  const back = pagesInView() === 2 ? ev.clientX < r.left + r.width / 2 : ev.clientX < r.left + r.width * 0.25;
  turnPage(back ? -1 : 1);
}
async function keepBook() {
  if (busy) return;
  if (!(await whileBusy(() => Server.takeBook()))) return;
  if (modal !== 'book') return;
  renderBook();
  const step = pagesInView(), mine = Book.entryBy(state.book, state.me.id);
  const target = Math.floor(bookPages().indexOf(mine ? mine.id : 'write') / step) * step;
  if (bookTurning) { bookPage = target; renderBook(); } else turnTo(target);
  const area = $('entry-input');
  if (area) area.focus();
  toast('The book is yours for the next hour. Write, then leave it for the next person.', 5000);
}
function dropSpot() {
  const me = state.me, s = world[me.scene];
  const surface = s.surfaces.find((a) => Math.hypot(a.x - me.x, a.base - me.y) < 18);
  if (surface) return { scene: me.scene, x: surface.x, y: surface.y, base: surface.base };
  return { scene: me.scene, x: me.x, y: me.y - 6, base: me.y - 1 };
}
async function leaveBook() {
  const me = state.me;
  if (busy || !(await whileBusy(() => Server.leaveBook(dropSpot())))) return;
  Sound.bookDrop();
  closeBook();
  const place = world[me.scene].placeAt(me.x, me.y);
  toast(`You left the green book ${place === 'the town' ? 'somewhere in town' : `near ${place}`}. Someone will find it.`, 5000, true);
}
// When your hour runs out, the book is set down where you're standing for the next person.
let settingDown = false;
async function checkHoldTime() {
  const book = state.book, me = state.me;
  if (!me || settingDown || book.holderId !== me.id || book.heldUntil > Date.now() || !book.heldUntil) return;
  settingDown = true;
  if (modal === 'book') closeBook();
  try {
    await Server.leaveBook(dropSpot());
    Sound.bookDrop();
    await refreshBook();
    toast('Your hour is up, so the book stays here for the next person.', 6000, true);
  } catch { /* Someone may already have it; the next refresh shows where it is. */ }
  settingDown = false;
}
function syncBookChip() {
  const chip = $('book-chip'), book = state.book, me = state.me;
  if (!me || !Book.heldBy(book, me.id)) { chip.hidden = true; return; }
  chip.hidden = false;
  chip.textContent = `Green book · ${formatLeft(Book.remaining(book, Date.now()))} left`;
}

/* ---------- The way in ----------
   You start in front of the town's entrance (see entrance.js; there are a few to choose from).
   A tap opens it straight onto the square, where Hazel waves and says hello a line at a time.
   The last line offers two ways in: sign in to play, or explore as a guest first. */
const HAZEL_LINES = [
  'Hi, I\'m Hazel. This is a town where people try to be honest.',
  'There\'s a green book hidden somewhere in town. Find it. It has something for you.',
];
const intro = { started: false, talking: false, t0: 0, gateAt: null, line: -1, shown: 0, blipAt: 0, joined: false, farewell: false };
// The way in is the full-screen Japanese gate whose doors slide apart from the centre (9; see entrance.js).
// ?opening=1 to 8 shows one of the earlier tries instead.
const OPENING = (() => { const n = parseInt(new URLSearchParams(location.search).get('opening'), 10); return n >= 1 && n <= 9 ? n : 9; })();
function startIntro() {
  intro.started = true;
  intro.t0 = time;
  TownName.hide();
  Entrance.show(OPENING);
  $('entrance').addEventListener('click', (ev) => knockGate(ev.clientX, ev.clientY));
  $('gate-hint').textContent = 'Knock to enter';
  // The town's name hangs over the gate from the start, and stays up there as the doors slide open.
  setTimeout(() => { if (screen === 'invite') TownName.reveal(); }, reducedMotion ? 0 : 800);
  if (!reducedMotion) {
    canvas.classList.add('waking');
    setTimeout(() => canvas.classList.remove('waking'), 1700);
  }
  setTimeout(() => { if (screen === 'invite' && intro.gateAt === null) $('gate-hint').hidden = false; }, reducedMotion ? 0 : 1200);
}
function openGate() {
  if (intro.gateAt !== null) return;
  intro.gateAt = time;
  $('gate-hint').hidden = true;
  // Hazel waves and starts talking while the doors are still sliding open, so there's no long pause
  // after the knock. (Her box sits above the gate, and the gate finishes opening behind it.)
  const wait = Math.min(Entrance.open() + TownName.extraWait, 1.2);
  setTimeout(() => {
    if (screen !== 'invite') return;
    hazel().waveUntil = time + 1.8;
    intro.talking = true;
    $('invite').hidden = false;
    nextIntroLine();
  }, reducedMotion ? 300 : wait * 1000);
}
// Knocking on the gate: the cursor is a little fist over it. A click knocks twice, the name board
// hanging above jolts with each knock, and then the gate opens.
let knocking = false;
function knockGate(x = innerWidth / 2, y = innerHeight / 2) {
  if (intro.gateAt !== null || knocking) return;
  knocking = true;
  $('gate-hint').hidden = true;
  Sound.knock();
  const entrance = $('entrance');
  if (entrance) entrance.classList.add('knock');
  TownName.jolt();
  setTimeout(() => TownName.jolt(), 220);
  const fist = document.createElement('div');
  fist.className = 'knock-fist';
  Object.assign(fist.style, { left: `${x}px`, top: `${y}px`, backgroundImage: `url(${fistImage()})` });
  document.body.append(fist);
  setTimeout(() => fist.remove(), reducedMotion ? 200 : 750);
  setTimeout(() => { knocking = false; openGate(); }, reducedMotion ? 200 : 550);
}
// A small pixel fist, used as the cursor over the gate and for the knock itself.
let fistUrl = '';
function fistImage() {
  if (fistUrl) return fistUrl;
  const rows = [
    '..oooooooo..',
    '.osssosssoo.',
    '.ossssssssso',
    '.odsdsdsdsso',
    'osssssssssso',
    'ossssssssdso',
    'ossssssssdso',
    '.osssssssdso',
    '.ossssssssso',
    '..osssssssso',
    '...ooooooo..',
    '...ossssso..',
    '...ooooooo..',
  ];
  const k = 2, c = makeCanvas(12 * k, rows.length * k), g = c.getContext('2d');
  const col = { o: '#362c38', s: '#f6c8a0', d: '#d8a07c' };
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x * k, y * k, k, k); } }));
  fistUrl = c.toDataURL();
  document.documentElement.style.setProperty('--fist', `url(${fistUrl}) 10 6, pointer`);
  return fistUrl;
}
fistImage();
function nextIntroLine() {
  intro.line++;
  intro.shown = reducedMotion ? HAZEL_LINES[intro.line].length : 0;
  $('intro-line').textContent = reducedMotion ? HAZEL_LINES[intro.line] : '';
  $('intro-next').hidden = true;
  $('intro-choices').hidden = true;
  if (reducedMotion) finishIntroLine();
}
function finishIntroLine() {
  intro.shown = HAZEL_LINES[intro.line].length;
  $('intro-line').textContent = HAZEL_LINES[intro.line];
  const last = intro.line === HAZEL_LINES.length - 1;
  $('intro-next').hidden = last;
  $('intro-choices').hidden = !last;
  if (last) $('sign-in-play').focus();
}
function typingIntro() { return intro.talking && intro.line >= 0 && intro.shown < HAZEL_LINES[intro.line].length; }
function updateIntro(dt) {
  if (screen !== 'invite' || !typingIntro()) return;
  const line = HAZEL_LINES[intro.line];
  const before = Math.floor(intro.shown);
  intro.shown = Math.min(line.length, intro.shown + dt * 42);
  const now = Math.floor(intro.shown);
  if (now > before) {
    $('intro-line').textContent = line.slice(0, now);
    // A blip every other letter, never on spaces.
    if (now - intro.blipAt >= 2 && line[now - 1] !== ' ') { intro.blipAt = now; Sound.blip(); }
  }
  if (intro.shown >= line.length) finishIntroLine();
}
function advanceIntro() {
  if (intro.gateAt === null) { knockGate(); return; }
  if (!intro.talking) return;
  if (typingIntro()) { finishIntroLine(); return; }
  if (intro.line < HAZEL_LINES.length - 1) { Sound.click(); nextIntroLine(); }
}
function joinFromIntro() {
  if (busy) return;
  intro.joined = true;
  comeInAsGuest();
}
// Hazel keeps the green book a mystery: she never says where it is or what it's for. Finding it is the point.
function talkToHazel(person) {
  const me = state.me;
  person.dir = me.x < person.x - 3 ? 'left' : me.x > person.x + 3 ? 'right' : me.y < person.y ? 'up' : 'down';
  const line = Book.heldBy(state.book, me.id)
    ? 'Oh, you found it. It\'ll tell you the rest.'
    : 'The green book\'s lying around here somewhere. Just wander, and you\'ll find it.';
  showTalk('Hazel', line, [], 'Okay');
}
// Both sound buttons (at the door and in town) show a speaker: with sound waves when on, crossed out when off.
const SPEAKER = '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>';
const SOUND_ICONS = {
  on: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  off: `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
};
function syncSoundButtons() {
  const label = Sound.on ? 'Sound on' : 'Sound off';
  for (const [btn, ico] of [['sound-btn', 'sound-ico'], ['intro-sound', 'intro-sound-ico']]) {
    $(ico).innerHTML = Sound.on ? SOUND_ICONS.on : SOUND_ICONS.off;
    $(btn).querySelector('.txt').textContent = label;
  }
  for (const id of ['sound-btn', 'intro-sound']) {
    $(id).setAttribute('aria-pressed', String(Sound.on));
  }
}
syncSoundButtons();

/* ---------- Screens ---------- */
function setScreen(next) {
  screen = next;
  $('invite').hidden = next !== 'invite' || !intro.talking;
  $('intro-sound').hidden = next !== 'invite';
  if (next === 'invite' && !intro.started) startIntro();
  if (next !== 'invite') { $('gate-hint').hidden = true; Entrance.leave(); TownName.leave(); }
  $('create').hidden = next !== 'create';
  $('signin').hidden = next !== 'signin';
  $('loading').hidden = next !== 'loading';
  $('hud').hidden = next !== 'play';
  if (next !== 'play') { $('prompt').hidden = true; $('hint').hidden = true; }
}

let chosenLook = 0;
function renderCreate() {
  const grid = $('look-grid');
  grid.textContent = '';
  PLAYER_LOOKS.forEach((look, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'look'; b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === chosenLook));
    b.setAttribute('aria-label', `Character ${i + 1}`);
    const c = makeCanvas(13, 20);
    c.getContext('2d').drawImage(personSheet(look), 0, 0, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
    b.append(c);
    b.addEventListener('click', () => { chosenLook = i; renderCreate(); });
    grid.append(b);
  });
}
function beginAs(me) {
  me.guest = isGuest;
  keepGuestName();
  state.me = me;
  buildResidents();
  joinLiveTown();
  Chat.syncChrome();
  if (!isGuest) Chat.init();
  setScreen('play');
  $('hint').hidden = moved;
  syncBookChip();
  saveState();
  if (intro.joined && !intro.farewell) {
    intro.farewell = true;
    Sound.chime();
    showTalk('Hazel', 'Look around. If you get lost, come and find me by the fountain.', [], 'Okay');
  }
}
async function createPlayer(ev) {
  ev.preventDefault();
  // Names are unique in town (ignoring capitals and extra spaces), so nobody can be mistaken for someone else.
  const name = $('name-input').value.replace(/\s+/g, ' ').trim();
  if (!name || !signedInId || busy) return;
  const look = PLAYER_LOOKS[chosenLook];
  busy = true; $('create-go').disabled = true; note('create-msg', '');
  try { await Server.savePlayer(signedInId, name, look); } catch (err) {
    busy = false; $('create-go').disabled = false;
    note('create-msg', err.message);
    $('name-input').focus();
    return;
  }
  busy = false; $('create-go').disabled = false;
  const s = world.town.start;
  beginAs({ id: signedInId, name, look, scene: 'town', x: s.x, y: s.y, dir: 'up', read: [] });
}

/* ---------- Other real players, live ----------
   Everyone who has the game open shares where they are a few times a second while they move.
   Others are drawn gliding toward their latest position, so movement looks smooth. */
const others = new Map();
let liveTown = null, sentAt = 0, lastSent = '';
function joinLiveTown() {
  if (liveTown || !Server.ready || !state.me) return;
  const me = state.me;
  liveTown = Server.joinTown(me, {
    // Who has the game open right now.
    people(list) {
      const here = new Set();
      for (const p of list) {
        // Guests are never shown to anyone (an older copy of the game might still announce one).
        if (p.id === me.id || p.guest) continue;
        here.add(p.id);
        // Place them where they said they were standing, so they show up straight away.
        const spot = p.scene && Number.isFinite(p.x) && Number.isFinite(p.y);
        if (!others.has(p.id)) {
          others.set(p.id, { id: p.id, real: true, guest: !!p.guest, name: p.name, look: p.look, scene: spot ? p.scene : null,
            x: spot ? p.x : 0, y: spot ? p.y : 0, tx: spot ? p.x : 0, ty: spot ? p.y : 0, dir: p.dir || 'down', walking: false, walkTime: 0 });
        } else {
          const o = others.get(p.id);
          Object.assign(o, { name: p.name, look: p.look, guest: !!p.guest });
          // Only if we've had nothing fresher from them yet.
          if (!o.scene && spot) Object.assign(o, { scene: p.scene, x: p.x, y: p.y, tx: p.x, ty: p.y, dir: p.dir || 'down' });
        }
      }
      for (const id of [...others.keys()]) if (!here.has(id)) others.delete(id);
      Chat.people();
    },
    // Someone new opened the game: tell them where I am straight away. This runs as soon as the
    // message arrives, even if this window is in the background (where drawing, and so the usual
    // position updates, pause).
    arrived(id) { if (id !== me.id) sendMyPositionNow(); },
    moved(pos) {
      const p = others.get(pos.id);
      if (!p) return;
      const jump = p.scene !== pos.scene || Math.hypot(pos.x - p.x, pos.y - p.y) > 80;
      Object.assign(p, { scene: pos.scene, tx: pos.x, ty: pos.y, dir: pos.dir, walking: pos.walking });
      if (jump) { p.x = pos.x; p.y = pos.y; }
    },
  });
}
function updateOthers(dt) {
  for (const p of others.values()) {
    const dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy);
    // A little faster than walking pace, so they catch up between updates without jumping.
    const step = 80 * dt;
    if (d <= step) { p.x = p.tx; p.y = p.ty; } else { p.x += dx / d * step; p.y += dy / d * step; }
    p.walking = d > 0.5;
    if (p.walking) p.walkTime += dt;
  }
}
function myPosition() {
  const me = state.me;
  return { id: me.id, scene: me.scene, x: Math.round(me.x * 10) / 10, y: Math.round(me.y * 10) / 10, dir: me.dir, walking: !!me.walking };
}
function sendMyPositionNow() {
  if (!liveTown || !state.me) return;
  const pos = myPosition();
  liveTown.move(pos);
  lastSent = `${pos.scene}|${pos.x}|${pos.y}|${pos.dir}|${pos.walking}`;
  sentAt = 0;
}
// Coming back to this tab: catch up with the live town straight away (see wake in server.js),
// and tell everyone where I am.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !liveTown) return;
  liveTown.wake();
  sendMyPositionNow();
});
// The spot shared along with who I am (see joinTown) is refreshed whenever I go into or out of a
// building, and every few seconds while I've moved, so newcomers always see me close to where I am.
let trackedScene = '', trackedAt = 0, trackedX = 0, trackedY = 0;
setInterval(() => {
  if (!liveTown || !state.me) return;
  const me = state.me, now = performance.now();
  const movedFar = Math.hypot(me.x - trackedX, me.y - trackedY) > 24;
  if (me.scene !== trackedScene || (movedFar && now - trackedAt > 4000)) {
    liveTown.retrack();
    trackedScene = me.scene; trackedAt = now; trackedX = me.x; trackedY = me.y;
  }
}, 1000);
function shareMyPosition(dt) {
  sentAt += dt;
  if (!liveTown || screen !== 'play' || !state.me) return;
  const pos = myPosition();
  const key = `${pos.scene}|${pos.x}|${pos.y}|${pos.dir}|${pos.walking}`;
  // While moving, two updates a second; standing still, nothing, apart from a hello every so often for anyone who missed it.
  // Two updates a second keep the free plan's live-message limit comfortable for ~20 players moving at once.
  if ((key !== lastSent && sentAt > 0.5) || sentAt > 10) {
    liveTown.move(pos);
    lastSent = key;
    sentAt = 0;
  }
}

/* ---------- Signing in and the shared book ----------
   Players walk in as guests and pick a name and character once; this device remembers them.
   Signing in only asks for an email, and a guest who signs in keeps their character. */
let signedInId = null, isGuest = false, busy = false, watching = false;
// Guests see a Sign in button; signed-in players see a Sign out button in its place.
// A gentle note for guests when they try something only signed-in people can do.
function askToSignIn(why) {
  showTalk('Sign in to play', why, [
    { label: 'Sign in', run: () => { closeTalk(); showSignin('email'); } },
  ]);
}
function syncAccountUi() {
  if (state.me) state.me.guest = isGuest;
  if (liveTown && liveTown.retrack) liveTown.retrack();
  $('signin-btn').hidden = !isGuest;
  $('signout-btn').hidden = isGuest;
}
// Runs one call to the shared town, showing what went wrong if it fails, and refreshes the book after.
async function whileBusy(run) {
  busy = true;
  let ok = true;
  try { await run(); } catch (err) { toast(err.message, 5000); ok = false; }
  busy = false;
  try { await refreshBook(); } catch { /* The next change in town refreshes it. */ }
  return ok;
}
async function refreshBook() {
  if (!signedInId) return;
  state.book = await Server.loadBook();
  syncBookChip();
  // Redraw an open book, unless someone is in the middle of writing in it.
  const typingHere = document.activeElement && document.activeElement.id === 'entry-input';
  if (modal === 'book' && !bookTurning && !typingHere) renderBook();
}
function leaveSignin() { setScreen(state.me ? 'play' : 'invite'); }
function showSignin(step) {
  $('email-form').hidden = step !== 'email';
  $('sent-panel').hidden = step !== 'sent';
  $('email-msg').hidden = true;
  $('sent-msg').hidden = true;
  setScreen('signin');
  if (step === 'email') $('email-input').focus();
}
function note(id, text) { $(id).textContent = text; $(id).hidden = !text; }
let linkEmail = '';
async function sendLink(email, msgId, btnId) {
  if (!email || busy) return null;
  busy = true; $(btnId).disabled = true; note(msgId, 'Sending…');
  let how = null;
  try { how = await Server.signInWithEmail(email); note(msgId, ''); } catch (err) { note(msgId, err.message); }
  busy = false; $(btnId).disabled = false;
  return how;
}
async function submitEmail(ev) {
  ev.preventDefault();
  const email = $('email-input').value.trim();
  const how = await sendLink(email, 'email-msg', 'send-code');
  if (!how) return;
  linkEmail = email;
  $('sent-email').textContent = email;
  $('sent-town').hidden = !state.me;
  showSignin('sent');
}
async function sendAgain() {
  if (await sendLink(linkEmail, 'sent-msg', 'send-again')) note('sent-msg', 'Sent again. Check your inbox in a minute.');
}
// Coming in as a guest: no email, just a name and a character.
async function comeInAsGuest() {
  if (busy) return;
  busy = true;
  setScreen('loading');
  note('loading-msg', '');
  let id = null;
  try { id = await Server.enterAsGuest(); } catch (err) {
    note('loading-msg', `${err.message} Refresh the page to try again.`);
  }
  busy = false;
  if (id) await enterTown(id, true);
}
// Guests skip choosing: they get a random character and a random two-word name like "Quiet Duck",
// which the town makes sure nobody else is using (see supabase/guest-names.sql). Nothing else is
// saved about them, and it all goes when they close the tab. Signing in is when you choose your own.
async function guestCharacter(id) {
  const same = state.me && state.me.id === id;
  let name;
  try { name = await Server.claimGuestName(); } catch { name = same && state.me.name ? state.me.name : 'Quiet Visitor'; }
  const look = same && state.me.look ? state.me.look : PLAYER_LOOKS[Math.floor(Math.random() * PLAYER_LOOKS.length)];
  return { name, look };
}
// While a guest is in town, their tab checks in every few minutes so their name stays theirs.
let guestCheckIn = null;
function keepGuestName() {
  clearInterval(guestCheckIn);
  guestCheckIn = isGuest ? setInterval(() => { if (isGuest) Server.touchGuestName().catch(() => {}); }, 3 * 60 * 1000) : null;
}
// Signed in: load the shared book, then either walk straight in or pick a character first.
async function enterTown(id, guest) {
  signedInId = id;
  isGuest = guest;
  syncAccountUi();
  setScreen('loading');
  note('loading-msg', '');
  try {
    const [player] = await Promise.all([guest ? guestCharacter(id) : Server.loadPlayer(id), refreshBook()]);
    if (!watching) { watching = true; Server.watch(() => refreshBook().catch(() => {})); }
    if (!player) {
      $('name-input').value = '';
      renderCreate();
      setScreen('create');
      $('name-input').focus();
      return;
    }
    const s = world.town.start;
    const here = state.me && state.me.id === id ? state.me : { scene: 'town', x: s.x, y: s.y, dir: 'up', read: [] };
    beginAs({ ...here, id, name: player.name, look: player.look });
    $('hint').hidden = moved;
  } catch (err) {
    note('loading-msg', `${err.message} Refresh the page to try again.`);
  }
}
// The Sign out button checks once before signing out, so a stray tap doesn't send anyone back to the door.
function askToSignOut() {
  if (modal) return;
  if (holdingBook()) { toast('You\'re still holding the green book. Leave it somewhere first.', 5000); return; }
  showTalk('Sign out?', 'Your character stays saved to your email, so you can sign in again any time.', [
    { label: 'Sign out', run: () => { closeTalk(); signOut(); } },
  ], 'Stay');
}
async function signOut() {
  await Server.signOut();
  state.me = null;
  saveState();
  location.reload();
}

/* ---------- Drawing ---------- */
function resize() {
  const W = innerWidth, H = innerHeight;
  // In the wider view (see wayfinding.js), each town pixel is drawn smaller, so more of the town fits.
  const wide = typeof Wayfinding !== 'undefined' && Wayfinding.wide;
  const scale = Math.max(2, Math.floor(Math.min(W / (wide ? 400 : 320), H / (wide ? 250 : 200))));
  view.scale = scale;
  view.w = Math.max(1, Math.ceil(W / scale));
  view.h = Math.max(1, Math.ceil(H / scale));
  for (const c of [canvas, lightCanvas, glowCanvas]) { c.width = view.w; c.height = view.h; }
  canvas.style.width = `${view.w * scale}px`;
  canvas.style.height = `${view.h * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

function updateCamera() {
  const s = curScene();
  let fx, fy;
  if (screen === 'play') { fx = state.me.x; fy = state.me.y - 8; }
  else if (screen === 'invite' || intro.started) {
    const h = hazel();
    fx = h.x; fy = h.y - 16;
  } else {
    const drift = reducedMotion ? 0 : Math.sin(time / 14) * 26;
    fx = 360 + drift; fy = 210;
  }
  const clamp = (v, size, max) => (size >= max ? -Math.floor((size - max) / 2) : Math.max(0, Math.min(max - size, Math.floor(v - size / 2))));
  view.x = clamp(fx, view.w, s.w);
  view.y = clamp(fy, view.h, s.h);
}
function personFrame(p) {
  return p.walking ? Math.floor((p.walkTime || 0) * 7) % 4 : 0;
}
function drawPersonTo(c, p, comp) {
  const fx = Math.round(p.x) - FEET_X - view.x, fy = Math.round(p.y) - FEET_Y - view.y;
  if (p.guide) {
    const waving = p.waveUntil > time;
    const col = waving ? 4 + (Math.floor(time * 5) % 2) : personFrame(p), row = waving ? 0 : DIRS[p.dir];
    c.drawImage(guideSheet(), col * CELL_W, row * CELL_H, CELL_W, CELL_H, fx, fy, CELL_W, CELL_H);
    return;
  }
  const sheet = p.guest ? guestSheet(p.look) : personSheet(p.look);
  c.drawImage(sheet, personFrame(p) * CELL_W, DIRS[p.dir] * CELL_H, CELL_W, CELL_H, fx, fy, CELL_W, CELL_H);
  if (comp) return;
  const hand = p.dir === 'left' ? 3 : p.dir === 'right' ? 8 : 9;
  if (p.coffeeUntil > Date.now()) { c.fillStyle = PAL.wall; c.fillRect(fx + hand, fy + 13, 2, 2); }
  if (p.treat && typeof Market !== 'undefined') Market.drawInHand(c, p, fx + hand, fy + 13);
  if (p.id && Book.heldBy(state.book, p.id)) {
    c.fillStyle = PAL.line; c.fillRect(fx + (p.dir === 'left' ? 7 : 1), fy + 12, 4, 4);
    c.fillStyle = PAL.book; c.fillRect(fx + (p.dir === 'left' ? 8 : 2), fy + 13, 2, 2);
  }
}

const bookCanvas = (() => { const c = makeCanvas(BOOK_W, BOOK_H); bookSprite(new Painter(c.getContext('2d')), 0, 0); return c; })();

function drawScene(s) {
  const items = [];
  for (const o of s.objects) {
    if (o.x + o.w < view.x || o.x > view.x + view.w || o.y + o.h < view.y || o.y > view.y + view.h) continue;
    items.push({ base: o.base, kind: 'o', o });
  }
  const people = [...residents, ...others.values()].filter((p) => p.scene === s.id);
  if (screen === 'play') people.push(state.me);
  for (const p of people) items.push({ base: p.y, kind: 'p', p });
  const book = state.book;
  if (bookLyingIn(s.id)) items.push({ base: book.base, kind: 'b' });
  items.sort((a, b) => a.base - b.base);

  ctx.fillStyle = '#1e1a2a';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.drawImage(s.ground, -view.x, -view.y);
  TownName.drawGround(ctx, s);
  const bx = Math.round(book.x) - 6 - view.x, by = Math.round(book.y) - 5 - view.y;
  for (const it of items) {
    if (it.kind === 'o') ctx.drawImage(it.o.canvas, it.o.x - view.x, it.o.y - view.y);
    else if (it.kind === 'p') drawPersonTo(ctx, it.p);
    else ctx.drawImage(bookCanvas, bx, by);
  }
  const blink = Math.floor(time * 3);
  s.sparkles.forEach((sp, i) => {
    if ((blink + i) % 3 === 0) { ctx.fillStyle = sp.c; ctx.fillRect(sp.x - view.x, sp.y - view.y, 1, 1); }
  });

  const night = nightAt(clockHour);
  if (s.id === 'town') {
    drawButterflies(1 - night);
    applyLight(s, items, night, bx, by);
    drawFireflies(night);
  } else {
    ctx.fillStyle = `rgba(30,34,76,${night * 0.92})`;
    for (const [x, y, w, h] of s.panes) ctx.fillRect(x - view.x, y - view.y, w, h);
    ctx.fillStyle = 'rgba(255,190,110,0.07)';
    ctx.fillRect(0, 0, view.w, view.h);
  }
  if (screen === 'play' && holdingBook() && !modal) drawDropMark();
  if (bookLyingIn(s.id)) {
    ctx.fillStyle = PAL.flowers[1];
    // One small star at a time twinkles around the book, so it catches the eye without hiding its shape.
    const [sx, sy] = [[-2, -1], [11, -3], [14, 4]][Math.floor(time * 0.8) % 3];
    if (time % 1.25 < 0.8) {
      ctx.fillRect(bx + sx - 1, by + sy, 3, 1);
      ctx.fillRect(bx + sx, by + sy - 1, 1, 3);
    }
  }
}

// When you carry the book and stand by a table, bench or desk, a small arrow bobs over it to say the book can go there.
function drawDropMark() {
  const a = surfaceInReach();
  if (!a) return;
  const x = Math.round(a.x) - view.x, y = Math.round(a.y) - 12 - view.y + Math.round(Math.sin(time * 4) * 1.5);
  ctx.fillStyle = PAL.line;
  ctx.fillRect(x - 4, y - 1, 9, 1);
  for (let i = 0; i < 5; i++) ctx.fillRect(x - 4 + i, y + i, 9 - 2 * i, 1);
  ctx.fillStyle = PAL.flowers[1];
  for (let i = 0; i < 4; i++) ctx.fillRect(x - 3 + i, y + i, 7 - 2 * i, 1);
}

function applyLight(s, items, night, bx, by) {
  const amb = ambientAt(clockHour);
  if (amb.every((v) => v === 255)) return;
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = `rgb(${amb})`;
  lightCtx.fillRect(0, 0, view.w, view.h);
  lightCtx.globalCompositeOperation = 'lighten';
  const stamp = (x, y, r) => {
    if (x + r < view.x || x - r > view.x + view.w || y + r < view.y || y - r > view.y + view.h) return;
    lightCtx.drawImage(glowStamp(r), Math.round(x - r - view.x), Math.round(y - r - view.y));
  };
  s.lamps.forEach((l) => stamp(l.x, l.y, l.r));
  for (const p of residents) if (p.guide && p.scene === s.id) stamp(p.x + 3, p.y - 4, 26);
  if (screen === 'play') stamp(state.me.x, state.me.y - 6, 22);
  // Guests carry a faint glow of their own, so their grey figures don't sink into the dark.
  for (const p of others.values()) if (p.guest && p.scene === s.id) stamp(p.x, p.y - 6, 14);
  if (bookLyingIn(s.id)) stamp(state.book.x, state.book.y, 14);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (night <= 0.01) return;
  // Lit windows glow through the dark, but anything standing in front still hides them.
  glowCtx.clearRect(0, 0, view.w, view.h);
  for (const it of items) {
    if (it.kind === 'o') {
      glowCtx.globalCompositeOperation = 'destination-out';
      glowCtx.drawImage(it.o.canvas, it.o.x - view.x, it.o.y - view.y);
      glowCtx.globalCompositeOperation = 'source-over';
      if (it.o.lit) glowCtx.drawImage(it.o.lit, it.o.x - view.x, it.o.y - view.y);
    } else if (it.kind === 'p') {
      glowCtx.globalCompositeOperation = 'destination-out';
      drawPersonTo(glowCtx, it.p, true);
      glowCtx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = night;
  ctx.drawImage(glowCanvas, 0, 0);
  ctx.globalAlpha = 1;
}

function drawButterflies(amount) {
  if (amount < 0.3) return;
  for (const b of butterflies) {
    if (!reducedMotion) {
      b.a += 0.03 + Math.sin(time + b.x) * 0.03;
      b.x = (b.x + Math.cos(b.a) * 0.25 + 720) % 720;
      b.y = (b.y + Math.sin(b.a) * 0.25 + 480) % 480;
    }
    ctx.fillStyle = b.c;
    const flap = Math.floor(time * 8 + b.x) % 2;
    ctx.fillRect(Math.round(b.x) - view.x - flap, Math.round(b.y) - view.y, 1 + flap * 2, 1);
  }
}
function drawFireflies(amount) {
  if (amount < 0.5) return;
  ctx.fillStyle = '#e8f07a';
  for (const f of fireflies) {
    if (!reducedMotion) {
      f.a += 0.02 + Math.sin(time * 0.7 + f.y) * 0.03;
      f.x = (f.x + Math.cos(f.a) * 0.15 + 720) % 720;
      f.y = (f.y + Math.sin(f.a) * 0.15 + 480) % 480;
    }
    if (Math.sin(time * 1.6 + f.x) > 0.1) ctx.fillRect(Math.round(f.x) - view.x, Math.round(f.y) - view.y, 1, 1);
  }
}

const labelPool = [];
function updateLabels(s) {
  const box = $('labels');
  const shown = [];
  const h = hazel();
  if (screen === 'invite' && h) shown.push({ p: h, cls: 'label guide' });
  if (screen === 'play') {
    const me = state.me;
    shown.push({ p: me, cls: `label me${me.guest ? ' guest' : ''}` });
    for (const p of others.values()) {
      if (p.scene === s.id) shown.push({ p, cls: `label player${p.guest ? ' guest' : ''}` });
    }
    for (const p of residents) {
      // Stallholders go without a name tag, which would cover their stall's sign; their menu says who they are.
      if (p.shop && p.scene === 'town') continue;
      if (p.scene === s.id && Math.hypot(p.x - me.x, p.y - me.y) < (p.guide ? 140 : 70)) shown.push({ p, cls: p.guide ? 'label guide' : 'label' });
    }
  }
  TownName.place(s);
  Wayfinding.update(s);
  while (labelPool.length < shown.length) { const d = document.createElement('div'); box.append(d); labelPool.push(d); }
  labelPool.forEach((el, i) => {
    const item = shown[i];
    el.hidden = !item;
    if (!item) return;
    if (el.textContent !== item.p.name) el.textContent = item.p.name;
    el.className = item.cls;
    el.style.left = `${(Math.round(item.p.x) - view.x) * view.scale}px`;
    el.style.top = `${(Math.round(item.p.y) - view.y - 16) * view.scale}px`;
  });
}

/* ---------- Heads-up display ---------- */
// A small wall clock in the corner, showing the player's own time.
(() => {
  const ticks = $('clock-ticks');
  for (let i = 0; i < 12; i++) {
    const big = i % 3 === 0, a = (i * Math.PI) / 6;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const r1 = big ? 14.5 : 16.5, r2 = 18.5;
    line.setAttribute('x1', (24 + r1 * Math.sin(a)).toFixed(2)); line.setAttribute('y1', (24 - r1 * Math.cos(a)).toFixed(2));
    line.setAttribute('x2', (24 + r2 * Math.sin(a)).toFixed(2)); line.setAttribute('y2', (24 - r2 * Math.cos(a)).toFixed(2));
    line.setAttribute('class', big ? 'clock-tick big' : 'clock-tick');
    ticks.append(line);
  }
})();
let clockShown = '';
function setClock(hour) {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  if (label === clockShown) return;
  clockShown = label;
  $('clock-hour').setAttribute('transform', `rotate(${((h % 12) + m / 60) * 30} 24 24)`);
  $('clock-minute').setAttribute('transform', `rotate(${m * 6} 24 24)`);
  $('clock').setAttribute('aria-label', `Time ${label}`);
  $('clock').title = label;
}
let currentRun = null;
function updateHud() {
  setClock(clockHour);
  const action = modal ? null : currentAction();
  const prompt = $('prompt');
  if (action) {
    if (prompt.dataset.label !== action.label) {
      prompt.dataset.label = action.label;
      prompt.innerHTML = '';
      const k = document.createElement('kbd'); k.textContent = 'E';
      prompt.append(k, action.label);
    }
    prompt.hidden = false;
    currentRun = action.run;
  } else { prompt.hidden = true; currentRun = null; delete prompt.dataset.label; }
}

/* ---------- Main loop ---------- */
let last = performance.now();
let tickTimer = 0;
function step(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  time += dt;
  updateClock(dt);
  residents.forEach((p) => p.update(dt, clockHour));
  updateOthers(dt);
  shareMyPosition(dt);
  updateIntro(dt);
  if (screen === 'play' && !modal) updateMe(dt);
  else if (screen === 'play' && state.me) state.me.walking = false;
  tickTimer += dt;
  if (tickTimer > 2) {
    tickTimer = 0;
    checkHoldTime();
    syncBookChip();
    if (screen === 'play') saveState();
  }
  Sound.ambience(dt, nightAt(clockHour), curScene().id === 'town');
  updateCamera();
  const s = curScene();
  drawScene(s);
  updateLabels(s);
  if (screen === 'play') updateHud();
}
let lastFrameError = '';
function frame(now) {
  try {
    step(now);
  } catch (err) {
    if (err.message !== lastFrameError) console.error(err);
    lastFrameError = err.message;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}

/* ---------- Input ---------- */
const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'Shift']);
function typing() {
  const t = document.activeElement;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') && t.offsetParent !== null;
}
addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') {
    if (modal === 'book') closeBook();
    else if (modal === 'talk') closeTalk();
    else if (modal === 'map') Wayfinding.closeMap();
    else if (modal === 'shop') Market.close();
    return;
  }
  if (typing()) return;
  const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (screen === 'invite') {
    if ((k === ' ' || k === 'Enter' || k === 'e') && !ev.repeat && !document.activeElement.closest('#intro-choices')) { ev.preventDefault(); advanceIntro(); }
    return;
  }
  if (screen !== 'play') return;
  if (modal === 'talk' && MOVE_KEYS.has(k) && k !== 'Shift') closeTalk();
  if (modal) return;
  if (MOVE_KEYS.has(k)) { keys.add(k); ev.preventDefault(); }
  // E or Space does whatever the button at the bottom says.
  if (k === 'm' && !ev.repeat) { Wayfinding.openMap(); return; }
  if (k === 'z' && !ev.repeat) { Wayfinding.toggleZoom(); return; }
  if ((k === 'e' || k === ' ') && currentRun && !ev.repeat) {
    ev.preventDefault();
    currentRun();
  }
});
addEventListener('keyup', (ev) => {
  keys.delete(ev.key.length === 1 ? ev.key.toLowerCase() : ev.key);
});
addEventListener('blur', () => keys.clear());
// The Mac never reports letters let go while Cmd is held, so those keys would keep walking.
addEventListener('keydown', (ev) => { if (ev.metaKey) keys.clear(); }, true);
addEventListener('resize', () => { resize(); if (modal === 'book' && !bookTurning) renderBook(); });
canvas.addEventListener('pointerdown', clickWorld);

$('come-in').addEventListener('click', (ev) => { ev.stopPropagation(); joinFromIntro(); });
// The town map, and zooming between seeing more of the town and a closer view.
$('minimap').addEventListener('click', () => { $('minimap').blur(); Wayfinding.openMap(); });
$('map-close').addEventListener('click', () => Wayfinding.closeMap());
$('map-screen').addEventListener('pointerdown', (ev) => { if (ev.target === $('map-screen')) Wayfinding.closeMap(); });
// Signing in straight from the welcome: just an email, and the link brings you into town.
$('sign-in-play').addEventListener('click', (ev) => { ev.stopPropagation(); intro.joined = true; showSignin('email'); });
$('invite').addEventListener('click', advanceIntro);
$('gate-hint').addEventListener('click', (ev) => { ev.stopPropagation(); knockGate(ev.clientX, ev.clientY); });
for (const id of ['sound-btn', 'intro-sound']) $(id).addEventListener('click', (ev) => { ev.stopPropagation(); $(id).blur(); Sound.toggle(); syncSoundButtons(); });
// Every button gives a small click.
document.addEventListener('click', (ev) => { if (ev.target.closest('button') && !ev.target.closest('.sound-btn, .gate-hint')) Sound.click(); }, true);
$('signin-btn').addEventListener('click', () => { $('signin-btn').blur(); showSignin('email'); });
$('signin-back').addEventListener('click', leaveSignin);
$('sent-town').addEventListener('click', leaveSignin);
$('email-form').addEventListener('submit', submitEmail);
$('send-again').addEventListener('click', sendAgain);
$('sent-back').addEventListener('click', () => showSignin('email'));
$('create-form').addEventListener('submit', createPlayer);
$('prompt').addEventListener('click', () => { $('prompt').blur(); if (currentRun) currentRun(); });
$('book').addEventListener('pointerdown', (ev) => { if (ev.target === $('book')) closeBook(); });
/* Turning pages with a two-finger swipe on a trackpad, which arrives as sideways scrolling.
   The page follows the fingers, keeps going with the trackpad's glide after they lift, and settles when the scrolling stops. */
const pageSwipe = { turn: null, p: 0, sum: 0, timer: 0, quietUntil: 0 };
function endSwipe() {
  const w = pageSwipe;
  clearTimeout(w.timer);
  if (w.turn) {
    // The trackpad's own glide after the fingers lift carries a quick swipe past this point.
    w.turn.finish(w.p > 0.3, w.p);
    // The trackpad's glide keeps sending scrolls for a moment; they shouldn't start another turn.
    w.quietUntil = performance.now() + 450;
  }
  Object.assign(w, { turn: null, p: 0, sum: 0 });
}
function onBookWheel(ev) {
  if (modal !== 'book' || editingEntry) return;
  const scale = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
  const dx = ev.deltaX * scale, dy = ev.deltaY * scale;
  const w = pageSwipe;
  // Up and down is for reading a long page.
  if (!w.turn && Math.abs(dx) <= Math.abs(dy)) return;
  ev.preventDefault(); // Also stops the browser from treating the swipe as Back or Forward.
  const now = performance.now();
  if (now < w.quietUntil) return;
  if (!w.turn) {
    if (bookTurning || reducedMotion) return;
    w.sum += dx;
    if (Math.abs(w.sum) < 6) return;
    // Fingers moving left scroll to the right, which turns the page forward, like pushing it over.
    const next = bookPage + (w.sum > 0 ? 1 : -1) * pagesInView();
    if (!canTurnTo(next)) { w.sum = 0; w.quietUntil = now + 300; return; }
    w.turn = startTurn(next);
  }
  const reach = Math.min(420, $('spread').getBoundingClientRect().width / pagesInView()) * 0.75;
  const move = (dx * w.turn.dir) / reach;
  w.p = Math.min(1, Math.max(0, w.p + move));
  w.turn.set(w.p);
  clearTimeout(w.timer);
  if (w.p >= 1) endSwipe(); else w.timer = setTimeout(endSwipe, 140);
}
$('book').addEventListener('wheel', onBookWheel, { passive: false });
$('spread').addEventListener('pointerdown', onSpreadDown);
$('spread').addEventListener('pointermove', onSpreadMove);
$('spread').addEventListener('pointerup', onSpreadUp);
$('spread').addEventListener('pointercancel', onSpreadUp);
$('book-prev').addEventListener('click', () => turnPage(-1));
$('book-next').addEventListener('click', () => turnPage(1));
$('book-chip').addEventListener('click', () => { if (!modal && !state.me.guest) openBook(); });
$('signout-btn').addEventListener('click', () => { $('signout-btn').blur(); askToSignOut(); });

resize();
requestAnimationFrame(frame);
/* ---------- Previewing how guests look ----------
   ?preview=guests opens the town without signing in, with a signed-in player and a few guests
   standing near you. Add &hour=22 (or any hour) to see them at that time of day. */
function startGuestPreview() {
  const s = world.town.start;
  isGuest = false;
  const row = [{ name: 'Member', guest: false }, { name: 'Monica', guest: true }, { name: 'Julian', guest: true }, { name: 'Alice', guest: true }];
  // On open ground below you, staggered so neighbouring name tags never sit on the same line.
  const spots = [[-60, 44], [-20, 70], [20, 44], [60, 70]];
  row.forEach((r, i) => {
    const x = s.x + spots[i][0], y = s.y + spots[i][1];
    others.set(`preview-${i}`, { id: `preview-${i}`, real: true, ...r, look: PLAYER_LOOKS[(i + 1) % PLAYER_LOOKS.length], scene: 'town', x, y, tx: x, ty: y, dir: 'down', walking: false, walkTime: 0 });
  });
  state.me = { id: 'preview-me', name: 'You', look: PLAYER_LOOKS[0], scene: 'town', x: s.x, y: s.y + 10, dir: 'down', read: [], guest: false };
  setScreen('play');
  syncAccountUi();
  $('hint').hidden = false;
  $('hint').textContent = 'Preview: "Member" is signed in; the grey figures are guests.';
}

// Coming back on a device that's still signed in walks straight into town.
(async () => {
  if (new URLSearchParams(location.search).get('preview') === 'guests') { startGuestPreview(); return; }
  if (!Server.ready) {
    setScreen('loading');
    note('loading-msg', 'The town isn\'t connected to its shared book yet.');
    return;
  }
  const who = await Server.account();
  if (who) { moved = true; await enterTown(who.id, who.guest); } else setScreen('invite');
  // Opening the emailed link signs this browser in, even if it opens in another tab.
  // A guest who confirmed their email stays where they are; signing in to a different
  // character walks this tab over to them, unless they're holding the book.
  Server.onSignedIn((who) => {
    if (who.id === signedInId) {
      if (isGuest !== who.guest) {
        isGuest = who.guest;
        syncAccountUi();
        // Guests never chose a name or character, so they do that now (see enterTown).
        if (!isGuest && !holdingBook()) { state.me = null; saveState(); location.reload(); return; }
      }
      if (screen === 'signin' && !isGuest) leaveSignin();
      return;
    }
    if (busy || holdingBook()) return;
    // Already walking around as someone else: start fresh so the live town knows the new character.
    if (state.me) { state.me = null; saveState(); location.reload(); return; }
    if (screen === 'signin' || screen === 'invite') enterTown(who.id, who.guest);
  });
})();

