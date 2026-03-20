-- Run this in your Supabase SQL editor

create table signals (
  id uuid default gen_random_uuid() primary key,
  raw_input text not null,
  parsed jsonb,
  analysis jsonb,
  created_at timestamptz default now()
);

alter table signals enable row level security;

create policy "Allow all" on signals for all using (true);
