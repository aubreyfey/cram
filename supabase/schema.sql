-- Cram feedback board. Run once in the Supabase SQL editor (Database → SQL).
--
-- Three tables: what people asked for (feedback), who upvoted what (votes),
-- and what shipped (updates). Statuses drive the Roadmap tab:
--   pending      just posted, not looked at yet          (Feedback tab only)
--   planned      going to do it                          (Roadmap: Planned)
--   in_progress  being built                             (Roadmap: In progress)
--   done         shipped                                 (Roadmap: Done)
--   declined     not doing it, with a note               (Feedback tab, greyed)
--
-- Anyone can read. Signed-in people can post and vote once per item. Only
-- you (via the dashboard, or the service role) can change a status or post
-- an update. Vote counts are kept on the feedback row by trigger so the
-- list is one query.

create type feedback_status as enum ('pending', 'planned', 'in_progress', 'done', 'declined');

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  author_id   uuid not null references auth.users (id) on delete cascade,
  author_name text not null default 'Someone',
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null default '' check (char_length(body) <= 2000),
  status      feedback_status not null default 'pending',
  note        text not null default '',          -- your reply, shown under the post
  votes       integer not null default 0
);

create table public.votes (
  feedback_id uuid not null references public.feedback (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (feedback_id, user_id)
);

create table public.updates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  version     text not null default '',
  title       text not null,
  body        text not null default ''
);

-- Keep feedback.votes in step with the votes table.
create or replace function public.bump_votes() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    update public.feedback set votes = votes + 1 where id = new.feedback_id;
  elsif tg_op = 'DELETE' then
    update public.feedback set votes = greatest(votes - 1, 0) where id = old.feedback_id;
  end if;
  return null;
end $$;

create trigger votes_bump
after insert or delete on public.votes
for each row execute function public.bump_votes();

-- Row-level security ------------------------------------------------------

alter table public.feedback enable row level security;
alter table public.votes    enable row level security;
alter table public.updates  enable row level security;

-- Everyone, signed in or not, can read the board.
create policy "feedback is public"  on public.feedback for select using (true);
create policy "votes are public"    on public.votes    for select using (true);
create policy "updates are public"  on public.updates  for select using (true);

-- Signed-in people can post. Status, note and votes are server-owned: the
-- insert policy pins them to their defaults.
create policy "signed-in can post" on public.feedback for insert
  with check (
    auth.uid() = author_id
    and status = 'pending'
    and note = ''
    and votes = 0
  );

-- Authors can edit their own title/body while it is still pending.
create policy "authors edit pending" on public.feedback for update
  using (auth.uid() = author_id and status = 'pending')
  with check (auth.uid() = author_id and status = 'pending');

-- One vote per person per item; you can take yours back.
create policy "signed-in can vote"   on public.votes for insert with check (auth.uid() = user_id);
create policy "signed-in can unvote" on public.votes for delete using (auth.uid() = user_id);

-- Nobody but the service role writes updates or changes statuses. Do that
-- from the dashboard's table editor, or the admin SQL below.

-- Handy: change a status and leave a note in one go.
--   select public.set_status('<feedback id>', 'planned', 'Coming in October.');
create or replace function public.set_status(fid uuid, s feedback_status, n text default '')
returns void language sql security definer as $$
  update public.feedback set status = s, note = n where id = fid;
$$;
revoke execute on function public.set_status from public, anon, authenticated;
