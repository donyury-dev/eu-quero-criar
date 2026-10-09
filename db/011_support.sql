-- 011: Suporte técnico — tickets entre estabelecimentos e o dono da plataforma.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_role text not null check (author_role in ('client', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_tenant on public.support_tickets (tenant_id, updated_at desc);
create index if not exists idx_support_messages_ticket on public.support_messages (ticket_id, created_at);

-- RLS
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

-- O dono vê os tickets do próprio estabelecimento; superadmin vê todos.
create policy "tickets_owner_read" on public.support_tickets
  for select to authenticated
  using (public.is_owner(tenant_id) or public.is_superadmin());

create policy "tickets_owner_insert" on public.support_tickets
  for insert to authenticated
  with check (public.is_owner(tenant_id));

create policy "tickets_admin_update" on public.support_tickets
  for update to authenticated
  using (public.is_owner(tenant_id) or public.is_superadmin());

-- Mensagens seguem o mesmo acesso do ticket.
create policy "messages_read" on public.support_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (public.is_owner(t.tenant_id) or public.is_superadmin())
    )
  );

create policy "messages_insert" on public.support_messages
  for insert to authenticated
  with check (
    exists (
      select 1 from public.support_tickets t
      where t.id = ticket_id and (public.is_owner(t.tenant_id) or public.is_superadmin())
    )
  );

grant select, insert, update on public.support_tickets to authenticated;
grant select, insert on public.support_messages to authenticated;
