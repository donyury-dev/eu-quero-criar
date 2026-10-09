-- 009: Estoque real — produtos e vendas com baixa automática

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  cost_cents int not null default 0,
  price_cents int not null default 0,
  stock int not null default 0,
  min_stock int not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  qty int not null check (qty > 0),
  unit_price_cents int not null default 0,
  unit_cost_cents int not null default 0,
  total_cents int not null default 0,
  customer_name text,
  sold_at timestamptz not null default now()
);

create index if not exists idx_product_sales_tenant_month
  on public.product_sales (tenant_id, sold_at);

alter table public.products enable row level security;
alter table public.product_sales enable row level security;

create policy "owner manage products" on public.products for all
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));
create policy "owner manage product sales" on public.product_sales for all
  using (public.is_owner(tenant_id)) with check (public.is_owner(tenant_id));

grant select, insert, update, delete on public.products, public.product_sales to authenticated;

-- Venda de produto: baixa o estoque atomicamente
create or replace function public.sell_product(
  p_product_id uuid,
  p_qty int,
  p_customer_name text default null
)
returns public.product_sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prod public.products;
  v_sale public.product_sales;
begin
  select * into v_prod from public.products where id = p_product_id for update;
  if v_prod.id is null then
    raise exception 'Produto não encontrado.';
  end if;
  if not public.is_owner(v_prod.tenant_id) then
    raise exception 'Sem permissão.';
  end if;
  if p_qty is null or p_qty < 1 then
    raise exception 'Quantidade inválida.';
  end if;
  if v_prod.stock < p_qty then
    raise exception 'Estoque insuficiente: restam % unidades.', v_prod.stock;
  end if;

  update public.products
    set stock = stock - p_qty
    where id = p_product_id
    returning * into v_prod;

  insert into public.product_sales
    (tenant_id, product_id, qty, unit_price_cents, unit_cost_cents, total_cents, customer_name)
  values
    (v_prod.tenant_id, v_prod.id, p_qty, v_prod.price_cents, v_prod.cost_cents,
     v_prod.price_cents * p_qty, nullif(trim(coalesce(p_customer_name, '')), ''))
  returning * into v_sale;

  return v_sale;
end;
$$;

grant execute on function public.sell_product(uuid, int, text) to authenticated;
