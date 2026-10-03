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
};
