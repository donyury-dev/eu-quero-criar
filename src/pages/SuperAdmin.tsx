import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Ban,
  CheckCheck,
  ExternalLink,
  KeyRound,
  LifeBuoy,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { fmtMoney, todayStr } from '../lib/utils';
import {
  CATEGORY_LABELS,
  SUB_STATUS_META,
  effectiveSubStatus,
  type Subscription,
  type SupportMessage,
  type SupportTicket,
  type Tenant,
} from '../lib/types';

type Row = { tenant: Tenant; sub: Subscription | null; appts: number };
type TicketRow = SupportTicket & { tenant_name: string };

const TICKET_STATUS: Record<SupportTicket['status'], { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-sky-100 text-sky-700' },
  answered: { label: 'Respondido', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Fechado', cls: 'bg-slate-100 text-slate-500' },
};

export default function SuperAdmin() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<'clients' | 'access' | 'finance' | 'support'>('clients');
  const isSuper = profile?.role === 'superadmin';

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

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck size={22} className="text-amber-400" />
          <div className="flex-1">
            <p className="font-bold">KalBix — Gestão da Plataforma</p>
            <p className="text-[11px] text-white/50">Painel do dono</p>
          </div>
          <Link to="/admin" className="text-xs text-white/60 hover:text-white underline underline-offset-2">
            Meu painel
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-5">
          {(
            [
              { key: 'clients', label: 'Clientes', icon: Users },
              { key: 'access', label: 'Acessos', icon: KeyRound },
              { key: 'finance', label: 'Financeiro', icon: Wallet },
              { key: 'support', label: 'Suporte', icon: LifeBuoy },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl transition ${
                tab === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {tab === 'clients' && <ClientsTab />}
        {tab === 'access' && <AccessTab />}
        {tab === 'finance' && <FinanceTab />}
        {tab === 'support' && <SupportAdminTab />}
      </main>
    </div>
  );
}

/* ---------------- Clientes ---------------- */

function ClientsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [query, setQuery] = useState('');

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
    load();
  }, [load]);

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

  return (
    <div>
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
    </div>
  );
}

/* ---------------- Acessos (usuários de login) ---------------- */

type AuthUserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  confirmed: boolean;
};

function AccessTab() {
  const [rows, setRows] = useState<AuthUserRow[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [creatingMsg, setCreatingMsg] = useState<string | null>(null);
  const [pwdFor, setPwdFor] = useState<string | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const load = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions
      .invoke<{ users: AuthUserRow[] }>('admin-users', { method: 'GET' })
      .catch((e) => ({ data: null, error: e as { message: string } }));
    if (fnErr || !data) {
      setError((fnErr as { message: string } | null)?.message ?? 'Falha ao carregar usuários.');
      setLoadingData(false);
      return;
    }
    setRows(data.users ?? []);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser() {
    setCreating(true);
    setCreatingMsg(null);
    const { error: fnErr } = await supabase.functions.invoke('admin-users', {
      method: 'POST',
      body: { action: 'create', email: newEmail.trim(), password: newPassword },
    });
    setCreating(false);
    if (fnErr) return setCreatingMsg(fnErr.message);
    setCreatingMsg('Usuário criado com sucesso.');
    setNewEmail('');
    setNewPassword('');
    load();
  }

  async function savePassword(userId: string) {
    setSavingPwd(true);
    const { error: fnErr } = await supabase.functions.invoke('admin-users', {
      method: 'POST',
      body: { action: 'set_password', user_id: userId, password: newPwd },
    });
    setSavingPwd(false);
    if (fnErr) return setError(fnErr.message);
    setPwdFor(null);
    setNewPwd('');
    setError(null);
  }

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (r.email ?? '').toLowerCase().includes(q);
      }),
    [rows, query],
  );

  return (
    <div className="space-y-5">
      <div className="card p-4 bg-amber-50 border-amber-200">
        <p className="text-xs text-amber-800">
          <strong>Nota de segurança:</strong> não é possível ver a senha que o cliente criou — o sistema
          guarda apenas um código criptografado, por design. Você pode definir uma <strong>nova</strong>
          {' '}senha para qualquer cliente aqui, e ela substitui a anterior imediatamente.
        </p>
      </div>

      <div className="card p-4">
        <p className="font-semibold text-sm flex items-center gap-2 mb-3">
          <UserPlus size={15} /> Criar acesso para um cliente
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1 min-w-[200px]"
            type="email"
            placeholder="email-do-cliente@gmail.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="input w-44"
            type="text"
            placeholder="Senha inicial"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <button
            onClick={createUser}
            disabled={creating || newEmail.trim().length < 5 || newPassword.length < 6}
            className="btn-accent px-4 text-sm disabled:opacity-50"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : 'Criar acesso'}
          </button>
        </div>
        {creatingMsg && <p className="text-xs text-slate-500 mt-2">{creatingMsg}</p>}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <input
            className="input flex-1"
            placeholder="Buscar por e-mail…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={load} className="card p-2.5 hover:border-slate-400" title="Atualizar">
            <RefreshCw size={16} className={loadingData ? 'animate-spin text-slate-400' : 'text-slate-500'} />
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

        {loadingData ? (
          <div className="card p-8 text-center text-slate-400 text-sm">
            <Loader2 className="animate-spin mx-auto" /> Carregando…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">Nenhum usuário encontrado.</div>
        ) : (
          <div className="grid gap-2">
            {filtered.map((u) => (
              <div key={u.id} className="card p-3.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{u.email ?? '(sem e-mail)'}</p>
                    <p className="text-[11px] text-slate-400">
                      Criado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      {' · '}
                      {u.last_sign_in_at
                        ? `Último acesso ${new Date(u.last_sign_in_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`
                        : 'Nunca acessou'}
                      {!u.confirmed && ' · E-mail não confirmado'}
                    </p>
                  </div>
                  {pwdFor === u.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="input w-44 text-xs"
                        type="text"
                        autoFocus
                        placeholder="Nova senha (mín. 6)"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                      />
                      <button
                        onClick={() => savePassword(u.id)}
                        disabled={savingPwd || newPwd.length < 6}
                        className="btn-accent text-xs px-3 py-1.5 disabled:opacity-50"
                      >
                        {savingPwd ? <Loader2 size={13} className="animate-spin" /> : 'Salvar'}
                      </button>
                      <button onClick={() => { setPwdFor(null); setNewPwd(''); }} className="btn-ghost text-xs px-2 py-1.5">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => { setPwdFor(u.id); setNewPwd(''); }} className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5">
                      <KeyRound size={13} /> Trocar senha
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Financeiro da plataforma ---------------- */

function FinanceTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const load = useCallback(async () => {
    setLoadingData(true);
    const [t, s] = await Promise.all([
      supabase.from('tenants').select('*').order('created_at'),
      supabase.from('subscriptions').select('*'),
    ]);
    const subs = new Map((s.data ?? []).map((x: Subscription) => [x.tenant_id, x]));
    setRows(
      (t.data ?? []).map((tenant: Tenant) => ({ tenant, sub: subs.get(tenant.id) ?? null, appts: 0 })),
    );
    setLoadingData(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const paying = rows.filter((r) => r.sub?.status === 'active');
  const trialing = rows.filter((r) => effectiveSubStatus(r.sub ?? ({ status: 'cancelled', trial_ends_at: null } as Subscription)) === 'trialing');
  const overdue = rows.filter((r) => ['past_due', 'suspended'].includes(effectiveSubStatus(r.sub ?? ({ status: 'cancelled', trial_ends_at: null } as Subscription))));
  const mrr = paying.reduce((sum, r) => sum + (r.sub?.price_cents ?? 0), 0);

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Receita mensal (MRR)</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtMoney(mrr)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Assinantes pagantes</p>
          <p className="text-2xl font-bold">{paying.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Em teste grátis</p>
          <p className="text-2xl font-bold text-sky-600">{trialing.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Pagamento pendente</p>
          <p className="text-2xl font-bold text-amber-600">{overdue.length}</p>
        </div>
      </div>

      {loadingData ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <Loader2 className="animate-spin mx-auto" /> Carregando…
        </div>
      ) : paying.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhum assinante pagante ainda. Quando um cliente assinar pelo Mercado Pago, a receita aparece aqui.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5 font-semibold">Estabelecimento</th>
                <th className="px-4 py-2.5 font-semibold">Plano</th>
                <th className="px-4 py-2.5 font-semibold text-right">Mensalidade</th>
              </tr>
            </thead>
            <tbody>
              {paying.map((r) => (
                <tr key={r.tenant.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-semibold">{r.tenant.name}</td>
                  <td className="px-4 py-2.5 text-slate-500 capitalize">{r.sub?.plan ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-emerald-600">
                    {fmtMoney(r.sub?.price_cents ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Suporte (caixa de entrada) ---------------- */

function SupportAdminTab() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'all'>('open');
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*, tenants(name)')
      .order('updated_at', { ascending: false });
    setTickets(
      (data ?? []).map((t: Record<string, unknown> & SupportTicket) => ({
        ...t,
        tenant_name: (t.tenants as { name: string } | null)?.name ?? '—',
      })),
    );
    setLoading(false);
  }, []);

  const loadMessages = useCallback(async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at');
    setMessages(data ?? []);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    if (openId) loadMessages(openId);
  }, [openId, loadMessages]);

  async function sendReply() {
    if (!openId || !reply.trim() || busy) return;
    setBusy(true);
    await supabase
      .from('support_messages')
      .insert({ ticket_id: openId, author_role: 'admin', body: reply.trim() });
    await supabase
      .from('support_tickets')
      .update({ status: 'answered', updated_at: new Date().toISOString() })
      .eq('id', openId);
    setReply('');
    await loadMessages(openId);
    await loadTickets();
    setBusy(false);
  }

  async function closeTicket(t: TicketRow) {
    await supabase
      .from('support_tickets')
      .update({ status: 'closed', updated_at: new Date().toISOString() })
      .eq('id', t.id);
    await loadTickets();
  }

  const open = tickets.find((t) => t.id === openId) ?? null;
  const shown = filter === 'open' ? tickets.filter((t) => t.status !== 'closed') : tickets;

  return (
    <div>
      {open ? (
        <div className="card p-4">
          <button onClick={() => setOpenId(null)} className="btn-ghost text-xs px-3 py-1.5 mb-3">
            ← Voltar aos chamados
          </button>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="font-bold flex-1 truncate">{open.subject}</p>
            <span className="text-[11px] text-slate-400">{open.tenant_name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TICKET_STATUS[open.status].cls}`}>
              {TICKET_STATUS[open.status].label}
            </span>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-y-auto mb-3 pr-1">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.author_role === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                    m.author_role === 'admin'
                      ? 'brand-accent text-slate-900 rounded-br-sm'
                      : 'bg-slate-100 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {m.author_role === 'client' && (
                    <p className="text-[10px] font-bold text-slate-500 mb-0.5">{open.tenant_name}</p>
                  )}
                  {m.body}
                  <p className="text-[10px] opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Responder ao cliente…"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            />
            {open.status !== 'closed' && (
              <button onClick={() => closeTicket(open)} className="btn-ghost text-xs px-3 flex items-center gap-1.5" title="Fechar chamado">
                <X size={13} /> Fechar
              </button>
            )}
            <button onClick={sendReply} disabled={busy || !reply.trim()} className="btn-accent px-4 disabled:opacity-50">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <Loader2 className="animate-spin mx-auto" /> Carregando…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setFilter('open')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === 'open' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              Em aberto
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              Todos
            </button>
            <button onClick={loadTickets} className="card p-2 ml-auto hover:border-slate-400" title="Atualizar">
              <RefreshCw size={14} className="text-slate-500" />
            </button>
          </div>
          {shown.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">
              <CheckCheck className="mx-auto mb-2 text-emerald-500" size={22} />
              Nenhum chamado por aqui. Quando um cliente abrir um chamado na aba "Suporte" do painel dele, ele aparece aqui.
            </div>
          ) : (
            <div className="grid gap-2">
              {shown.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setOpenId(t.id)}
                  className="card p-3.5 text-left hover:border-slate-400 transition flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{t.subject}</p>
                    <p className="text-[11px] text-slate-400">
                      {t.tenant_name} · Atualizado em {new Date(t.updated_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TICKET_STATUS[t.status].cls}`}>
                    {TICKET_STATUS[t.status].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
