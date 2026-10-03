-- anon needs SELECT to read slot availability and to use return=representation
-- on booking inserts (demo scope; production would expose slots via RPC).
grant select on public.appointments, public.customers to anon;
