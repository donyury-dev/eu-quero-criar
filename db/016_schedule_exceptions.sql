-- 016: Exceções de agenda — dias específicos abertos/fechados com horário próprio
-- Permite ao dono marcar um dia específico como fechado ou abrir em horário
-- diferente da base semanal (inclui almoço variável). Rodar no SQL Editor do Supabase.

create table if not exists public.schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  date date not null,
  closed boolean not null default true,
  start_time text,
  end_time text,
  break_start text,
  break_end text,
  created_at timestamptz not null default now(),
  unique (tenant_id, date)
);

alter table public.schedule_exceptions enable row level security;

create policy "public read schedule_exceptions"
  on public.schedule_exceptions for select using (true);

create policy "owner manage schedule_exceptions"
  on public.schedule_exceptions for all
  using (public.is_owner(tenant_id))
  with check (public.is_owner(tenant_id));
