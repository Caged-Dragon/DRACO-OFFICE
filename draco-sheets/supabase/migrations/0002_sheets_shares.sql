-- Draco Sheets: server-enforced share links (view / comment / edit). All objects prefixed "sheets_".
create table if not exists public.sheets_shares (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.sheets_workbooks(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  role text not null default 'view' check (role in ('view', 'comment', 'edit')),
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists sheets_shares_workbook_idx on public.sheets_shares (workbook_id);
create index if not exists sheets_shares_owner_idx on public.sheets_shares (owner);
alter table public.sheets_shares enable row level security;
drop policy if exists "sheets own shares select" on public.sheets_shares;
drop policy if exists "sheets own shares insert" on public.sheets_shares;
drop policy if exists "sheets own shares update" on public.sheets_shares;
drop policy if exists "sheets own shares delete" on public.sheets_shares;
create policy "sheets own shares select" on public.sheets_shares for select to authenticated using (owner = (select auth.uid()));
create policy "sheets own shares insert" on public.sheets_shares for insert to authenticated with check (
  owner = (select auth.uid()) and exists (select 1 from public.sheets_workbooks w where w.id = workbook_id and w.owner = (select auth.uid())));
create policy "sheets own shares update" on public.sheets_shares for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "sheets own shares delete" on public.sheets_shares for delete to authenticated using (owner = (select auth.uid()));

-- Recipients (even anonymous) never read the table: they call these functions with the secret token.
-- The role and expiry are checked here, on the server, so editing the page in a browser cannot widen access.
create or replace function public.sheets_open_shared(p_token text)
returns table (title text, data jsonb, role text, updated_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select w.title, w.data, s.role, w.updated_at
  from public.sheets_shares s join public.sheets_workbooks w on w.id = s.workbook_id
  where s.token = p_token and not s.revoked and (s.expires_at is null or s.expires_at > now());
$$;
create or replace function public.sheets_save_shared(p_token text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare wid uuid;
begin
  select s.workbook_id into wid from public.sheets_shares s
   where s.token = p_token and s.role = 'edit' and not s.revoked and (s.expires_at is null or s.expires_at > now());
  if wid is null then return false; end if;
  update public.sheets_workbooks set data = p_data where id = wid;
  return true;
end $$;
revoke all on function public.sheets_open_shared(text) from public;
revoke all on function public.sheets_save_shared(text, jsonb) from public;
grant execute on function public.sheets_open_shared(text) to anon, authenticated;
grant execute on function public.sheets_save_shared(text, jsonb) to anon, authenticated;
