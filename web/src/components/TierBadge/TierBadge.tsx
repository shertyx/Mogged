import styles from './TierBadge.module.css';

const TIER_CONFIG: Record<string, { color: string; icon: string }> = {
  'Bronze':      { color: '#CD7F32', icon: '🥉' },
  'Silver':      { color: '#C0C0C0', icon: '🥈' },
  'Gold':        { color: '#FFD700', icon: '🥇' },
  'Platinum':    { color: '#4fc3f7', icon: '💎' },
  'Diamond':     { color: '#B9F2FF', icon: '💠' },
  'Master':      { color: '#9B59B6', icon: '👑' },
  'Grandmaster': { color: '#E74C3C', icon: '🔱' },
  'Top 500':     { color: '#F39C12', icon: '⭐' },
};

interface Props {
  tierName: string;
  division?: number;
  sr?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function TierBadge({ tierName, division, sr, size = 'md' }: Props) {
  const cfg = TIER_CONFIG[tierName] ?? { color: '#888', icon: '?' };
  const divStr = division && division > 0 ? ` ${division}` : '';
  return (
    <div className={`${styles.badge} ${styles[size]}`} style={{ borderColor: cfg.color }}>
      <span className={styles.icon}>{cfg.icon}</span>
      <div className={styles.info}>
        <span className={styles.name} style={{ color: cfg.color }}>{tierName}{divStr}</span>
        {sr !== undefined && <span className={styles.sr}>{sr} SR</span>}
      </div>
    </div>
  );
}
