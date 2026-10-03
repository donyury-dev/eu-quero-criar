import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Scissors,
  Clock,
  MapPin,
  Calendar,
  ChevronLeft,
  Check,
  BadgeCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BusinessHour, Professional, Service, Tenant, Appointment, ProfessionalService } from '../lib/types';
import { WEEKDAYS_SHORT, CATEGORY_LABELS } from '../lib/types';
import { computeSlots } from '../lib/slots';
import { addDays, fmtDateBR, fmtMoney, fmtTime, todayStr, weekdayOf } from '../lib/utils';

type Step = 'service' | 'professional' | 'time' | 'details' | 'done';

const CATEGORY_ICONS: Record<string, string> = { barbearia: '💈', salao: '💇', estetica: '🧖' };

function iosBannerText() {
  return '📱 Instale o app: toque em Compartilhar e depois em "Adicionar à Tela de Início".';
}

export default function Booking() {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [profServices, setProfServices] = useState<ProfessionalService[]>([]);
  const [hours, setHours] = useState<BusinessHour[]>([]);

  const [step, setStep] = useState<Step>('service');
  const [service, setService] = useState<Service | null>(null);
  const [professional, setProfessional] = useState<Professional | null>(null);
  const [date, setDate] = useState(todayStr());
  const [slots, setSlots] = useState<string[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [showIos, setShowIos] = useState(
    /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { standalone?: boolean }).standalone
  );

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('tenants')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => (data ? setTenant(data) : setNotFound(true)));
  }, [slug]);

  useEffect(() => {
    if (!tenant) return;
    const tid = tenant.id;
    Promise.all([
      supabase.from('services').select('*').eq('tenant_id', tid).eq('active', true).order('sort_order'),
      supabase.from('professionals').select('*').eq('tenant_id', tid).eq('active', true).order('sort_order'),
      supabase.from('professional_services').select('*').eq('tenant_id', tid),
      supabase.from('business_hours').select('*').eq('tenant_id', tid),
    ]).then(([s, p, ps, h]) => {
      setServices(s.data ?? []);
      setProfessionals(p.data ?? []);
      setProfServices(ps.data ?? []);
      setHours(h.data ?? []);
    });
  }, [tenant]);

  const loadSlots = useCallback(async () => {
    if (!tenant || !service || !professional) return;
    setSlotLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('start_time,end_time')
      .eq('tenant_id', tenant.id)
      .eq('professional_id', professional.id)
      .eq('appointment_date', date)
      .in('status', ['confirmed', 'completed']);
    const busy = (data ?? []).map((d) => ({ start_time: d.start_time, end_time: d.end_time }));
    setSlots(
      computeSlots({
        hours,
        professionalId: professional.id,
        weekday: weekdayOf(date),
        dateStr: date,
        durationMin: service.duration_min,
        busy,
      })
    );
    setSlotLoading(false);
  }, [tenant, service, professional, date, hours]);

  useEffect(() => {
    if (step === 'time') setTime(null);
    if (step === 'time') loadSlots();
  }, [step, date, loadSlots]);

  const dateStrip = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(todayStr(), i)), []);

  async function submit() {
    if (!tenant || !service || !professional || !time) return;
    if (name.trim().length < 3) return setError('Informe seu nome completo.');
    if (phone.replace(/\D/g, '').length < 10) return setError('Informe um WhatsApp válido com DDD.');
    setSubmitting(true);
    setError(null);
    try {
      const digits = phone.replace(/\D/g, '');
      let customerId: string | null = null;
      const existing = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('phone', phone.trim())
        .maybeSingle();
      if (existing.data) customerId = existing.data.id;
      else {
        const ins = await supabase
          .from('customers')
          .insert({ tenant_id: tenant.id, name: name.trim(), phone: phone.trim() })
          .select('id')
          .single();
        customerId = ins.data?.id ?? null;
      }
      const end = new Date(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3, 5)));
      end.setMinutes(end.getMinutes() + service.duration_min);
      const endTime = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
      const { data, error: err } = await supabase
        .from('appointments')
        .insert({
          tenant_id: tenant.id,
          professional_id: professional.id,
          service_id: service.id,
          customer_id: customerId,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          appointment_date: date,
          start_time: time,
          end_time: endTime,
          price_cents: service.price_cents,
          status: 'confirmed',
        })
        .select('*')
        .single();
      if (err) throw err;
      setBooked(data);
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao agendar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBooking() {
    if (!booked) return;
    if (!confirm('Cancelar este agendamento?')) return;
    const { error: err } = await supabase.rpc('cancel_appointment', {
      p_appointment_id: booked.id,
      p_phone: booked.customer_phone ?? '',
    });
    if (err) alert('Não foi possível cancelar: ' + err.message);
    else setCancelled(true);
  }

  if (notFound)
    return (
      <Shell>
        <div className="card p-8 text-center max-w-md mx-auto mt-20">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-xl font-bold mb-1">Estabelecimento não encontrado</h1>
          <p className="text-slate-500 text-sm">Confira o link ou escolha outro lugar para agendar.</p>
          <Link to="/explorar" className="btn-accent inline-block mt-4 px-5 py-2.5 text-sm">
            Explorar estabelecimentos
          </Link>
        </div>
      </Shell>
    );

  if (!tenant)
    return (
      <Shell>
        <div className="max-w-md mx-auto mt-24 animate-pulse text-center text-slate-400 text-sm">Carregando…</div>
      </Shell>
    );

  const allowedPros = service
    ? professionals.filter((p) => profServices.some((ps) => ps.professional_id === p.id && ps.service_id === service.id))
    : [];

  const openHours = hours
    .filter((h) => h.professional_id === null)
    .sort((a, b) => a.weekday - b.weekday)
    .filter((h, i, arr) => arr.findIndex((x) => x.weekday === h.weekday) === i);

  return (
    <div style={{ ['--brand' as string]: tenant.primary_color, ['--accent' as string]: tenant.secondary_color }}>
      {/* Header */}
      <header className="brand-bg text-white">
        <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg"
                style={{ background: tenant.secondary_color, color: tenant.primary_color }}
              >
                {tenant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{tenant.name}</h1>
              <p className="text-white/70 text-sm flex items-center gap-1.5 mt-0.5">
                <span>{CATEGORY_ICONS[tenant.category] ?? '✂️'}</span>
                {CATEGORY_LABELS[tenant.category] ?? tenant.category}
                {tenant.city ? <span className="truncate">· {tenant.city}</span> : null}
              </p>
            </div>
          </div>
          {tenant.description && <p className="text-white/80 text-sm mt-4 leading-relaxed">{tenant.description}</p>}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-white/70">
            {tenant.address && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {tenant.address}
              </span>
            )}
            {tenant.phone && (
              <span className="flex items-center gap-1">
                <Clock size={13} /> {tenant.phone}
              </span>
            )}
          </div>
        </div>
      </header>

      {showIos && (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center justify-between gap-3">
          <span>{iosBannerText()}</span>
          <button onClick={() => setShowIos(false)} className="shrink-0 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Hours summary */}
      <div className="max-w-2xl mx-auto px-4 -mt-4">
        <div className="card px-4 py-3 text-xs text-slate-600 flex gap-2 overflow-x-auto">
          {openHours.map((h) => (
            <span key={h.id} className="whitespace-nowrap">
              <b>{WEEKDAYS_SHORT[h.weekday]}</b>{' '}
              {h.closed ? (
                <span className="text-rose-500">Fechado</span>
              ) : (
                `${fmtTime(h.start_time)}–${fmtTime(h.end_time)}`
              )}
            </span>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {step !== 'done' && (
          <div className="flex items-center gap-2 mb-5 text-xs font-medium text-slate-500">
            {(['service', 'professional', 'time', 'details'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold ${
                    step === s ? 'brand-accent text-slate-900' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {i + 1}
                </span>
                {i < 3 && <span className="w-4 h-px bg-slate-300" />}
              </div>
            ))}
          </div>
        )}

        {step === 'service' && (
          <>
            <h2 className="font-bold text-lg mb-1">Escolha um serviço</h2>
            <p className="text-sm text-slate-500 mb-4">Agende online, sem ligação e sem esperar.</p>
            <div className="grid gap-3">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setService(s);
                    setStep('professional');
                  }}
                  className="card p-4 flex items-center gap-4 text-left hover:border-slate-400 transition"
                >
                  <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: s.color + '22', color: s.color }}>
                    <Scissors size={18} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="font-semibold block">{s.name}</span>
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock size={12} /> {s.duration_min} min
                    </span>
                  </span>
                  <span className="font-bold" style={{ color: tenant.secondary_color }}>
                    {fmtMoney(s.price_cents)}
                  </span>
                </button>
              ))}
              {services.length === 0 && (
                <div className="card p-6 text-center text-sm text-slate-500">
                  Catálogo em breve. Este estabelecimento ainda está configurando os serviços.
                </div>
              )}
            </div>
          </>
        )}

        {step === 'professional' && (
          <>
            <h2 className="font-bold text-lg mb-1">Com qual profissional?</h2>
            <p className="text-sm text-slate-500 mb-4">Serviço: {service?.name}</p>
            <div className="grid gap-3">
              {allowedPros.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setProfessional(p);
                    setStep('time');
                  }}
                  className="card p-4 flex items-center gap-4 text-left hover:border-slate-400 transition"
                >
                  <span className="w-11 h-11 rounded-full brand-accent grid place-items-center font-bold text-slate-900 shrink-0">
                    {p.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold block">{p.name}</span>
                    <span className="text-xs text-slate-500">{p.specialty}</span>
                  </span>
                </button>
              ))}
            </div>
            <BackButton onClick={() => setStep('service')} />
          </>
        )}

        {step === 'time' && (
          <>
            <h2 className="font-bold text-lg mb-1">Quando você quer vir?</h2>
            <p className="text-sm text-slate-500 mb-4">
              {service?.name} com {professional?.name}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
              {dateStrip.map((d) => {
                const wd = weekdayOf(d);
                const closed = hoursForClosed(hours, wd);
                return (
                  <button
                    key={d}
                    disabled={closed}
                    onClick={() => setDate(d)}
                    className={`shrink-0 w-14 py-2 rounded-xl text-center border transition ${
                      d === date ? 'brand-accent border-transparent text-slate-900 font-bold' : 'card hover:border-slate-400'
                    } ${closed ? 'opacity-30' : ''}`}
                  >
                    <span className="block text-[10px] uppercase">{WEEKDAYS_SHORT[wd]}</span>
                    <span className="block text-sm font-bold">{d.slice(8)}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4">
              {slotLoading ? (
                <div className="text-sm text-slate-400 animate-pulse py-6 text-center">Buscando horários…</div>
              ) : slots.length === 0 ? (
                <div className="card p-6 text-center text-sm text-slate-500">
                  Sem horários disponíveis neste dia. Escolha outra data.
                </div>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {slots.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTime(t);
                        setStep('details');
                      }}
                      className={`py-2 rounded-xl text-sm font-semibold border transition ${
                        t === time ? 'brand-accent border-transparent' : 'card hover:border-slate-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <BackButton onClick={() => setStep('professional')} />
          </>
        )}

        {step === 'details' && (
          <>
            <h2 className="font-bold text-lg mb-1">Seus dados</h2>
            <p className="text-sm text-slate-500 mb-4">
              {service?.name} · {professional?.name} · {fmtDateBR(date)} às {time}
            </p>
            <div className="card p-4 grid gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 block mb-1">Nome completo</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 block mb-1">WhatsApp</span>
                <input
                  className="input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 91234-5678"
                  inputMode="tel"
                />
              </label>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-sm text-slate-500">Total</span>
                <span className="font-bold text-lg" style={{ color: tenant.secondary_color }}>
                  {fmtMoney(service?.price_cents ?? 0)}
                </span>
              </div>
              {error && <p className="text-sm text-rose-600">{error}</p>}
              <button onClick={submit} disabled={submitting} className="btn-accent py-3">
                {submitting ? 'Confirmando…' : 'Confirmar agendamento'}
              </button>
            </div>
            <BackButton onClick={() => setStep('time')} />
          </>
        )}

        {step === 'done' && booked && (
          <div className="card p-6 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full brand-accent grid place-items-center mx-auto mb-4">
              <Check size={32} className="text-slate-900" strokeWidth={3} />
            </div>
            <h2 className="font-bold text-xl">{cancelled ? 'Agendamento cancelado' : 'Agendamento confirmado!'}</h2>
            {!cancelled && (
              <>
                <p className="text-sm text-slate-500 mt-1">
                  Até logo, {booked.customer_name.split(' ')[0]}! Chegue com alguns minutos de antecedência.
                </p>
                <div className="mt-5 text-left bg-slate-50 rounded-xl p-4 text-sm space-y-1.5">
                  <p>
                    <b>Serviço:</b> {service?.name}
                  </p>
                  <p>
                    <b>Profissional:</b> {professional?.name}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar size={14} /> {fmtDateBR(booked.appointment_date)} às {fmtTime(booked.start_time)}
                  </p>
                  <p>
                    <b>Valor:</b> {fmtMoney(booked.price_cents)}
                  </p>
                </div>
                <button onClick={cancelBooking} className="mt-4 text-xs text-rose-600 underline underline-offset-2">
                  Precisei cancelar este agendamento
                </button>
              </>
            )}
            <button
              onClick={() => {
                setStep('service');
                setService(null);
                setProfessional(null);
                setBooked(null);
                setCancelled(false);
                setName('');
                setPhone('');
              }}
              className="btn-accent mt-4 px-6 py-2.5 text-sm w-full"
            >
              Fazer novo agendamento
            </button>
          </div>
        )}
      </main>

      <footer className="max-w-2xl mx-auto px-4 pb-8 text-center text-[11px] text-slate-400">
        <p className="flex items-center justify-center gap-1.5">
          <BadgeCheck size={13} /> Agendamento online por{' '}
          <Link to="/explorar" className="font-bold text-slate-500 hover:underline">
            AgendaPro
          </Link>
        </p>
      </footer>
    </div>
  );
}

function hoursForClosed(hours: BusinessHour[], weekday: number): boolean {
  const h = hours.find((x) => x.professional_id === null && x.weekday === weekday);
  return !h || h.closed;
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="mt-5 text-sm text-slate-500 flex items-center gap-1 hover:text-slate-800">
      <ChevronLeft size={16} /> Voltar
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="brand-bg h-2" />
      {children}
    </div>
  );
}

