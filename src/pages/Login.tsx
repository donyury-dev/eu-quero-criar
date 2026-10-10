import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Store, ArrowRight, Loader2, PlayCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase, DEMO_LOGIN_EMAIL, DEMO_LOGIN_PASSWORD } from '../lib/supabase';

export default function Login() {
  const { user, profile, loading, signOut, linkAsDemoOwner } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) navigate('/admin', { replace: true });
  }, [profile, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSending(false);
    if (error) setError('E-mail ou senha incorretos.');
  }

  async function enterDemo() {
    setLinking(true);
    setError(null);
    // Tenta entrar; se a conta demo ainda não existe, cria na hora.
    let res = await supabase.auth.signInWithPassword({
      email: DEMO_LOGIN_EMAIL,
      password: DEMO_LOGIN_PASSWORD,
    });
    if (res.error) {
      const created = await supabase.auth.signUp({
        email: DEMO_LOGIN_EMAIL,
        password: DEMO_LOGIN_PASSWORD,
      });
      if (created.data.session && created.data.user) {
        res = { data: { session: created.data.session, user: created.data.user }, error: null };
      }
    }
    if (res.error) {
      setLinking(false);
      return setError(
        'Não foi possível abrir a demonstração. Crie o usuário "demo@kalbixagenda.com" com a senha "demo-kalbix-2026" no painel do Supabase (Authentication → Users → Add user) e tente de novo.'
      );
    }
    // Assume o estabelecimento demo se ainda não tiver vínculo.
    const { data: prof } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', res.data.user!.id)
      .limit(1);
    if (!prof || prof.length === 0) {
      const name = 'Dono (demo)';
      const { error: linkErr } = await supabase.from('profiles').insert({
        user_id: res.data.user!.id,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        role: 'owner',
        name,
      });
      if (linkErr && !linkErr.message.includes('duplicate')) {
        setLinking(false);
        return setError(linkErr.message);
      }
    }
    setLinking(false);
    navigate('/admin', { replace: true });
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
          <>
            <button
              onClick={enterDemo}
              disabled={linking}
              className="btn-accent w-full py-4 flex items-center justify-center gap-2 text-base disabled:opacity-50"
            >
              {linking ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={20} />}
              Ver demonstração
            </button>
            <p className="text-xs text-white/40 mt-1.5 mb-6">Entre e teste todas as funções na hora.</p>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-left">
              <h1 className="font-bold text-lg flex items-center gap-2">
                <Store size={18} className="text-amber-400" /> Já sou cliente
              </h1>
              <form onSubmit={handleLogin} className="mt-4 space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                />
                <button
                  disabled={sending}
                  className="w-full rounded-lg border border-white/20 bg-white/10 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/15 transition disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Entrar com e-mail e senha
                </button>
              </form>
              {error && <p className="text-xs text-rose-400 mt-3">{error}</p>}
            </div>
          </>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <p className="text-sm text-white/60">Conectado como</p>
            <p className="font-semibold truncate">{user.email}</p>
            {!profile && (
              <>
                <p className="text-sm text-white/70 mt-4">
                  Ative o modo demonstração e assuma o painel da Barbearia Nova Era:
                </p>
                <button onClick={enterDemo} disabled={linking} className="btn-accent w-full py-3 mt-3">
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

        <div className="mt-8 space-y-2">
          {!user && (
            <Link to="/criar" className="block text-center text-xs text-amber-300 hover:text-amber-200 font-semibold underline underline-offset-2">
              Quero criar o agendamento do meu negócio — 7 dias grátis
            </Link>
          )}
          <Link to="/explorar" className="block text-center text-xs text-white/40 hover:text-white underline underline-offset-2">
            Voltar para o diretório público
          </Link>
        </div>
      </div>
    </div>
  );
}
