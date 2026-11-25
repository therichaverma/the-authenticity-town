-- The live town ('players'): who's here right now and where they're walking. It's a private channel,
-- so the database decides who may do what on it:
--   everyone who has come in (guests included) can watch it, so guests see the town come alive;
--   only signed-in players can appear in it or send where they're walking, so guests are never seen.
-- Realtime checks these when someone joins the channel. (The rules for private chats are in
-- private-chat.sql; Postgres allows anything either set of rules allows.)

create policy "everyone in town can watch the live town" on realtime.messages
  for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence') and (select realtime.topic()) = 'players');

create policy "only signed-in players show up in the live town" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and (select realtime.topic()) = 'players'
    and not (select public.is_guest())
  );
