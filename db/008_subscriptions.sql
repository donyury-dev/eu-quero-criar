-- 008: Assinaturas (Mercado Pago) — políticas e status do trial
-- A tabela é criada em 007, antes da função de cadastro.

alter table public.subscriptions enable row level security;

create policy "owner read own subscription" on public.subscriptions for select
  using (public.is_owner(tenant_id));
create policy "superadmin read subscriptions" on public.subscriptions for select
  using (public.is_superadmin());
create policy "superadmin update subscriptions" on public.subscriptions for update
  using (public.is_superadmin()) with check (public.is_superadmin());

grant select, update on public.subscriptions to authenticated;
-- A Edge Function (webhook do Mercado Pago) atualiza via service_role, que ignora RLS.

create or replace function public.effective_subscription_status(s public.subscriptions)
returns text
language sql
stable
as $$
  select case
    when s.status = 'trialing' and s.trial_ends_at < now() then 'past_due'
    else s.status
  end;
$$;

create or replace function public.is_subscription_active(p_tenant uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.tenant_id = p_tenant
      and public.effective_subscription_status(s) in ('trialing','active')
  )
  or public.is_superadmin();
$$;

comment on function public.is_subscription_active(uuid) is
  'Trial vencido ou assinatura inadimplente/cancelada retornam false (painel bloqueado).';
