-- 015: Corrige RLS de app_admins para que superadmin seja reconhecido pelo app
-- sem precisar de linha em profiles.
drop policy if exists "admins read own" on public.app_admins;
create policy "admins read own email" on public.app_admins
  for select
  using (email = lower(coalesce(auth.jwt()->>'email', '')));
