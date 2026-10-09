// Edge Function: create-preapproval
// Cria a assinatura recorrente no Mercado Pago para o estabelecimento logado
// e devolve o link de checkout (init_point).
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

    // Identifica o usuário pelo token do app
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) throw new Error('Sessão inválida — faça login novamente.');
    const user = userData.user;

    // Tenant do usuário
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id')
      .eq('user_id', user.id)
      .not('tenant_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error('Conta sem estabelecimento vinculado.');
    const tenantId = profile.tenant_id;

    // Assinatura atual
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (sub?.provider_sub_id && ['active', 'past_due'].includes(sub.status)) {
      throw new Error('Você já possui uma assinatura em andamento.');
    }

    const priceCents = sub?.price_cents ?? 4990;

    // Cria a assinatura no Mercado Pago
    const mpRes = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        reason: 'KalBix Agenda — Plano Mensal',
        external_reference: tenantId,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: Math.round(priceCents) / 100,
          currency_id: 'BRL',
        },
        back_url: 'https://kalbix.vercel.app/admin',
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
      }),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok || !mpData.init_point) {
      throw new Error(`Mercado Pago: ${mpData.message ?? 'falha ao criar assinatura'}`);
    }

    // Guarda o id da assinatura
    await supabaseAdmin
      .from('subscriptions')
      .update({ provider_sub_id: mpData.id, provider: 'mercopago', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId);

    return new Response(JSON.stringify({ init_point: mpData.init_point }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Erro inesperado' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
