import { useNavigate } from 'react-router-dom';
import styles from './Matchmaking.module.css';

export default function Matchmaking() {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Photos</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Fight</h1>
        <button className={styles.card} onClick={() => navigate('/match/realtime')}>
          <span className={styles.cardTitle}>⚡ Real-time Match</span>
          <span className={styles.cardSub}>Find an opponent now — 5 min timeout</span>
        </button>
        <button className={styles.card} onClick={() => navigate('/match/challenge')}>
          <span className={styles.cardTitle}>📩 Async Challenge</span>
          <span className={styles.cardSub}>Challenge a friend — they have 24h to accept</span>
        </button>
      </div>
    </div>
  );
}
