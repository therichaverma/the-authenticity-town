-- The Authenticity Town: everything the players share.
-- Players can read everything here once signed in, but they can only change the book,
-- entries and "me too"s through the functions at the bottom, which check the rules
-- (one holder at a time, an hour each, only the holder writes, one entry per person).

-- Each signed-in person's character.
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 20),
  look jsonb not null,
  created_at timestamptz not null default now()
);

-- The one green book: where it was last left, and who has it right now.
create table public.book (
  id int primary key default 1 check (id = 1),
  scene text not null check (scene in ('town', 'cafe', 'bookshop')),
  x real not null,
  y real not null,
  base real not null,
  holder_id uuid references public.players (id) on delete set null,
  held_until timestamptz,
  last_holder_id uuid references public.players (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- What people wrote. One entry per person, which they can edit while they hold the book.
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null unique references public.players (id) on delete cascade,
  author_name text not null,
  body text not null check (char_length(btrim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Who said "me too" to which entry.
create table public.me_toos (
  entry_id uuid not null references public.entries (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  player_name text not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, player_id)
);

alter table public.players enable row level security;
alter table public.book enable row level security;
alter table public.entries enable row level security;
alter table public.me_toos enable row level security;

-- Signed-in players can read the town's shared things.
create policy "players are visible to signed-in players" on public.players
  for select to authenticated using (true);
create policy "the book is visible to signed-in players" on public.book
  for select to authenticated using (true);
-- Guests (anonymous accounts) can see where the book is, but not what's written in it.
create policy "entries are visible to signed-in players" on public.entries
  for select to authenticated using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);
create policy "me toos are visible to signed-in players" on public.me_toos
  for select to authenticated using (coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false);

-- People make and rename only their own character.
create policy "people create their own character" on public.players
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "people update their own character" on public.players
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- The book starts on a table in the café.
insert into public.book (id, scene, x, y, base) values (1, 'cafe', 152, 111, 125);

-- True when the caller is a guest who hasn't signed in with an email.
create function public.is_guest()
returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) $$;
revoke execute on function public.is_guest() from public, anon;
grant execute on function public.is_guest() to authenticated;

-- Picking up the book: only if nobody holds it (or their hour has run out).
-- Picking it back up within your own hour keeps the time you had left.
create function public.take_book()
returns public.book
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  b public.book;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'guests need to sign in'; end if;
  if not exists (select 1 from public.players where id = me) then raise exception 'no character yet'; end if;
  select * into b from public.book where id = 1 for update;
  if b.holder_id is not null and b.holder_id <> me and b.held_until > now() then
    raise exception 'someone else has the book';
  end if;
  if not (b.last_holder_id = me and b.held_until > now()) or b.held_until is null then
    b.held_until := now() + interval '60 minutes';
  end if;
  update public.book
    set holder_id = me, last_holder_id = me, held_until = b.held_until, updated_at = now()
    where id = 1
    returning * into b;
  return b;
end;
$$;

-- Leaving the book somewhere: only the person holding it can.
create function public.leave_book(p_scene text, p_x real, p_y real, p_base real)
returns public.book
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  b public.book;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_scene not in ('town', 'cafe', 'bookshop') then raise exception 'unknown place'; end if;
  if p_x < 0 or p_x > 720 or p_y < 0 or p_y > 480 or p_base < 0 or p_base > 480 then raise exception 'outside the town'; end if;
  select * into b from public.book where id = 1 for update;
  if b.holder_id is distinct from me then raise exception 'you are not holding the book'; end if;
  update public.book
    set holder_id = null, scene = p_scene, x = p_x, y = p_y, base = p_base, updated_at = now()
    where id = 1
    returning * into b;
  return b;
end;
$$;

-- Writing or editing your entry: only while you hold the book and your hour isn't up.
create function public.save_entry(p_body text)
returns public.entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_name text;
  e public.entries;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'guests need to sign in'; end if;
  if not exists (select 1 from public.book where id = 1 and holder_id = me and held_until > now()) then
    raise exception 'you need to be holding the book';
  end if;
  select name into my_name from public.players where id = me;
  insert into public.entries (author_id, author_name, body)
    values (me, my_name, left(btrim(p_body), 1200))
    on conflict (author_id) do update
      set body = excluded.body, author_name = excluded.author_name, updated_at = now()
    returning * into e;
  return e;
end;
$$;

-- Saying "me too" to someone else's entry, once.
create function public.say_me_too(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  my_name text;
begin
  if me is null then raise exception 'not signed in'; end if;
  if public.is_guest() then raise exception 'guests need to sign in'; end if;
  select name into my_name from public.players where id = me;
  if my_name is null then raise exception 'no character yet'; end if;
  if exists (select 1 from public.entries where id = p_entry and author_id = me) then
    raise exception 'that is your own entry';
  end if;
  insert into public.me_toos (entry_id, player_id, player_name)
    values (p_entry, me, my_name)
    on conflict do nothing;
end;
$$;

-- Only signed-in players may call these, never anonymous visitors.
revoke execute on function public.take_book() from public, anon;
revoke execute on function public.leave_book(text, real, real, real) from public, anon;
revoke execute on function public.save_entry(text) from public, anon;
revoke execute on function public.say_me_too(uuid) from public, anon;
grant execute on function public.take_book() to authenticated;
grant execute on function public.leave_book(text, real, real, real) to authenticated;
grant execute on function public.save_entry(text) to authenticated;
grant execute on function public.say_me_too(uuid) to authenticated;

-- Tell open games straight away when the book moves or someone writes.
alter publication supabase_realtime add table public.book, public.entries, public.me_toos;

-- Small indexes the database's advisor recommends for the links between tables.
create index me_toos_player_id_idx on public.me_toos (player_id);
create index book_holder_id_idx on public.book (holder_id);
create index book_last_holder_id_idx on public.book (last_holder_id);

-- Copy each character's name onto their account, so the dashboard's Users page shows it as the display name.
create function public.sync_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
    set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('display_name', new.name)
    where id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_display_name() from public, anon, authenticated;
create trigger players_sync_display_name
  after insert or update of name on public.players
  for each row execute function public.sync_display_name();

-- Character names are unique in town, ignoring capitals and spaces at either end.
create unique index players_name_unique on public.players (lower(btrim(name)));
