import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  CalendarDays,
  Scissors,
  Users,
  Clock,
  Palette,
  Wallet,
  Contact,
  Package,
  Repeat,
  Clapperboard,
  ExternalLink,
  LogOut,
  Loader2,
  ScissorsSquare,
} from 'lucide-react';
import { supabase, DEMO_TENANT_ID } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Tenant } from '../lib/types';
import AgendaTab from '../admin/AgendaTab';
import ServicesTab from '../admin/ServicesTab';
import TeamTab from '../admin/TeamTab';
import HoursTab from '../admin/HoursTab';
import BrandingTab from '../admin/BrandingTab';
import FinanceTab from '../admin/FinanceTab';
import CrmTab from '../admin/CrmTab';
import { StockTab, ClubTab } from '../admin/ExtrasTabs';
import EditorTab from '../admin/EditorTab';

const TABS = [
  { key: 'agenda', label: 'Agenda', icon: CalendarDays },
  { key: 'services', label: 'Serviços', icon: Scissors },
  { key: 'team', label: 'Equipe', icon: Users },
  { key: 'hours', label: 'Horários', icon: Clock },
  { key: 'branding', label: 'Personalização', icon: Palette },
  { key: 'finance', label: 'Financeiro', icon: Wallet },
  { key: 'crm', label: 'Clientes', icon: Contact },
  { key: 'stock', label: 'Estoque', icon: Package },
  { key: 'club', label: 'Clube', icon: Repeat },
  { key: 'editor', label: 'Editor de Vídeo', icon: Clapperboard },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Admin() {
  const { user, profile, loading, signOut } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tab, setTab] = useState<TabKey>('agenda');

  const tenantId = profile?.tenant_id ?? DEMO_TENANT_ID;

  useEffect(() => {
    supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle()
      .then(({ data }) => setTenant(data));
  }, [tenantId]);

  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (!user) return <Navigate to="/entrar" replace />;

  if (!profile)
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center bg-slate-900 text-white">
        <div>
          <p className="text-lg font-semibold mb-2">Sua conta não está vinculada a um estabelecimento.</p>
          <Link to="/entrar" className="btn-accent inline-block px-5 py-2.5 text-sm">
            Ativar modo demonstração
          </Link>
        </div>
      </div>
    );

  if (!tenant)
    return (
      <div className="min-h-screen grid place-items-center text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen flex" style={{ ['--brand' as string]: tenant.primary_color, ['--accent' as string]: tenant.secondary_color }}>
      {/* Sidebar (desktop) */}
      <aside className="brand-bg text-white w-60 shrink-0 hidden lg:flex flex-col fixed inset-y-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <ScissorsSquare size={22} className="brand-text shrink-0" />
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight">AgendaPro</p>
            <p className="text-[10px] text-white/50">Painel do estabelecimento</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition ${
                tab === key ? 'bg-white/15 font-semibold' : 'text-white/70 hover:bg-white/8'
              }`}
            >
              <Icon size={16} className={tab === key ? 'brand-text' : ''} /> {label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10 space-y-1">
          <Link
            to={`/agendar/${tenant.slug}`}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/70 hover:bg-white/10"
          >
            <ExternalLink size={14} /> Ver página de agendamento
          </Link>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-white/70 hover:bg-white/10"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 lg:ml-60 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-3 px-4 py-3">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg brand-accent grid place-items-center text-xs font-bold text-slate-900">
                {tenant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm leading-tight truncate">{tenant.name}</p>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                Modo demonstração · {profile.name}
              </p>
            </div>
            <Link to={`/agendar/${tenant.slug}`} className="lg:hidden text-slate-500">
              <ExternalLink size={18} />
            </Link>
            <button onClick={signOut} className="lg:hidden text-slate-500">
              <LogOut size={18} />
            </button>
          </div>
          {/* Mobile tabs */}
          <nav className="flex gap-1 px-3 pb-2 overflow-x-auto lg:hidden">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full transition ${
                  tab === key ? 'brand-accent font-semibold text-slate-900' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
          {tab === 'agenda' && <AgendaTab tenant={tenant} />}
          {tab === 'services' && <ServicesTab tenant={tenant} />}
          {tab === 'team' && <TeamTab tenant={tenant} />}
          {tab === 'hours' && <HoursTab tenant={tenant} />}
          {tab === 'branding' && <BrandingTab tenant={tenant} onSaved={setTenant} />}
          {tab === 'finance' && <FinanceTab tenant={tenant} />}
          {tab === 'crm' && <CrmTab tenant={tenant} />}
          {tab === 'stock' && <StockTab />}
          {tab === 'club' && <ClubTab />}
          {tab === 'editor' && <EditorTab tenant={tenant} />}
        </main>
      </div>
    </div>
  );
}
