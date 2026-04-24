import styles from './TierBadge.module.css';

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
  platinum: '#E5E4E2', diamond: '#B9F2FF', master: '#9B59B6',
  grandmaster: '#E74C3C', top500: '#F39C12',
};

export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  return (
    <span className={styles.badge} style={{ borderColor: color, color }}>
      {tier.toUpperCase()}
    </span>
  );
}
