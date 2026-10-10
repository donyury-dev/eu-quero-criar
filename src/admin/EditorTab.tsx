import { useEffect, useState } from 'react';
import { Clapperboard, ExternalLink, Lock, ShieldCheck } from 'lucide-react';
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

const EDITOR_URL = (import.meta.env.VITE_EDITOR_URL as string | undefined) ?? 'https://kalbix-editor.onrender.com';

function accessGranted(a: EditorAccess | null): boolean {
  if (!a) return false;
  if (a.plan === 'full') return true;
  if (a.manual_revoked) return false;
  if (a.manual_grant) return true;
  if (a.included_until) return new Date(a.included_until) >= new Date(new Date().toDateString());
  return false;
}

export default function EditorTab({ tenant }: { tenant: Tenant | null }) {
  const tenantId = tenant?.id ?? DEMO_TENANT_ID;
  const [access, setAccess] = useState<EditorAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

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

  const save = async (patch: Partial<EditorAccess>) => {
    setBusy(true);
    const row = {
      tenant_id: tenantId,
      plan: access?.plan ?? 'agenda',
      included_until: access?.included_until ?? null,
      manual_grant: access?.manual_grant ?? false,
      manual_revoked: access?.manual_revoked ?? false,
      ...patch,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from('editor_access')
      .upsert(row);
    if (!error) setAccess(row as EditorAccess);
    setBusy(false);
  };

  const liberar = () =>
    save({ manual_grant: true, manual_revoked: false, granted_at: new Date().toISOString() });
  const bloquear = () =>
    save({ manual_grant: false, manual_revoked: true });

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
          {!granted ? (
            <button
              onClick={liberar}
              disabled={busy}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Liberar acesso ao editor
            </button>
          ) : (
            <button
              onClick={bloquear}
              disabled={busy}
              className="rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
            >
              Bloquear acesso
            </button>
          )}
          {granted && (
            <a
              href={EDITOR_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
            >
              Abrir editor <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      <div className="card p-5 text-sm text-slate-600">
        <p className="font-medium text-slate-800">Como funciona</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Assinando o agendamento, o editor fica incluso nos primeiros meses.</li>
          <li>No plano completo, o acesso é liberado automaticamente.</li>
          <li>Depois do período incluso, o editor pode ser assinado à parte — ou liberado aqui mesmo, manualmente.</li>
        </ul>
      </div>
    </div>
  );
}
