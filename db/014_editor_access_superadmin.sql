-- O dono da plataforma controla o acesso ao editor dos clientes.
drop policy if exists "editor_access read" on public.editor_access;
create policy "editor_access read"
  on public.editor_access for select
  using (
    auth.role() = 'anon'
    or exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          p.tenant_id = editor_access.tenant_id
          or p.role = 'superadmin'
        )
    )
  );

drop policy if exists "editor_access write" on public.editor_access;
create policy "editor_access write"
  on public.editor_access for all
  using (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          (
            p.tenant_id = editor_access.tenant_id
            and p.role in ('owner', 'admin')
          )
          or p.role = 'superadmin'
        )
    )
  )
  with check (
    exists (
      select 1
      from public.profiles p
      where p.user_id = auth.uid()
        and (
          (
            p.tenant_id = editor_access.tenant_id
            and p.role in ('owner', 'admin')
          )
          or p.role = 'superadmin'
        )
    )
  );