-- Draco Sheets: workbooks + version history, owner-only RLS.
-- Every object is prefixed "sheets_" so this app can share the CAGED_DRAGON project with other apps.
create table if not exists public.sheets_workbooks (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled workbook',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sheets_workbook_versions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.sheets_workbooks(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists sheets_workbooks_owner_updated_idx on public.sheets_workbooks (owner, updated_at desc);
create index if not exists sheets_workbook_versions_wb_idx on public.sheets_workbook_versions (workbook_id, created_at desc);
create index if not exists sheets_workbook_versions_owner_idx on public.sheets_workbook_versions (owner);

create or replace function public.sheets_touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists sheets_workbooks_touch on public.sheets_workbooks;
create trigger sheets_workbooks_touch before update on public.sheets_workbooks
for each row execute function public.sheets_touch_updated_at();

alter table public.sheets_workbooks enable row level security;
alter table public.sheets_workbook_versions enable row level security;

drop policy if exists "sheets own workbooks select" on public.sheets_workbooks;
drop policy if exists "sheets own workbooks insert" on public.sheets_workbooks;
drop policy if exists "sheets own workbooks update" on public.sheets_workbooks;
drop policy if exists "sheets own workbooks delete" on public.sheets_workbooks;
drop policy if exists "sheets own versions select" on public.sheets_workbook_versions;
drop policy if exists "sheets own versions insert" on public.sheets_workbook_versions;
drop policy if exists "sheets own versions delete" on public.sheets_workbook_versions;

create policy "sheets own workbooks select" on public.sheets_workbooks for select to authenticated using (owner = (select auth.uid()));
create policy "sheets own workbooks insert" on public.sheets_workbooks for insert to authenticated with check (owner = (select auth.uid()));
create policy "sheets own workbooks update" on public.sheets_workbooks for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "sheets own workbooks delete" on public.sheets_workbooks for delete to authenticated using (owner = (select auth.uid()));

create policy "sheets own versions select" on public.sheets_workbook_versions for select to authenticated using (owner = (select auth.uid()));
create policy "sheets own versions insert" on public.sheets_workbook_versions for insert to authenticated with check (owner = (select auth.uid()));
create policy "sheets own versions delete" on public.sheets_workbook_versions for delete to authenticated using (owner = (select auth.uid()));
