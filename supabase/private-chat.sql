-- Private conversations between two players. The messages themselves are never stored: they travel
-- live over a private channel that only the two people in the conversation may join. What is stored:
-- who has blocked whom, and conversations people have reported.

-- Who has blocked whom. A blocked person can't start a conversation with, or message, the person who blocked them.
create table public.blocks (
  blocker_id uuid not null references public.players (id) on delete cascade,
  blocked_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_id_idx on public.blocks (blocked_id);

-- Conversations someone reported, with the messages as they saw them, for the town's keeper to review
-- in the Supabase dashboard. Players can send reports but never read them.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reported_id uuid references public.players (id) on delete set null,
  reported_name text not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_reported_id_idx on public.reports (reported_id);

alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- People see, add and remove only their own blocks. Guests can't block (they can't chat either).
create policy "people see their own blocks" on public.blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
create policy "people block for themselves" on public.blocks
  for insert to authenticated with check ((select auth.uid()) = blocker_id and not (select public.is_guest()));
create policy "people unblock for themselves" on public.blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);

-- People send reports as themselves. There is no select policy, so no player can read any report.
create policy "people report as themselves" on public.reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id and not (select public.is_guest()));

-- Whether the caller may use this private channel. It lives in a private schema, out of reach of the
-- public interface, so nobody can call it directly to find out whether someone has blocked them.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
 A private conversation's channel is named
-- "dm:<first id>:<second id>", the two player ids in order. Only those two may join or send,
-- only when signed in with an email (not as a guest), and not if either has blocked the other.
create function private.dm_allowed(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  a uuid;
  b uuid;
  me uuid := auth.uid();
begin
  if topic is null or topic !~ '^dm:[0-9a-f-]{36}:[0-9a-f-]{36}$' then return false; end if;
  a := split_part(topic, ':', 2)::uuid;
  b := split_part(topic, ':', 3)::uuid;
  if a >= b or me is null or me not in (a, b) then return false; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then return false; end if;
  if not exists (select 1 from public.players where id = a) or not exists (select 1 from public.players where id = b) then return false; end if;
  if exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)) then return false; end if;
  return true;
end;
$$;
revoke execute on function private.dm_allowed(text) from public, anon;
grant execute on function private.dm_allowed(text) to authenticated;

-- The rules for private channels: receive and send only in your own conversations.
create policy "players hear their own private conversations" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence') and (select private.dm_allowed((select realtime.topic()))));
create policy "players speak in their own private conversations" on realtime.messages
  for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence') and (select private.dm_allowed((select realtime.topic()))));
