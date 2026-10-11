import { useRef, useState } from 'react';
import { Upload, Save, Eye, Check, Link2, Copy, Share2, QrCode, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CATEGORY_LABELS, type Tenant } from '../lib/types';
import { compressImage } from '../lib/utils';

function sanitizeSlug(v: string): string {
  return v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-');
}

export default function BrandingTab({ tenant, onSaved }: { tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    category: tenant.category,
    city: tenant.city ?? '',
    description: tenant.description ?? '',
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    logo_url: tenant.logo_url,
    cover_url: tenant.cover_url ?? '',
    whatsapp: tenant.whatsapp ?? '',
    confirmation_message: tenant.confirmation_message ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const [slug, setSlug] = useState(tenant.slug);
  const [copied, setCopied] = useState(false);
  const [slugErr, setSlugErr] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // HashRouter: o link compartilhável precisa do "#/" para abrir a rota certa.
  const bookingUrl = `${window.location.origin}/#/agendar/${slug || tenant.slug}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = bookingUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function pickImage(file: File, field: 'logo_url' | 'cover_url') {
    try {
      const dataUrl = await compressImage(file, field === 'logo_url' ? 256 : 1024);
      setForm((f) => ({ ...f, [field]: dataUrl }));
    } catch {
      alert('Não foi possível carregar a imagem. Use PNG ou JPG.');
    }
  }

  async function save() {
    if (!form.name.trim()) return;
    const s = slug.trim().replace(/^-+|-+$/g, '');
    if (s.length < 3) {
      setSlugErr('O endereço precisa ter pelo menos 3 caracteres.');
      return;
    }
    if (s !== tenant.slug) {
      const { data: taken } = await supabase.from('tenants').select('id').eq('slug', s).maybeSingle();
      if (taken) {
        setSlugErr('Esse endereço já está em uso — escolha outro.');
        return;
      }
    }
    setSlugErr(null);
    setSaving(true);
    const { data, error } = await supabase
      .from('tenants')
      .update({
        name: form.name.trim(),
        category: form.category,
        city: form.city.trim() || null,
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        logo_url: form.logo_url,
        cover_url: form.cover_url.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        confirmation_message: form.confirmation_message.trim() || null,
        slug: s,
      })
      .eq('id', tenant.id)
      .select('*')
      .single();
    setSaving(false);
    if (!error && data) {
      onSaved(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
      <div>
        <h2 className="font-bold">Personalização</h2>
        <p className="text-xs text-slate-500 mb-4">
          Tudo aqui aparece na hora na sua página de agendamento — logo, cores e informações.
        </p>

        <div className="card p-4 mb-4 border-2" style={{ borderColor: form.secondary_color }}>
          <h3 className="font-bold text-sm flex items-center gap-1.5">
            <Link2 size={15} /> Seu link de agendamento
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 mb-3">
            Coloque esse link na bio do Instagram, WhatsApp e redes sociais — é por ele que seus clientes agendam.
          </p>
          <div className="flex gap-1.5">
            <input readOnly className="input text-xs flex-1 bg-slate-50" value={bookingUrl} onFocus={(e) => e.currentTarget.select()} />
            <button
              onClick={copyLink}
              className={`text-xs font-semibold px-3.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap transition ${
                copied ? 'bg-emerald-100 text-emerald-700' : 'btn-accent'
              }`}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <a href={bookingUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 flex items-center gap-1.5">
              <ExternalLink size={12} /> Abrir página
            </a>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Agende online: ${bookingUrl}`)}`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 flex items-center gap-1.5"
            >
              <Share2 size={12} /> Enviar no WhatsApp
            </a>
            <button
              onClick={() => setShowQr((v) => !v)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 flex items-center gap-1.5"
            >
              <QrCode size={12} /> QR Code
            </button>
          </div>
          {showQr && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-slate-100 flex flex-col items-center gap-2">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bookingUrl)}`}
                alt="QR Code do link"
                className="w-40 h-40 rounded-lg"
              />
              <p className="text-[10px] text-slate-400 text-center">Cliente aponta a câmera do celular e cai direto na sua página de agendamento.</p>
            </div>
          )}
          <label className="block mt-4">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Endereço personalizado</span>
            <div className="flex items-stretch">
              <span className="text-[11px] text-slate-400 bg-slate-50 border border-r-0 border-slate-200 rounded-l-xl px-2.5 flex items-center whitespace-nowrap overflow-hidden">
                {window.location.origin}/agendar/
              </span>
              <input
                className="input rounded-l-none text-xs"
                value={slug}
                onChange={(e) => {
                  setSlugErr(null);
                  setSlug(sanitizeSlug(e.target.value));
                }}
              />
            </div>
            {slugErr ? (
              <span className="text-[11px] text-rose-600 mt-1 block">{slugErr}</span>
            ) : (
              <span className="text-[10px] text-slate-400 mt-1 block">Salve para aplicar. Atenção: se mudar o endereço, o link antigo para de funcionar.</span>
            )}
          </label>
        </div>

        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-4">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Logo" className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
            ) : (
              <div
                className="w-16 h-16 rounded-2xl grid place-items-center text-2xl font-bold"
                style={{ background: form.secondary_color, color: form.primary_color }}
              >
                {form.name.charAt(0)}
              </div>
            )}
            <div>
              <input
                ref={logoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0], 'logo_url')}
              />
              <button onClick={() => logoRef.current?.click()} className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5">
                <Upload size={13} /> Enviar logo
              </button>
              {form.logo_url && (
                <button onClick={() => setForm({ ...form, logo_url: null })} className="text-[11px] text-slate-400 underline mt-1.5">
                  remover
                </button>
              )}
              <p className="text-[10px] text-slate-400 mt-1">PNG ou JPG, quadrado fica melhor.</p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Nome do estabelecimento</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Tipo de negócio</span>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Cidade</span>
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Descrição</span>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Telefone</span>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">WhatsApp (com DDD)</span>
              <input className="input" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} inputMode="tel" placeholder="11912345678" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Endereço</span>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          <div>
            <span className="text-xs font-semibold text-slate-600 block mb-1">Imagem de capa</span>
            <input
              ref={coverRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0], 'cover_url')}
            />
            {form.cover_url ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200">
                <img src={form.cover_url} alt="Capa" className="w-full h-32 object-cover" />
                <button
                  onClick={() => setForm({ ...form, cover_url: '' })}
                  className="absolute top-2 right-2 bg-white/90 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                >
                  remover
                </button>
              </div>
            ) : (
              <button onClick={() => coverRef.current?.click()} className="btn-ghost w-full py-6 text-xs text-slate-400 border-dashed">
                <Upload size={14} className="inline mr-1.5" /> Enviar capa (aparece no topo da página pública)
              </button>
            )}
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 block mb-1">Mensagem de confirmação do agendamento</span>
            <textarea
              className="input"
              rows={2}
              value={form.confirmation_message}
              onChange={(e) => setForm({ ...form, confirmation_message: e.target.value })}
              placeholder="Ex: Te esperamos no dia marcado! Chegue com 5 minutos de antecedência."
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Aparece na confirmação depois que o cliente agenda.</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Cor principal (fundo)</span>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
                <input className="input" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 block mb-1">Cor de destaque</span>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                />
                <input
                  className="input"
                  value={form.secondary_color}
                  onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                />
              </div>
            </label>
          </div>
          <button onClick={save} disabled={saving} className="btn-accent w-full py-2.5 text-sm flex items-center justify-center gap-2">
            <Save size={15} /> {saving ? 'Salvando…' : 'Salvar personalização'}
          </button>
          {saved && <p className="text-xs text-emerald-600 font-medium text-center">Salvo! A página pública já está atualizada.</p>}
        </div>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-24">
        <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-2">
          <Eye size={13} /> Prévia da página pública
        </p>
        <div
          className="rounded-2xl overflow-hidden border border-slate-200 shadow-lg"
          style={{ background: form.primary_color }}
        >
          <div className="p-4 text-white">
            <div className="flex items-center gap-3">
              {form.logo_url ? (
                <img src={form.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover shadow" />
              ) : (
                <div
                  className="w-11 h-11 rounded-xl grid place-items-center font-bold"
                  style={{ background: form.secondary_color, color: form.primary_color }}
                >
                  {form.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-sm truncate">{form.name || 'Seu estabelecimento'}</p>
                <p className="text-[10px] text-white/60">agendamento online</p>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 p-3 space-y-2">
            {['Corte Masculino', 'Corte + Barba', 'Barba Terapia'].map((s) => (
              <div key={s} className="bg-white rounded-xl px-3 py-2.5 flex items-center justify-between text-xs">
                <span className="font-medium">{s}</span>
                <span className="font-bold" style={{ color: form.secondary_color }}>
                  agendar
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
