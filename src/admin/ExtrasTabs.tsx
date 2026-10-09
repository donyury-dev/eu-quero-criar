import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtMoney, todayStr } from '../lib/utils';
import type { ClubMember, ClubPlan, ClubVisit, Product, ProductSale, Tenant } from '../lib/types';

function DemoBadge() {
  return (
    <span className="text-[9px] font-bold uppercase tracking-wide bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
      demo
    </span>
  );
}

// ============================== ESTOQUE ==============================
export function StockTab({ tenant }: { tenant: Tenant }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sellFor, setSellFor] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', cost: '', price: '', stock: '', minStock: '3' });

  const load = useCallback(async () => {
    setLoading(true);
    const monthStart = `${todayStr().slice(0, 7)}-01`;
    const [p, s] = await Promise.all([
      supabase.from('products').select('*').eq('tenant_id', tenant.id).order('name'),
      supabase.from('product_sales').select('*').eq('tenant_id', tenant.id).gte('sold_at', monthStart).order('sold_at', { ascending: false }),
    ]);
    setProducts((p.data as Product[]) ?? []);
    setSales((s.data as ProductSale[]) ?? []);
    setLoading(false);
  }, [tenant.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cost = Math.round(parseFloat(form.cost.replace(',', '.') || '0') * 100);
    const price = Math.round(parseFloat(form.price.replace(',', '.') || '0') * 100);
    if (!form.name.trim()) return setError('Informe o nome do produto.');
    if (price <= 0) return setError('Informe o preço de venda.');
    const { error: err } = await supabase.from('products').insert({
      tenant_id: tenant.id,
      name: form.name.trim(),
      cost_cents: Math.max(0, cost),
      price_cents: price,
      stock: parseInt(form.stock || '0', 10) || 0,
      min_stock: parseInt(form.minStock || '3', 10) || 0,
    });
    if (err) return setError(err.message);
    setForm({ name: '', cost: '', price: '', stock: '', minStock: '3' });
    setShowForm(false);
    load();
  }

  async function sell(product: Product, qty: number, customer: string) {
    setError(null);
    const { error: err } = await supabase.rpc('sell_product', {
      p_product_id: product.id,
      p_qty: qty,
      p_customer_name: customer || null,
    });
    if (err) setError(err.message);
    setSellFor(null);
    load();
  }

  async function restock(product: Product, qty: number) {
    await supabase.from('products').update({ stock: product.stock + qty }).eq('id', product.id);
    load();
  }

  async function removeProduct(product: Product) {
    if (!confirm(`Remover "${product.name}" e o histórico de vendas dele?`)) return;
    await supabase.from('products').delete().eq('id', product.id);
    load();
  }

  const monthRevenue = sales.reduce((s, v) => s + v.total_cents, 0);
  const monthCost = sales.reduce((s, v) => s + v.unit_cost_cents * v.qty, 0);
  const lowStock = products.filter((p) => p.active && p.stock <= p.min_stock);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold">Estoque de produtos</h2>
        <button onClick={() => setShowForm(!showForm)} className="btn-accent text-xs px-3 py-2 flex items-center gap-1.5">
          <Plus size={14} /> Produto
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Cadastre produtos, registre vendas (baixa automática) e acompanhe o resultado no mês.
      </p>

      {showForm && (
        <form onSubmit={addProduct} className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 items-end">
          <label className="col-span-2">
            <span className="text-[11px] text-slate-400 block mb-1">Nome *</span>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pomada modeladora" />
          </label>
          <label>
            <span className="text-[11px] text-slate-400 block mb-1">Custo (R$)</span>
            <input className="input" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} inputMode="decimal" placeholder="12,00" />
          </label>
          <label>
            <span className="text-[11px] text-slate-400 block mb-1">Preço (R$) *</span>
            <input className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} inputMode="decimal" placeholder="35,00" />
          </label>
          <label>
            <span className="text-[11px] text-slate-400 block mb-1">Estoque</span>
            <input className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} inputMode="numeric" placeholder="10" />
          </label>
          <button className="btn-accent py-2.5 text-sm">Salvar</button>
        </form>
      )}
      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Vendas no mês</p>
          <p className="text-lg font-bold">{sales.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Faturamento de produtos</p>
          <p className="text-lg font-bold text-emerald-600">{fmtMoney(monthRevenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Lucro de produtos</p>
          <p className="text-lg font-bold">{fmtMoney(monthRevenue - monthCost)}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-2.5 mb-4">
          ⚠️ Estoque baixo: {lowStock.map((p) => p.name).join(', ')}
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-slate-400 text-sm"><Loader2 className="animate-spin mx-auto" /></div>
      ) : products.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          Nenhum produto cadastrado ainda. Clique em "Produto" para começar.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Produto</th>
                <th className="px-4 py-2.5 font-semibold text-center">Estoque</th>
                <th className="px-4 py-2.5 font-semibold text-right">Custo</th>
                <th className="px-4 py-2.5 font-semibold text-right">Preço</th>
                <th className="px-4 py-2.5 font-semibold text-center">Vendidos (mês)</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const sold = sales.filter((s) => s.product_id === p.id).reduce((s, v) => s + v.qty, 0);
                return (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-rose-100 text-rose-600' : p.stock <= p.min_stock ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {p.stock === 0 ? 'esgotado' : p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{fmtMoney(p.cost_cents)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtMoney(p.price_cents)}</td>
                    <td className="px-4 py-2.5 text-center">{sold}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setSellFor(p)} disabled={p.stock === 0} className="btn-accent text-[11px] px-2.5 py-1.5 disabled:opacity-40">Vender</button>
                        <button onClick={() => restock(p, 10)} className="btn-ghost text-[11px] px-2 py-1.5" title="Repor +10">+10</button>
                        <button onClick={() => removeProduct(p)} className="p-1.5 text-slate-300 hover:text-rose-500" title="Remover"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sellFor && (
        <SellModal
          product={sellFor}
          onClose={() => setSellFor(null)}
          onConfirm={(qty, customer) => sell(sellFor, qty, customer)}
        />
      )}
    </div>
  );
}

function SellModal({ product, onClose, onConfirm }: { product: Product; onClose: () => void; onConfirm: (qty: number, customer: string) => void }) {
  const [qty, setQty] = useState(1);
  const [customer, setCustomer] = useState('');
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 px-4" onClick={onClose}>
      <div className="card p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-sm mb-1">Vender {product.name}</p>
        <p className="text-xs text-slate-400 mb-4">Estoque atual: {product.stock} · {fmtMoney(product.price_cents)} cada</p>
        <label className="block mb-3">
          <span className="text-[11px] text-slate-400 block mb-1">Quantidade</span>
          <input type="number" min={1} max={product.stock} className="input" value={qty} onChange={(e) => setQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value || '1', 10))))} />
        </label>
        <label className="block mb-4">
          <span className="text-[11px] text-slate-400 block mb-1">Cliente (opcional)</span>
          <input className="input" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Nome do cliente" />
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 py-2.5 text-sm">Cancelar</button>
          <button onClick={() => onConfirm(qty, customer)} className="btn-accent flex-1 py-2.5 text-sm">
            Vender {fmtMoney(product.price_cents * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================== CLUBE ==============================
export function ClubTab({ tenant }: { tenant: Tenant }) {
  const [plans, setPlans] = useState<ClubPlan[]>([]);
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [visits, setVisits] = useState<ClubVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState<ClubPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [planForm, setPlanForm] = useState({ name: '', price: '', cuts: '4', perks: '' });
  const [memberForm, setMemberForm] = useState({ name: '', phone: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m, v] = await Promise.all([
      supabase.from('club_plans').select('*').eq('tenant_id', tenant.id).order('sort_order'),
      supabase.from('club_members').select('*').eq('tenant_id', tenant.id).order('created_at'),
      supabase.from('club_visits').select('*').eq('tenant_id', tenant.id).gte('visit_date', `${todayStr().slice(0, 7)}-01`),
    ]);
    setPlans((p.data as ClubPlan[]) ?? []);
    setMembers((m.data as ClubMember[]) ?? []);
    setVisits((v.data as ClubVisit[]) ?? []);
    setLoading(false);
  }, [tenant.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addPlan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const price = Math.round(parseFloat(planForm.price.replace(',', '.') || '0') * 100);
    if (!planForm.name.trim()) return setError('Informe o nome do plano.');
    if (price <= 0) return setError('Informe o preço mensal.');
    const maxSort = plans.reduce((s, p) => Math.max(s, p.sort_order), 0);
    const { error: err } = await supabase.from('club_plans').insert({
      tenant_id: tenant.id,
      name: planForm.name.trim(),
      price_cents: price,
      cuts_per_month: Math.max(1, parseInt(planForm.cuts || '4', 10)),
      perks: planForm.perks.trim() || null,
      sort_order: maxSort + 1,
    });
    if (err) return setError(err.message);
    setPlanForm({ name: '', price: '', cuts: '4', perks: '' });
    setShowPlanForm(false);
    load();
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!showMemberForm) return;
    if (!memberForm.name.trim() || memberForm.phone.replace(/\D/g, '').length < 10) {
      return setError('Preencha o nome e um telefone válido (com DDD).');
    }
    const { error: err } = await supabase.from('club_members').insert({
      tenant_id: tenant.id,
      plan_id: showMemberForm.id,
      customer_name: memberForm.name.trim(),
      customer_phone: memberForm.phone.trim(),
    });
    if (err) return setError(err.message === 'duplicate key value violates unique constraint "club_members_tenant_id_customer_phone_key"'
      ? 'Já existe um assinante com esse telefone.' : err.message);
    setMemberForm({ name: '', phone: '' });
    setShowMemberForm(null);
    load();
  }

  async function addVisit(member: ClubMember, plan: ClubPlan) {
    setError(null);
    const used = visits.filter((v) => v.member_id === member.id).length;
    if (used >= plan.cuts_per_month) {
      return setError(`${member.customer_name} já usou todos os ${plan.cuts_per_month} do mês.`);
    }
    await supabase.from('club_visits').insert({ tenant_id: tenant.id, member_id: member.id });
    load();
  }

  async function removeMember(member: ClubMember) {
    if (!confirm(`Remover ${member.customer_name} do clube?`)) return;
    await supabase.from('club_members').delete().eq('id', member.id);
    load();
  }

  const mrr = members.filter((m) => m.active).reduce((s, m) => s + (plans.find((p) => p.id === m.plan_id)?.price_cents ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold">Clube de assinatura</h2>
        <button onClick={() => setShowPlanForm(!showPlanForm)} className="btn-accent text-xs px-3 py-2 flex items-center gap-1.5">
          <Plus size={14} /> Plano
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Crie planos (ex.: "4 cortes/mês"), cadastre assinantes e marque as visitas — o limite do mês é controlado automaticamente.
      </p>

      {showPlanForm && (
        <form onSubmit={addPlan} className="card p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
          <label className="col-span-2">
            <span className="text-[11px] text-slate-400 block mb-1">Nome do plano *</span>
            <input className="input" value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Clube Clássico" />
          </label>
          <label>
            <span className="text-[11px] text-slate-400 block mb-1">Preço/mês (R$) *</span>
            <input className="input" value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} inputMode="decimal" placeholder="99,00" />
          </label>
          <label>
            <span className="text-[11px] text-slate-400 block mb-1">Cortes/mês</span>
            <input className="input" value={planForm.cuts} onChange={(e) => setPlanForm({ ...planForm, cuts: e.target.value })} inputMode="numeric" />
          </label>
          <button className="btn-accent py-2.5 text-sm">Salvar</button>
          <label className="col-span-2 md:col-span-5">
            <span className="text-[11px] text-slate-400 block mb-1">Benefícios (opcional, separados por vírgula)</span>
            <input className="input" value={planForm.perks} onChange={(e) => setPlanForm({ ...planForm, perks: e.target.value })} placeholder="Prioridade na agenda, 10% em produtos" />
          </label>
        </form>
      )}
      {error && <p className="text-xs text-rose-600 mb-3">{error}</p>}

      <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">
        <div className="space-y-3">
          {plans.length === 0 && !loading && (
            <div className="card p-5 text-center text-sm text-slate-500">
              Nenhum plano ainda. Crie o primeiro plano do clube.
            </div>
          )}
          {plans.map((plan) => (
            <div key={plan.id} className="card p-5" style={{ borderTop: '3px solid var(--accent)' }}>
              <p className="font-bold">{plan.name}</p>
              <p className="text-2xl font-extrabold mt-1">
                {fmtMoney(plan.price_cents)}
                <span className="text-xs font-normal text-slate-400">/mês</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">{plan.cuts_per_month} visitas por mês</p>
              {plan.perks && (
                <ul className="text-xs text-slate-500 mt-2 space-y-1">
                  {plan.perks.split(',').map((perk) => (
                    <li key={perk} className="flex gap-2"><span className="brand-text font-bold">✓</span> {perk.trim()}</li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowMemberForm(plan)} className="btn-ghost w-full mt-3 py-2 text-xs flex items-center justify-center gap-1.5">
                <Plus size={13} /> Cadastrar assinante
              </button>
            </div>
          ))}
        </div>

        <div>
          <div className="card p-4 mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Receita recorrente (MRR)</span>
            <span className="text-lg font-bold text-emerald-600">{fmtMoney(mrr)}</span>
          </div>

          {showMemberForm && (
            <form onSubmit={addMember} className="card p-4 mb-3 grid grid-cols-3 gap-2 items-end">
              <p className="col-span-3 text-xs font-semibold text-slate-500">Novo assinante — plano {showMemberForm.name}</p>
              <label>
                <span className="text-[11px] text-slate-400 block mb-1">Nome *</span>
                <input className="input" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} />
              </label>
              <label>
                <span className="text-[11px] text-slate-400 block mb-1">WhatsApp * (com DDD)</span>
                <input className="input" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} inputMode="tel" placeholder="11912345678" />
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowMemberForm(null)} className="btn-ghost flex-1 py-2.5 text-xs">Cancelar</button>
                <button className="btn-accent flex-1 py-2.5 text-xs">Salvar</button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="card p-8 text-center text-slate-400 text-sm"><Loader2 className="animate-spin mx-auto" /></div>
          ) : members.length === 0 ? (
            <div className="card p-8 text-center text-sm text-slate-500">Nenhum assinante cadastrado ainda.</div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-4 py-2.5 font-semibold">Assinante</th>
                    <th className="px-4 py-2.5 font-semibold">Plano</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Uso no mês</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m) => {
                    const plan = plans.find((p) => p.id === m.plan_id);
                    const used = visits.filter((v) => v.member_id === m.id).length;
                    const limit = plan?.cuts_per_month ?? 0;
                    return (
                      <tr key={m.id} className={!m.active ? 'opacity-50' : ''}>
                        <td className="px-4 py-2.5 font-medium">
                          {m.customer_name}
                          <span className="block text-[11px] text-slate-400">{m.customer_phone}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{plan?.name ?? '—'}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${used >= limit ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-700'}`}>
                            {used}/{limit}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => plan && addVisit(m, plan)} disabled={used >= limit || !plan} className="btn-accent text-[11px] px-2.5 py-1.5 disabled:opacity-40">
                              Marcar visita
                            </button>
                            <button onClick={() => removeMember(m)} className="p-1.5 text-slate-300 hover:text-rose-500" title="Remover"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
