import { useState } from 'react';
import { BadgeCheck, Check, Copy, CreditCard, ExternalLink, Loader2, QrCode, RefreshCw, X } from 'lucide-react';
import { SUPABASE_URL, supabase } from '../lib/supabase';
import { fmtMoney } from '../lib/utils';
import { SUB_STATUS_META, effectiveSubStatus, type Subscription } from '../lib/types';

type PixData = { qr_code: string | null; qr_code_base64: string | null; amount: number };

export type PlanKey = 'monthly' | 'quarterly' | 'annual';

const BASE_CENTS = 4990; // plano mensal

// Trimestral e anual têm 20% de desconto sobre o mensal.
export const PLANS: Record<PlanKey, { label: string; months: number; totalCents: number; note: string }> = {
  monthly: { label: 'Mensal', months: 1, totalCents: BASE_CENTS, note: 'R$ 49,90 por mês' },
  quarterly: { label: 'Trimestral', months: 3, totalCents: BASE_CENTS * 3 * 0.8, note: '20% de desconto' },
  annual: { label: 'Anual', months: 12, totalCents: BASE_CENTS * 12 * 0.8, note: '20% de desconto' },
};

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
  const [pixLoading, setPixLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanKey>('monthly');
  const status = sub ? effectiveSubStatus(sub) : 'trialing';
  const meta = SUB_STATUS_META[status];
  const left = daysLeft(sub?.trial_ends_at ?? null);
  const periodLeft = sub?.status === 'active' ? daysLeft(sub?.current_period_end ?? null) : null;
  const expiringSoon = periodLeft !== null && periodLeft <= 5;

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
        body: JSON.stringify({ plan }),
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

  async function payPix() {
    setPixLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessão expirada — faça login novamente.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await res.json();
      if (!res.ok || (!json.qr_code && !json.qr_code_base64)) throw new Error(json.error ?? 'Falha ao gerar o Pix.');
      setPix({ qr_code: json.qr_code, qr_code_base64: json.qr_code_base64, amount: json.amount });
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setPixLoading(false);
    }
  }

  async function payCheckout() {
    setPixLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessão expirada — faça login novamente.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'checkout' }),
      });
      const json = await res.json();
      if (!res.ok || !json.init_point) throw new Error(json.error ?? 'Falha ao abrir o checkout.');
      window.open(json.init_point as string, '_blank', 'noopener');
      setTimeout(onRefresh, 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado.');
    } finally {
      setPixLoading(false);
    }
  }

  async function copyPix() {
    if (!pix?.qr_code) return;
    try {
      await navigator.clipboard.writeText(pix.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard indisponível
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

        {expiringSoon && (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            ⚠️ Sua assinatura expira em {periodLeft} {periodLeft === 1 ? 'dia' : 'dias'}. Renove abaixo para não perder o acesso.
          </p>
        )}
        {status === 'trialing' && left !== null && left <= 2 && (
          <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
            ⚠️ Seu teste grátis termina em {left} {left === 1 ? 'dia' : 'dias'}. Assine para continuar.
          </p>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">Escolha seu plano</p>
          {(Object.keys(PLANS) as PlanKey[]).map((key) => {
            const p = PLANS[key];
            const current = sub?.plan === key;
            return (
              <button
                key={key}
                onClick={() => setPlan(key)}
                className={`w-full text-left rounded-xl border p-3.5 flex items-center justify-between transition-colors ${
                  plan === key
                    ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-300'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-sm font-bold flex items-center gap-2">
                    {p.label}
                    {key !== 'monthly' && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        -20%
                      </span>
                    )}
                    {current && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500">
                        atual
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {fmtMoney(p.totalCents)} a cada {p.months === 1 ? 'mês' : `${p.months} meses`} · {p.note}
                  </p>
                </div>
                <span
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    plan === key ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                  }`}
                />
              </button>
            );
          })}
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

        <div className="space-y-2">
          <button onClick={subscribe} disabled={loading} className="btn-accent w-full py-3 flex items-center justify-center gap-2">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <BadgeCheck size={16} />}
            {status === 'active'
              ? `Assinar ${PLANS[plan].label} (cartão)`
              : status === 'trialing'
                ? 'Assinar com cartão (automático)'
                : 'Regularizar com cartão'}
          </button>
          {status !== 'active' && (
            <>
              <button onClick={payPix} disabled={pixLoading} className="btn-ghost w-full py-3 flex items-center justify-center gap-2">
                {pixLoading ? <Loader2 size={16} className="animate-spin" /> : <QrCode size={16} />}
                Pagar 30 dias com Pix
              </button>
              <button onClick={payCheckout} disabled={pixLoading} className="btn-ghost w-full py-3 flex items-center justify-center gap-2">
                {pixLoading ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                Pagar com débito ou boleto
              </button>
              <p className="text-[11px] text-center text-slate-400">
                Cartão de crédito: renova automática conforme o plano · Pix e débito: pagamento avulso, libera 30 dias
              </p>
            </>
          )}
        </div>
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

      {pix && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPix(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <QrCode size={17} /> Pix — {fmtMoney(pix.amount)}
              </h3>
              <button onClick={() => setPix(null)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            {pix.qr_code_base64 && (
              <img
                src={`data:image/png;base64,${pix.qr_code_base64}`}
                alt="QR Code Pix"
                className="w-56 h-56 mx-auto rounded-lg border border-slate-200"
              />
            )}
            {pix.qr_code && (
              <>
                <textarea
                  readOnly
                  value={pix.qr_code}
                  rows={4}
                  className="w-full text-[10px] font-mono bg-slate-50 border border-slate-200 rounded-lg p-2 break-all resize-none"
                />
                <button onClick={copyPix} className="btn-ghost w-full py-2.5 text-sm flex items-center justify-center gap-2">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Código copiado!' : 'Copiar código Pix (copia e cola)'}
                </button>
              </>
            )}
            <p className="text-xs text-slate-500 text-center">
              Pague com o app do seu banco. O acesso é liberado em até 1 minuto após o pagamento — clique em
              "Já paguei" para atualizar.
            </p>
            <button onClick={onRefresh} className="btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-2">
              <RefreshCw size={14} /> Já paguei — atualizar status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
