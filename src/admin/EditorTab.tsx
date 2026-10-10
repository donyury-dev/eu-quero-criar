import { useEffect, useState } from 'react';
import { Clapperboard, Lock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, DEMO_TENANT_ID } from '../lib/supabase';
import type { Tenant } from '../lib/types';

type EditorAccess = {
  tenant_id: string;
  plan: 'agenda' | 'full';
  included_until: string | null;
  manual_grant: boolean;
  manual_revoked: boolean;
  granted_at?: string | null;
};

function accessGranted(a: EditorAccess | null): boolean {
  if (!a) return false;
  if (a.manual_revoked) return false;
  if (a.plan === 'full') return true;
  if (a.manual_grant) return true;
  if (a.included_until) return new Date(a.included_until) >= new Date(new Date().toDateString());
  return false;
}

export default function EditorTab({ tenant }: { tenant: Tenant | null }) {
  const tenantId = tenant?.id ?? DEMO_TENANT_ID;
  const [access, setAccess] = useState<EditorAccess | null>(null);
  const [loading, setLoading] = useState(true);

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
                Edição automática de vídeos verticais com IA — incluso no plano.
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
          {access?.included_until && (
            <p>
              Meses inclusos até: <b className="text-slate-800">{access.included_until}</b>
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
          <p className="w-full text-[11px] text-slate-400">
            O acesso e o período são controlados pelo administrador da plataforma.
          </p>
        </div>
      </div>

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Assinando o agendamento, o editor fica incluso nos primeiros meses.</li>
          <li>No plano completo, o acesso é liberado automaticamente.</li>
          <li>Depois do período incluso, somente o administrador da plataforma pode liberar ou bloquear o editor.</li>
        </ul>
      </div>
    </div>
  );
}
