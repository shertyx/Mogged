import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCallback, getOAuthURL } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import styles from './Login.module.css';

export default function Login() {
  const { setTokens, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      exchangeCallback(code, state)
        .then((data) => {
          setTokens(data.access_token, data.refresh_token, data.user_id);
          navigate('/');
        })
        .catch(console.error);
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
