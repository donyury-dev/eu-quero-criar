import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const EDITOR_URL =
  (import.meta.env.VITE_EDITOR_URL as string | undefined) ??
  'https://kalbix-editor.onrender.com';

export default function EditorLaunch() {
  const [checking, setChecking] = useState(true);
  const [logged, setLogged] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.access_token) {
        setLogged(true);
        window.location.replace(
          `${EDITOR_URL}/?access_token=${encodeURIComponent(data.session.access_token)}`,
        );
      }
      setChecking(false);
    });
  }, []);

  if (checking || logged) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Abrindo o editor…</div>;
  }
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div>
        <p className="text-lg font-semibold mb-2">Entre no painel para usar o editor.</p>
        <Link to="/entrar" className="btn-accent inline-block px-5 py-2.5 text-sm">
          Entrar
        </Link>
      </div>
    </div>
  );
}