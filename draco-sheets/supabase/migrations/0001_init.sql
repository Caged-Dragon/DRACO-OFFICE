-- Draco Sheets v7: workbooks + version history, owner-only RLS
create table if not exists public.workbooks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled workbook',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workbook_versions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.workbooks(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists workbooks_owner_updated_idx on public.workbooks (owner, updated_at desc);
create index if not exists workbook_versions_wb_idx on public.workbook_versions (workbook_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists workbooks_touch on public.workbooks;
create trigger workbooks_touch before update on public.workbooks
for each row execute function public.touch_updated_at();

alter table public.workbooks enable row level security;
alter table public.workbook_versions enable row level security;

create policy "own workbooks select" on public.workbooks for select to authenticated using (owner = (select auth.uid()));
create policy "own workbooks insert" on public.workbooks for insert to authenticated with check (owner = (select auth.uid()));
create policy "own workbooks update" on public.workbooks for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own workbooks delete" on public.workbooks for delete to authenticated using (owner = (select auth.uid()));

create policy "own versions select" on public.workbook_versions for select to authenticated using (owner = (select auth.uid()));
create policy "own versions insert" on public.workbook_versions for insert to authenticated with check (owner = (select auth.uid()));
create policy "own versions delete" on public.workbook_versions for delete to authenticated using (owner = (select auth.uid()));
