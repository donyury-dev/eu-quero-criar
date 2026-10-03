import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Professional, Service, Tenant, ProfessionalService } from '../lib/types';
import { Modal } from './ServicesTab';

export default function TeamTab({ tenant }: { tenant: Tenant }) {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [profServices, setProfServices] = useState<ProfessionalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(Partial<Professional> & { serviceIds?: string[] }) | null>(null);

  async function reload() {
    const [p, s, ps] = await Promise.all([
      supabase.from('professionals').select('*').eq('tenant_id', tenant.id).order('sort_order'),
      supabase.from('services').select('*').eq('tenant_id', tenant.id).order('sort_order'),
      supabase.from('professional_services').select('*').eq('tenant_id', tenant.id),
    ]);
    setProfessionals(p.data ?? []);
    setServices(s.data ?? []);
    setProfServices(ps.data ?? []);
  }

  useEffect(() => {
    reload().then(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id]);

  async function save() {
    if (!editing) return;
    const name = editing.name?.trim();
    if (!name) return;
    const payload = {
      tenant_id: tenant.id,
      name,
      specialty: editing.specialty?.trim() || null,
      commission_pct: Number(editing.commission_pct ?? 40),
      active: editing.active ?? true,
      sort_order: editing.sort_order ?? professionals.length,
    };
    let profId = editing.id;
    if (profId) await supabase.from('professionals').update(payload).eq('id', profId);
    else {
      const { data } = await supabase.from('professionals').insert(payload).select('id').single();
      profId = data?.id;
    }
    if (profId) {
      await supabase.from('professional_services').delete().eq('professional_id', profId);
      const rows = (editing.serviceIds ?? []).map((sid) => ({
        professional_id: profId,
        service_id: sid,
        tenant_id: tenant.id,
      }));
      if (rows.length) await supabase.from('professional_services').insert(rows);
    }
    setEditing(null);
    await reload();
  }

  async function remove(id: string) {
    if (!confirm('Remover este profissional?')) return;
    await supabase.from('professionals').delete().eq('id', id);
    setProfessionals((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-bold">Equipe</h2>
          <p className="text-xs text-slate-500">Especialidades, serviços que executa e % de comissão.</p>
        </div>
        <button
          onClick={() => setEditing({ commission_pct: 40, active: true, serviceIds: [] })}
          className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5"
        >
          <Plus size={14} /> Novo profissional
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {professionals.map((p) => {
          const ids = profServices.filter((ps) => ps.professional_id === p.id).map((ps) => ps.service_id);
          return (
            <div key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="w-11 h-11 rounded-full brand-accent grid place-items-center font-bold text-slate-900 shrink-0">
                  {p.name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.specialty ?? '—'}</p>
                  <p className="text-[11px] text-slate-400 mt-1">Comissão: {p.commission_pct}%</p>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={() => setEditing({ ...p, serviceIds: ids })} className="p-1.5 text-slate-400 hover:text-slate-700">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(p.id)} className="p-1.5 text-slate-300 hover:text-rose-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {ids.map((sid) => {
                  const svc = services.find((s) => s.id === sid);
                  return svc ? (
                    <span
                      key={sid}
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: svc.color + '1a', color: svc.color }}
                    >
                      {svc.name}
                    </span>
                  ) : null;
                })}
                {ids.length === 0 && <span className="text-[10px] text-amber-600">Nenhum serviço vinculado</span>}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? 'Editar profissional' : 'Novo profissional'}>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Nome</span>
              <input className="input" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Especialidade</span>
              <input
                className="input"
                placeholder="Ex.: Fade e navalhado"
                value={editing.specialty ?? ''}
                onChange={(e) => setEditing({ ...editing, specialty: e.target.value })}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Comissão (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                className="input"
                value={editing.commission_pct ?? 40}
                onChange={(e) => setEditing({ ...editing, commission_pct: Number(e.target.value) })}
              />
            </label>
            <div>
              <span className="text-xs font-semibold text-slate-600 block mb-1">Serviços que executa</span>
              <div className="grid grid-cols-2 gap-1.5">
                {services.map((s) => {
                  const checked = (editing.serviceIds ?? []).includes(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-xs bg-slate-50 rounded-lg px-2.5 py-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-amber-500"
                        checked={checked}
                        onChange={(e) =>
                          setEditing({
                            ...editing,
                            serviceIds: e.target.checked
                              ? [...(editing.serviceIds ?? []), s.id]
                              : (editing.serviceIds ?? []).filter((x) => x !== s.id),
                          })
                        }
                      />
                      {s.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.active ?? true}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                className="accent-amber-500"
              />
              Ativo
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
