import { createClient } from '@supabase/supabase-js';

// Public browser configuration. In Verdent preview/publish the same-origin
// BaaS proxy is used; outside it (localhost preview) we fall back to the
// project's public Supabase URL + publishable key (safe for browser code).
const FALLBACK_URL = 'https://supabase-api-prod.verdent.ai/p/p3ea2719cae00eab193dc';
const FALLBACK_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMTA2NjY2OTM5LCJpYXQiOjE3OTEwNDc3MzksImlzcyI6InN1cGFiYXNlIiwicHJvamVjdF9yZWYiOiJwM2VhMjcxOWNhZTAwZWFiMTkzZGMiLCJyb2xlIjoiYW5vbiJ9.ylc6I6mc6k-lQwtHTxzTHRSB7c5fu0Cf2eOJchVS6ys';

const SUPABASE_BASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? FALLBACK_URL;
const SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? FALLBACK_KEY;

export const SUPABASE_URL = SUPABASE_BASE_URL.replace(/\/$/, '');

export const supabase = createClient(SUPABASE_BASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Fixed id of the demo establishment used for self-onboarding.
export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000001';
