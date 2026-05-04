import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { getLeaderboard, type LeaderboardEntry } from '@/api/elo';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import styles from './Leaderboard.module.css';

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32', Silver: '#a8a9ad', Gold: '#ffd700',
  Platinum: '#4dd0e1', Diamond: '#b388ff', Master: '#f06292',
  Grandmaster: '#ff5252', 'Top 500': '#ff1744',
};
function tierColor(tier: string) {
  return TIER_COLORS[tier.split(' ')[0]] ?? '#888';
}

export default function Leaderboard() {
  const userID = useAuthStore((s) => s.userID);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard().then((d) => setEntries(d ?? [])).finally(() => setLoading(false));
  }, []);

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>SIGMA<br /><span className={styles.accent}>BOARD</span></h1>
        <span className={styles.subtitle}>Top {entries.length} Chads Mondiaux</span>
      </header>

      <div className={styles.content}>
        {loading && <div className={styles.loading}><span>🗿</span><span>Calcul en cours…</span></div>}

        {!loading && entries.length === 0 && (
          <div className={styles.empty}>
            <span>💀</span><p>Aucun chad ranked</p>
          </div>
        )}

        {/* Podium */}
        {top3.length > 0 && (
          <div className={styles.podium}>
            {([1, 0, 2] as const).map((pos) => {
              const e = entries[pos];
              if (!e) return <div key={pos} className={styles.podiumSlot} />;
              const isMe = e.user_id === userID;
              return (
                <div key={e.user_id} className={`${styles.podiumSlot} ${pos === 0 ? styles.first : ''}`}>
                  <span className={styles.podiumRank} style={{ color: pos === 0 ? '#ffd700' : pos === 1 ? '#a8a9ad' : '#cd7f32' }}>
                    #{pos + 1}
                  </span>
                  <span className={styles.podiumName} style={isMe ? { color: 'var(--orange)' } : {}}>
                    {e.username}
                  </span>
                  <span className={styles.podiumSR}>{e.score} SR</span>
                  <span className={styles.podiumTier} style={{ color: tierColor(e.tier) }}>{e.tier}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Rest of list */}
        {rest.length > 0 && (
          <div className={styles.list}>
            {rest.map((e, i) => (
              <div key={e.user_id} className={`${styles.row} ${e.user_id === userID ? styles.rowMe : ''}`} style={{ animationDelay: `${i * 0.03}s` }}>
                <span className={styles.rowRank}>#{e.rank}</span>
                <span className={styles.rowName}>{e.username}{e.user_id === userID ? ' 👈' : ''}</span>
                <span className={styles.rowTier} style={{ color: tierColor(e.tier) }}>{e.tier}</span>
                <span className={styles.rowSR}>{e.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
