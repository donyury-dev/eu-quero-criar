import { useState } from 'react';
import { KeyRound, Loader2, UserCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { displayLogin } from '../lib/auth';

export default function AccountTab() {
  const { user, profile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'ok' | 'error' } | null>(null);

  const login = displayLogin(user?.email ?? null);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setMessage(null);
    if (newPassword.length < 6) return setMessage({ text: 'A nova senha deve ter pelo menos 6 caracteres.', type: 'error' });
    if (newPassword !== confirmPassword) return setMessage({ text: 'As senhas não coincidem.', type: 'error' });

    setBusy(true);
    // Primeiro reautentica com a senha atual para confirmar identidade.
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });
    if (authErr) {
      setBusy(false);
      return setMessage({ text: 'Senha atual incorreta.', type: 'error' });
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (updateErr) return setMessage({ text: updateErr.message, type: 'error' });

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage({ text: 'Senha atualizada com sucesso.', type: 'ok' });
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full brand-accent grid place-items-center">
            <UserCircle size={24} className="text-slate-900" />
          </div>
          <div>
            <p className="font-semibold text-sm">{profile?.name || user?.email || '—'}</p>
            <p className="text-[11px] text-slate-400">
              Login: <span className="font-mono text-slate-600">{login}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
          <KeyRound size={16} className="text-amber-500" /> Trocar senha
        </h2>
        <form onSubmit={handleChangePassword} className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Senha atual</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="input w-full"
              placeholder="Sua senha atual"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Nova senha</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input w-full"
              placeholder="Mínimo 6 caracteres"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 block mb-1">Confirmar nova senha</span>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              placeholder="Repita a nova senha"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
            Atualizar senha
          </button>
          {message && (
            <p className={`text-xs text-center ${message.type === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {message.text}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
