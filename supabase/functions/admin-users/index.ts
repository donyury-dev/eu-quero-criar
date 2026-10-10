// Edge Function: admin-users
// Gestão de acessos dos clientes, exclusiva do dono da plataforma.
//
// GET  → lista usuários de autenticação (e-mail, datas, status)
// POST → ações:
//   { action: 'set_password', user_id, password }  define uma nova senha
//   { action: 'create', email, password }          cria usuário com senha
//
// Segurança: só responde se o chamador for superadmin (profiles) ou
// estiver na tabela app_admins. Nenhuma senha é exposta — apenas
// definimos novas.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: 'Sessão inválida — faça login novamente.' }, 401);

    // Só o dono da plataforma pode usar esta função.
    let adminOk = false;
    const { data: appAdmin } = await supabaseAdmin
      .from('app_admins')
      .select('email')
      .eq('email', userData.user.email ?? '')
      .maybeSingle();
    if (appAdmin) adminOk = true;
    if (!adminOk) {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('user_id', userData.user.id)
        .maybeSingle();
      adminOk = prof?.role === 'superadmin';
    }
    if (!adminOk) return json({ error: 'Acesso restrito ao dono da plataforma.' }, 403);

    if (req.method === 'GET') {
      const url = new URL(req.url);
      const page = Number(url.searchParams.get('page') ?? '1') || 1;
      const query = url.searchParams.get('q') ?? '';
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 50,
        ...(query ? { query } : {}),
      });
      if (error) return json({ error: error.message }, 500);
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          confirmed: !!u.email_confirmed_at,
        })),
        total: data.total,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json().catch(() => null);
      if (body?.action === 'set_password' && body.user_id && body.password) {
        const password = String(body.password);
        if (password.length < 6) return json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, 400);
        const { error } = await supabaseAdmin.auth.admin.updateUserById(String(body.user_id), { password });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
      if (body?.action === 'create' && body.email && body.password) {
        const password = String(body.password);
        if (password.length < 6) return json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, 400);
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
          email: String(body.email).trim().toLowerCase(),
          password,
          email_confirm: true,
        });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true, id: data.user?.id });
      }
      return json({ error: 'Ação inválida.' }, 400);
    }

    return json({ error: 'Método não suportado.' }, 405);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
