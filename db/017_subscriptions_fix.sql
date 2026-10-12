-- 017: Correções de assinatura
-- 1) Garante as políticas RLS da tabela subscriptions (SQL 008 pode não ter rodado).
-- 2) Coluna plan (mensal/trimestral/anual) para os novos planos.
-- 3) Backfill: todo estabelecimento sem linha de assinatura ganha trial
--    de 7 dias a partir da data de criação (corrige o "Cancelada" indevido).

-- 1) Políticas RLS
alter table public.subscriptions enable row level security;

drop policy if exists "owner read own subscription" on public.subscriptions;
create policy "owner read own subscription" on public.subscriptions for select
  using (public.is_owner(tenant_id));

drop policy if exists "superadmin read subscriptions" on public.subscriptions;
create policy "superadmin read subscriptions" on public.subscriptions for select
  using (public.is_superadmin());

drop policy if exists "superadmin update subscriptions" on public.subscriptions;
create policy "superadmin update subscriptions" on public.subscriptions for update
  using (public.is_superadmin()) with check (public.is_superadmin());

grant select, update on public.subscriptions to authenticated;

-- 2) Plano escolhido
alter table public.subscriptions add column if not exists plan text not null default 'monthly';

-- 3) Backfill: trial de 7 dias para quem não tem linha de assinatura
insert into public.subscriptions (tenant_id, status, trial_ends_at, current_period_end, plan)
select t.id, 'trialing', t.created_at + interval '7 days', t.created_at + interval '7 days', 'monthly'
from public.tenants t
where not exists (select 1 from public.subscriptions s where s.tenant_id = t.id);
