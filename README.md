# The Authenticity Town

A living pixel town where people try to be honest. Somewhere in town there's a green book. Whoever finds it can write one true thing in it, then leave it somewhere for the next person. Decisions live in the project docs, not here.

## Play it

Serve the folder and open http://localhost:4173:

```bash
python3 serve.py
```

You knock on the gate, Hazel says hello, and then you choose: sign in to play, or explore as a guest first.

## The town

The square has the fountain in the middle and public places all round it:

- **North:** the community garden, the library, the café, the bookshop, the launderette and the town hall
- **South:** the cinema, the ice-cream parlour, the chapel and the post office
- **West:** the pond and the playground
- **East, along Market Street:** the Lantern (a pub that only serves soft drinks), the art studio and four food stalls (fruit, juice, snacks and a bakery)
- **Further south:** the park with its bandstand and duck pond, and Rose Lane, where the residents live

Most places have something to do: order a coffee, browse the shelves, paint at an easel, watch the washing go round, play the piano, light a candle, post a letter. Food and drinks are free: walk up to a stall or counter, ask for something, and you have it on the spot.

Tables, benches, counters, pews and the bandstand steps are all places to leave the green book.

## Who can do what

**Guests** come in without an email, as a free look around. They get a random character and a random name like "Quiet Duck", which nobody else in town is using. They can walk everywhere, go into every place and have the food, but they can't open the book, write in it or talk to other players, and other players can't see them. A guest's visit lasts only while their tab is open.

**Signed-in players** sign in with a link sent to their email, choose a name and a character, and keep them across devices. They can pick up the book, write in it and leave it somewhere, and chat with each other (chats are saved, and anyone can be blocked or reported).

The database enforces all of this, not just the game.

## What's where

- `index.html`, `style.css`: the page and its screens
- `src/main.js`: the game loop, day and night, drawing, signing in, the book and everything you can do
- `src/world.js`: the town and every room: what's where, what blocks you, doors and path-finding
- `src/art.js`: every sprite, drawn from rectangles in the Sunny Square palette
- `src/people.js`: the residents and the people who run each place, and how they move around
- `src/market.js`: the stalls and counters: their menus, the little food pictures, and eating on the spot
- `src/book.js`: the green book's rules
- `src/server.js`: talking to Supabase: sign-in, the shared book, players and the live town
- `src/dm.js`: chats between players
- `src/entrance.js`, `src/townname.js`: the gate and the hanging name board
- `src/wayfinding.js`: signposts, the corner map and the big map
- `src/sound.js`, `audio/`: sound
- `supabase/`: the database (see below)

## The database

The shared town lives in a Supabase project. `src/config.js` holds its address and public key, which are safe to publish; the database's own rules decide what each person can do.

To set up a new project, run the files in `supabase/` in this order: `schema.sql`, `saved-chats.sql`, `private-chat.sql`, `guest-names.sql`, `live-town.sql`, `bigger-town.sql`. Then, in the Supabase dashboard, turn on **Allow anonymous sign-ins** (Authentication, Sign In / Providers) so guests can come in.

## Previewing

Add these to the address to look at things without signing in:

- `?preview=guests`: the town with a signed-in player and a few guests
- `?hour=22`: a fixed time of day (any hour from 0 to 23)
- `?opening=1` to `9`: the different gates that were tried (9 is the one everyone sees)
- `?name=1` to `6`: the different ways of showing the town's name (6 is the one everyone sees)

## Not in this repository

The source novel stays on the computer it's on and is never committed.
