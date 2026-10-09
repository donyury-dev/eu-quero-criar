-- 010: Clube — planos de assinatura do estabelecimento para seus clientes finais

create table if not exists public.club_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  price_cents int not null default 0,
  cuts_per_month int not null default 4,
  discount_pct numeric(5,2) not null default 0,
  perks text,
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.club_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_id uuid not null references public.club_plans(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  since date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, customer_phone)
);

create table if not exists public.club_visits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  member_id uuid not null references public.club_members(id) on delete cascade,
  visit_date date not null default current_date,
  appointment_id uuid references public.appointments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_club_visits_member on public.club_visits (member_id, visit_date);

alter table public.club_plans enable row level security;
alter table public.club_members enable row level security;
alter table public.club_visits enable row level security;

create policy "owner manage club plans" on public.club_plans for all
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage club members" on public.club_members for all
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage club visits" on public.club_visits for all
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));

grant select, insert, update, delete on public.club_plans, public.club_members, public.club_visits to authenticated;

-- Uso do mês de um membro: visitas registradas no mês corrente
create or replace function public.club_member_usage(p_member_id uuid)
returns int
language sql
stable
as $$
  select count(*)::int from public.club_visits v
  where v.member_id = p_member_id
    and date_trunc('month', v.visit_date) = date_trunc('month', current_date);
$$;

-- Consulta pública (usada na página de agendamento): verifica se o telefone
-- informado é de um membro ativo do clube e se ainda tem cortes no mês.
create or replace function public.check_club_membership(
  p_tenant_id uuid,
  p_phone text
)
returns table (
  member_id uuid,
  member_name text,
  plan_name text,
  cuts_per_month int,
  used_this_month int,
  discount_pct numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select m.id, m.customer_name, pl.name, pl.cuts_per_month,
         public.club_member_usage(m.id), pl.discount_pct
  from public.club_members m
  join public.club_plans pl on pl.id = m.plan_id
  where m.tenant_id = p_tenant_id
    and m.customer_phone = trim(p_phone)
    and m.active
    and pl.active
  limit 1;
$$;

grant execute on function public.check_club_membership(uuid, text) to anon, authenticated;
