import { Package, Repeat, AlertTriangle } from 'lucide-react';

function DemoBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <AlertTriangle size={10} /> Tela de demonstração
    </span>
  );
}

const MOCK_PRODUCTS = [
  { name: 'Pomada Modeladora Matte', stock: 12, cost: 2200, price: 5500, sold: 34 },
  { name: 'Óleo para Barba 30ml', stock: 8, cost: 1800, price: 4500, sold: 21 },
  { name: 'Shampoo Anticaspa 250ml', stock: 15, cost: 1400, price: 3800, sold: 17 },
  { name: 'Balm Pós-Barba', stock: 3, cost: 1600, price: 4200, sold: 26 },
  { name: 'Talco Fresh', stock: 0, cost: 600, price: 1800, sold: 40 },
];

const MOCK_CLUB = {
  planName: 'Clube Nova Era',
  price: 9900,
  perks: ['4 cortes por mês', '20% off em produtos', 'Prioridade na agenda'],
  members: [
    { name: 'Rafael Souza', since: '12/08/2026', used: 3 },
    { name: 'Lucas Andrade', since: '02/09/2026', used: 2 },
    { name: 'Tiago Ferreira', since: '28/09/2026', used: 1 },
    { name: 'Diego Martins', since: '15/09/2026', used: 4 },
  ],
};

export function StockTab() {
  const lowStock = MOCK_PRODUCTS.filter((p) => p.stock <= 3);
  const revenue = MOCK_PRODUCTS.reduce((s, p) => s + p.sold * p.price, 0);
  const profit = MOCK_PRODUCTS.reduce((s, p) => s + p.sold * (p.price - p.cost), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold flex items-center gap-2">
          <Package size={17} className="text-slate-400" /> Estoque e produtos
        </h2>
        <DemoBadge />
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Na versão completa, cada venda no caixa dá baixa automática no estoque.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Vendas de produtos (mês)</p>
          <p className="text-lg font-bold">{(revenue / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] text-slate-400">Lucro bruto estimado</p>
          <p className="text-lg font-bold text-emerald-600">{(profit / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-2.5 mb-4">
          ⚠️ Estoque baixo: {lowStock.map((p) => p.name).join(', ')}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-slate-50 text-left text-xs text-slate-500">
              <th className="px-4 py-2.5 font-semibold">Produto</th>
              <th className="px-4 py-2.5 font-semibold text-center">Estoque</th>
              <th className="px-4 py-2.5 font-semibold text-right">Custo</th>
              <th className="px-4 py-2.5 font-semibold text-right">Preço</th>
              <th className="px-4 py-2.5 font-semibold text-center">Vendidos</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {MOCK_PRODUCTS.map((p) => (
              <tr key={p.name}>
                <td className="px-4 py-2.5 font-medium">{p.name}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-rose-100 text-rose-600' : p.stock <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {p.stock === 0 ? 'esgotado' : p.stock}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right text-slate-500">{(p.cost / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-4 py-2.5 text-right font-semibold">{(p.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td className="px-4 py-2.5 text-center">{p.sold}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ClubTab() {
  const mrr = MOCK_CLUB.members.length * MOCK_CLUB.price;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold flex items-center gap-2">
          <Repeat size={17} className="text-slate-400" /> Clube de assinatura
        </h2>
        <DemoBadge />
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Renda recorrente: o cliente assina e volta todo mês — a versão completa cobra via Pix/cartão automaticamente.
      </p>

      <div className="grid md:grid-cols-[300px_1fr] gap-4 items-start">
        <div className="card p-5" style={{ borderTop: '3px solid var(--accent)' }}>
          <p className="font-bold">{MOCK_CLUB.planName}</p>
          <p className="text-2xl font-extrabold mt-1">
            {(MOCK_CLUB.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            <span className="text-xs font-normal text-slate-400">/mês</span>
          </p>
          <ul className="text-xs text-slate-500 mt-3 space-y-1.5">
            {MOCK_CLUB.perks.map((perk) => (
              <li key={perk} className="flex gap-2">
                <span className="brand-text font-bold">✓</span> {perk}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="card p-4 mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Receita recorrente (MRR)</span>
            <span className="text-lg font-bold text-emerald-600">{(mrr / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500">
                  <th className="px-4 py-2.5 font-semibold">Assinante</th>
                  <th className="px-4 py-2.5 font-semibold">Desde</th>
                  <th className="px-4 py-2.5 font-semibold text-center">Uso no mês</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_CLUB.members.map((m) => (
                  <tr key={m.name}>
                    <td className="px-4 py-2.5 font-medium">{m.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{m.since}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">{m.used}/4</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
