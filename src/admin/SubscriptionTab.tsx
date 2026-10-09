import { useState } from 'react';
import { BadgeCheck, CreditCard, ExternalLink, Loader2, RefreshCw } from 'lucide-react';
import { SUPABASE_URL, supabase } from '../lib/supabase';
import { fmtMoney } from '../lib/utils';
import { SUB_STATUS_META, effectiveSubStatus, type Subscription } from '../lib/types';

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export function useSubscription() {
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reload = async () => {
    setLoaded(false);
    const { data } = await supabase.from('subscriptions').select('*').maybeSingle();
    setSub((data as Subscription) ?? null);
    setLoaded(true);
  };
  return { sub, loaded, reload };
}

export function isPanelBlocked(sub: Subscription | null): boolean {
  if (!sub) return false;
  return !['trialing', 'active'].includes(effectiveSubStatus(sub));
}

export default function SubscriptionTab({
  sub,
  onRefresh,
  blocking = false,
}: {
  sub: Subscription | null;
  onRefresh: () => void;
  blocking?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = sub ? effectiveSubStatus(sub) : 'trialing';
  const meta = SUB_STATUS_META[status];
  const left = daysLeft(sub?.trial_ends_at ?? null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessão expirada — faça login novamente.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-preapproval`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok || !json.init_point) throw new Error(json.error ?? 'Falha ao criar o checkout.');
      window.open(json.init_point as string, '_blank', 'noopener');
      setTimeout(onRefresh, 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={blocking ? 'max-w-md mx-auto mt-10' : 'max-w-lg'}>
      {blocking && (
        <div className="card p-6 text-center mb-4">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-lg font-bold">Seu período de teste terminou</h1>
          <p className="text-sm text-slate-500 mt-1">
            Assine o plano mensal para continuar usando o painel. Sua página de agendamento continua no ar para os clientes.
          </p>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold flex items-center gap-2">
            <CreditCard size={17} className="text-slate-400" /> Assinatura
          </h2>
          {sub && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>}
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">Plano Mensal KalBix</p>
            <p className="text-xs text-slate-500">
              Painel completo · página de agendamento · app instalável · suporte
            </p>
          </div>
          <p className="font-bold text-lg" style={{ color: 'var(--accent)' }}>
            {fmtMoney(sub?.price_cents ?? 4990)}<span className="text-xs font-normal text-slate-400">/mês</span>
          </p>
        </div>

        {sub?.status === 'trialing' && (
          <p className="text-xs text-sky-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2">
            Teste grátis: {left !== null ? `${left} ${left === 1 ? 'dia restante' : 'dias restantes'}` : 'ativo'}.
          </p>
        )}
        {sub?.status === 'active' && sub.current_period_end && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            Assinatura ativa — próxima cobrança em {new Date(sub.current_period_end).toLocaleDateString('pt-BR')}.
          </p>
        )}
        {(status === 'past_due' || status === 'suspended') && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Pagamento pendente. Conclua a assinatura ou atualize a forma de pagamento no Mercado Pago para reativar.
          </p>
        )}

        {['trialing', 'past_due', 'suspended', 'cancelled'].includes(status) && (
          <button onClick={subscribe} disabled={loading} className="btn-accent w-full py-3 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            {status === 'trialing' ? 'Assinar agora' : 'Regularizar assinatura'}
          </button>
        )}
        {status === 'active' && sub?.provider_sub_id && (
          <a
            href="https://www.mercadopago.com.br/subscriptions"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2"
          >
            <ExternalLink size={14} /> Gerenciar no Mercado Pago
          </a>
        )}

        <button onClick={onRefresh} className="w-full text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1.5">
          <RefreshCw size={12} /> Já paguei — atualizar status
        </button>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    </div>
  );
}
