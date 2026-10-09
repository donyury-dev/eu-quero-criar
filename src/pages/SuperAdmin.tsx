import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Ban, ExternalLink, Loader2, RefreshCw, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, todayStr } from '../lib/utils';
import { CATEGORY_LABELS, SUB_STATUS_META, effectiveSubStatus, type Subscription, type Tenant } from '../lib/types';

type Row = { tenant: Tenant; sub: Subscription | null; appts: number };

export default function SuperAdmin() {
  const { user, profile, loading } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [query, setQuery] = useState('');

  const isSuper = profile?.role === 'superadmin';

  const load = useCallback(async () => {
    setLoadingData(true);
    const monthStart = `${todayStr().slice(0, 7)}-01`;
    const [t, s, a] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at'),
      supabase.from('subscriptions').select('*'),
      supabase.from('appointments').select('tenant_id').gte('appointment_date', monthStart),
    ]);
    const subs = new Map((s.data ?? []).map((x: Subscription) => [x.tenant_id, x]));
    const counts = new Map<string, number>();
    for (const ap of a.data ?? []) counts.set(ap.tenant_id, (counts.get(ap.tenant_id) ?? 0) + 1);
    setRows(
      (t.data ?? []).map((tenant: Tenant) => ({
        tenant,
        sub: subs.get(tenant.id) ?? null,
        appts: counts.get(tenant.id) ?? 0,
      })),
    );
    setLoadingData(false);
  }, []);

  useEffect(() => {
    if (isSuper) load();
  }, [isSuper, load]);

  async function toggleBlock(row: Row) {
    const next = !row.tenant.is_blocked;
    if (!confirm(next ? `Bloquear o acesso de "${row.tenant.name}"?` : `Liberar o acesso de "${row.tenant.name}"?`)) return;
    await supabase.from('tenants').update({ is_blocked: next }).eq('id', row.tenant.id);
    load();
  }

  async function setSubStatus(row: Row, status: Subscription['status']) {
    await supabase.from('subscriptions').update({ status, updated_at: new Date().toISOString() }).eq('tenant_id', row.tenant.id);
    load();
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          r.tenant.name.toLowerCase().includes(q) ||
          r.tenant.slug.includes(q) ||
          (r.tenant.city ?? '').toLowerCase().includes(q)
        );
      }),
    [rows, query],
  );

  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (!user) return <Navigate to="/entrar" replace />;
  if (!isSuper)
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <p className="text-lg font-semibold mb-2">Área restrita ao dono da plataforma.</p>
          <Link to="/admin" className="btn-accent inline-block px-5 py-2.5 text-sm">
            Ir para meu painel
          </Link>
        </div>
      </div>
    );

  const activeCount = rows.filter((r) => ['trialing', 'active'].includes(effectiveSubStatus(r.sub ?? { status: 'cancelled', trial_ends_at: null } as Subscription))).length;

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck size={22} className="text-amber-400" />
          <div className="flex-1">
            <p className="font-bold">KalBix — Gestão da Plataforma</p>
            <p className="text-[11px] text-white/50">Super Admin</p>
          </div>
          <Link to="/admin" className="text-xs text-white/60 hover:text-white underline underline-offset-2">
            Meu painel
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <div className="card p-4">
            <p className="text-[11px] text-slate-400 flex items-center gap-1"><Users size={12} /> Estabelecimentos</p>
            <p className="text-xl font-bold">{rows.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] text-slate-400">Com acesso liberado</p>
            <p className="text-xl font-bold text-emerald-600">{activeCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-[11px] text-slate-400">Agendamentos no mês</p>
            <p className="text-xl font-bold">{rows.reduce((s, r) => s + r.appts, 0)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Buscar por nome, slug ou cidade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={load} className="card p-2.5 hover:border-slate-400" title="Atualizar">
            <RefreshCw size={16} className={loadingData ? 'animate-spin text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        {loadingData ? (
          <div className="card p-8 text-center text-slate-400 text-sm">
            <Loader2 className="animate-spin mx-auto" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">Nenhum estabelecimento encontrado.</div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((row) => {
              const st = effectiveSubStatus(row.sub ?? ({ status: 'cancelled', trial_ends_at: null } as Subscription));
              const meta = SUB_STATUS_META[st];
              return (
                <div key={row.tenant.id} className="card p-4 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold truncate">{row.tenant.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      {row.tenant.is_blocked && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                          Bloqueado manualmente
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {CATEGORY_LABELS[row.tenant.category] ?? row.tenant.category} · /{row.tenant.slug}
                      {row.tenant.city ? ` · ${row.tenant.city}` : ''} · {row.appts} agendamentos no mês
                      {row.sub ? ` · ${fmtMoney(row.sub.price_cents)}/mês` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/agendar/${row.tenant.slug}`} target="_blank" className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                      <ExternalLink size={13} /> Página
                    </Link>
                    {row.sub && st !== 'active' && (
                      <button onClick={() => setSubStatus(row, 'active')} className="btn-ghost text-xs px-3 py-1.5">
                        Marcar como paga
                      </button>
                    )}
                    {row.sub && st === 'active' && (
                      <button onClick={() => setSubStatus(row, 'suspended')} className="btn-ghost text-xs px-3 py-1.5 text-amber-600">
                        Suspender assinatura
                      </button>
                    )}
                    <button
                      onClick={() => toggleBlock(row)}
                      className={`btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 ${row.tenant.is_blocked ? 'text-emerald-600' : 'text-rose-600'}`}
                    >
                      <Ban size={13} /> {row.tenant.is_blocked ? 'Desbloquear' : 'Bloquear'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
