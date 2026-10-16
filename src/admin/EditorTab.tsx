import { useEffect, useState } from 'react';
import { Clapperboard, Check, Copy, Loader2, Lock, QrCode, ShieldCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SUPABASE_URL, supabase, DEMO_TENANT_ID } from '../lib/supabase';
import { fmtMoney } from '../lib/utils';
import type { Tenant } from '../lib/types';

const EDITOR_PRICE_CENTS = 2990; // aluguel mensal

type EditorAccess = {
  tenant_id: string;
  plan: 'agenda' | 'full';
  included_until: string | null;
  manual_grant: boolean;
  manual_revoked: boolean;
  granted_at?: string | null;
};

type PixData = { qr_code: string | null; qr_code_base64: string | null; amount: number };

function accessGranted(a: EditorAccess | null): boolean {
  if (!a) return false;
  if (a.manual_revoked) return false;
  if (a.plan === 'full') return true;
  if (a.manual_grant) return true;
  if (a.included_until) return new Date(`${a.included_until}T23:59:59`) >= new Date();
  return false;
}

function diasRestantes(data: string | null): number | null {
  if (!data) return null;
  return Math.max(0, Math.ceil((new Date(`${data}T23:59:59`).getTime() - Date.now()) / 86_400_000));
}

export default function EditorTab({ tenant }: { tenant: Tenant | null }) {
  const tenantId = tenant?.id ?? DEMO_TENANT_ID;
  const [access, setAccess] = useState<EditorAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [pixLoading, setPixLoading] = useState(false);
  const [pix, setPix] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    supabase
      .from('editor_access')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()
      .then(({ data }) => {
        setAccess((data as EditorAccess) ?? null);
        setLoading(false);
      });
  };
  useEffect(load, [tenantId]);

  const granted = accessGranted(access);
  const autoGranted = access?.plan === 'full' && !access?.manual_revoked;
  const restantes = diasRestantes(access?.included_until ?? null);

  async function alugarPix() {
    setPixLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessão expirada — faça login novamente.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'editor' }),
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

  async function alugarCheckout() {
    setPixLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error('Sessão expirada — faça login novamente.');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pix-payment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: 'editor', mode: 'checkout' }),
      });
      const json = await res.json();
      if (!res.ok || !json.init_point) throw new Error(json.error ?? 'Falha ao abrir o checkout.');
      window.open(json.init_point as string, '_blank', 'noopener');
      setTimeout(load, 60_000);
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
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2.5 text-orange-600">
              <Clapperboard size={22} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Editor de Vídeo (Auto Editor)</h3>
              <p className="text-sm text-slate-500">
                Edição automática de vídeos verticais com IA — aluguel mensal.
              </p>
            </div>
          </div>
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              granted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {granted ? <ShieldCheck size={14} /> : <Lock size={14} />}
            {loading ? '…' : granted ? 'Acesso liberado' : 'Bloqueado'}
          </span>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          <p>
            Plano: <b className="text-slate-800">{access?.plan === 'full' ? 'Completo (editor incluso)' : 'Agenda'}</b>
          </p>
          {restantes !== null && (
            <p>
              Aluguel ativo por mais <b className="text-slate-800">{restantes} {restantes === 1 ? 'dia' : 'dias'}</b>
              {' '}(até {access?.included_until && new Date(`${access.included_until}T12:00:00`).toLocaleDateString('pt-BR')}).
            </p>
          )}
          {autoGranted && (
            <p className="text-emerald-600">Liberado automaticamente pelo plano completo.</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {granted && (
            <Link
              to="/editor"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/30 transition hover:brightness-110 active:scale-95"
            >
              Abrir editor
            </Link>
          )}
        </div>

        {!granted && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-sm font-bold text-slate-800">Alugue o editor por {fmtMoney(EDITOR_PRICE_CENTS)}/mês</p>
            <p className="text-xs text-slate-500">
              Pagamento único por mês de uso. Sem fidelidade — renove só quando quiser continuar editando.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={alugarPix} disabled={pixLoading} className="btn-accent px-4 py-2.5 text-sm flex items-center gap-2">
                {pixLoading ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                Pagar 30 dias com Pix — {fmtMoney(EDITOR_PRICE_CENTS)}
              </button>
              <button onClick={alugarCheckout} disabled={pixLoading} className="btn-ghost px-4 py-2.5 text-sm flex items-center gap-2">
                Cartão, débito ou boleto
              </button>
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )}

        {granted && !autoGranted && (
          <p className="mt-4 text-[11px] text-slate-400">
            Quer continuar usando no próximo mês? Basta pagar outro aluguel de 30 dias antes do vencimento.
          </p>
        )}
      </div>

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>O editor é alugado por {fmtMoney(EDITOR_PRICE_CENTS)} por mês (30 dias), sem fidelidade.</li>
          <li>A agenda tem licença permanente: paga uma vez só e nunca mais mensalidade.</li>
          <li>O pagamento libera o acesso em até 1 minuto — clique em "Já paguei" na aba Assinatura ou recarregue.</li>
        </ul>
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
              Pague com o app do seu banco. O acesso é liberado em até 1 minuto após o pagamento.
            </p>
            <button onClick={load} className="btn-accent w-full py-2.5 text-sm flex items-center gap-2 justify-center">
              <Loader2 size={14} className={pixLoading ? 'animate-spin' : 'hidden'} /> Já paguei — atualizar status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
