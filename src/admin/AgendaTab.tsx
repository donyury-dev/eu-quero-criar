import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Check, Ban, UserX, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Appointment, Professional, Service, Tenant, ProfessionalService, BusinessHour } from '../lib/types';
import { computeSlots } from '../lib/slots';
import { addDays, fmtDateBR, fmtMoney, fmtTime, timeToMinutes, minutesToTime, nowMinutes, todayStr, weekdayOf } from '../lib/utils';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'bg-sky-100 text-sky-700' },
  completed: { label: 'Concluído', cls: 'bg-emerald-100 text-emerald-700' },
  cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-400 line-through' },
  no_show: { label: 'Faltou', cls: 'bg-rose-100 text-rose-600' },
};

export default function AgendaTab({ tenant }: { tenant: Tenant }) {
  const [date, setDate] = useState(todayStr());
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [profServices, setProfServices] = useState<ProfessionalService[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, s, ps, h, a] = await Promise.all([
      supabase.from('professionals').select('*').eq('tenant_id', tenant.id).eq('active', true).order('sort_order'),
      supabase.from('services').select('*').eq('tenant_id', tenant.id).order('sort_order'),
      supabase.from('professional_services').select('*').eq('tenant_id', tenant.id),
      supabase.from('business_hours').select('*').eq('tenant_id', tenant.id),
      supabase
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .eq('appointment_date', date)
        .order('start_time'),
    ]);
    setProfessionals(p.data ?? []);
    setServices(s.data ?? []);
    setProfServices(ps.data ?? []);
    setHours(h.data ?? []);
    setAppointments(a.data ?? []);
    setLoading(false);
  }, [tenant.id, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(appt: Appointment, status: Appointment['status']) {
    setAppointments((prev) => prev.map((a) => (a.id === appt.id ? { ...a, status } : a)));
    await supabase.from('appointments').update({ status }).eq('id', appt.id);
  }

  const active = appointments.filter((a) => a.status !== 'cancelled');
  const revenue = active.filter((a) => a.status === 'completed').reduce((s, a) => s + a.price_cents, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 justify-between mb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setDate(addDays(date, -1))} className="card p-2 hover:border-slate-400">
            <ChevronLeft size={16} />
          </button>
          <span className="font-bold text-sm px-2 min-w-32 text-center">
            {date === todayStr() ? 'Hoje' : fmtDateBR(date, true)} <span className="text-slate-400 font-normal">· {fmtDateBR(date).slice(0, 5)}</span>
          </span>
          <button onClick={() => setDate(addDays(date, 1))} className="card p-2 hover:border-slate-400">
            <ChevronRight size={16} />
          </button>
          {date !== todayStr() && (
            <button onClick={() => setDate(todayStr())} className="text-xs text-slate-500 underline underline-offset-2 ml-1">
              Hoje
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {active.length} atendimentos · <b className="text-emerald-600">{fmtMoney(revenue)}</b>
          </span>
          <button onClick={() => setShowNew(true)} className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5">
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : professionals.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="font-semibold text-slate-700">Nenhum profissional cadastrado</p>
          <p className="text-sm text-slate-500 mt-1">
            A agenda é organizada por profissional. Cadastre você mesmo (ou sua equipe) na aba <b>Equipe</b> para começar a receber agendamentos.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {professionals.map((p) => {
            const list = appointments.filter((a) => a.professional_id === p.id);
            return (
              <section key={p.id} className="card overflow-hidden">
                <header className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{p.name}</p>
                    <p className="text-[11px] text-slate-400">{p.specialty}</p>
                  </div>
                  <span className="text-[11px] text-slate-400">{list.filter((a) => a.status !== 'cancelled').length} agend.</span>
                </header>
                <div className="p-3 space-y-2 min-h-24">
                  {list.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Agenda livre neste dia.</p>}
                  {list.map((a) => {
                    const svc = services.find((s) => s.id === a.service_id);
                    const meta = STATUS_META[a.status];
                    const past = a.appointment_date < todayStr() || (a.appointment_date === todayStr() && timeToMinutes(a.end_time) <= nowMinutes());
                    return (
                      <div key={a.id} className={`rounded-xl border border-slate-100 p-3 ${a.status === 'cancelled' ? 'opacity-60' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold" style={{ color: svc?.color }}>
                            {fmtTime(a.start_time)}–{fmtTime(a.end_time)}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <p className="text-sm font-semibold mt-1">{a.customer_name}</p>
                        <p className="text-[11px] text-slate-500">
                          {svc?.name} · {fmtMoney(a.price_cents)}
                          {a.customer_phone ? <span className="text-slate-400"> · {a.customer_phone}</span> : null}
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          {a.status === 'confirmed' && (
                            <>
                              <button
                                onClick={() => setStatus(a, 'completed')}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center gap-1"
                              >
                                <Check size={11} /> Concluir
                              </button>
                              <button
                                onClick={() => setStatus(a, 'no_show')}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center gap-1"
                              >
                                <UserX size={11} /> Faltou
                              </button>
                              <button
                                onClick={() => setStatus(a, 'cancelled')}
                                className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-1"
                              >
                                <Ban size={11} /> Cancelar
                              </button>
                            </>
                          )}
                          {(a.status === 'no_show' || a.status === 'cancelled' || (a.status === 'completed' && !past)) && (
                            <button
                              onClick={() => setStatus(a, 'confirmed')}
                              className="text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center gap-1"
                            >
                              <RotateCcw size={11} /> Reabrir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewAppointmentModal
          tenantId={tenant.id}
          date={date}
          professionals={professionals}
          services={services.filter((s) => s.active)}
          profServices={profServices}
          hours={hours}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewAppointmentModal({
  tenantId,
  date: initialDate,
  professionals,
  services,
  profServices,
  hours,
  onClose,
  onCreated,
}: {
  tenantId: string;
  date: string;
  professionals: Professional[];
  services: Service[];
  profServices: ProfessionalService[];
  hours: BusinessHour[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [serviceId, setServiceId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const allowedPros = professionalId
    ? professionals.filter((p) => p.id === professionalId)
    : service
      ? professionals.filter((p) => profServices.some((ps) => ps.professional_id === p.id && ps.service_id === service.id))
      : [];

  useEffect(() => {
    if (!service) return setSlots([]);
    let pid = professionalId;
    if (!pid && allowedPros.length === 1) pid = allowedPros[0].id;
    if (!pid) return setSlots([]);
    (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('start_time,end_time')
        .eq('tenant_id', tenantId)
        .eq('professional_id', pid)
        .eq('appointment_date', date)
        .in('status', ['confirmed', 'completed']);
      setSlots(
        computeSlots({
          hours,
          professionalId: pid,
          weekday: weekdayOf(date),
          dateStr: date,
          durationMin: service.duration_min,
          busy: (data ?? []).map((d) => ({ start_time: d.start_time, end_time: d.end_time })),
        })
      );
    })();
  }, [service, professionalId, date, tenantId, hours, allowedPros.length]);

  async function save() {
    if (!service) return setError('Escolha um serviço.');
    if (!professionalId) return setError('Escolha um profissional.');
    if (!time) return setError('Escolha um horário.');
    if (name.trim().length < 3) return setError('Informe o nome do cliente.');
    setSaving(true);
    setError(null);
    try {
      const end = new Date(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
      end.setMinutes(end.getMinutes() + service.duration_min);
      const digits = phone.replace(/\D/g, '');
      let customerId: string | null = null;
      if (digits.length >= 10) {
        const existing = await supabase
          .from('customers')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('phone', phone.trim())
          .maybeSingle();
        if (existing.data) customerId = existing.data.id;
        else {
          const ins = await supabase
            .from('customers')
            .insert({ tenant_id: tenantId, name: name.trim(), phone: phone.trim() })
            .select('id')
            .single();
          customerId = ins.data?.id ?? null;
        }
      }
      const { error: err } = await supabase.from('appointments').insert({
        tenant_id: tenantId,
        professional_id: professionalId,
        service_id: service.id,
        customer_id: customerId,
        customer_name: name.trim(),
        customer_phone: phone.trim() || null,
        appointment_date: date,
        start_time: time,
        end_time: minutesToTime(timeToMinutes(time) + service.duration_min),
        price_cents: service.price_cents,
        status: 'confirmed',
      });
      if (err) throw err;
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Novo agendamento</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Serviço</span>
            <select className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">Selecione…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.duration_min} min · {fmtMoney(s.price_cents)})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Profissional</span>
            <select className="input" value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">{service ? 'Selecione…' : 'Escolha o serviço primeiro'}</option>
              {allowedPros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Data</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          {slots.length > 0 && (
            <div>
              <span className="text-xs font-semibold text-slate-600 block mb-1">Horário</span>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {slots.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition ${
                      t === time ? 'brand-accent border-transparent' : 'hover:border-slate-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {service && professionalId && slots.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5">
              Nenhum horário livre neste dia para o profissional selecionado.
            </p>
          )}
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Nome do cliente</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">WhatsApp (opcional)</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </label>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button onClick={save} disabled={saving} className="btn-accent w-full py-2.5 text-sm">
            {saving ? 'Salvando…' : 'Salvar agendamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
