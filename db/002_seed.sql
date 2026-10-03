-- Seed: demo tenant "Barbearia Nova Era" + marketplace examples
-- Demo tenant has fixed id so RLS policy for self-onboarding matches.

insert into public.tenants (id, slug, name, category, description, phone, address, city, primary_color, secondary_color)
values
  ('00000000-0000-0000-0000-000000000001', 'nova-era', 'Barbearia Nova Era', 'barbearia',
   'Barbearia clássica com toque moderno. Cortes, barba e cuidado masculino.', '(11) 99999-0101',
   'Rua das Palmeiras, 120', 'São Paulo', '#0f172a', '#f59e0b'),
  ('00000000-0000-0000-0000-000000000002', 'studio-helena', 'Studio Helena', 'salao',
   'Salão de beleza completo: cabelo, unhas e estética.', '(11) 98888-0202',
   'Av. Paulista, 900', 'São Paulo', '#9d174d', '#f472b6'),
  ('00000000-0000-0000-0000-000000000003', 'clinic-vitalis', 'Clínica Vitalis', 'estetica',
   'Estética avançada e bem-estar.', '(19) 97777-0303',
   'Rua Barão de Jaguara, 500', 'Campinas', '#065f46', '#34d399')
on conflict (slug) do nothing;

insert into public.services (tenant_id, name, duration_min, price_cents, color, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Corte Masculino', 40, 4000, '#6366f1', 0),
  ('00000000-0000-0000-0000-000000000001', 'Corte + Barba', 60, 6500, '#8b5cf6', 1),
  ('00000000-0000-0000-0000-000000000001', 'Barba Terapia', 30, 3000, '#f59e0b', 2),
  ('00000000-0000-0000-0000-000000000001', 'Pezinho', 15, 1000, '#10b981', 3),
  ('00000000-0000-0000-0000-000000000001', 'Corte Infantil', 45, 4500, '#ec4899', 4)
on conflict do nothing;

insert into public.professionals (tenant_id, name, specialty, commission_pct, sort_order)
values
  ('00000000-0000-0000-0000-000000000001', 'Carlos "Tesoura" Silva', 'Barbeiro Sênior · Fade e Navalhado', 50, 0),
  ('00000000-0000-0000-0000-000000000001', 'João Mendes', 'Barbeiro · Clássicos e Barba', 40, 1),
  ('00000000-0000-0000-0000-000000000001', 'Pedro Lima', 'Barbeiro · Sobrancelha e Pezinho', 40, 2)
on conflict do nothing;

insert into public.professional_services (professional_id, service_id, tenant_id)
select p.id, s.id, s.tenant_id
from public.professionals p
join public.services s on s.tenant_id = p.tenant_id
where p.tenant_id = '00000000-0000-0000-0000-000000000001'
  and not (
    (p.name like 'Carlos%' and s.name = 'Corte Infantil')
    or (p.name like 'Pedro%' and s.name in ('Corte + Barba', 'Corte Infantil'))
  )
on conflict do nothing;

-- Establishment hours: Mon–Sat open, Sunday closed (weekdays with lunch break)
insert into public.business_hours (tenant_id, professional_id, weekday, start_time, end_time, break_start, break_end, closed)
select '00000000-0000-0000-0000-000000000001', null, w.wd,
  case when w.wd = 6 then time '08:00' else time '09:00' end,
  case when w.wd = 6 then time '18:00' else time '19:00' end,
  case when w.wd = 6 then null else time '12:00' end,
  case when w.wd = 6 then null else time '13:00' end,
  w.wd = 0
from (select generate_series(0, 6) as wd) w
where not exists (
  select 1 from public.business_hours bh
  where bh.tenant_id = '00000000-0000-0000-0000-000000000001' and bh.professional_id is null
);

-- Personal hours for two professionals (Pedro uses establishment hours)
insert into public.business_hours (tenant_id, professional_id, weekday, start_time, end_time, closed)
select p.tenant_id, p.id, w.wd,
  case when p.name like 'Carlos%' then time '09:00' else time '10:00' end,
  case when p.name like 'Carlos%' then time '18:00' else time '19:30' end,
  false
from public.professionals p, (select generate_series(1, 6) as wd) w
where p.tenant_id = '00000000-0000-0000-0000-000000000001'
  and (p.name like 'Carlos%' or p.name like 'João%')
  and not exists (
    select 1 from public.business_hours bh
    where bh.professional_id = p.id and bh.weekday = w.wd
  );

insert into public.customers (tenant_id, name, phone, notes)
values
  ('00000000-0000-0000-0000-000000000001', 'Rafael Souza', '(11) 91234-5678', 'Prefere degradê baixo'),
  ('00000000-0000-0000-0000-000000000001', 'Lucas Andrade', '(11) 92345-6789', null),
  ('00000000-0000-0000-0000-000000000001', 'Marcos Vieira', '(11) 93456-7890', 'Alergia a loção com álcool'),
  ('00000000-0000-0000-0000-000000000001', 'Tiago Ferreira', '(11) 94567-8901', null),
  ('00000000-0000-0000-0000-000000000001', 'Bruno Carvalho', '(11) 95678-9012', 'Sempre com o Carlos'),
  ('00000000-0000-0000-0000-000000000001', 'Diego Martins', '(11) 96789-0123', null)
on conflict do nothing;

-- Backfill: last 21 days of history (completed / some no-show / cancelled)
insert into public.appointments
  (tenant_id, professional_id, service_id, customer_id, customer_name, customer_phone,
   appointment_date, start_time, end_time, price_cents, status)
with profs as (
  select id, name, row_number() over (order by sort_order) - 1 as idx
  from public.professionals
  where tenant_id = '00000000-0000-0000-0000-000000000001'
),
svc as (
  select id, name, duration_min, price_cents, row_number() over (order by sort_order) - 1 as sidx
  from public.services
  where tenant_id = '00000000-0000-0000-0000-000000000001'
),
days as (
  select d::date as dt
  from generate_series(current_date - 21, current_date - 1, interval '1 day') d
  where extract(dow from d) <> 0
),
slots as (
  select p.idx,
    unnest(case p.idx
      when 0 then array['09:00','10:00','11:00','13:30','14:30','15:30','16:30']::time[]
      when 1 then array['09:30','10:30','11:30','14:00','15:00','16:00','17:00']::time[]
      else array['09:00','10:00','13:00','14:00','15:00','16:00']::time[]
    end) as st
  from profs p
),
pairs as (
  select d.dt, s.idx, s.st,
    row_number() over (partition by d.dt, s.idx order by s.st) as k,
    (extract(day from d.dt)::int + s.idx) as seed
  from days d cross join slots s
),
picked as (
  select pr.id as professional_id, pr.name as prof_name,
    case
      when pp.idx = 0 and (pp.seed % 5) = 4 then (select id from svc where sidx = 1)
      when pp.idx = 2 and (pp.seed % 5) = 4 then (select id from svc where sidx = 0)
      else (select id from svc where sidx = (pp.seed % 5))
    end as service_id,
    pp.dt, pp.st, pp.seed, pp.k
  from pairs pp join profs pr on pr.idx = pp.idx
)
select
  '00000000-0000-0000-0000-000000000001',
  pk.professional_id,
  pk.service_id,
  c.id, c.name, c.phone,
  pk.dt, pk.st,
  (pk.st + (s.duration_min || ' minutes')::interval)::time,
  s.price_cents,
  case
    when pk.seed % 11 = 0 then 'no_show'
    when pk.seed % 17 = 0 then 'cancelled'
    else 'completed'
  end
from picked pk
join svc s on s.id = pk.service_id
join lateral (
  select * from public.customers cu
  where cu.tenant_id = '00000000-0000-0000-0000-000000000001'
  order by cu.created_at
  offset ((pk.seed + pk.k) % 6) limit 1
) c on true
where not exists (
  select 1 from public.appointments a
  where a.professional_id = pk.professional_id and a.appointment_date = pk.dt and a.start_time = pk.st
);

-- Upcoming: today + next 6 days, confirmed bookings
insert into public.appointments
  (tenant_id, professional_id, service_id, customer_id, customer_name, customer_phone,
   appointment_date, start_time, end_time, price_cents, status)
with profs as (
  select id, name, row_number() over (order by sort_order) - 1 as idx
  from public.professionals
  where tenant_id = '00000000-0000-0000-0000-000000000001'
),
svc as (
  select id, name, duration_min, price_cents, row_number() over (order by sort_order) - 1 as sidx
  from public.services
  where tenant_id = '00000000-0000-0000-0000-000000000001'
),
days as (
  select d::date as dt
  from generate_series(current_date, current_date + 6, interval '1 day') d
  where extract(dow from d) <> 0
),
slots as (
  select p.idx,
    unnest(case p.idx
      when 0 then array['09:00','11:00','14:30','16:30']::time[]
      when 1 then array['10:30','14:00','16:00']::time[]
      else array['10:00','14:00','15:00']::time[]
    end) as st
  from profs p
),
pairs as (
  select d.dt, s.idx, s.st,
    row_number() over (partition by d.dt, s.idx order by s.st) as k,
    (extract(day from d.dt)::int + s.idx) as seed
  from days d cross join slots s
),
picked as (
  select pr.id as professional_id,
    case
      when pp.idx = 0 and (pp.seed % 5) = 4 then (select id from svc where sidx = 1)
      when pp.idx = 2 and (pp.seed % 5) = 4 then (select id from svc where sidx = 0)
      else (select id from svc where sidx = (pp.seed % 5))
    end as service_id,
    pp.dt, pp.st, pp.seed, pp.k
  from pairs pp join profs pr on pr.idx = pp.idx
)
select
  '00000000-0000-0000-0000-000000000001',
  pk.professional_id,
  pk.service_id,
  c.id, c.name, c.phone,
  pk.dt, pk.st,
  (pk.st + (s.duration_min || ' minutes')::interval)::time,
  s.price_cents,
  'confirmed'
from picked pk
join svc s on s.id = pk.service_id
join lateral (
  select * from public.customers cu
  where cu.tenant_id = '00000000-0000-0000-0000-000000000001'
  order by cu.created_at
  offset ((pk.seed + pk.k) % 6) limit 1
) c on true
where not exists (
  select 1 from public.appointments a
  where a.professional_id = pk.professional_id and a.appointment_date = pk.dt and a.start_time = pk.st
);
