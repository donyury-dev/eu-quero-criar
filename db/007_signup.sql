-- 007: Cadastro self-service de estabelecimentos + painel do dono do KalBix (superadmin)

-- Novas colunas de personalização
alter table public.tenants add column if not exists whatsapp text;
alter table public.tenants add column if not exists confirmation_message text;
alter table public.tenants add column if not exists is_blocked boolean not null default false;

-- Perfis podem ser superadmin (dono do KalBix)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner','admin','professional','superadmin'));

-- Tabela de e-mails de administradores da plataforma
create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
create policy "admins read own" on public.app_admins for select using (false);
grant select on public.app_admins to service_role;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a
    where a.email = lower(coalesce(auth.jwt()->>'email', ''))
  );
$$;

-- Leitura de todos os tenants pelo superadmin (página de gestão)
create policy "superadmin read all tenants" on public.tenants for select using (public.is_superadmin());
create policy "superadmin update tenants" on public.tenants for update using (public.is_superadmin()) with check (public.is_superadmin());
create policy "superadmin read all appointments" on public.appointments for select using (public.is_superadmin());

-- ============================================================
-- Cadastro self-service: cria o estabelecimento do usuário
-- ============================================================
create or replace function public.create_establishment(
  p_name text,
  p_category text,
  p_city text,
  p_whatsapp text default null,
  p_owner_name text default null
)
returns table (tenant_id uuid, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_user_email text := lower(coalesce(auth.jwt()->>'email', ''));
  v_slug text;
  v_base text;
  v_tenant uuid;
  v_existing uuid;
  v_i int := 0;
begin
  if v_user is null then
    raise exception 'Faça login para criar um estabelecimento.';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Informe o nome do estabelecimento.';
  end if;

  -- Usuário só pode ter um estabelecimento
  select tenant_id into v_existing from public.profiles
    where user_id = v_user and tenant_id is not null limit 1;
  if v_existing is not null then
    raise exception 'Você já possui um estabelecimento vinculado à sua conta.';
  end if;

  -- Gera slug único a partir do nome
  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' or v_base is null then v_base := 'estabelecimento'; end if;
  v_slug := v_base;
  while exists (select 1 from public.tenants where slug = v_slug) loop
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  end loop;

  insert into public.tenants (slug, name, category, city, whatsapp, phone)
  values (
    v_slug,
    trim(p_name),
    coalesce(nullif(trim(p_category), ''), 'barbearia'),
    nullif(trim(p_city), ''),
    nullif(trim(p_whatsapp), ''),
    nullif(trim(p_whatsapp), '')
  )
  returning id into v_tenant;

  insert into public.profiles (user_id, tenant_id, role, name)
  values (v_user, v_tenant, 'owner', coalesce(nullif(trim(p_owner_name), ''), split_part(v_user_email, '@', 1)))
  on conflict (user_id, tenant_id) do nothing;

  -- Horários padrão: seg-sex 09-19 (pausa 12-13), sáb 09-15, dom fechado
  insert into public.business_hours (tenant_id, weekday, start_time, end_time, break_start, break_end, closed)
  values
    (v_tenant, 1, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant, 2, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant, 3, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant, 4, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant, 5, '09:00', '19:00', '12:00', '13:00', false),
    (v_tenant, 6, '09:00', '15:00', null, null, false),
    (v_tenant, 0, '09:00', '19:00', null, null, true);

  -- Serviços de exemplo por categoria
  with s(name, duration, price, color, ord) as (
    values
      case p_category
        when 'barbearia' then ('Corte Masculino', 40, 4000, '#6366f1', 0)::text[]
        when 'salao' then ('Corte Feminino', 60, 8000, '#ec4899', 0)::text[]
        when 'estetica' then ('Limpeza de Pele', 60, 12000, '#10b981', 0)::text[]
        when 'academia' then ('Aula Experimental', 60, 0, '#f97316', 0)::text[]
        when 'clinica' then ('Consulta', 30, 15000, '#0ea5e9', 0)::text[]
        when 'petshop' then ('Banho e Tosa', 60, 7000, '#84cc16', 0)::text[]
        when 'spa' then ('Massagem Relaxante', 60, 15000, '#14b8a6', 0)::text[]
        when 'oficina' then ('Revisão', 60, 12000, '#64748b', 0)::text[]
        when 'consultorio' then ('Consulta', 30, 20000, '#6366f1', 0)::text[]
        else ('Atendimento', 30, 5000, '#6366f1', 0)::text[]
      end,
      case p_category
        when 'barbearia' then ('Barba', 30, 2500, '#8b5cf6', 1)::text[]
        when 'salao' then ('Escova', 40, 5000, '#f97316', 1)::text[]
        when 'estetica' then ('Massagem Modeladora', 50, 14000, '#14b8a6', 1)::text[]
        when 'academia' then ('Avaliação Física', 30, 8000, '#0ea5e9', 1)::text[]
        when 'clinica' then ('Retorno', 20, 8000, '#64748b', 1)::text[]
        when 'petshop' then ('Consulta Veterinária', 30, 12000, '#0ea5e9', 1)::text[]
        when 'spa' then ('Drenagem Linfática', 50, 12000, '#10b981', 1)::text[]
        when 'oficina' then ('Troca de Óleo', 30, 9000, '#f59e0b', 1)::text[]
        when 'consultorio' then ('Avaliação', 40, 25000, '#10b981', 1)::text[]
        else ('Retorno', 20, 3000, '#8b5cf6', 1)::text[]
      end,
      case p_category
        when 'barbearia' then ('Corte + Barba', 60, 6500, '#10b981', 2)::text[]
        when 'salao' then ('Coloração', 120, 18000, '#6366f1', 2)::text[]
        when 'estetica' then ('Peeling', 60, 20000, '#0ea5e9', 2)::text[]
        when 'academia' then ('Personal Trainer', 60, 10000, '#ec4899', 2)::text[]
        when 'clinica' then ('Exame', 40, 25000, '#14b8a6', 2)::text[]
        when 'petshop' then ('Tosa Higiênica', 40, 5000, '#f97316', 2)::text[]
        when 'spa' then ('Day Spa', 120, 30000, '#8b5cf6', 2)::text[]
        when 'oficina' then ('Alinhamento', 60, 15000, '#0ea5e9', 2)::text[]
        when 'consultorio' then ('Procedimento', 60, 40000, '#f97316', 2)::text[]
        else ('Atendimento Completo', 60, 10000, '#10b981', 2)::text[]
      end
  )
  insert into public.services (tenant_id, name, duration_min, price_cents, color, sort_order)
  select v_tenant, name, duration::int, price::int, color, ord::int from s;

  -- Assinatura: 7 dias de teste grátis
  insert into public.subscriptions (tenant_id, status, trial_ends_at, current_period_end)
  values (v_tenant, 'trialing', now() + interval '7 days', now() + interval '7 days')
  on conflict (tenant_id) do nothing;

  return query select v_tenant, v_slug;
end;
$$;

grant execute on function public.create_establishment(text, text, text, text, text) to authenticated;

comment on function public.create_establishment(text, text, text, text, text) is
  'Cria o estabelecimento do usuário logado com horários, serviços de exemplo e trial de 7 dias.';

-- ============================================================
-- COMPLETAR depois de rodar: cadastre seu e-mail de dono do KalBix
-- insert into public.app_admins (email) values ('seu-email@exemplo.com');
-- ============================================================
