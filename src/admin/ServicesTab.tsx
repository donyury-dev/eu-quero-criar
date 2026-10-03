import { useEffect, useState } from 'react';
import { Plus, Pencil, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Service, Tenant } from '../lib/types';
import { fmtMoney } from '../lib/utils';

const COLORS = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#ef4444', '#0ea5e9', '#84cc16'];

export default function ServicesTab({ tenant }: { tenant: Tenant }) {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Service> | null>(null);

  useEffect(() => {
    supabase
      .from('services')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('sort_order')
      .then(({ data }) => {
        setServices(data ?? []);
        setLoading(false);
      });
  }, [tenant.id]);

  async function save() {
    if (!editing) return;
    const payload = {
      tenant_id: tenant.id,
      name: editing.name?.trim(),
      duration_min: Number(editing.duration_min) || 30,
      price_cents: Math.round(Number(editing.price_cents ?? 0) * 100),
      color: editing.color ?? COLORS[0],
      active: editing.active ?? true,
      sort_order: editing.sort_order ?? services.length,
    };
    if (!payload.name) return;
    if (editing.id) await supabase.from('services').update(payload).eq('id', editing.id);
    else await supabase.from('services').insert(payload);
    setEditing(null);
    const { data } = await supabase.from('services').select('*').eq('tenant_id', tenant.id).order('sort_order');
    setServices(data ?? []);
  }

  async function remove(id: string) {
    if (!confirm('Excluir este serviço? Agendamentos antigos mantêm o histórico.')) return;
    await supabase.from('services').delete().eq('id', id);
    setServices((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold">Serviços</h2>
          <p className="text-xs text-slate-500">Duração e preço definem os horários disponíveis na agenda.</p>
        </div>
        <button
          onClick={() => setEditing({ color: COLORS[0], duration_min: 30, price_cents: 0, active: true })}
          className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5"
        >
          <Plus size={14} /> Novo serviço
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.id} className={`card p-4 flex items-center gap-3 ${!s.active ? 'opacity-50' : ''}`}>
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: s.color + '22', color: s.color }}>
              ✂️
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm flex items-center gap-2">
                {s.name}
                {!s.active && <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full">inativo</span>}
              </p>
              <p className="text-xs text-slate-500">
                {s.duration_min} min · <b>{fmtMoney(s.price_cents)}</b>
              </p>
            </div>
            <button onClick={() => setEditing(s)} className="p-2 text-slate-400 hover:text-slate-700">
              <Pencil size={15} />
            </button>
            <button onClick={() => remove(s.id)} className="p-2 text-slate-300 hover:text-rose-500">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? 'Editar serviço' : 'Novo serviço'}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Nome</span>
              <input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 block mb-1">Duração (min)</span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  className="input"
                  value={editing.duration_min ?? 30}
                  onChange={(e) => setEditing({ ...editing, duration_min: Number(e.target.value) })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 block mb-1">Preço (R$)</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="input"
                  value={editing.price_cents != null ? editing.price_cents / 100 : 0}
                  onChange={(e) => setEditing({ ...editing, price_cents: Number(e.target.value) * 100 })}
                />
              </label>
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 block mb-1">Cor no calendário</span>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditing({ ...editing, color: c })}
                    className={`w-7 h-7 rounded-full transition ${editing.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active ?? true}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="accent-amber-500"
              />
              Ativo (visível na página de agendamento)
            </label>
            <button onClick={save} className="btn-accent w-full py-2.5 text-sm">
              Salvar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
