// The one green book and its rules. Nothing here touches the screen.
const HOLD_MS = 60 * 60 * 1000; // One hour with the book, then it moves on.
const ENTRY_LIMIT = 1200;

const BOOK_NAME = 'The Authenticity Book';

const INTRO_LINES = [
  'We all are looking for a deeper connection that feels like home, where we feel free to be ourselves – flawed, broken, crazy, uniquely beautiful, a work in progress.',
  'But how often do we let anyone see that side of us? How about you give it a chance?',
  'Write one honest thing about yourself. It can be anything. Then leave this book for someone else to find.',
  'They may read it and realise they’re not the only one. And neither are you.',
];
const INTRO_SIGNATURE = 'Richa';

const Book = {
  fresh(spot) {
    return { scene: spot.scene, x: spot.x, y: spot.y, base: spot.base, holderId: null, heldUntil: 0, lastHolderId: null, entries: [] };
  },
  // A hold only counts until its hour runs out; after that the book is free for anyone.
  heldBy(book, id) { return !!id && book.holderId === id && book.heldUntil > Date.now(); },
  isFree(book) { return !book.holderId || book.heldUntil <= Date.now(); },
  keep(book, id, now) {
    if (book.holderId) return false;
    // Picking it back up does not restart your own hour.
    const stillYours = book.lastHolderId === id && book.heldUntil > now;
    book.holderId = id;
    book.lastHolderId = id;
    if (!stillYours) book.heldUntil = now + HOLD_MS;
    return true;
  },
  leave(book, spot) {
    Object.assign(book, { scene: spot.scene, x: spot.x, y: spot.y, base: spot.base, holderId: null });
  },
  expired(book, now) { return !!book.holderId && book.heldUntil <= now; },
  remaining(book, now) { return Math.max(0, book.heldUntil - now); },
  entryBy(book, id) { return book.entries.find((e) => e.authorId === id); },
  save(book, me, text, now) {
    const clean = text.trim().slice(0, ENTRY_LIMIT);
    if (!clean || book.holderId !== me.id) return null;
    let entry = Book.entryBy(book, me.id);
    if (entry) { entry.text = clean; entry.at = now; return entry; }
    entry = { id: `e${now}`, authorId: me.id, author: me.name, text: clean, at: now };
    book.entries.push(entry);
    return entry;
  },
};

function formatLeft(ms) {
  const hours = Math.floor(ms / 3600000), mins = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}
