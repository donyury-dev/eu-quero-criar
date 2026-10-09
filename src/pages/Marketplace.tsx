import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, MapPin, LogIn, Sparkles, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tenant } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';

const CATEGORY_ICONS: Record<string, string> = { barbearia: '💈', salao: '💇', estetica: '🧖' };

export default function Marketplace() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('tenants').select('*').order('created_at').then(({ data }) => {
      setTenants(data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(
    () =>
      tenants.filter(
        (t) =>
          (!category || t.category === category) &&
          (t.name.toLowerCase().includes(query.toLowerCase()) ||
            (t.city ?? '').toLowerCase().includes(query.toLowerCase()))
      ),
    [tenants, query, category]
  );

  const categories = Object.entries(CATEGORY_LABELS);

  return (
    <div className="min-h-screen">
      <header className="brand-bg text-white" style={{ ['--brand' as string]: '#0f172a', ['--accent' as string]: '#f59e0b' }}>
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-6">
          <div className="flex items-center justify-between">
            <p className="text-lg font-extrabold tracking-tight">
              Agenda<span className="brand-text">Pro</span>
            </p>
            <Link to="/entrar" className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 transition rounded-lg px-3 py-2">
              <LogIn size={15} /> Área do dono
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mt-6 leading-tight">
            Encontre e agende seu próximo horário
          </h1>
          <p className="text-white/70 text-sm mt-2">
            Barbearias, salões e clínicas perto de você. Agende online em segundos.
          </p>
          <div className="relative mt-5">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou cidade…"
              className="w-full rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 bg-white outline-none shadow"
            />
          </div>
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            <Chip active={category === null} onClick={() => setCategory(null)}>
              Todos
            </Chip>
            {categories.map(([key, label]) => (
              <Chip key={key} active={category === key} onClick={() => setCategory(key)}>
                {CATEGORY_ICONS[key]} {label}
              </Chip>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {loading ? (
          <div className="text-center text-slate-400 text-sm animate-pulse py-12">Carregando estabelecimentos…</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((t) => (
              <article key={t.id} className="card p-4 flex flex-col">
                <div className="flex items-center gap-3">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt={t.name} className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl grid place-items-center text-xl"
                      style={{ background: t.primary_color + '14' }}
                    >
                      {CATEGORY_ICONS[t.category] ?? '✂️'}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="font-bold truncate">{t.name}</h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin size={12} /> {t.city ?? '—'}
                    </p>
                  </div>
                </div>
                {t.description && <p className="text-xs text-slate-500 mt-3 leading-relaxed line-clamp-2">{t.description}</p>}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                  <Link
                    to={`/agendar/${t.slug}`}
                    className="btn-accent text-xs px-4 py-2"
                    style={{ ['--accent' as string]: t.secondary_color }}
                  >
                    Agendar
                  </Link>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <div className="card p-8 text-center text-sm text-slate-500 sm:col-span-2">
                Nenhum estabelecimento encontrado para “{query}”.
              </div>
            )}
          </div>
        )}

        <div className="card p-4 mt-8 flex items-start gap-3 bg-gradient-to-r from-amber-50 to-white">
          <Sparkles size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Você é dono de estabelecimento?</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Tenha sua própria página de agendamento com sua marca, app instalável e agenda completa. Faça uma
              demonstração agora.
            </p>
            <Link to="/entrar" className="btn-accent inline-block text-xs px-4 py-2 mt-2">
              Quero ver a demonstração
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-8">
          <Smartphone size={13} className="inline -mt-0.5" /> Ambiente de demonstração — KalBix Agenda
        </p>
      </main>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition ${
        active ? 'brand-accent border-transparent font-semibold' : 'bg-white/10 text-white border-white/20'
      }`}
    >
      {children}
    </button>
  );
}
