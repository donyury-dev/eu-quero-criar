import { Navigate, Route, Routes } from 'react-router-dom';
import Marketplace from './pages/Marketplace';
import Booking from './pages/Booking';
import Login from './pages/Login';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/explorar" replace />} />
      <Route path="/explorar" element={<Marketplace />} />
      <Route path="/agendar/:slug" element={<Booking />} />
      <Route path="/entrar" element={<Login />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/explorar" replace />} />
    </Routes>
  );
}
