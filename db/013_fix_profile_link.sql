-- 013: Corrige o vínculo usuário ↔ estabelecimento (perfil) que não era gravado
-- pelo create_establishment, e libera o próprio site para gravar esse vínculo.
-- Rodar no SQL Editor do Supabase.

-- 1) Permite que o usuário logado grave o próprio perfil como 'owner'
--    (antes só podia apontar para o tenant da demonstração).
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (
  auth.uid() = user_id and role = 'owner'
);

-- 2) Repara o vínculo de contas que já criaram estabelecimento mas ficaram sem perfil
--    (associa cada usuário da kalbixagenda.app ao estabelecimento criado hoje por ele).
insert into public.profiles (user_id, tenant_id, role, name)
select u.id, t.id, 'owner', initcap(split_part(u.email, '@', 1))
from auth.users u
join public.tenants t on t.created_at::date = current_date
where u.email like '%@kalbixagenda.app'
  and t.slug in ('barbearia', 'teste-verdent')
  and not exists (
    select 1 from public.profiles p
    where p.user_id = u.id and p.tenant_id = t.id
  )
on conflict do nothing;

-- 3) Remove o estabelecimento de teste criado durante diagnóstico.
delete from public.tenants where slug = 'teste-verdent';
delete from auth.users where email = 'teste.verdent@kalbixagenda.app';
