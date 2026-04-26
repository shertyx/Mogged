import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import styles from './BottomNav.module.css';

const tabs = [
  { path: '/',            icon: '◼',   label: 'Feed'    },
  { path: '/analyze',     icon: '🔬',  label: 'Analyse' },
  { path: '/leaderboard', icon: '🏆',  label: 'Top'     },
  { path: '/friends',     icon: '⚔️',  label: 'Duels'   },
  { path: '/profile',     icon: '👤',  label: 'Profil'  },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAdmin = useAuthStore((s) => s.isAdmin);

  return (
    <nav className={styles.nav}>
      {tabs.map((t) => (
        <button
          key={t.path}
          className={`${styles.tab} ${pathname === t.path ? styles.active : ''}`}
          onClick={() => navigate(t.path)}
        >
          <span className={styles.icon}>{t.icon}</span>
          <span className={styles.label}>{t.label}</span>
        </button>
      ))}
      {isAdmin && (
        <button
          className={`${styles.tab} ${pathname === '/admin' ? styles.active : ''} ${styles.adminTab}`}
          onClick={() => navigate('/admin')}
        >
          <span className={styles.icon}>⚡</span>
          <span className={styles.label}>Admin</span>
        </button>
      )}
    </nav>
  );
}
