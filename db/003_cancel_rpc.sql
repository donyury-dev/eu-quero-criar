-- Customer self-service cancellation (verifies phone match)
create or replace function public.cancel_appointment(p_appointment_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update public.appointments
  set status = 'cancelled'
  where id = p_appointment_id
    and status = 'confirmed'
    and appointment_date >= current_date
    and lower(replace(coalesce(customer_phone, ''), ' ', '')) = lower(replace(coalesce(p_phone, ''), ' ', ''));
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Agendamento não encontrado para este telefone.';
  end if;
end;
$$;

grant execute on function public.cancel_appointment(uuid, text) to anon, authenticated;
