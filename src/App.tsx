import { Navigate, Route, Routes } from 'react-router-dom';
import Marketplace from './pages/Marketplace';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Admin from './pages/Admin';
import Signup from './pages/Signup';
import SuperAdmin from './pages/SuperAdmin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/explorar" replace />} />
      <Route path="/explorar" element={<Marketplace />} />
      <Route path="/agendar/:slug" element={<Booking />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/criar" element={<Signup />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/superadmin" element={<SuperAdmin />} />
      <Route path="*" element={<Navigate to="/explorar" replace />} />
    </Routes>
  );
}
