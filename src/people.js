// Stand-in residents, until real players live here.
const PLAYER_LOOKS = [
  { skin: 0, hair: 0, shirt: 0, style: 'short' }, { skin: 2, hair: 1, shirt: 1, style: 'long' },
  { skin: 1, hair: 3, shirt: 2, style: 'bun' }, { skin: 3, hair: 1, shirt: 4, style: 'curly' },
  { skin: 0, hair: 2, shirt: 3, style: 'long' }, { skin: 2, hair: 1, shirt: 7, style: 'short' },
  { skin: 3, hair: 1, shirt: 5, style: 'bun' }, { skin: 1, hair: 4, shirt: 6, style: 'short' },
];

const RESIDENTS = [
  { id: 'asha', name: 'Asha', look: { skin: 2, hair: 1, shirt: 0, style: 'long' }, lines: ['Morning. I keep meaning to learn everyone\'s name.', 'I said I was fine three times before lunch.'] },
  { id: 'tom', name: 'Tom', look: { skin: 0, hair: 0, shirt: 1, style: 'short' }, owl: true, lines: ['Nice evening for a walk, or any evening really.', 'I come out here when the house gets too quiet.'] },
  { id: 'mei', name: 'Mei', look: { skin: 1, hair: 1, shirt: 3, style: 'bun' }, lines: ['Have you had a proper look around yet? Go on, it\'s good for you.', 'Someone told me there\'s a green book going around. I haven\'t found it yet.'] },
  { id: 'leo', name: 'Leo', look: { skin: 3, hair: 1, shirt: 2, style: 'curly' }, lines: ['I moved here last spring. Still working out where I fit.', 'The fountain sounds nicer when nobody\'s around.'] },
  { id: 'nora', name: 'Nora', look: { skin: 0, hair: 4, shirt: 4, style: 'bun' }, owl: true, lines: ['I sit by the pond most days. Nobody ever asks why.', 'You look new. It gets easier.'] },
  { id: 'sam', name: 'Sam', look: { skin: 1, hair: 3, shirt: 7, style: 'short' }, lines: ['The market\'s best early on.', 'I\'m better at listening than talking. Working on it.'] },
  { id: 'ines', name: 'Ines', look: { skin: 2, hair: 2, shirt: 5, style: 'long' }, lines: ['Lovely day. Well, it\'s a day.', 'I found a note in a second-hand book once. I still think about it.'] },
  { id: 'kofi', name: 'Kofi', look: { skin: 3, hair: 1, shirt: 6, style: 'short' }, lines: ['Hello, neighbour. That\'s you now, you know.', 'If you ever want company on a bench, I\'m usually on one.'] },
  { id: 'ruth', name: 'Ruth', owl: true, look: { skin: 1, hair: 4, shirt: 3, style: 'curly' }, lines: ['The ducks in the park have names. I gave them names, anyway.', 'I used to rush everywhere. Now I take the long way round the park.'] },
  { id: 'jun', name: 'Jun', owl: true, look: { skin: 0, hair: 1, shirt: 5, style: 'short' }, lines: ['Have you tried the juice bar? Dev makes it up as he goes.', 'I paint on Thursdays. Badly. That\'s not the point, apparently.'] },
];
// The people who run the new places. Stallholders stand behind their stalls on Market Street.
const STALLHOLDERS = [
  { id: 'priya', name: 'Priya', staff: true, shop: 'fruit', scene: 'town', x: 763, y: 274, look: { skin: 2, hair: 1, shirt: 2, style: 'long' }, lines: [] },
  { id: 'dev', name: 'Dev', staff: true, shop: 'juice', scene: 'town', x: 827, y: 274, look: { skin: 3, hair: 1, shirt: 4, style: 'short' }, lines: [] },
  { id: 'rosa', name: 'Rosa', staff: true, shop: 'snacks', scene: 'town', x: 891, y: 274, look: { skin: 1, hair: 3, shirt: 0, style: 'bun' }, lines: [] },
  { id: 'olu', name: 'Olu', staff: true, shop: 'bakery', scene: 'town', x: 955, y: 274, look: { skin: 3, hair: 1, shirt: 7, style: 'curly' }, lines: [] },
];
const LIBRARIAN = { id: 'agnes', name: 'Agnes', staff: true, scene: 'library', x: 190, y: 54, look: { skin: 0, hair: 4, shirt: 3, style: 'bun' },
  lines: ['Borrow anything you like. Bring it back when you\'ve finished with it, or when it\'s finished with you.', 'People come in for a book and stay for the quiet. Both are free.', 'Shh. Not for you. For the radiator.'] };
const ICE_KEEPER = { id: 'bruno', name: 'Bruno', staff: true, shop: 'icecream', scene: 'icecream', x: 56, y: 52, look: { skin: 0, hair: 1, shirt: 5, style: 'curly' }, lines: [] };
const CINEMA_KEEPER = { id: 'lou', name: 'Lou', staff: true, shop: 'cinema', scene: 'cinema', x: 24, y: 108, look: { skin: 2, hair: 2, shirt: 3, style: 'short' }, lines: [] };
const PUB_HOST = { id: 'gwen', name: 'Gwen', staff: true, shop: 'pub', scene: 'pub', x: 62, y: 52, look: { skin: 0, hair: 3, shirt: 1, style: 'long' }, lines: [] };
const TEACHER = { id: 'felix', name: 'Felix', staff: true, scene: 'studio', x: 104, y: 60, look: { skin: 1, hair: 4, shirt: 6, style: 'curly' },
  lines: ['Don\'t worry about making it good. Make it honest, and the rest follows.', 'Everyone says they can\'t draw. Then they draw something true and forget they said it.', 'Grab an easel. The paint\'s free and nobody\'s marking anything.'] };
const BARISTA = { id: 'bea', name: 'Bea', staff: true, scene: 'cafe', x: 72, y: 56, look: { skin: 1, hair: 3, shirt: 4, style: 'bun' }, lines: ['What can I get you?'] };
// Hazel stands just below the fountain in the middle of town and welcomes newcomers. She never says where the book is.
const HAZEL = { id: 'hazel', name: 'Hazel', guide: true, scene: 'town', x: 394, y: 270, look: {}, lines: [] };
const BOOKSELLER = { id: 'ravi', name: 'Ravi', staff: true, scene: 'bookshop', x: 168, y: 54, look: { skin: 2, hair: 4, shirt: 6, style: 'short' }, lines: ['Take your time. The books aren\'t going anywhere.', 'I only sell the ones I\'d want to talk about afterwards.'] };

const SHELF_LINES = [
  'A second-hand novel with someone\'s notes in the margins. They disagree with the ending.',
  'A poetry collection, one corner folded down. You wonder which day that was.',
  'A book on how to start over. It looks well used.',
];

class Person {
  constructor(data, world, rng) {
    Object.assign(this, data);
    this.world = world;
    this.rng = rng;
    this.dir = 'down';
    this.path = null;
    this.goal = null;
    this.wait = rng ? rng() * 3 : 0;
    this.walkTime = 0;
    this.walking = false;
    this.home = world.town.doors.find((d) => d.owner === this.id) || null;
    if (!this.scene) {
      const h = world.town.hangouts[Math.floor(rng() * world.town.hangouts.length)];
      this.scene = 'town'; this.x = h.x; this.y = h.y;
    }
  }

  update(dt, hour) {
    this.walking = false;
    if (this.staff || this.guide) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    const late = (hour >= 21 || hour < 6.5) && !this.owl && !!this.home;
    if (this.atHome) {
      if (late) { this.wait = 5; return; }
      this.atHome = false;
      this.scene = 'town'; this.x = this.home.cx; this.y = this.home.spawnY;
    }
    if (!this.goal) this.chooseGoal(late);
    if (!this.path) this.planLeg();
    if (this.path) this.follow(dt);
  }

  chooseGoal(late) {
    if (late) { this.goal = { scene: 'town', x: this.home.cx, y: this.home.spawnY, wait: 0, home: true }; return; }
    const pool = this.owl && (this.rng() < 0.7) ? this.world.town.hangouts
      : Object.values(this.world).flatMap((s) => s.hangouts);
    this.goal = pool[Math.floor(this.rng() * pool.length)];
  }

  // Town and rooms connect only through doors, so a long trip takes two legs.
  planLeg() {
    const scene = this.world[this.scene];
    let target = this.goal;
    if (this.goal.scene !== this.scene) {
      if (this.scene !== 'town') target = { x: scene.exit.x + 12, y: scene.exit.y + 2 };
      else {
        const d = scene.doors.find((door) => door.to === this.goal.scene);
        target = { x: d.cx, y: d.spawnY };
      }
    }
    this.path = scene.findPath(this.x, this.y, target.x, target.y) || [];
    if (!this.path.length) this.arrive();
  }

  follow(dt) {
    const speed = 24, next = this.path[0];
    if (!next) { this.arrive(); return; }
    const dx = next.x - this.x, dy = next.y - this.y, dist = Math.hypot(dx, dy);
    const step = speed * dt;
    this.walking = true;
    this.walkTime += dt;
    if (Math.abs(dx) > Math.abs(dy)) this.dir = dx > 0 ? 'right' : 'left';
    else if (dist > 0.01) this.dir = dy > 0 ? 'down' : 'up';
    if (dist <= step) {
      this.x = next.x; this.y = next.y;
      this.path.shift();
      if (!this.path.length) this.arrive();
    } else {
      this.x += dx / dist * step; this.y += dy / dist * step;
    }
  }

  arrive() {
    this.path = null;
    const { goal } = this;
    if (!goal) return;
    if (goal.scene !== this.scene) {
      if (this.scene === 'town') {
        const inside = this.world[goal.scene];
        this.scene = goal.scene; this.x = inside.start.x; this.y = inside.start.y;
      } else {
        const d = this.world.town.doors.find((door) => door.to === this.scene);
        this.scene = 'town'; this.x = d.cx; this.y = d.spawnY;
      }
      return;
    }
    if (goal.home) { this.atHome = true; this.scene = null; }
    this.wait = (goal.wait || 3) * (0.6 + this.rng() * 0.9);
    this.goal = null;
    this.dir = ['down', 'left', 'right', 'down'][Math.floor(this.rng() * 4)];
  }

  stopToTalk(facing) {
    this.wait = Math.max(this.wait, 5);
    this.path = null;
    this.dir = facing;
  }
}
