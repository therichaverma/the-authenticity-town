# The Authenticity Town

A living pixel town where people try to be honest. Decisions live in the project docs, not here.

## Play it

Open `index.html` in a browser. Nothing needs installing.

Or serve it, which the preview pane needs:

```bash
python3 serve.py
```

## What's where

- `src/art.js`: every sprite, drawn from rectangles in the Sunny Square palette
- `src/world.js`: the town and rooms, what blocks you, doors, and path-finding
- `src/book.js`: the green book's rules
- `src/people.js`: stand-in residents and how they move around
- `src/main.js`: the game loop, day and night, drawing, and the screens

## Guests and signing in

Everyone walks in as a guest (a Supabase anonymous account kept on that device). A Sign in button asks only for an email; a guest who signs in keeps their character. Anonymous sign-ins must be switched on in the Supabase dashboard under Authentication.

Guests can walk around and see where the green book is, but can't open it, write in it or talk; the database enforces this too. They're drawn in grey with a grey name tag, and carry a faint glow at night so they stay visible. `?preview=guests` (plus `&hour=22` for night) shows them in town without signing in.

## Not real yet

Everything is saved in one browser. Other residents are stand-ins until a server lets real players share the town.
