/* ---------- Market Street's stalls and the pub's bar ----------
   Walk up to a stall (or the bar in the Lantern) and you see what's on offer. Nothing costs anything:
   you just ask, the stallholder hands it over, and you eat or drink it there and then. While you do,
   a little of it shows in your hand. Nothing is stored anywhere. */
const Market = (() => {
  // Tiny pixel pictures, eight by eight, one letter per pixel.
  const COLOURS = {
    k: '#322830', r: '#d64a46', R: '#a03834', o: '#f08c4a', O: '#c86a2a', y: '#fad650', Y: '#d8a046',
    g: '#78be52', G: '#2e7c4a', w: '#fafaf0', b: '#c88a4a', B: '#8a5a38', t: '#e2b46c', p: '#e88aa8',
    P: '#b0507a', l: '#d8dce4', c: '#f4ecd8', s: '#6a4428',
  };
  const glass = (fill, dark, top) => [
    '........', '.kkkkkk.', '.kTTTTk.', '.kFFFDk.', '.kFwFDk.', '.kFFFDk.', '..kFDk..', '..kkkk..',
  ].map((row) => row.replace(/F/g, fill).replace(/D/g, dark).replace(/T/g, top));
  const mug = (top) => [
    '..l..l..', '...l....', 'kkkkkk..', 'kTTTTkk.', 'kcccck.k', 'kcccckkk', 'kcccck..', '.kkkk...',
  ].map((row) => row.replace(/T/g, top));
  const cone = (scoop, dark) => [
    '..kkkk..', '.kSSSSk.', 'kSwSSSDk', 'kSSSSDDk', '.kkkkkk.', '.ktbtbk.', '..ktbk..', '...kk...',
  ].map((row) => row.replace(/S/g, scoop).replace(/D/g, dark));
  const PICTURES = {
    vanilla: cone('c', 't'),
    strawberryice: cone('p', 'P'),
    chocolate: cone('s', 'k'),
    mint: cone('g', 'G'),
    sweets: ['........', '.kk..kk.', 'kyyk.krk', 'kyyk.krk', '.kk..kk.', '.kk..kk.', 'kgGk.kpk', '.kk..kk.'],
    apple: ['...G....', '..kGkk..', '.krrrrk.', 'krwrrrrk', 'krrrrrRk', 'krrrrrRk', '.kRrrRk.', '..kkkk..'],
    banana: ['......k.', '.....kyk', '....kyyk', '...kyyYk', '..kyyYk.', 'kkyyYYk.', 'kYYYkk..', '.kkk....'],
    orange: ['...Gk...', '..kkGk..', '.kooook.', 'kowooook', 'koooooOk', 'kooooOOk', '.kOOOOk.', '..kkkk..'],
    strawberry: ['.GgGgG..', 'krrrrrk.', 'krwryrk.', 'krrrrrk.', '.kryrk..', '.krrrk..', '..krk...', '...k....'],
    oj: glass('o', 'O', 'y'),
    green: glass('g', 'G', 'w'),
    berry: glass('p', 'P', 'w'),
    melon: glass('r', 'R', 'g'),
    popcorn: ['.ywywy..', 'ywyyyyw.', 'kkkkkkk.', 'krwrwrk.', 'krwrwrk.', '.krwrk..', '.krwrk..', '.kkkkk..'],
    crisps: ['.kkkkkk.', '.kyyyyk.', '.kyrryk.', '.kryyrk.', '.kyrryk.', '.kyyyyk.', '.kYYYYk.', '.kkkkkk.'],
    cookie: ['..kkkk..', '.kttttk.', 'ktsttstk', 'kttttttk', 'ktttstbk', 'kstttttk', '.kbttbk.', '..kkkk..'],
    samosa: ['...kk...', '..kttk..', '..kttk..', '.kttbtk.', '.ktttbk.', 'kttbtttk', 'kbbbbbbk', 'kkkkkkkk'],
    croissant: ['........', '...kkk..', '..kttbk.', 'kktbttbk', 'ktbttbtk', 'kbttbtbk', '.kbbbbk.', '..kkkk..'],
    muffin: ['..kkkk..', '.kssssk.', 'ksswsssk', 'kssssssk', 'kkkkkkkk', '.kpPpPk.', '.kpPpPk.', '..kkkk..'],
    bun: ['..kkkk..', '.kbttbk.', 'kbtbbtbk', 'ktbtwbtk', 'kbtbbtbk', 'kbbttbbk', '.kbbbbk.', '..kkkk..'],
    roll: ['........', '..kkkk..', '.ktwttk.', 'kttbttbk', 'kbtttbtk', 'kbbbbbbk', '.kkkkkk.', '........'],
    ginger: glass('Y', 'b', 'w'),
    lemonade: glass('y', 'Y', 'l'),
    cocoa: mug('s'),
    tea: mug('B'),
  };

  // What there is, and what it's like. "drink" or "eat" decides the words.
  const ITEMS = {
    apple: { name: 'Apple', how: 'eat', taste: 'Crisp, a little sour, and gone sooner than you meant.' },
    banana: { name: 'Banana', how: 'eat', taste: 'Soft and sweet. Exactly as ripe as you like them.' },
    orange: { name: 'Orange', how: 'eat', taste: 'You peel it in one long spiral. Small wins.' },
    strawberry: { name: 'Strawberries', how: 'eat', taste: 'A handful, still warm from the sun.' },
    oj: { name: 'Orange juice', how: 'drink', taste: 'Freshly squeezed, with bits. Dev insists on the bits.' },
    green: { name: 'Green smoothie', how: 'drink', taste: 'It tastes better than it looks. Mostly.' },
    berry: { name: 'Berry smoothie', how: 'drink', taste: 'Thick, cold and very pink.' },
    melon: { name: 'Watermelon juice', how: 'drink', taste: 'Like summer, in a cup.' },
    popcorn: { name: 'Popcorn', how: 'eat', taste: 'Sweet and salty. You end up sharing it with a pigeon.' },
    crisps: { name: 'Crisps', how: 'eat', taste: 'The crunch is very loud. Nobody minds.' },
    cookie: { name: 'Cookie', how: 'eat', taste: 'Still soft in the middle, with too many chocolate chips. Perfect.' },
    samosa: { name: 'Samosa', how: 'eat', taste: 'Crisp outside, warm and spicy inside.' },
    croissant: { name: 'Croissant', how: 'eat', taste: 'Flaky. Crumbs everywhere. Worth it.' },
    muffin: { name: 'Muffin', how: 'eat', taste: 'Chocolate, and big enough for two. You don\'t share.' },
    bun: { name: 'Cinnamon bun', how: 'eat', taste: 'Sticky fingers for the rest of the afternoon.' },
    roll: { name: 'Bread roll', how: 'eat', taste: 'Simple, warm and just right.' },
    ginger: { name: 'Ginger beer', how: 'drink', taste: 'Fizzy, with a kick at the end. No alcohol in it.' },
    lemonade: { name: 'Lemonade', how: 'drink', taste: 'Cloudy, cold and properly lemony.' },
    cocoa: { name: 'Hot chocolate', how: 'drink', taste: 'Too hot at first, then exactly right.' },
    vanilla: { name: 'Vanilla cone', how: 'eat', taste: 'It drips down your wrist straight away. Worth it.' },
    strawberryice: { name: 'Strawberry cone', how: 'eat', taste: 'Pink, cold and full of little bits of real strawberry.' },
    chocolate: { name: 'Chocolate cone', how: 'eat', taste: 'Rich and dark. You eat it far too fast.' },
    mint: { name: 'Mint choc chip', how: 'eat', taste: 'Cool and green, with chocolate in every bite.' },
    sweets: { name: 'Bag of sweets', called: 'sweets', how: 'eat', taste: 'You save the red ones for last. You always have.' },
    tea: { name: 'Cup of tea', how: 'drink', taste: 'Strong, with a splash of milk. Gwen didn\'t need to ask.' },
  };

  // Who runs each place, what they say, and what they have.
  const SHOPS = {
    fruit: { keeper: 'priya', title: 'Priya\'s fruit stall', hello: 'Fresh in this morning. Take whatever you fancy.', give: 'There you go. Enjoy it.', items: ['apple', 'banana', 'orange', 'strawberry'] },
    juice: { keeper: 'dev', title: 'Dev\'s juice bar', hello: 'I\'ll make you anything on the board. Well, almost anything.', give: 'Made just now. Tell me what you think.', items: ['oj', 'green', 'berry', 'melon'] },
    snacks: { keeper: 'rosa', title: 'Rosa\'s snack hatch', hello: 'Hungry? Of course you are. Have a look.', give: 'Here. Come back whenever you like.', items: ['popcorn', 'crisps', 'cookie', 'samosa'] },
    bakery: { keeper: 'olu', title: 'Olu\'s bakery', hello: 'Still warm, most of it. Point at what you\'d like.', give: 'Careful, that one\'s still warm.', items: ['croissant', 'muffin', 'bun', 'roll'] },
    icecream: { keeper: 'bruno', title: 'Bruno\'s ice-cream parlour', hello: 'One scoop or two? Both are free, so I\'d say two.', give: 'Eat it quick, before it eats your sleeve.', items: ['vanilla', 'strawberryice', 'chocolate', 'mint'] },
    cinema: { keeper: 'lou', title: 'The cinema counter', hello: 'Something for the film? Take what you like.', give: 'Enjoy the film. Try not to rustle.', items: ['popcorn', 'sweets', 'crisps', 'lemonade'] },
    pub: { keeper: 'gwen', title: 'The Lantern bar', hello: 'Soft drinks only here these days. Nobody\'s complained yet.', give: 'There you are, love. Find a seat.', items: ['ginger', 'lemonade', 'cocoa', 'tea'] },
  };

  const pictures = new Map();
  function picture(id) {
    if (pictures.has(id)) return pictures.get(id);
    const c = makeCanvas(8, 8), g = c.getContext('2d');
    PICTURES[id].forEach((row, y) => [...row].forEach((ch, x) => {
      if (COLOURS[ch]) { g.fillStyle = COLOURS[ch]; g.fillRect(x, y, 1, 1); }
    }));
    pictures.set(id, c);
    return c;
  }
  const keeperOf = (shop) => residents.find((r) => r.id === SHOPS[shop].keeper);

  let openShop = null;
  function open(shop) {
    if (modal) return;
    const info = SHOPS[shop], keeper = keeperOf(shop);
    openShop = shop;
    modal = 'shop';
    Sound.pop();
    $('shop-title').textContent = info.title;
    $('shop-hello').textContent = `${keeper.name}: "${info.hello}"`;
    const face = $('shop-face').getContext('2d');
    face.clearRect(0, 0, CELL_W, CELL_H);
    face.drawImage(personSheet(keeper.look), 0, 0, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
    const box = $('shop-items');
    box.textContent = '';
    for (const id of info.items) {
      const item = ITEMS[id];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-item';
      const pic = document.createElement('canvas');
      pic.width = 8; pic.height = 8;
      pic.getContext('2d').drawImage(picture(id), 0, 0);
      const name = document.createElement('span');
      name.className = 'shop-item-name';
      name.textContent = item.name;
      const ask = document.createElement('span');
      ask.className = 'shop-item-ask';
      ask.textContent = 'Ask for one';
      b.append(pic, name, ask);
      b.addEventListener('click', () => askFor(shop, id));
      box.append(b);
    }
    $('shop').hidden = false;
    box.querySelector('button').focus();
  }
  function close() {
    $('shop').hidden = true;
    if (modal === 'shop') modal = null;
    openShop = null;
    releaseFocus();
  }
  // Asking: the stallholder hands it over, and you have it straight away.
  function askFor(shop, id) {
    const info = SHOPS[shop], keeper = keeperOf(shop), item = ITEMS[id], me = state.me;
    close();
    me.treat = { id, until: Date.now() + 8000 };
    showTalk(keeper.name, info.give, [], 'Thank you!');
    toast(`You ${item.how} the ${item.called || item.name.toLowerCase()}. ${item.taste}`, 6000, true);
  }
  // A little of what you're having shows in your hand while you have it.
  function drawInHand(c, p, x, y) {
    if (!p.treat || p.treat.until < Date.now()) return;
    c.drawImage(picture(p.treat.id), x - 1, y - 1, 5, 5);
  }

  $('shop-close').addEventListener('click', close);
  $('shop').addEventListener('pointerdown', (ev) => { if (ev.target === $('shop')) close(); });

  return {
    open, close, drawInHand,
    title: (shop) => SHOPS[shop].title,
    keeperName: (shop) => SHOPS[shop] && keeperOf(shop) ? keeperOf(shop).name : '',
  };
})();
