import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const body = await req.json();
    const login = String(body.login ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!/^[a-z0-9._-]{3,30}$/.test(login)) {
      return json({ error: 'Login inválido.' }, 400);
    }
    if (password.length < 6) {
      return json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const email = `${login}@kalbixagenda.app`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { login },
    });

    if (error) {
      if (error.message.toLowerCase().includes('already')) {
        return json({ error: 'Esse login já está em uso. Escolha outro.' }, 409);
      }
      return json({ error: error.message }, 400);
    }
    return json({ ok: true, login, email, user_id: data.user.id });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao criar conta.' }, 500);
  }
});