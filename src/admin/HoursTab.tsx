import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { BusinessHour, Professional, Tenant } from '../lib/types';
import { WEEKDAYS } from '../lib/types';

type DayRow = {
  weekday: number;
  closed: boolean;
  start_time: string;
  end_time: string;
  break_start: string;
  break_end: string;
};

const DEFAULT_ROWS: DayRow[] = Array.from({ length: 7 }, (_, wd) => ({
  weekday: wd,
  closed: wd === 0,
  start_time: '09:00',
  end_time: '19:00',
  break_start: wd === 0 || wd === 6 ? '' : '12:00',
  break_end: wd === 0 || wd === 6 ? '' : '13:00',
}));

export default function HoursTab({ tenant }: { tenant: Tenant }) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [allHours, setAllHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>('__tenant__');
  const [rows, setRows] = useState<DayRow[]>(DEFAULT_ROWS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('professionals').select('*').eq('tenant_id', tenant.id).eq('active', true).order('sort_order'),
      supabase.from('business_hours').select('*').eq('tenant_id', tenant.id),
    ]).then(([p, h]) => {
      setProfessionals(p.data ?? []);
      setAllHours(h.data ?? []);
      setLoading(false);
    });
  }, [tenant.id]);

  const current = useMemo(() => {
    return selected === '__tenant__' ? null : professionals.find((p) => p.id === selected) ?? null;
  }, [selected, professionals]);

  useEffect(() => {
    if (loading) return;
    const pid = current?.id ?? null;
    const base = allHours.filter((h) => h.professional_id === pid);
    setRows(
      DEFAULT_ROWS.map((d) => {
        const h = base.find((b) => b.weekday === d.weekday);
        if (!h) {
          if (pid) {
            // no personal row: falls back to establishment hours in the slot engine
            const est = allHours.find((x) => x.professional_id === null && x.weekday === d.weekday);
            if (est)
              return {
                weekday: d.weekday,
                closed: est.closed,
                start_time: est.start_time.slice(0, 5),
                end_time: est.end_time.slice(0, 5),
                break_start: est.break_start?.slice(0, 5) ?? '',
                break_end: est.break_end?.slice(0, 5) ?? '',
              };
          }
          return d;
        }
        return {
          weekday: d.weekday,
          closed: h.closed,
          start_time: h.start_time.slice(0, 5),
          end_time: h.end_time.slice(0, 5),
          break_start: h.break_start?.slice(0, 5) ?? '',
          break_end: h.break_end?.slice(0, 5) ?? '',
        };
      })
    );
  }, [selected, allHours, loading, current]);

  async function save() {
    setSaving(true);
    setSaved(false);
    const tid = tenant.id;
    const pid = current?.id ?? null;
    if (!pid) {
      // establishment: update existing tenant rows
      for (const r of rows) {
        const existing = allHours.find((h) => h.professional_id === null && h.weekday === r.weekday);
        const payload = {
          tenant_id: tid,
          professional_id: null,
          weekday: r.weekday,
          start_time: r.start_time || '09:00',
          end_time: r.end_time || '19:00',
          break_start: r.break_start || null,
          break_end: r.break_end || null,
          closed: r.closed,
        };
        if (existing) await supabase.from('business_hours').update(payload).eq('id', existing.id);
        else await supabase.from('business_hours').insert(payload);
      }
    } else {
      await supabase.from('business_hours').delete().eq('professional_id', pid);
      const insertRows = rows
        .filter((r) => !r.closed)
        .map((r) => ({
          tenant_id: tid,
          professional_id: pid,
          weekday: r.weekday,
          start_time: r.start_time || '09:00',
          end_time: r.end_time || '19:00',
          break_start: null,
          break_end: null,
          closed: false,
        }));
      const closedRows = rows.filter((r) => r.closed).map((r) => ({
        tenant_id: tid,
        professional_id: pid,
        weekday: r.weekday,
        start_time: '09:00',
        end_time: '19:00',
        break_start: null,
        break_end: null,
        closed: true,
      }));
      const all = [...insertRows, ...closedRows];
      if (all.length) await supabase.from('business_hours').insert(all);
    }
    const { data } = await supabase.from('business_hours').select('*').eq('tenant_id', tid);
    setAllHours(data ?? []);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading)
    return (
      <div className="grid place-items-center py-20 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div>
      <h2 className="font-bold">Horários de funcionamento</h2>
      <p className="text-xs text-slate-500 mb-4">
        Defina a base do estabelecimento e, se quiser, horários individuais por profissional.
      </p>

      <div className="flex items-center gap-2 mb-4">
        <Clock size={16} className="text-slate-400" />
        <select className="input max-w-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="__tenant__">Estabelecimento (padrão)</option>
          {professionals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.weekday} className="flex flex-wrap items-center gap-2 px-4 py-3">
            <span className="w-20 text-sm font-semibold">{WEEKDAYS[r.weekday]}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={r.closed}
                onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))}
              />
              Fechado
            </label>
            {!r.closed && (
              <>
                <input
                  type="time"
                  className="input !w-28"
                  value={r.start_time}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))}
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="time"
                  className="input !w-28"
                  value={r.end_time}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))}
                />
                <span className="text-slate-400 text-xs ml-2">almoço</span>
                <input
                  type="time"
                  className="input !w-24"
                  value={r.break_start}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, break_start: e.target.value } : x)))}
                />
                <span className="text-slate-400 text-xs">até</span>
                <input
                  type="time"
                  className="input !w-24"
                  value={r.break_end}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, break_end: e.target.value } : x)))}
                />
              </>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="btn-accent text-sm px-5 py-2.5 flex items-center gap-2">
          <Save size={15} /> {saving ? 'Salvando…' : 'Salvar horários'}
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Horários atualizados!</span>}
      </div>
      {current && (
        <p className="text-[11px] text-slate-400 mt-2">
          Dias sem horário próprio para {current.name} usam automaticamente o padrão do estabelecimento.
        </p>
      )}
    </div>
  );
}
