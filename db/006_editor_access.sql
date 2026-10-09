-- Acesso ao Editor de Vídeo por tenant.
-- Regra: assinantes do agendamento ganham o editor incluso por N meses
-- (included_until). Plano completo (full) libera sempre. O admin pode
-- liberar/bloquear manualmente (manual_grant / manual_revoked).
create table if not exists editor_access (
  tenant_id uuid primary key references tenants(id) on delete cascade,
  plan text not null default 'agenda' check (plan in ('agenda', 'full')),
  included_until date,
  manual_grant boolean not null default false,
  manual_revoked boolean not null default false,
  granted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table editor_access enable row level security;

drop policy if exists "editor_access read" on editor_access;
create policy "editor_access read"
  on editor_access for select
  using (
    auth.role() = 'anon'
    or exists (
      select 1 from profiles p
      where p.user_id = auth.uid() and p.tenant_id = editor_access.tenant_id
    )
  );

drop policy if exists "editor_access write" on editor_access;
create policy "editor_access write"
  on editor_access for all
  using (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.tenant_id = editor_access.tenant_id
        and p.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.user_id = auth.uid()
        and p.tenant_id = editor_access.tenant_id
        and p.role in ('owner', 'admin')
    )
  );

-- Acesso efetivo calculado no lado do app:
--   plan = 'full'                 -> liberado
--   manual_revoked = true         -> bloqueado
--   manual_grant = true           -> liberado
--   included_until >= hoje        -> liberado (meses inclusos)
