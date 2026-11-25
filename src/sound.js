// Every sound in town is made right here in the browser, so there are no audio files to load.
// Browsers stay silent until the player first taps or presses a key, so sound starts then.
const Sound = (() => {
  const PREF_KEY = 'authenticity-town-sound';
  const LOUD = 2.4;
  let on = true;
  try { on = localStorage.getItem(PREF_KEY) !== 'off'; } catch { /* Sound stays on. */ }
  let ac = null, master = null, noiseBuf = null, meter = null, touched = false;
  let birdWait = 2;

  function unlock() {
    touched = true;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch { return; }
      // Everything goes through one volume, then a limiter, so the game is loud enough on laptop
      // speakers without the louder moments crackling.
      master = ac.createGain();
      master.gain.value = on ? LOUD : 0;
      const limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
      master.connect(limiter);
      limiter.connect(ac.destination);
      // A meter on the output, so we can check how loud the game is.
      meter = ac.createAnalyser(); meter.fftSize = 2048;
      master.connect(meter);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    loadPages();
  }
  addEventListener('pointerdown', unlock, true);
  addEventListener('keydown', unlock, true);

  const ready = () => on && ac && ac.state === 'running';

  // A single note that slides from f to f2 and fades out.
  function tone({ type = 'sine', f = 440, f2 = f, t = 0.1, vol = 0.2, delay = 0, attack = 0.004 }) {
    if (!ready()) return;
    const at = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, at + t);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + t);
    o.connect(g); g.connect(master);
    o.start(at); o.stop(at + t + 0.02);
  }
  // A short puff of filtered noise: footsteps, paper, wood.
  function noise({ t = 0.08, vol = 0.2, f = 1000, f2 = f, q = 1, delay = 0 }) {
    if (!ready()) return;
    const at = ac.currentTime + delay;
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuf;
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f, at);
    if (f2 !== f) bp.frequency.exponentialRampToValueAtTime(f2, at + t);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + t);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(at, Math.random() * 0.5); src.stop(at + t + 0.02);
  }
  // A tiny buzz on phones that allow it (Android); iPhones ignore this.
  function buzz(ms) { try { if (on && touched && navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch { /* Not supported. */ } }

  // A hinge creaks because it sticks and slips over and over. This plays that as a quick train of
  // tiny clicks through a ringing filter: the click rate sets how "groany" it sounds, the filter its pitch.
  function creakTrain({ t, f0, f1, rate0, rate1, vol, q = 12, delay = 0 }) {
    for (let at = 0; at < t;) {
      const k = at / t, swell = Math.sin(Math.PI * Math.min(1, k * 1.15));
      noise({ t: 0.014, vol: Math.max(0.002, vol * swell * (0.7 + Math.random() * 0.3)), f: f0 + (f1 - f0) * k, q, delay: delay + at });
      at += 1 / (rate0 + (rate1 - rate0) * k + Math.random() * 8);
    }
  }

  // One bird note: a soft whistle that slides in pitch and flutters quickly (the flutter is what makes it
  // sound like a bird rather than a beep), fading in and out gently.
  function birdNote(at, f0, f1, len, vol, flutter) {
    const o = ac.createOscillator(), lfo = ac.createOscillator(), depth = ac.createGain(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f1, at + len);
    lfo.frequency.value = flutter; depth.gain.value = f0 * 0.08;
    lfo.connect(depth); depth.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + len * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(g); g.connect(master);
    o.start(at); lfo.start(at); o.stop(at + len + 0.02); lfo.stop(at + len + 0.02);
  }
  // A little song, picked at random: a two-note "tee-oo", a quick trill, or a rising warble.
  function birdCall() {
    const t = ac.currentTime + 0.05, base = 2600 + Math.random() * 1200, vol = 0.03 + Math.random() * 0.015;
    const kind = Math.floor(Math.random() * 3);
    if (kind === 0) {
      birdNote(t, base * 1.1, base * 0.95, 0.16, vol, 30);
      birdNote(t + 0.2, base * 0.9, base * 0.7, 0.22, vol * 0.9, 24);
    } else if (kind === 1) {
      const n = 5 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) birdNote(t + i * 0.065, base * 1.15, base * 0.9, 0.055, vol * (1 - i / (n * 1.6)), 40);
    } else {
      birdNote(t, base * 0.8, base * 1.2, 0.3, vol, 18);
      birdNote(t + 0.34, base * 1.15, base * 1.0, 0.12, vol * 0.8, 32);
    }
  }

  /* ---------- Turning the green book's pages, with a real recording ----------
     audio/flipping-through-a-book.mp3 (freesound community, via Pixabay, free to use) is 18 seconds of
     someone turning pages: twelve separate turns with quiet gaps between them. Each page turn in the game
     plays one of those twelve, picked at random (never the same one twice in a row), so it sounds natural. */
  const TURNS = [[0.55, 1.2], [2.1, 2.75], [3.65, 4.3], [5.2, 5.75], [6.65, 7.25], [8.1, 8.65], [9.5, 10.1],
    [10.85, 11.5], [12.2, 12.8], [13.5, 14.2], [14.85, 15.45], [16.15, 16.85]];
  let pagesBuf = null, lastTurn = -1, pickUpBuf = null, dropBuf = null;
  // Loads a recording from the audio folder once, and hands it over when it's ready.
  const loadAudio = (path, done) => fetch(path).then((r) => r.arrayBuffer()).then((b) => ac.decodeAudioData(b)).then(done).catch(() => {});
  function loadPages() {
    if (!ac) return;
    if (!pagesBuf) loadAudio('audio/flipping-through-a-book.mp3', (buf) => { pagesBuf = buf; });
    if (!pickUpBuf) loadAudio('audio/book-pick-up.mp3', (buf) => { pickUpBuf = buf; });
    if (!dropBuf) loadAudio('audio/book-drop.mp3', (buf) => { dropBuf = buf; });
  }
  function playTurn() {
    if (!ready() || !pagesBuf) return;
    let i = Math.floor(Math.random() * TURNS.length);
    if (i === lastTurn) i = (i + 1) % TURNS.length;
    lastTurn = i;
    const [from, to] = TURNS[i], at = ac.currentTime, len = to - from;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = pagesBuf;
    // A quick fade in and out, so the cut edges don't click.
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.5, at + 0.015);
    g.gain.setValueAtTime(0.5, at + len - 0.05);
    g.gain.linearRampToValueAtTime(0, at + len);
    src.connect(g); g.connect(master);
    src.start(at, from, len);
  }

  // Plays the pick-up chime. rate below 1 is lower and slower; warm takes off the bright edge;
  // swell fades it in instead of striking; echo adds a soft, fading repeat, like a quiet room.
  function playChime({ vol = 0.3, rate = 1, warm = 0, swell = 0, echo = 0 } = {}) {
    const at = ac.currentTime, src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = pickUpBuf; src.playbackRate.value = rate;
    g.gain.setValueAtTime(swell ? 0 : vol, at);
    if (swell) g.gain.linearRampToValueAtTime(vol, at + swell);
    let out = src;
    if (warm) { const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = warm; lp.Q.value = 0.4; src.connect(lp); out = lp; }
    out.connect(g); g.connect(master);
    if (echo) {
      const d = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain();
      d.delayTime.value = 0.18; fb.gain.value = 0.35; wet.gain.value = echo;
      g.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
    }
    src.start(at);
  }
  const api = {
    // Turning a page in the green book: one real page turn from the recording.
    pageTurn() { playTurn(); },
    // Putting the green book back down: a notebook landing (audio/book-drop.mp3, freesound community via
    // Pixabay). The recording spends its first 1.3 seconds on a low rumble before the book lands at about
    // 1.34s, so it starts just before the landing, with the rumble filtered out and the volume raised.
    bookDrop() {
      if (!ready() || !dropBuf) return;
      const from = 1.25, at = ac.currentTime;
      const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = dropBuf;
      hp.type = 'highpass'; hp.frequency.value = 90;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1.2, at + 0.02);
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(at, from);
    },
    // Opening the green book: a "you found something" chime (audio/book-pick-up.mp3, freesound community
    // via Pixabay), softened: warmer, quieter, and fading in gently instead of being struck.
    bookOpen() { if (ready() && pickUpBuf) playChime({ vol: 0.18, warm: 3000, swell: 0.18 }); },
    get on() { return on; },
    // For checking: whether the browser's audio has started ('running'), is waiting for a tap, or isn't there.
    get state() { return ac ? ac.state : 'not started'; },
    // The loudest point in the last moment of sound, from 0 (silent) to 1 (as loud as it goes).
    peak() {
      if (!meter) return 0;
      const d = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(d);
      return d.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    },
    toggle() {
      on = !on;
      try { localStorage.setItem(PREF_KEY, on ? 'on' : 'off'); } catch { /* Not remembered. */ }
      unlock();
      if (master) master.gain.setTargetAtTime(on ? LOUD : 0, ac.currentTime, 0.05);
      if (on) api.click();
      return on;
    },
    // Hazel talking: a soft, slightly varied blip per letter.
    blip() { tone({ type: 'triangle', f: 600 + Math.random() * 140, t: 0.045, vol: 0.05 }); },
    click() { tone({ type: 'triangle', f: 1100, f2: 720, t: 0.05, vol: 0.1 }); buzz(8); },
    pop() { tone({ f: 380, f2: 820, t: 0.11, vol: 0.13 }); tone({ f: 980, t: 0.08, vol: 0.04, delay: 0.05 }); },
    // The banner landing: a low wooden knock with a little creak.
    thunk() {
      tone({ f: 150, f2: 55, t: 0.28, vol: 0.4 });
      noise({ t: 0.1, vol: 0.22, f: 500, q: 1.5 });
      tone({ type: 'triangle', f: 320, f2: 260, t: 0.35, vol: 0.025, delay: 0.18 });
      buzz(18);
    },
    rustle() { noise({ t: 0.32, vol: 0.1, f: 2200, f2: 5200, q: 0.6 }); noise({ t: 0.18, vol: 0.06, f: 3800, q: 0.8, delay: 0.12 }); },
    // Knocking on the gate: two hollow knocks on wood.
    knock() {
      unlock();
      for (const at of [0, 0.22]) {
        tone({ f: 210, f2: 140, t: 0.12, vol: 0.26, delay: at });
        noise({ t: 0.04, vol: 0.18, f: 1100, q: 2.5, delay: at });
      }
      buzz(15);
    },
    // The gate opening: a soft old wooden creak, and a light bump as the doors come to rest.
    gate() {
      unlock();
      noise({ t: 0.03, vol: 0.08, f: 1400, q: 4 });
      creakTrain({ t: 1.2, f0: 620, f1: 820, rate0: 30, rate1: 55, vol: 0.09, q: 10, delay: 0.1 });
      tone({ f: 110, f2: 70, t: 0.25, vol: 0.12, delay: 1.35 });
      buzz(12);
    },
    // Two rising notes, for a happy moment like joining the town.
    chime() { tone({ f: 784, t: 0.4, vol: 0.09 }); tone({ f: 1175, t: 0.55, vol: 0.08, delay: 0.12 }); },

    // Birds singing now and then, whatever the time of day. Called each frame.
    ambience(dt, night, outdoors) {
      if (!ready() || !outdoors) return;
      birdWait -= dt;
      if (birdWait > 0) return;
      birdWait = 3 + Math.random() * 6;
      birdCall();
    },
  };
  return api;
})();
