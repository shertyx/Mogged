import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { getLeaderboard, type LeaderboardEntry } from '@/api/elo';
import { TierBadge } from '@/components/TierBadge/TierBadge';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import styles from './Leaderboard.module.css';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const userID = useAuthStore((s) => s.userID);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then((d) => setEntries(d ?? [])).finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>SIGMA<br /><span className={styles.titleAccent}>BOARD</span></h1>
        <span className={styles.subtitle}>Top {entries.length} Chads Mondiaux</span>
      </header>

      <div className={styles.content}>
        {loading && (
          <div className={styles.loading}>
            <span style={{ fontSize: '2rem', animation: 'float 1.5s ease-in-out infinite' }}>🗿</span>
            <span>Calcul en cours…</span>
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className={styles.empty}>
            <span style={{ fontSize: '3rem' }}>💀</span>
            <p>Aucun chad ranked pour l'instant</p>
            <p style={{ fontSize: '0.75rem', color: '#444' }}>Commence à te battre</p>
          </div>
        )}

        {entries.slice(0, 3).length > 0 && (
          <div className={styles.podium}>
            {[entries[1], entries[0], entries[2]].map((e, idx) => e && (
              <div key={e.user_id} className={`${styles.podiumSlot} ${idx === 1 ? styles.podiumFirst : ''} ${e.user_id === userID ? styles.podiumMe : ''}`}>
                <span className={styles.podiumMedal}>{MEDALS[[1,0,2][idx]]}</span>
                <span className={styles.podiumName}>{e.username}</span>
                <span className={styles.podiumSR}>{e.score} SR</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.list}>
          {entries.slice(3).map((e, i) => {
            const isMe = e.user_id === userID;
            const tierParts = e.tier.split(' ');
            const tierName = tierParts.slice(0, -1).join(' ') || e.tier;
            const division = parseInt(tierParts[tierParts.length - 1]) || 0;
            return (
              <div
                key={e.user_id}
                className={`${styles.row} ${isMe ? styles.rowMe : ''}`}
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <span className={styles.rowRank}>#{e.rank}</span>
                <span className={styles.rowName}>{e.username}{isMe ? ' 👈' : ''}</span>
                <TierBadge tierName={tierName} division={division} sr={e.score} size="sm" />
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
