import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Marketplace from './pages/Marketplace';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Signup from './pages/Signup';
import SuperAdmin from './pages/SuperAdmin';

// Abre direto no painel se o dono já estiver logado (sessão gravada),
// senão mostra a página de explorar.
function RootRedirect() {
  const [checking, setChecking] = useState(true);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setLogged(!!data.session);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: '#0f172a' }}>
        <p className="text-sm text-white/60">KalBix Agenda…</p>
      </div>
    );
  }
  return <Navigate to={logged ? '/admin' : '/explorar'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/explorar" element={<Marketplace />} />
      <Route path="/agendar/:slug" element={<Booking />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/criar" element={<Signup />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/superadmin" element={<SuperAdmin />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
