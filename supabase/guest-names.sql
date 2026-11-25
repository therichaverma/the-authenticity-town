-- Guest names: every guest walks in with a random two-word name like "Quiet Duck", and no two
-- people in town share one. A guest's name is held only while they're around: their tab checks in
-- every few minutes, and a name nobody has checked in for 10 minutes is free for the next guest.
-- Nothing else about a guest is kept.

create table public.guest_names (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  seen_at timestamptz not null default now()
);
create unique index guest_names_name_unique on public.guest_names (lower(name));
-- Nobody reads or writes this table directly; only the functions below touch it.
alter table public.guest_names enable row level security;

-- Gives the calling guest their name: the one they already have, or a fresh random one that no
-- other guest is using and no signed-in player has taken. 40 x 40 words make 1,600 names; in the
-- unlikely case they're all in use, a number is added on the end.
create function public.claim_guest_name()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  firsts text[] := array[
    'Sunny', 'Quiet', 'Curious', 'Gentle', 'Brave', 'Sleepy', 'Merry', 'Shy', 'Lucky', 'Cosy',
    'Bright', 'Wandering', 'Happy', 'Calm', 'Little', 'Kind', 'Cheerful', 'Dreamy', 'Clever', 'Jolly',
    'Humble', 'Breezy', 'Mellow', 'Patient', 'Playful', 'Quirky', 'Rosy', 'Snug', 'Spry', 'Sweet',
    'Tender', 'Thoughtful', 'Velvet', 'Warm', 'Whistling', 'Wise', 'Witty', 'Zesty', 'Plucky', 'Dapper'];
  seconds text[] := array[
    'Otter', 'Fox', 'Robin', 'Badger', 'Hedgehog', 'Owl', 'Sparrow', 'Rabbit', 'Squirrel', 'Wren',
    'Mole', 'Finch', 'Heron', 'Deer', 'Duck', 'Panda', 'Beaver', 'Bunny', 'Cat', 'Crow',
    'Dormouse', 'Fawn', 'Goose', 'Hare', 'Koala', 'Lamb', 'Lark', 'Magpie', 'Moth', 'Newt',
    'Pigeon', 'Puffin', 'Quail', 'Raccoon', 'Seal', 'Swan', 'Toad', 'Turtle', 'Vole', 'Weasel'];
  candidate text;
  tries int := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  if not public.is_guest() then raise exception 'only guests get a visitor name'; end if;
  -- Names of guests who have gone quiet are free again.
  delete from public.guest_names where seen_at < now() - interval '10 minutes' and id <> me;
  select name into candidate from public.guest_names where id = me;
  if found then
    update public.guest_names set seen_at = now() where id = me;
    return candidate;
  end if;
  loop
    tries := tries + 1;
    candidate := firsts[1 + floor(random() * array_length(firsts, 1))::int] || ' '
              || seconds[1 + floor(random() * array_length(seconds, 1))::int];
    if tries > 300 then candidate := candidate || ' ' || (2 + floor(random() * 98))::int; end if;
    continue when exists (select 1 from public.players where lower(btrim(name)) = lower(candidate));
    begin
      insert into public.guest_names (id, name) values (me, candidate);
      return candidate;
    exception when unique_violation then
      -- Another guest has it; try again.
    end;
  end loop;
end;
$$;
revoke execute on function public.claim_guest_name() from public, anon;
grant execute on function public.claim_guest_name() to authenticated;

-- A guest's tab checks in every few minutes, so their name stays theirs while they're around.
create function public.touch_guest_name()
returns void
language sql
security definer
set search_path = ''
as $$ update public.guest_names set seen_at = now() where id = auth.uid() $$;
revoke execute on function public.touch_guest_name() from public, anon;
grant execute on function public.touch_guest_name() to authenticated;

-- Signed-in players can't pick a name a guest in town is using right now.
create function public.name_not_held_by_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.guest_names
    where lower(name) = lower(btrim(new.name)) and id <> new.id and seen_at > now() - interval '10 minutes'
  ) then
    raise exception 'duplicate key: a visitor in town has that name';
  end if;
  return new;
end;
$$;
revoke execute on function public.name_not_held_by_guest() from public, anon, authenticated;
create trigger players_name_not_held_by_guest
  before insert or update of name on public.players
  for each row execute function public.name_not_held_by_guest();
