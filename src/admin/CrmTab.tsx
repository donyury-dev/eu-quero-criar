import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Appointment, Tenant } from '../lib/types';
import { Modal } from './ServicesTab';
import { fmtDateBR } from '../lib/utils';

export default function CrmTab({ tenant }: { tenant: Tenant }) {
  const [customers, setCustomers] = useState<{ id: string; name: string; phone: string | null; notes: string | null }[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  useEffect(() => {
    Promise.all([
      supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('created_at'),
      supabase.from('appointments').select('*').eq('tenant_id', tenant.id),
    ]).then(([c, a]) => {
      setCustomers(c.data ?? []);
      setAppointments(a.data ?? []);
      setLoading(false);
    });
  }, [tenant.id]);

  const rows = useMemo(() => {
    const valid = appointments.filter((a) => a.status === 'completed' || a.status === 'confirmed');
    return customers
      .map((c) => {
        const mine = valid
          .filter((a) => a.customer_id === c.id || (a.customer_phone && a.customer_phone === c.phone))
          .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));
        return {
          ...c,
          visits: mine.length,
          last: mine[0]?.appointment_date ?? null,
          totalSpent: mine.filter((a) => a.status === 'completed').reduce((s, a) => s + a.price_cents, 0),
        };
      })
      .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()) || (c.phone ?? '').includes(query))
      .sort((a, b) => b.visits - a.visits);
  }, [customers, appointments, query]);

  async function addCustomer() {
    if (newName.trim().length < 3) return;
    await supabase.from('customers').insert({
      tenant_id: tenant.id,
      name: newName.trim(),
      phone: newPhone.trim() || null,
      notes: newNotes.trim() || null,
    });
    setAdding(false);
    setNewName('');
    setNewPhone('');
    setNewNotes('');
    const { data } = await supabase.from('customers').select('*').eq('tenant_id', tenant.id).order('created_at');
    setCustomers(data ?? []);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="font-bold">Clientes</h2>
          <p className="text-xs text-slate-500">Histórico de cada cliente: visitas, última visita e gasto total.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input !w-44 pl-8"
              placeholder="Buscar cliente…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button onClick={() => setAdding(true)} className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5">
            <Plus size={14} /> Novo
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Cliente</th>
              <th className="px-4 py-2.5 font-semibold">WhatsApp</th>
              <th className="px-4 py-2.5 font-semibold text-center">Visitas</th>
              <th className="px-4 py-2.5 font-semibold">Última visita</th>
              <th className="px-4 py-2.5 font-semibold text-right">Total gasto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{c.name}</p>
                  {c.notes && <p className="text-[11px] text-slate-400">📝 {c.notes}</p>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {c.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} /> {c.phone}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.visits >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {c.visits}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{c.last ? fmtDateBR(c.last) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{(c.totalSpent / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="text-xs text-slate-400 p-4">Carregando…</p>}
        {!loading && rows.length === 0 && <p className="text-xs text-slate-400 p-6 text-center">Nenhum cliente encontrado.</p>}
      </div>

      {adding && (
        <Modal title="Novo cliente" onClose={() => setAdding(false)}>
          <div className="space-y-3">
            <input className="input" placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <input className="input" placeholder="WhatsApp" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} inputMode="tel" />
            <input className="input" placeholder="Observações (alergias, preferências…)" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            <button onClick={addCustomer} className="btn-accent w-full py-2.5 text-sm">
              Salvar cliente
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
