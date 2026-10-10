// Logins sem e-mail: o cliente escolhe um nome de usuário e o sistema
// converte internamente para um "e-mail sintético" no Supabase Auth.
// Nenhum e-mail real é necessário e nada é enviado por e-mail.
const SYNTHETIC_DOMAIN = 'kalbixagenda.app';

export function toAuthEmail(login: string): string {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${SYNTHETIC_DOMAIN}`;
}

export function isSynthetic(email: string | null): boolean {
  return !!email && email.endsWith(`@${SYNTHETIC_DOMAIN}`);
}

// Mostra o login como o cliente escolheu (sem o domínio interno).
export function displayLogin(email: string | null): string {
  if (!email) return '—';
  return isSynthetic(email) ? email.split('@')[0] : email;
}

export const LOGIN_PATTERN = /^[a-z0-9._-]{3,30}$/;
