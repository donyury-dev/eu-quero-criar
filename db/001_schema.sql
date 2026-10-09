-- KalBix Agenda: multi-tenant schema + RLS
create extension if not exists pgcrypto;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null default 'barbearia',
  description text,
  phone text,
  address text,
  city text,
  logo_url text,
  cover_url text,
  primary_color text not null default '#111827',
  secondary_color text not null default '#f59e0b',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','professional')),
  name text,
  created_at timestamptz not null default now(),
  unique (user_id, tenant_id)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  duration_min int not null default 30,
  price_cents int not null default 0,
  color text not null default '#6366f1',
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.professionals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  specialty text,
  commission_pct numeric(5,2) not null default 40,
  active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.professional_services (
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (professional_id, service_id)
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),
  start_time time not null default '09:00',
  end_time time not null default '19:00',
  break_start time,
  break_end time,
  closed boolean not null default false
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  price_cents int not null default 0,
  status text not null default 'confirmed' check (status in ('confirmed','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_appointments_tenant_date on public.appointments (tenant_id, appointment_date);
create index if not exists idx_appointments_professional on public.appointments (professional_id, appointment_date);

-- RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.professionals enable row level security;
alter table public.professional_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;

create or replace function public.is_owner(tid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.tenant_id = tid
      and p.role in ('owner','admin')
  );
$$;

-- Public catalog: readable by anyone (booking page + marketplace)
create policy "public read tenants" on public.tenants for select using (true);
create policy "public read services" on public.services for select using (true);
create policy "public read professionals" on public.professionals for select using (true);
create policy "public read professional_services" on public.professional_services for select using (true);
create policy "public read business_hours" on public.business_hours for select using (true);

-- Owner updates own establishment branding
create policy "owner update tenant" on public.tenants for update using (public.is_owner(id)) with check (public.is_owner(id));

-- Public booking (no login needed to book)
create policy "anon create customer" on public.customers for insert with check (true);
create policy "anon create appointment" on public.appointments for insert with check (true);

-- Owner full management of own data
create policy "owner manage services" on public.services for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage professionals" on public.professionals for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage professional_services" on public.professional_services for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage business_hours" on public.business_hours for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage customers" on public.customers for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage appointments" on public.appointments for all using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));

-- Profiles: self only; new users may attach themselves as owner of the demo tenant
create policy "read own profile" on public.profiles for select using (auth.uid() = user_id);
create policy "insert own profile" on public.profiles for insert with check (
  auth.uid() = user_id and tenant_id = '00000000-0000-0000-0000-000000000001'
);
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Grants
grant select on public.tenants, public.services, public.professionals, public.professional_services, public.business_hours to anon, authenticated;
grant insert on public.customers, public.appointments to anon, authenticated;
grant select on public.customers, public.appointments to authenticated;
grant update, delete on public.customers, public.appointments to authenticated;
grant insert, update, delete on public.services, public.professionals, public.professional_services, public.business_hours to authenticated;
grant update on public.tenants to authenticated;
grant select, insert, update on public.profiles to authenticated;
