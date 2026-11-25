-- Saved private chats. Every message is stored, so people can read their chats again after leaving
-- and coming back. Only the two people in a chat can ever read its messages. Typing ("… is typing")
-- still travels live over the private channel from private-chat.sql and is never stored.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.players (id) on delete cascade,
  to_id uuid not null references public.players (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  seen_at timestamptz,
  check (from_id <> to_id)
);
create index messages_to_idx on public.messages (to_id, created_at);
create index messages_from_idx on public.messages (from_id, created_at);

alter table public.messages enable row level security;

-- Whether the caller may send a message to this player: signed in with an email (not a guest), and
-- neither has blocked the other. Kept in the private schema, out of reach of the public interface.
create function private.can_message(p_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and auth.uid() <> p_to
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
    and exists (select 1 from public.players where id = p_to)
    and not exists (select 1 from public.blocks
                    where (blocker_id = auth.uid() and blocked_id = p_to) or (blocker_id = p_to and blocked_id = auth.uid()))
$$;
revoke execute on function private.can_message(uuid) from public, anon;
grant execute on function private.can_message(uuid) to authenticated;

-- People read only the messages they sent or received, and send only as themselves.
create policy "people read their own chats" on public.messages
  for select to authenticated using ((select auth.uid()) in (from_id, to_id));
create policy "people send as themselves" on public.messages
  for insert to authenticated
  with check ((select auth.uid()) = from_id and delivered_at is null and seen_at is null and (select private.can_message(to_id)));

-- Marking messages from someone as delivered (they reached my game) or seen (I've read them).
-- Only the person they were sent to can do this, and only these two times change.
create function public.mark_messages(p_from uuid, p_seen boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages set delivered_at = coalesce(delivered_at, now())
    where to_id = auth.uid() and from_id = p_from and delivered_at is null;
  if p_seen then
    update public.messages set seen_at = now()
      where to_id = auth.uid() and from_id = p_from and seen_at is null;
  end if;
end;
$$;
revoke execute on function public.mark_messages(uuid, boolean) from public, anon;
grant execute on function public.mark_messages(uuid, boolean) to authenticated;

-- Tell open games straight away when a message is sent, delivered or seen (each person only hears
-- about their own chats, because the read rule above applies).
alter publication supabase_realtime add table public.messages;
