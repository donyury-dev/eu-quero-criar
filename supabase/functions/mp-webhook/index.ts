// Edge Function: mp-webhook
// Recebe notificações do Mercado Pago sobre a assinatura (preapproval) e
// atualiza o status em public.subscriptions.
//
// Secrets necessários: MP_ACCESS_TOKEN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STATUS_MAP: Record<string, string> = {
  authorized: 'active',
  paused: 'suspended',
  cancelled: 'cancelled',
};

function mapStatus(raw: string, nextCharge?: string): { status: string; current_period_end: string | null } {
  const base = STATUS_MAP[raw] ?? 'past_due';
  return { status: base, current_period_end: nextCharge ?? null };
}

Deno.serve(async (req) => {
  const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  if (!MP_TOKEN) return new Response('ok');

  const url = new URL(req.url);
  // Mercado Pago pode notificar por query (?type=&data.id=) ou por corpo JSON
  let notifId = url.searchParams.get('data.id') ?? url.searchParams.get('id');
  let type = url.searchParams.get('type') ?? url.searchParams.get('topic');

  if (!notifId) {
    try {
      const body = await req.json();
      type = body?.type ?? body?.topic ?? type;
      notifId = body?.data?.id ?? notifId;
    } catch {
      // corpo vazio
    }
  }

  if (!notifId) return new Response('ok');

  if (type === 'payment') return handlePayment(notifId, MP_TOKEN);
  if (!type || type === 'subscription_preapproval') return handlePreapproval(notifId, MP_TOKEN);
  return new Response('ok');
});

async function handlePreapproval(preapprovalId: string, MP_TOKEN: string): Promise<Response> {
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const pre = await mpRes.json();
    if (!mpRes.ok || !pre?.external_reference) return new Response('ok');

    const tenantId: string = pre.external_reference;
    const payerEmail: string | null = pre.payer_email ?? null;
    const { status, current_period_end } = mapStatus(pre.status ?? '', pre.next_charge_date ?? null);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          tenant_id: tenantId,
          provider: 'mercopago',
          provider_sub_id: preapprovalId,
          status,
          current_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id' },
      );

    // Registro simples de auditoria (opcional; falha silenciosa)
    void payerEmail;
    return new Response('ok');
  } catch {
    return new Response('ok');
  }
}

async function handlePayment(paymentId: string, MP_TOKEN: string): Promise<Response> {
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const pay = await mpRes.json();
    if (!mpRes.ok || !pay?.external_reference) return new Response('ok');
    if (pay.status !== 'approved') return new Response('ok');

    const externalRef: string = pay.external_reference;
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const now = new Date();

    // Aluguel do editor: external_reference "<tenant_id>|editor"
    if (externalRef.endsWith('|editor')) {
      const tenantId = externalRef.replace(/\|editor$/, '');
      const { data: access } = await supabaseAdmin
        .from('editor_access')
        .select('included_until, plan')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const current = access?.included_until ? new Date(`${access.included_until}T23:59:59`) : null;
      const base = current && current > now ? current : now;
      const end = new Date(base.getTime() + 30 * 86_400_000);
      const { error: upsertErr } = await supabaseAdmin
        .from('editor_access')
        .upsert(
          {
            tenant_id: tenantId,
            plan: access?.plan ?? 'agenda',
            included_until: end.toISOString().slice(0, 10),
            manual_revoked: false,
            updated_at: now.toISOString(),
          },
          { onConflict: 'tenant_id' },
        );
      if (upsertErr) console.error('editor_access upsert:', upsertErr.message);
      return new Response('ok');
    }

    // Licença permanente da agenda: acesso vitalício
    const tenantId: string = externalRef;
    await supabaseAdmin
      .from('subscriptions')
      .upsert(
        {
          tenant_id: tenantId,
          provider: 'mercopago',
          plan: 'permanente',
          price_cents: 4990,
          status: 'active',
          current_period_end: new Date(now.getTime() + 100 * 365 * 86_400_000).toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: 'tenant_id' },
      );

    return new Response('ok');
  } catch {
    return new Response('ok');
  }
}
