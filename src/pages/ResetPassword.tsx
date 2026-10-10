import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // O Supabase já processa o token de recuperação da URL automaticamente
    // quando detectSessionInUrl está ativo no createClient.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Token de recuperação válido — usuário pode definir nova senha.
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    if (password !== confirm) return setError('As senhas não coincidem.');

    setBusy(true);
    const { error: updateErr } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateErr) return setError(updateErr.message);
    setDone(true);
    setTimeout(() => navigate('/entrar'), 2500);
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="w-full max-w-sm">
        <p className="text-2xl font-extrabold tracking-tight mb-1 text-center">
          Kal<span className="text-amber-400">Bix</span> Agenda
        </p>
        <p className="text-white/60 text-sm mb-8 text-center">Crie uma nova senha para sua conta.</p>

        {done ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <CheckCircle2 size={40} className="mx-auto text-emerald-400 mb-3" />
            <p className="font-semibold">Senha atualizada!</p>
            <p className="text-sm text-white/60 mt-2">Redirecionando para o login…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h1 className="font-bold text-lg flex items-center gap-2 mb-2">
              <KeyRound size={18} className="text-amber-400" /> Nova senha
            </h1>
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nova senha (mín. 6)"
              className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repita a nova senha"
              className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
              Salvar nova senha
            </button>
            {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
