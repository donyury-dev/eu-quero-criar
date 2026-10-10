import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_LABELS } from '../lib/types';
import { toAuthEmail, LOGIN_PATTERN } from '../lib/auth';

export default function Signup() {
  const { session, profile } = useAuth();
  const [step, setStep] = useState<'data' | 'creating' | 'error'>('data');
  const [form, setForm] = useState({ name: '', category: 'barbearia', city: '', whatsapp: '', ownerName: '' });
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Já autenticado sem estabelecimento: pula a parte de login e só cria o estabelecimento.
  const alreadyAuthed = !!session?.user && !profile;

  useEffect(() => {
    if (session?.user && profile) navigate('/admin', { replace: true });
  }, [session?.user, profile, navigate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const clean = login.trim().toLowerCase();
    if (!alreadyAuthed) {
      if (!LOGIN_PATTERN.test(clean)) {
        return setError('Login inválido. Use de 3 a 30 letras, números, ponto, hífen ou _ (sem espaços).');
      }
      if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
    }
    setSending(true);
    setError(null);

    if (!alreadyAuthed) {
      const { data: registerData, error: registerErr } = await supabase.functions.invoke<{
        email: string;
        error?: string;
      }>('register-login', {
        body: { login: clean, password },
      });
      let authEmail: string;
      if (registerErr || registerData?.error) {
        const reason = registerData?.error ?? registerErr?.message ?? '';
        if (reason.toLowerCase().includes('já está em uso')) {
          // Login já existe: se a senha bater, segue o fluxo normalmente.
          authEmail = toAuthEmail(clean);
          const { error: retryErr } = await supabase.auth.signInWithPassword({
            email: authEmail,
            password,
          });
          if (retryErr) {
            setSending(false);
            return setError('Esse login já está em uso com outra senha. Tente entrar ou escolha outro login.');
          }
        } else {
          setSending(false);
          return setError(reason || 'Não foi possível criar a conta.');
        }
      } else {
        authEmail = registerData!.email;
        const { error: firstErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
        if (firstErr) {
          setSending(false);
          return setError(`Conta criada, mas não foi possível entrar: ${firstErr.message}`);
        }
      }
    }
    setStep('creating');
    const { data: rpcData, error: rpcErr } = await supabase.rpc('create_establishment', {
      p_name: form.name.trim(),
      p_category: form.category,
      p_city: form.city.trim(),
      p_whatsapp: form.whatsapp.trim(),
      p_owner_name: form.ownerName.trim(),
    });
    if (rpcErr) {
      setSending(false);
      const msg = rpcErr.message.toLowerCase();
      // Se o estabelecimento já foi criado em tentativa anterior, segue para o painel.
      if (
        msg.includes('duplicate') ||
        msg.includes('already exists') ||
        msg.includes('já possui um estabelecimento')
      ) {
        navigate('/admin', { replace: true });
        return;
      }
      setError(`Sua conta foi criada, mas houve um problema ao criar o estabelecimento: ${rpcErr.message}`);
      return;
    }
    // Garante o vínculo do usuário com o estabelecimento criado.
    const tenantId = Array.isArray(rpcData) ? rpcData[0]?.tenant_id : rpcData?.tenant_id;
    if (tenantId) {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { error: profErr } = await supabase.from('profiles').insert({
          user_id: userData.user.id,
          tenant_id: tenantId,
          role: 'owner',
          name: form.ownerName.trim() || userData.user.email?.split('@')[0] || null,
        });
        if (profErr && !profErr.message.toLowerCase().includes('duplicate')) {
          setSending(false);
          return setError(`Estabelecimento criado, mas faltou vincular seu acesso: ${profErr.message}. Saia e entre de novo — se persistir, chame o suporte.`);
        }
      }
    }
    setSending(false);
    navigate('/admin', { replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="w-full max-w-md">
        <p className="text-2xl font-extrabold tracking-tight mb-1 text-center">
          Kal<span className="text-amber-400">Bix</span> Agenda
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          Crie o agendamento online do seu negócio em 2 minutos — 7 dias grátis, sem e-mail.
        </p>

        {step === 'data' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Store size={18} className="text-amber-400" /> Seu estabelecimento
            </h1>
            <label className="block">
              <span className="text-xs text-white/60 block mb-1">Nome do estabelecimento *</span>
              <input
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Barbearia Estilo Novo"
              />
            </label>
            <label className="block">
              <span className="text-xs text-white/60 block mb-1">Tipo de negócio</span>
              <select
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k} className="text-slate-900">
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-white/60 block mb-1">Cidade</span>
                <input
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="São Paulo"
                />
              </label>
              <label className="block">
                <span className="text-xs text-white/60 block mb-1">WhatsApp</span>
                <input
                  className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(11) 91234-5678"
                  inputMode="tel"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-white/60 block mb-1">Seu nome</span>
              <input
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40"
                value={form.ownerName}
                onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                placeholder="Como você se chama"
              />
            </label>

            {!alreadyAuthed ? (
              <div className="border-t border-white/10 pt-3 space-y-3">
                <h2 className="font-bold text-sm flex items-center gap-2">
                  <Check size={16} className="text-amber-400" /> Seu acesso (login e senha)
                </h2>
                <form onSubmit={handleCreate} className="space-y-3">
                  <input
                    required
                    autoComplete="username"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    placeholder="Crie seu login (ex: barbearia.do.joao)"
                    className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                  />
                  <input
                    type="password"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Crie uma senha (mín. 6 letras)"
                    className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
                  />
                  <p className="text-[11px] text-white/40">
                    Sem e-mail, sem confirmação — você entra direto. Guarde bem seu login e senha.
                  </p>
                  <button
                    disabled={sending || form.name.trim().length < 2}
                    className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                    Criar minha conta — 7 dias grátis
                  </button>
                </form>
                {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
              </div>
            ) : (
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <Check size={14} /> Você já está conectado — só falta criar o estabelecimento.
                </p>
                <button
                  onClick={handleCreate}
                  disabled={sending || form.name.trim().length < 2}
                  className="btn-accent w-full py-3 mt-3 flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  Criar meu estabelecimento — 7 dias grátis
                </button>
                {error && <p className="text-xs text-rose-400 text-center mt-3">{error}</p>}
              </div>
            )}
            <p className="text-[11px] text-white/40 text-center">
              Já tem conta? <Link to="/entrar" className="underline text-white/60 hover:text-white">Entrar</Link>
            </p>
          </div>
        )}

        {step === 'creating' && !error && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <Loader2 size={28} className="animate-spin mx-auto text-amber-400" />
            <p className="text-sm text-white/70 mt-4">Criando seu estabelecimento…</p>
          </div>
        )}

        {error && step !== 'data' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-sm text-rose-400">{error}</p>
            <button onClick={() => { setStep('data'); setError(null); }} className="btn-ghost text-xs px-4 py-2 mt-4">
              Voltar
            </button>
          </div>
        )}

        {step === 'error' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <p className="text-sm text-rose-400">{error}</p>
            <button onClick={() => setStep('data')} className="btn-ghost text-xs px-4 py-2 mt-4">
              Voltar
            </button>
          </div>
        )}

        <Link to="/explorar" className="block text-center text-xs text-white/40 hover:text-white mt-8 underline underline-offset-2">
          Voltar para o diretório público
        </Link>
      </div>
    </div>
  );
}
