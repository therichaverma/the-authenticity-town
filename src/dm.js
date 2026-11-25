/* ---------- Chatting with other players ----------
   Walk up to another signed-in player and choose "Talk to …": a chat opens and you can write straight
   away. Chats are saved (see supabase/saved-chats.sql), so if someone is away, they read your message
   when they come back, and you can both scroll back through it after signing out and in again.
   Only the two people in a chat can read it.

   - The Chats button in the top bar lists everyone you've chatted with, with a count of unread messages.
   - When a message arrives and that chat isn't open, a small card shows who it's from, with Open.
   - Under your latest message: Sent, Delivered (it reached their game) or Seen (they've read it).
   - Under the name: "In town" or "Not in town", or "… is typing…" while they type.
   - The × closes the chat window; the chat itself is kept. Beside it, the block icon offers Block,
     or Block and report. */
const Chat = (() => {
  const threads = new Map();  // other player's id → { id, name, messages: [rows from the messages table] }
  let openId = null, typingLine = null, typingUntil = 0, typingTimer = 0, lastTyping = 0, lastSent = 0;
  let blocked = new Set(), ready = false, cardFrom = null;

  const me = () => state.me;
  const topicWith = (id) => `dm:${[me().id, id].sort().join(':')}`;
  const nameOf = (id) => (threads.get(id) && threads.get(id).name) || (others.get(id) && others.get(id).name) || 'Someone';
  const thread = (id, name) => {
    if (!threads.has(id)) threads.set(id, { id, name: name || nameOf(id), messages: [] });
    const t = threads.get(id);
    if (name) t.name = name;
    return t;
  };
  const otherOf = (m) => (m.from_id === me().id ? m.to_id : m.from_id);
  const unread = (t) => t.messages.filter((m) => m.to_id === me().id && !m.seen_at).length;

  /* ---------- Loading and keeping up ---------- */
  async function init() {
    if (ready || !state.me || state.me.guest || !Server.ready) return;
    ready = true;
    try { blocked = new Set(await Server.myBlocks()); } catch { /* Keep what we have. */ }
    try {
      const { messages, names } = await Server.loadChats();
      for (const m of messages) thread(otherOf(m), names[otherOf(m)]).messages.push(m);
    } catch { /* Chats will fill in as messages arrive. */ }
    // Everything waiting for me has now reached my game.
    for (const t of threads.values()) if (t.messages.some((m) => m.to_id === me().id && !m.delivered_at)) Server.markMessages(t.id, false).catch(() => {});
    Server.watchMessages(arrived);
    // A chat may have been opened while these were still loading.
    if (openId) { render(); if (unread(thread(openId))) Server.markMessages(openId, true).catch(() => {}); }
    syncChrome();
  }
  // A message was sent, or one was delivered or seen. Only my own chats ever arrive here.
  function arrived(m) {
    if (!state.me || (m.from_id !== me().id && m.to_id !== me().id)) return;
    const t = thread(otherOf(m));
    const i = t.messages.findIndex((x) => x.id === m.id);
    const isNew = i < 0;
    if (isNew) t.messages.push(m); else t.messages[i] = m;
    if (isNew && m.to_id === me().id) {
      typingUntil = 0;
      Sound.pop();
      if (openId === t.id && canSee()) Server.markMessages(t.id, true).catch(() => {});
      else {
        Server.markMessages(t.id, false).catch(() => {});
        if (openId !== t.id) showCard(t, m);
      }
    }
    if (openId === t.id) render();
    syncChrome();
  }
  const canSee = () => !!openId && !$('dm').hidden && document.visibilityState === 'visible';

  /* ---------- The chat window ---------- */
  function render() {
    const box = $('dm');
    box.hidden = !openId;
    if (!openId) return;
    const t = thread(openId);
    $('dm-name').textContent = t.name;
    const typing = typingUntil > Date.now();
    const here = others.has(t.id);
    $('dm-status').textContent = typing ? `${t.name} is typing…` : here ? 'In town' : 'Not in town';
    $('dm-status').className = `dm-status${typing ? ' typing' : here ? ' here' : ''}`;
    const log = $('dm-log');
    log.textContent = '';
    if (!t.messages.length) {
      const p = document.createElement('p'); p.className = 'dm-note';
      p.textContent = `Say hello to ${t.name}.`;
      log.append(p);
    }
    const mine = t.messages.filter((m) => m.from_id === me().id), lastMine = mine[mine.length - 1];
    for (const m of t.messages) {
      const p = document.createElement('p');
      p.className = m.from_id === me().id ? 'dm-msg mine' : 'dm-msg theirs';
      p.textContent = m.body;
      log.append(p);
      if (m === lastMine) {
        const r = document.createElement('p');
        r.className = 'dm-receipt';
        r.textContent = m.pending ? 'Sending…' : m.seen_at ? 'Seen' : m.delivered_at ? 'Delivered' : 'Sent';
        log.append(r);
      }
    }
    if (blocked.has(t.id)) {
      const p = document.createElement('p'); p.className = 'dm-note';
      p.textContent = `You blocked ${t.name}.`;
      log.append(p);
    }
    log.scrollTop = log.scrollHeight;
    const can = !blocked.has(t.id);
    $('dm-input').disabled = !can;
    $('dm-send').disabled = !can;
  }

  // Opens the chat with this player (from "Talk to …", the Chats list, or a new-message card).
  function open(id, name) {
    if (!state.me || state.me.guest) return;
    init();
    closeList();
    hideCard();
    if (openId && openId !== id) leaveTyping();
    thread(id, name);
    openId = id;
    joinTyping(id);
    render();
    if (unread(thread(id))) Server.markMessages(id, true).catch(() => {});
    $('dm-input').focus();
  }
  function close() {
    if (!openId) return;
    const name = thread(openId).name;
    leaveTyping();
    openId = null;
    hideConfirm();
    render();
    releaseFocus();
    // Only the first chat you ever close says it's saved; after that, this device remembers you've seen it.
    let told = false;
    try { told = localStorage.getItem(SAVED_NOTE_KEY) === 'seen'; } catch { /* Shown again next time. */ }
    if (told) return;
    toast(`Your chat with ${name} is saved. Find it again under Chats.`, 4000);
    try { localStorage.setItem(SAVED_NOTE_KEY, 'seen'); } catch { /* Not remembered. */ }
  }
  const SAVED_NOTE_KEY = 'authenticity-town:chat-saved-note';

  // "… is typing" travels live over the pair's private channel, and is never stored.
  function joinTyping(id) {
    leaveTyping();
    typingLine = Server.privateChat(topicWith(id), {
      event(kind) {
        if (kind !== 'typing' || openId !== id) return;
        typingUntil = Date.now() + 3000;
        render();
        clearTimeout(typingTimer);
        typingTimer = setTimeout(render, 3100);
      },
      left() {},
      failed() {},
    });
  }
  function leaveTyping() { if (typingLine) typingLine.leave(); typingLine = null; typingUntil = 0; }
  function typed() {
    if (!typingLine || !$('dm-input').value.trim()) return;
    const now = performance.now();
    if (now - lastTyping > 1500) { lastTyping = now; typingLine.send('typing', {}); }
  }

  async function send(ev) {
    ev.preventDefault();
    const input = $('dm-input'), body = input.value.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!openId || !body || blocked.has(openId)) return;
    if (performance.now() - lastSent < 400) return;
    lastSent = performance.now();
    const t = thread(openId);
    const draft = { id: `draft-${Date.now()}`, from_id: me().id, to_id: t.id, body, created_at: new Date().toISOString(), pending: true };
    t.messages.push(draft);
    input.value = '';
    render();
    try {
      const row = await Server.sendMessage(t.id, body);
      const i = t.messages.indexOf(draft);
      // The saved message may already have arrived through the live updates.
      if (t.messages.some((m) => m.id === row.id)) t.messages.splice(i, 1); else t.messages[i] = row;
    } catch (err) {
      t.messages.splice(t.messages.indexOf(draft), 1);
      toast(err.message);
    }
    if (openId === t.id) render();
    syncChrome();
  }

  /* ---------- Blocking (and reporting) ----------
     The block icon next to the × asks: Block, Block and report, or Cancel. A report sends the chat to
     the town's keeper to review; the other person isn't told. */
  function confirm(text, yesLabel, run, alsoLabel, alsoRun) {
    $('dm-confirm-text').textContent = text;
    $('dm-confirm-yes').textContent = yesLabel;
    $('dm-confirm-yes').onclick = () => { hideConfirm(); run(); };
    $('dm-confirm-also').hidden = !alsoLabel;
    $('dm-confirm-also').textContent = alsoLabel || '';
    $('dm-confirm-also').onclick = alsoRun ? () => { hideConfirm(); alsoRun(); } : null;
    $('dm-confirm').hidden = false;
  }
  function hideConfirm() { $('dm-confirm').hidden = true; }
  async function blockNow(t) {
    try { await Server.block(t.id); } catch (err) { toast(err.message); return false; }
    blocked.add(t.id);
    render();
    return true;
  }
  async function reportNow(t) {
    const messages = t.messages.filter((m) => !m.pending).map((m) => ({ from: m.from_id === me().id ? me().name : t.name, text: m.body, at: m.created_at }));
    try { await Server.report(t.id, t.name, messages); } catch (err) { toast(err.message); return false; }
    return true;
  }
  function block() {
    if (!openId) return;
    const t = thread(openId);
    if (blocked.has(t.id)) { toast(`You've already blocked ${t.name}.`); return; }
    confirm(`Block ${t.name}? You won't be able to message each other any more.`, 'Block', () => blockNow(t),
      'Block and report', async () => {
        if (!(await reportNow(t))) return;
        if (await blockNow(t)) toast(`You blocked ${t.name} and reported the chat. Thank you.`, 5000);
      });
  }

  /* ---------- The Chats list, the unread count, and the new-message card ---------- */
  function syncChrome() {
    const total = [...threads.values()].reduce((n, t) => n + unread(t), 0);
    $('chats-btn').hidden = !state.me || state.me.guest;
    $('chats-count').hidden = !total;
    $('chats-count').textContent = String(total);
    if (!$('dm-list').hidden) renderList();
  }
  function renderList() {
    const box = $('dm-list-items');
    box.textContent = '';
    const list = [...threads.values()].filter((t) => t.messages.length)
      .sort((a, b) => Date.parse(b.messages[b.messages.length - 1].created_at) - Date.parse(a.messages[a.messages.length - 1].created_at));
    if (!list.length) {
      const p = document.createElement('p'); p.className = 'note';
      p.textContent = 'No chats yet. Walk up to someone in town and choose "Talk to …".';
      box.append(p);
      return;
    }
    for (const t of list) {
      const last = t.messages[t.messages.length - 1], n = unread(t);
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'dm-item';
      const top = document.createElement('span'); top.className = 'dm-item-name';
      top.textContent = t.name;
      if (n) { const c = document.createElement('span'); c.className = 'count'; c.textContent = String(n); top.append(c); }
      const where = document.createElement('span'); where.className = 'dm-item-where';
      where.textContent = others.has(t.id) ? 'In town' : 'Not in town';
      const text = document.createElement('span'); text.className = 'dm-item-text';
      text.textContent = `${last.from_id === me().id ? 'You: ' : ''}${last.body}`;
      b.append(top, where, text);
      b.addEventListener('click', () => open(t.id));
      box.append(b);
    }
  }
  function openList() {
    if (!state.me || state.me.guest) return;
    init();
    renderList();
    $('dm-list').hidden = false;
  }
  function closeList() { $('dm-list').hidden = true; }
  // A pop-up at the top of the screen: who it's from (with their character, if they're in town),
  // and the message. It stays until you reply or choose Later.
  function showCard(t, m) {
    cardFrom = t.id;
    $('dm-card-name').textContent = t.name;
    $('dm-card-text').textContent = m.body.length > 140 ? `${m.body.slice(0, 140)}…` : m.body;
    const face = $('dm-card-face'), person = others.get(t.id);
    face.hidden = !(person && person.look);
    if (!face.hidden) {
      const g = face.getContext('2d');
      g.clearRect(0, 0, face.width, face.height);
      g.drawImage(personSheet(person.look), 0, 0, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
    }
    const card = $('dm-card');
    card.hidden = false;
    card.classList.remove('pop-in'); void card.offsetWidth; card.classList.add('pop-in');
  }
  function hideCard() { cardFrom = null; $('dm-card').hidden = true; }

  // Whenever who's in town changes: keep "In town" / "Not in town" up to date.
  function people() {
    if (openId) render();
    if (!$('dm-list').hidden) renderList();
  }

  $('dm-form').addEventListener('submit', send);
  $('dm-input').addEventListener('input', typed);
  $('dm-input').addEventListener('focus', () => { if (openId && unread(thread(openId))) Server.markMessages(openId, true).catch(() => {}); });
  $('dm-input').addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); $('dm-input').blur(); } });
  $('dm-close').addEventListener('click', close);
  $('dm-block').addEventListener('click', block);
  $('dm-confirm-no').addEventListener('click', hideConfirm);
  $('chats-btn').addEventListener('click', () => { $('chats-btn').blur(); openList(); });
  $('dm-list-close').addEventListener('click', closeList);
  $('dm-card-open').addEventListener('click', () => { if (cardFrom) open(cardFrom); });
  $('dm-card-close').addEventListener('click', hideCard);
  document.addEventListener('visibilitychange', () => { if (canSee() && unread(thread(openId))) Server.markMessages(openId, true).catch(() => {}); });

  return { init, open: (person) => open(person.id, person.name), people, syncChrome };
})();
