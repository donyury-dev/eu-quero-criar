import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Store, ArrowRight, Loader2, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export default function Login() {
  const { user, profile, loading, signOut, linkAsDemoOwner } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) navigate('/admin', { replace: true });
  }, [profile, navigate]);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setNotice(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) setError(error.message);
    else {
      setStage('code');
      setNotice('Código enviado! Confira sua caixa de entrada (e o spam).');
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'email',
    });
    setSending(false);
    if (error) setError(error.message);
  }

  async function handleLink() {
    setLinking(true);
    setError(null);
    const res = await linkAsDemoOwner();
    setLinking(false);
    if (res.error) setError(res.error);
    else navigate('/admin', { replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="w-full max-w-sm text-center">
        <p className="text-2xl font-extrabold tracking-tight mb-1">
          Kal<span className="text-amber-400">Bix</span> Agenda
        </p>
        <p className="text-white/60 text-sm mb-8">Sistema de agendamento com a marca do seu negócio.</p>

        {loading ? (
          <Loader2 className="animate-spin mx-auto text-white/50" />
        ) : !user ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Store size={18} className="text-amber-400" /> Área do dono
            </h1>
            <ul className="text-sm text-white/70 mt-3 space-y-1.5 list-disc list-inside">
              <li>Agenda completa e equipe</li>
              <li>Logo, cores e serviços personalizados</li>
              <li>Financeiro, CRM e app instalável</li>
            </ul>

            {stage === 'email' ? (
              <form onSubmit={handleSendCode} className="mt-5 space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <button
                  disabled={sending}
                  className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Entrar com e-mail
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="mt-5 space-y-3">
                <p className="text-xs text-white/60 flex items-center gap-1.5">
                  <MailCheck size={14} className="text-amber-400" /> Digite o código de 6 dígitos enviado para {email}
                </p>
                <input
                  inputMode="numeric"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-center text-xl tracking-[0.4em] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <button
                  disabled={sending}
                  className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Confirmar código
                </button>
                <button
                  type="button"
                  onClick={() => { setStage('email'); setCode(''); setNotice(null); }}
                  className="w-full text-xs text-white/50 hover:text-white"
                >
                  Usar outro e-mail
                </button>
              </form>
            )}

            {notice && <p className="text-xs text-emerald-400 mt-3">{notice}</p>}
            {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-sm text-white/60">Conectado como</p>
            <p className="font-semibold truncate">{user.email}</p>
            {!profile && (
              <>
                <p className="text-sm text-white/70 mt-4">
                  Ative o modo demonstração e assuma o painel da Barbearia Nova Era:
                </p>
                <button onClick={handleLink} disabled={linking} className="btn-accent w-full py-3 mt-3">
                  {linking ? 'Ativando…' : 'Assumir estabelecimento demo'}
                </button>
              </>
            )}
            {error && <p className="text-sm text-rose-400 mt-3">{error}</p>}
            <button onClick={signOut} className="mt-4 text-xs text-white/50 flex items-center gap-1.5 mx-auto hover:text-white">
              <LogOut size={13} /> Sair
            </button>
          </div>
        )}

        <Link to="/explorar" className="inline-block text-xs text-white/40 hover:text-white mt-8 underline underline-offset-2">
          Voltar para o diretório público
        </Link>
      </div>
    </div>
  );
}
