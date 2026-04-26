import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOAuthURL } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import { MoggedLogo } from '@/components/Logo/MoggedLogo';
import { BeauTentacule } from '@/components/BeauTentacule/BeauTentacule';
import styles from './Login.module.css';

const MEME_ICONS = ['🗿', '💪', '🦷', '🏋️', '🫀', '👁️', '🦴', '🧠'];

export default function Login() {
  const { setTokens, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return; }
    const params = new URLSearchParams(window.location.search);
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    const userID = params.get('user_id');
    if (access && refresh && userID) {
      setTokens(access, refresh, userID);
      navigate('/');
    }
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.memes}>
        {MEME_ICONS.map((icon, i) => (
          <span key={i} className={styles.meme} style={{
            left: `${(i * 137) % 90 + 5}%`,
            top: `${(i * 97) % 80 + 5}%`,
            animationDelay: `${i * 0.4}s`,
            fontSize: `${2 + (i % 3)}rem`,
          }}>{icon}</span>
        ))}
      </div>

      <div className={styles.hero}>
        <MoggedLogo size={72} color="#f97316" />
        <h1 className={styles.title}>
          MOG<span className={styles.titleAccent}>GED</span>
        </h1>
        <p className={styles.tagline}>Are you chad enough?</p>
      </div>

      {/* Squidward cali easter egg */}
      <div className={styles.squidWrap}>
        <BeauTentacule size={40} />
        <span className={styles.squidLabel}>beau tentacule approuve</span>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statValue}>∞</span>
          <span className={styles.statLabel}>Chads</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>0</span>
          <span className={styles.statLabel}>Simps</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>💀</span>
          <span className={styles.statLabel}>Mogged</span>
        </div>
      </div>

      <a className={styles.button} href={getOAuthURL()}>
        <svg className={styles.googleIcon} viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continuer avec Google
      </a>

      <p className={styles.disclaimer}>Weak jaw men will be eliminated</p>
    </div>
  );
}
