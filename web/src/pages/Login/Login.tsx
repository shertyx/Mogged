import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOAuthURL } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import styles from './Login.module.css';

export default function Login() {
  const { setTokens, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return; }
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const userID = params.get('user_id');
    if (accessToken && refreshToken && userID) {
      setTokens(accessToken, refreshToken, userID);
      navigate('/');
    }
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Mogged</h1>
      <p className={styles.subtitle}>How chad are you?</p>
      <a className={styles.button} href={getOAuthURL()}>
        Continue with Google
      </a>
    </div>
  );
}
