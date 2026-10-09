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

-- Criada antes da RPC de cadastro, que insere o trial de 7 dias.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  provider text not null default 'mercopago',
  provider_sub_id text,
  plan text not null default 'mensal',
  price_cents int not null default 4990,
  status text not null default 'trialing'
    check (status in ('trialing','active','past_due','suspended','cancelled')),
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
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

  -- Usuário só pode ter um estabelecimento real (ignora o vínculo com a demonstração)
  select p.tenant_id into v_existing from public.profiles p
    where p.user_id = v_user
      and p.tenant_id is not null
      and p.tenant_id <> '00000000-0000-0000-0000-000000000001'
    limit 1;
  if v_existing is not null then
    raise exception 'Você já possui um estabelecimento vinculado à sua conta.';
  end if;

  -- Gera slug único a partir do nome
  v_base := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g');
  v_base := trim(both '-' from v_base);
  if v_base = '' or v_base is null then v_base := 'estabelecimento'; end if;
  v_slug := v_base;
  while exists (select 1 from public.tenants t where t.slug = v_slug) loop
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

  -- Serviços iniciais são sugestões editáveis pelo dono, não um catálogo fixo.
  insert into public.services (tenant_id, name, duration_min, price_cents, color, sort_order)
  values
    (v_tenant, case p_category
      when 'barbearia' then 'Corte Masculino'
      when 'salao' then 'Corte Feminino'
      when 'estetica' then 'Limpeza de Pele'
      when 'academia' then 'Aula Experimental'
      when 'clinica' then 'Consulta'
      when 'petshop' then 'Banho e Tosa'
      when 'spa' then 'Massagem Relaxante'
      when 'oficina' then 'Revisão'
      when 'consultorio' then 'Consulta'
      else 'Atendimento' end, 40, 5000, '#6366f1', 0),
    (v_tenant, case p_category
      when 'barbearia' then 'Barba'
      when 'salao' then 'Escova'
      when 'estetica' then 'Massagem Modeladora'
      when 'academia' then 'Avaliação Física'
      when 'petshop' then 'Tosa Higiênica'
      when 'spa' then 'Drenagem Linfática'
      when 'oficina' then 'Troca de Óleo'
      else 'Retorno' end, 30, 3500, '#8b5cf6', 1),
    (v_tenant, case p_category
      when 'barbearia' then 'Corte + Barba'
      when 'salao' then 'Coloração'
      when 'academia' then 'Personal Trainer'
      when 'spa' then 'Day Spa'
      else 'Atendimento Completo' end, 60, 8000, '#10b981', 2);

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
