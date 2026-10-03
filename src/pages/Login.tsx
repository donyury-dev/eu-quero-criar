import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Store, ArrowRight, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user, profile, loading, openSignIn, signOut, linkAsDemoOwner } = useAuth();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (profile) navigate('/admin', { replace: true });
  }, [profile, navigate]);

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
          Agenda<span className="text-amber-400">Pro</span>
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
            <button onClick={openSignIn} className="btn-accent w-full py-3 mt-5 flex items-center justify-center gap-2">
              Entrar <ArrowRight size={16} />
            </button>
            <p className="text-[11px] text-white/40 text-center mt-3">
              Faça login com sua conta Google ou e-mail — é a mesma conta do ambiente de demonstração.
            </p>
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
