// Talks to the shared town in Supabase: coming in as a guest, signing in with a link sent by email, your character,
// and the one green book everyone shares. Nothing here touches the screen.
const Server = (() => {
  const ready = !!(SUPABASE_URL && SUPABASE_KEY && window.supabase);
  // detectSessionInUrl signs the player in when they arrive from the link in their email.
  // realtime.worker keeps the live town's "still here" signal going from a background thread, because
  // browsers slow down ordinary timers in background tabs; without it, a player whose tab is in the
  // background gets dropped from everyone else's town.
  // A guest's visit lasts only as long as their tab: their sign-in is kept in this tab's own storage,
  // which the browser clears when the tab closes. Someone signed in with their email is remembered on
  // the device as usual.
  const tabOrDevice = {
    getItem(k) {
      try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; }
    },
    setItem(k, v) {
      let guest = false;
      try { guest = !!JSON.parse(v)?.user?.is_anonymous; } catch { /* Not a sign-in record. */ }
      try {
        if (guest) { sessionStorage.setItem(k, v); localStorage.removeItem(k); }
        else { localStorage.setItem(k, v); sessionStorage.removeItem(k); }
      } catch { /* Not remembered. */ }
    },
    removeItem(k) {
      try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch { /* Nothing to forget. */ }
    },
  };
  const db = ready ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: tabOrDevice },
    realtime: { worker: true },
  }) : null;

  // Errors from the database arrive as words; these turn the common ones into what the player should hear.
  function plain(error) {
    const m = (error && error.message) || '';
    if (/players_name_unique|duplicate key/.test(m)) return 'Someone in town already has that name. Try another one.';
    if (/someone else has the book/.test(m)) return 'Someone else has just picked up the book.';
    if (/not holding the book|need to be holding/.test(m)) return 'Your hour with the book has run out.';
    if (/anonymous sign-ins are disabled/i.test(m)) return 'Guests can\'t come in just yet. Please try again later.';
    if (/guests need to sign in/.test(m)) return 'Sign in with your email to do that.';
    if (/expired|invalid/i.test(m)) return 'That link has expired or was already used. Ask for a new one.';
    if (/email rate limit|over_email_send_rate_limit/i.test(m)) return 'The town has sent all the sign-in emails it can for now. Please try again in an hour.';
    if (/security purposes/i.test(m)) return 'Please wait a minute before asking for another link.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries just now. Please try again in a little while.';
    if (/fetch|network/i.test(m)) return 'The town can\'t be reached right now. Check your connection.';
    return m || 'Something went wrong. Please try again.';
  }
  async function call(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(plain(error));
    return data;
  }

  const toBook = (row, entries) => ({
    scene: row.scene, x: row.x, y: row.y, base: row.base,
    holderId: row.holder_id,
    heldUntil: row.held_until ? Date.parse(row.held_until) : 0,
    lastHolderId: row.last_holder_id,
    entries: entries.map((e) => ({
      id: e.id, authorId: e.author_id, author: e.author_name, text: e.body, at: Date.parse(e.updated_at),
    })),
  });

  return {
    ready,

    // Who is signed in on this device, and whether they're still a guest (no email yet).
    async account() {
      if (!db) return null;
      const { data } = await db.auth.getSession();
      const u = data.session && data.session.user;
      return u ? { id: u.id, guest: !!u.is_anonymous } : null;
    },
    // Walks in as a guest: an account with no email that lasts only while this tab is open.
    async enterAsGuest() {
      const data = await call(db.auth.signInAnonymously());
      return data.user.id;
    },
    // Signing in from inside town only asks for an email. A guest's account is given that email,
    // so their character comes with them once they open the link. If the email already belongs
    // to someone, a link to that account is sent instead. Someone with no account yet just gets a
    // sign-in link. Says which one happened: 'linked', 'existing' or 'fresh'.
    async signInWithEmail(email) {
      const back = location.origin + location.pathname;
      const { data } = await db.auth.getSession();
      const u = data.session && data.session.user;
      if (u && u.is_anonymous) {
        const { error } = await db.auth.updateUser({ email }, { emailRedirectTo: back });
        if (!error) return 'linked';
        if (!/already.*(registered|exists)|email_exists/i.test(error.message || error.code || '')) throw new Error(plain(error));
      }
      await call(db.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: back } }));
      return u ? 'existing' : 'fresh';
    },
    // Calls back with the account when someone signs in or a guest's email is confirmed,
    // including from the link opened in another tab.
    onSignedIn(fn) {
      if (!db) return;
      db.auth.onAuthStateChange((event, session) => {
        if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')) {
          fn({ id: session.user.id, guest: !!session.user.is_anonymous });
        }
      });
    },
    signOut() { return db.auth.signOut(); },

    async loadPlayer(id) {
      const rows = await call(db.from('players').select('id, name, look').eq('id', id).limit(1));
      return rows[0] || null;
    },
    // A guest's random name, unique in town (see supabase/guest-names.sql), and the check-in that keeps it theirs.
    claimGuestName() { return call(db.rpc('claim_guest_name')); },
    touchGuestName() { return call(db.rpc('touch_guest_name')); },
    savePlayer(id, name, look) {
      return call(db.from('players').upsert({ id, name, look }));
    },

    async loadBook() {
      const [rows, entries] = await Promise.all([
        call(db.from('book').select('*').eq('id', 1).limit(1)),
        call(db.from('entries').select('*').order('created_at')),
      ]);
      if (!rows[0]) throw new Error('The green book is missing from the town.');
      return toBook(rows[0], entries);
    },
    takeBook() { return call(db.rpc('take_book')); },
    leaveBook(spot) {
      return call(db.rpc('leave_book', { p_scene: spot.scene, p_x: spot.x, p_y: spot.y, p_base: spot.base }));
    },
    saveEntry(text) { return call(db.rpc('save_entry', { p_body: text })); },

    // Joins the live town: who's here right now (presence) and where they're walking (broadcast).
    // Nothing here is stored; it only reaches people who have the game open.
    // Guests only watch: they see everyone, but never say they're here or where they walk, so nobody sees them.
    // The channel is private, and the database refuses anything a guest tries to send on it (see supabase/live-town.sql).
    joinTown(me, on) {
      if (!db) return null;
      const seen = () => !me.guest;
      let room = null, joined = false, retry = 0, waiting = false, connecting = false;
      // Who I am and where I'm standing. Sharing the spot along with the name means anyone who
      // opens the game sees me in the right place straight away, without waiting for me to move.
      const meta = () => ({ name: me.name, look: me.look, guest: !!me.guest, scene: me.scene, x: Math.round(me.x), y: Math.round(me.y), dir: me.dir });
      const connect = async () => {
        connecting = true;
        // The live channel must know who's signed in, or it turns the connection away.
        const { data } = await db.auth.getSession();
        if (data.session) db.realtime.setAuth(data.session.access_token);
        const ch = db.channel('players', { config: { private: true, presence: { key: me.id }, broadcast: { self: false } } });
        room = ch;
        // Anything from a connection that has since been replaced is ignored.
        const current = (fn) => (...args) => { if (room === ch) fn(...args); };
        ch
          .on('presence', { event: 'sync' }, current(() => {
            const people = [];
            for (const [id, metas] of Object.entries(ch.presenceState())) if (metas[0]) people.push({ ...metas[0], id });
            on.people(people);
          }))
          .on('presence', { event: 'join' }, current(({ key }) => on.arrived(key)))
          .on('broadcast', { event: 'move' }, current(({ payload }) => on.moved(payload)))
          // Someone has come back to their tab and is asking where everyone is.
          .on('broadcast', { event: 'hello' }, current(() => on.arrived('someone')))
          .subscribe(current((status, err) => {
            console.info('[town] live channel:', status, err ? err.message || err : '');
            connecting = false;
            if (status === 'SUBSCRIBED') {
              joined = true;
              retry = 0;
              if (seen()) room.track(meta());
              on.arrived('');
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              joined = false;
              // Try again after a short wait, a little longer each time. Only one attempt at a time.
              if (!waiting) {
                waiting = true;
                room = null;
                db.removeChannel(ch);
                setTimeout(() => { waiting = false; connect(); }, Math.min(30000, 1000 * 2 ** retry++));
              }
            }
          }));
      };
      connect();
      // Only send once joined; otherwise the library falls back to a slower route that skips the live channel.
      const send = (event, payload) => { if (joined && seen()) room.send({ type: 'broadcast', event, payload }); };
      return {
        move(position) { send('move', position); },
        // Tells everyone again who this is and where they are, for example once a guest has signed in
        // or after walking into a building.
        retrack() { if (joined && seen()) room.track(meta()); },
        // Back in this tab after a while: reconnect if the connection dropped; otherwise say who and
        // where I am again, ask everyone else to say where they are, and redo the list of who's here.
        wake() {
          if (!joined) {
            if (!waiting && !connecting) { const old = room; room = null; retry = 0; if (old) db.removeChannel(old); connect(); }
            return;
          }
          if (seen()) room.track(meta());
          send('hello', {});
          const people = [];
          for (const [id, metas] of Object.entries(room.presenceState())) if (metas[0]) people.push({ ...metas[0], id });
          on.people(people);
        },
      };
    },

    // A private live channel between two players that only those two may join (the database checks
    // this; see supabase/private-chat.sql). It carries "… is typing", which is never stored; the
    // messages themselves are saved (see the saved chats below).
    privateChat(topic, on) {
      if (!db) return null;
      let joined = false, closed = false;
      const queue = [];
      const ch = db.channel(topic, { config: { private: true, broadcast: { self: false } } });
      for (const event of ['msg', 'ack', 'seen', 'typing']) ch.on('broadcast', { event }, ({ payload }) => on.event(event, payload || {}));
      ch.on('broadcast', { event: 'leave' }, () => on.left())
        .subscribe((status) => {
          if (closed) return;
          if (status === 'SUBSCRIBED') {
            joined = true;
            while (queue.length) ch.send(queue.shift());
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            on.failed();
          }
        });
      const send = (event, payload) => {
        if (closed) return;
        const m = { type: 'broadcast', event, payload };
        if (joined) ch.send(m); else queue.push(m);
      };
      return {
        send,
        // Says goodbye to the other person, then closes the channel.
        leave() {
          if (closed) return;
          if (joined) ch.send({ type: 'broadcast', event: 'leave', payload: {} });
          closed = true;
          setTimeout(() => db.removeChannel(ch), 300);
        },
      };
    },
    /* ---------- Saved chats (see supabase/saved-chats.sql) ----------
       Messages are stored, and only the two people in a chat can read them. */
    // Every message I've sent or received, oldest first, with the names of everyone I've chatted with.
    async loadChats() {
      const { data } = await db.auth.getSession();
      if (!data.session) return { messages: [], names: {} };
      const me = data.session.user.id;
      const messages = await call(db.from('messages').select('*').or(`from_id.eq.${me},to_id.eq.${me}`).order('created_at').limit(1000));
      const ids = [...new Set(messages.map((m) => (m.from_id === me ? m.to_id : m.from_id)))];
      const names = {};
      if (ids.length) for (const p of await call(db.from('players').select('id, name').in('id', ids))) names[p.id] = p.name;
      return { messages, names };
    },
    async sendMessage(to, body) {
      const { data } = await db.auth.getSession();
      const rows = await call(db.from('messages').insert({ from_id: data.session.user.id, to_id: to, body }).select());
      return rows[0];
    },
    // Marks someone's messages to me as delivered, and as seen when I've actually read them.
    markMessages(from, seen) { return call(db.rpc('mark_messages', { p_from: from, p_seen: !!seen })); },
    // Calls back with each message sent to or by me, and each time one is delivered or seen.
    watchMessages(onChange) {
      if (!db) return;
      db.channel('my-messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => onChange(m))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, ({ new: m }) => onChange(m))
        .subscribe();
    },

    // Blocking: the people I've blocked, and blocking someone.
    async myBlocks() {
      const { data } = await db.auth.getSession();
      if (!data.session) return [];
      const rows = await call(db.from('blocks').select('blocked_id').eq('blocker_id', data.session.user.id));
      return rows.map((r) => r.blocked_id);
    },
    async block(playerId) {
      const { data } = await db.auth.getSession();
      return call(db.from('blocks').insert({ blocker_id: data.session.user.id, blocked_id: playerId }));
    },
    // Sends a conversation to the town's keeper to review. Only they can read reports.
    async report(playerId, playerName, messages) {
      const { data } = await db.auth.getSession();
      return call(db.from('reports').insert({ reporter_id: data.session.user.id, reported_id: playerId, reported_name: playerName, messages }));
    },

    // Calls back whenever anyone moves the book or writes in it.
    watch(onChange) {
      if (!db) return;
      let timer = 0;
      const later = () => { clearTimeout(timer); timer = setTimeout(onChange, 150); };
      db.channel('town')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'book' }, later)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, later)
        .subscribe();
    },
  };
})();
