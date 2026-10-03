import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, TrendingUp, CalendarClock, Receipt, HandCoins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Appointment, Professional, Service, Tenant } from '../lib/types';
import { fmtMoney, monthLabel, todayStr } from '../lib/utils';

export default function FinanceTab({ tenant }: { tenant: Tenant }) {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      supabase
        .from('appointments')
        .select('*')
        .eq('tenant_id', tenant.id)
        .gte('appointment_date', `${month}-01`)
        .lte('appointment_date', `${month}-31`),
      supabase.from('professionals').select('*').eq('tenant_id', tenant.id),
      supabase.from('services').select('*').eq('tenant_id', tenant.id),
    ]).then(([a, p, s]) => {
      setAppointments(a.data ?? []);
      setProfessionals(p.data ?? []);
      setServices(s.data ?? []);
      setLoading(false);
    });
  }, [tenant.id, month]);

  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const stats = useMemo(() => {
    const done = appointments.filter((a) => a.status === 'completed');
    const confirmed = appointments.filter((a) => a.status === 'confirmed');
    const revenue = done.reduce((s, a) => s + a.price_cents, 0);
    const forecast = confirmed.reduce((s, a) => s + a.price_cents, 0);
    const ticket = done.length ? Math.round(revenue / done.length) : 0;
    const commissions = professionals
      .map((p) => {
        const mine = done.filter((a) => a.professional_id === p.id);
        return {
          pro: p,
          count: mine.length,
          total: mine.reduce((s, a) => s + a.price_cents, 0),
          commission: Math.round(mine.reduce((s, a) => s + a.price_cents, 0) * (p.commission_pct / 100)),
        };
      })
      .sort((a, b) => b.total - a.total);
    const byDay = new Map<string, number>();
    for (const a of done) byDay.set(a.appointment_date, (byDay.get(a.appointment_date) ?? 0) + a.price_cents);
    const series = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const noShows = appointments.filter((a) => a.status === 'no_show').length;
    return { revenue, forecast, ticket, doneCount: done.length, commissions, series, noShows };
  }, [appointments, professionals]);

  const maxDay = Math.max(1, ...stats.series.map((s) => s[1]));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold">Financeiro</h2>
          <p className="text-xs text-slate-500">Faturamento e comissões calculados dos atendimentos concluídos.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => shiftMonth(-1)} className="card p-2 hover:border-slate-400">
            <ChevronLeft size={16} />
          </button>
          <span className="font-bold text-sm min-w-28 text-center">{monthLabel(month)}</span>
          <button onClick={() => shiftMonth(1)} className="card p-2 hover:border-slate-400">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {loading ? null : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Kpi icon={TrendingUp} label="Faturamento" value={fmtMoney(stats.revenue)} hint={`${stats.doneCount} atendimentos`} />
            <Kpi icon={CalendarClock} label="Previsto" value={fmtMoney(stats.forecast)} hint="agendamentos ativos" />
            <Kpi icon={Receipt} label="Ticket médio" value={fmtMoney(stats.ticket)} hint={`faltas: ${stats.noShows}`} />
            <Kpi icon={HandCoins} label="Comissões" value={fmtMoney(stats.commissions.reduce((s, c) => s + c.commission, 0))} hint="a repassar" />
          </div>

          <div className="card p-4 mb-5">
            <p className="text-xs font-semibold text-slate-500 mb-3">Faturamento por dia</p>
            {stats.series.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Sem atendimentos concluídos neste mês.</p>
            ) : (
              <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
                {stats.series.map(([day, v]) => (
                  <div key={day} className="flex flex-col items-center gap-1 min-w-6 flex-1" title={`${day}: ${fmtMoney(v)}`}>
                    <div
                      className="w-full rounded-t-md brand-accent transition-all"
                      style={{ height: `${Math.max(4, (v / maxDay) * 100)}%` }}
                    />
                    <span className="text-[9px] text-slate-400">{day.slice(8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Profissional</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Atend.</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Produção</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Comissão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.commissions.map((c) => (
                  <tr key={c.pro.id}>
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{c.pro.name}</p>
                      <p className="text-[11px] text-slate-400">{c.pro.commission_pct}% de comissão</p>
                    </td>
                    <td className="px-4 py-2.5 text-center">{c.count}</td>
                    <td className="px-4 py-2.5 text-right">{fmtMoney(c.total)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{fmtMoney(c.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string; hint: string }) {
  return (
    <div className="card p-4">
      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <Icon size={13} /> {label}
      </p>
      <p className="text-lg font-bold mt-1">{value}</p>
      <p className="text-[10px] text-slate-400">{hint}</p>
    </div>
  );
}
