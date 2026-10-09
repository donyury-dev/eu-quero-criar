export type Tenant = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  logo_url: string | null;
  cover_url: string | null;
  primary_color: string;
  secondary_color: string;
  whatsapp: string | null;
  confirmation_message: string | null;
  is_blocked: boolean;
};

export type Subscription = {
  id: string;
  tenant_id: string;
  provider: string;
  provider_sub_id: string | null;
  plan: string;
  price_cents: number;
  status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
  trial_ends_at: string | null;
  current_period_end: string | null;
  updated_at: string;
};

export type Product = {
  id: string;
  tenant_id: string;
  name: string;
  cost_cents: number;
  price_cents: number;
  stock: number;
  min_stock: number;
  active: boolean;
};

export type ProductSale = {
  id: string;
  tenant_id: string;
  product_id: string;
  qty: number;
  unit_price_cents: number;
  unit_cost_cents: number;
  total_cents: number;
  customer_name: string | null;
  sold_at: string;
};

export type ClubPlan = {
  id: string;
  tenant_id: string;
  name: string;
  price_cents: number;
  cuts_per_month: number;
  discount_pct: number;
  perks: string | null;
  active: boolean;
  sort_order: number;
};

export type ClubMember = {
  id: string;
  tenant_id: string;
  plan_id: string;
  customer_name: string;
  customer_phone: string;
  since: string;
  active: boolean;
};

export type ClubVisit = {
  id: string;
  tenant_id: string;
  member_id: string;
  visit_date: string;
  appointment_id: string | null;
  notes: string | null;
};

export function effectiveSubStatus(s: Subscription): Subscription['status'] {
  if (s.status === 'trialing' && s.trial_ends_at && new Date(s.trial_ends_at) < new Date()) return 'past_due';
  return s.status;
}

export const SUB_STATUS_META: Record<Subscription['status'], { label: string; cls: string }> = {
  trialing: { label: 'Teste grátis', cls: 'bg-sky-100 text-sky-700' },
  active: { label: 'Ativa', cls: 'bg-emerald-100 text-emerald-700' },
  past_due: { label: 'Pagamento pendente', cls: 'bg-amber-100 text-amber-700' },
  suspended: { label: 'Suspensa', cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500' },
};

export type Profile = {
  id: string;
  user_id: string;
  tenant_id: string | null;
  role: string;
  name: string | null;
};

export type Service = {
  id: string;
  tenant_id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  color: string;
  active: boolean;
  sort_order: number;
};

export type Professional = {
  id: string;
  tenant_id: string;
  name: string;
  specialty: string | null;
  commission_pct: number;
  active: boolean;
  sort_order: number;
};

export type ProfessionalService = {
  professional_id: string;
  service_id: string;
  tenant_id: string;
};

export type BusinessHour = {
  id: string;
  tenant_id: string;
  professional_id: string | null;
  weekday: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  closed: boolean;
};

export type Customer = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  created_at: string;
};

export type Appointment = {
  id: string;
  tenant_id: string;
  professional_id: string;
  service_id: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  appointment_date: string;
  start_time: string;
  end_time: string;
  price_cents: number;
  status: 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
};

export const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const CATEGORY_LABELS: Record<string, string> = {
  barbearia: 'Barbearia',
  salao: 'Salão de Beleza',
  estetica: 'Clínica de Estética',
  academia: 'Academia',
  clinica: 'Clínica',
  petshop: 'Pet Shop',
  spa: 'Spa',
  oficina: 'Oficina',
  consultorio: 'Consultório',
};

export const CATEGORY_ICONS: Record<string, string> = {
  barbearia: '💈',
  salao: '💇',
  estetica: '🧖',
  academia: '🏋️',
  clinica: '🩺',
  petshop: '🐾',
  spa: '💆',
  oficina: '🔧',
  consultorio: '🩻',
};
