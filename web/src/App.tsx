import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Login from '@/pages/Login/Login';
import Photos from '@/pages/Photos/Photos';
import Profile from '@/pages/Profile/Profile';
import Matchmaking from '@/pages/Matchmaking/Matchmaking';
import RealtimeMatch from '@/pages/Match/RealtimeMatch';
import Challenge from '@/pages/Match/Challenge';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Photos />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/matchmaking" element={<Matchmaking />} />
          <Route path="/match/realtime" element={<RealtimeMatch />} />
          <Route path="/match/challenge" element={<Challenge />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}
