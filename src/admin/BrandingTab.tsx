import { useRef, useState } from 'react';
import { Upload, Save, Eye, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Tenant } from '../lib/types';
import { compressImage } from '../lib/utils';

export default function BrandingTab({ tenant, onSaved }: { tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    description: tenant.description ?? '',
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    primary_color: tenant.primary_color,
    secondary_color: tenant.secondary_color,
    logo_url: tenant.logo_url,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function pickLogo(file: File) {
    try {
      const dataUrl = await compressImage(file, 256);
      setForm((f) => ({ ...f, logo_url: dataUrl }));
    } catch {
      alert('Não foi possível carregar a imagem. Use PNG ou JPG.');
    }
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('tenants')
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        logo_url: form.logo_url,
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
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => e.target.files?.[0] && pickLogo(e.target.files[0])}
              />
              <button onClick={() => fileRef.current?.click()} className="btn-accent text-xs px-3.5 py-2 flex items-center gap-1.5">
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
              <span className="text-xs font-semibold text-slate-600 block mb-1">Endereço</span>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
          </div>
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
