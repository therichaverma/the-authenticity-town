-- The town grew: Market Street to the east (with the pub and the art studio) and the park to the south.
-- The town is now 1040 x 720, and the book can be left inside the new buildings too: the pub, the art
-- studio, the library, launderette and town hall north of the square, and the picture house,
-- ice-cream parlour and chapel south of it (all where houses used to be).

alter table public.book drop constraint book_scene_check;
alter table public.book add constraint book_scene_check check (scene in ('town', 'cafe', 'bookshop', 'pub', 'studio', 'library', 'launderette', 'hall', 'cinema', 'icecream', 'chapel'));

create or replace function public.leave_book(p_scene text, p_x real, p_y real, p_base real)
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
  if p_scene not in ('town', 'cafe', 'bookshop', 'pub', 'studio', 'library', 'launderette', 'hall', 'cinema', 'icecream', 'chapel') then raise exception 'unknown place'; end if;
  if p_x < 0 or p_x > 1040 or p_y < 0 or p_y > 720 or p_base < 0 or p_base > 720 then raise exception 'outside the town'; end if;
  select * into b from public.book where id = 1 for update;
  if b.holder_id is distinct from me then raise exception 'you are not holding the book'; end if;
  update public.book
    set holder_id = null, scene = p_scene, x = p_x, y = p_y, base = p_base, updated_at = now()
    where id = 1
    returning * into b;
  return b;
end;
$$;
