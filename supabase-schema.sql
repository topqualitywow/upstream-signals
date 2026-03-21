-- Run this in Supabase SQL editor
-- If you already have a signals table, drop it first:
-- drop table if exists signals;

create table signals (
  id uuid default gen_random_uuid() primary key,
  raw_input text not null,
  parsed jsonb,
  analysis jsonb,
  trends_data jsonb,
  reddit_data jsonb,
  created_at timestamptz default now()
);

alter table signals enable row level security;
create policy "Allow all" on signals for all using (true);
