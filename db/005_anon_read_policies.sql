-- anon read access needed for slot calculation and INSERT ... RETURNING on booking
create policy "anon read customers" on public.customers for select using (true);
create policy "anon read appointments" on public.appointments for select using (true);
