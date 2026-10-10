// Edge Function: create-pix-payment
// Gera um pagamento Pix avulso no Mercado Pago para 30 dias de acesso.
// Ao pagar, o webhook (mp-webhook) recebe a notificação e estende o período.
//
// Secrets necessários: MP_ACCESS_TOKEN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_TOKEN) throw new Error('MP_ACCESS_TOKEN não configurado');

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) throw new Error('Sessão inválida — faça login novamente.');
    const user = userData.user;
    if (!user.email) throw new Error('Conta sem e-mail para o pagamento.');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error('Conta sem estabelecimento vinculado.');
    const tenantId = profile.tenant_id;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('price_cents')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    const priceCents = sub?.price_cents ?? 4990;

    // mode=checkout → abre o checkout do Mercado Pago (débito, boleto etc.)
    let mode = 'pix';
    try {
      const body = await req.json();
      if (body?.mode) mode = String(body.mode);
    } catch {
      // corpo vazio → pix
    }

    if (mode === 'checkout') {
      const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [
            {
              title: 'KalBix Agenda — Plano Mensal (30 dias)',
              quantity: 1,
              unit_price: Math.round(priceCents) / 100,
              currency_id: 'BRL',
            },
          ],
          external_reference: tenantId,
          back_url: 'https://kalbix.vercel.app/admin',
          notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
          payment_methods: {
            excluded_payment_types: [{ id: 'credit_card' }],
          },
        }),
      });
      const pref = await prefRes.json();
      if (!prefRes.ok || !pref.init_point) {
        throw new Error(`Mercado Pago: ${pref.message ?? 'falha ao criar o checkout'}`);
      }
      return new Response(JSON.stringify({ init_point: pref.init_point }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: Math.round(priceCents) / 100,
        description: 'KalBix Agenda — Plano Mensal (30 dias via Pix)',
        payment_method_id: 'pix',
        external_reference: tenantId,
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
        payer: { email: user.email },
      }),
    });
    const pay = await mpRes.json();
    if (!mpRes.ok) {
      throw new Error(`Mercado Pago: ${pay.message ?? JSON.stringify(pay).slice(0, 200)}`);
    }

    const td = pay.point_of_interaction?.transaction_data;
    return new Response(
      JSON.stringify({
        payment_id: pay.id,
        qr_code: td?.qr_code ?? null,
        qr_code_base64: td?.qr_code_base64 ?? null,
        amount: pay.transaction_amount,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro inesperado' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
