-- Optional shared persistence. Run once in the Supabase SQL editor.
create table if not exists cf_ops (
  id text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);
alter table cf_ops enable row level security;
-- DEMO policies: anyone with the app link can read, add and remove changes. Add authentication before real use.
create policy "demo read"   on cf_ops for select to anon using (true);
create policy "demo insert" on cf_ops for insert to anon with check (pg_column_size(data) < 20000);
create policy "demo delete" on cf_ops for delete to anon using (true);
