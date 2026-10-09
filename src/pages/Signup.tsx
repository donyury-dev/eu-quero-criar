import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Loader2, MailCheck, Store } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORY_LABELS } from '../lib/types';

export default function Signup() {
  const [step, setStep] = useState<'data' | 'code' | 'creating'>('data');
  const [form, setForm] = useState({ name: '', category: 'barbearia', city: '', whatsapp: '', ownerName: '' });
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setEmail(data.session.user.email ?? '');
    });
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setSending(false);
    if (error) setError(error.message);
    else {
      setStep('code');
      setNotice('Código enviado! Confira sua caixa de entrada (e o spam).');
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setStep('creating');
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'email',
    });
    if (verifyErr) {
      setSending(false);
      setStep('code');
      return setError(verifyErr.message);
    }
    const { data, error: rpcErr } = await supabase.rpc('create_establishment', {
      p_name: form.name.trim(),
      p_category: form.category,
      p_city: form.city.trim(),
      p_whatsapp: form.whatsapp.trim(),
      p_owner_name: form.ownerName.trim(),
    });
    setSending(false);
    if (rpcErr) return setError(rpcErr.message);
    void data;
    setStep('data');
    navigate('/admin', { replace: true });
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 py-12 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="w-full max-w-md">
        <p className="text-2xl font-extrabold tracking-tight mb-1 text-center">
          Kal<span className="text-amber-400">Bix</span> Agenda
        </p>
        <p className="text-white/60 text-sm mb-6 text-center">
          Crie o agendamento online do seu negócio em 2 minutos — 7 dias grátis.
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
            <button
              disabled={form.name.trim().length < 2}
              onClick={() => setStep('code')}
              className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Continuar <ArrowRight size={16} />
            </button>
            <p className="text-[11px] text-white/40 text-center">
              Já tem conta? <Link to="/entrar" className="underline text-white/60 hover:text-white">Entrar</Link>
            </p>
          </div>
        )}

        {step === 'code' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <MailCheck size={18} className="text-amber-400" /> Confirme seu e-mail
            </h1>
            <form onSubmit={handleSendCode} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <button disabled={sending} className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50">
                {sending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Enviar código
              </button>
            </form>
            <form onSubmit={handleVerify} className="space-y-3">
              <input
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="w-full rounded-lg bg-white/10 border border-white/15 px-3 py-2.5 text-center text-xl tracking-[0.4em] placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/60"
              />
              <button
                disabled={sending || code.replace(/\D/g, '').length < 6}
                className="btn-accent w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Criar meu estabelecimento
              </button>
            </form>
            <button
              type="button"
              onClick={() => { setStep('data'); setCode(''); setNotice(null); }}
              className="w-full text-xs text-white/50 hover:text-white"
            >
              Voltar
            </button>
          </div>
        )}

        {step === 'creating' && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
            <Loader2 size={28} className="animate-spin mx-auto text-amber-400" />
            <p className="text-sm text-white/70 mt-4">Criando seu estabelecimento…</p>
          </div>
        )}

        {notice && step === 'code' && <p className="text-xs text-emerald-400 mt-3 text-center">{notice}</p>}
        {error && <p className="text-xs text-rose-400 mt-3 text-center">{error}</p>}

        <Link to="/explorar" className="block text-center text-xs text-white/40 hover:text-white mt-8 underline underline-offset-2">
          Voltar para o diretório público
        </Link>
      </div>
    </div>
  );
}
