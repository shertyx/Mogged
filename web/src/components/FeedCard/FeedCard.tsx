import type { FeedEntry } from '@/api/elo';
import styles from './FeedCard.module.css';

function getScoreColor(score: number): string {
  if (score >= 75) return '#f97316';
  if (score >= 50) return '#fbbf24';
  return '#888';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'GIGACHAD';
  if (score >= 75) return 'CHAD';
  if (score >= 60) return 'BASED';
  if (score >= 45) return 'NPC';
  return 'MOGGED';
}

interface Props {
  entry: FeedEntry & { url_a?: string; url_b?: string };
  myID: string;
  style?: React.CSSProperties;
}

export function FeedCard({ entry, myID, style }: Props) {
  const isAWinner = entry.winner_id === entry.player_a_id;
  const isMeA = myID === entry.player_a_id;
  const isMeB = myID === entry.player_b_id;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "à l'instant";
    if (m < 60) return `il y a ${m}min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
  };

  return (
    <div className={styles.card} style={style}>
      {/* Header */}
      <div className={styles.cardHeader}>
        <span className={styles.matchLabel}>⚔️ DUEL</span>
        <span className={styles.time}>{timeAgo(entry.played_at)}</span>
      </div>

      {/* Dual photo layout */}
      <div className={styles.duoLayout}>
        {/* Player A */}
        <div className={`${styles.player} ${isAWinner ? styles.winner : styles.loser}`}>
          <div className={styles.photoWrap}>
            {entry.url_a ? (
              <img src={entry.url_a} className={styles.photo} alt={entry.player_a} />
            ) : (
              <div className={styles.noPhoto}>🗿</div>
            )}
            <div className={styles.photoOverlay}>
              <span className={styles.playerName}>{entry.player_a}{isMeA ? ' 👈' : ''}</span>
              <div className={styles.scoreRow}>
                <span className={styles.scoreNum} style={{ color: getScoreColor(entry.score_a) }}>
                  {Math.round(entry.score_a)}%
                </span>
                <span className={styles.scoreBadge} style={{ background: getScoreColor(entry.score_a) }}>
                  {getScoreLabel(entry.score_a)}
                </span>
              </div>
            </div>
            {isAWinner && <div className={styles.winBadge}>🏆</div>}
            {!isAWinner && <div className={styles.lossBadge}>💀</div>}
          </div>
        </div>

        {/* VS separator */}
        <div className={styles.vs}>
          <span>VS</span>
        </div>

        {/* Player B */}
        <div className={`${styles.player} ${!isAWinner ? styles.winner : styles.loser}`}>
          <div className={styles.photoWrap}>
            {entry.url_b ? (
              <img src={entry.url_b} className={styles.photo} alt={entry.player_b} />
            ) : (
              <div className={styles.noPhoto}>🗿</div>
            )}
            <div className={styles.photoOverlay}>
              <span className={styles.playerName}>{entry.player_b}{isMeB ? ' 👈' : ''}</span>
              <div className={styles.scoreRow}>
                <span className={styles.scoreNum} style={{ color: getScoreColor(entry.score_b) }}>
                  {Math.round(entry.score_b)}%
                </span>
                <span className={styles.scoreBadge} style={{ background: getScoreColor(entry.score_b) }}>
                  {getScoreLabel(entry.score_b)}
                </span>
              </div>
            </div>
            {!isAWinner && <div className={styles.winBadge}>🏆</div>}
            {isAWinner && <div className={styles.lossBadge}>💀</div>}
          </div>
        </div>
      </div>

      {/* Result strip */}
      <div className={styles.resultStrip}>
        <span className={styles.resultWinner}>
          {isAWinner ? entry.player_a : entry.player_b} a moggé {isAWinner ? entry.player_b : entry.player_a}
        </span>
        <span className={styles.resultDiff}>
          +{Math.abs(Math.round(entry.score_a - entry.score_b))}%
        </span>
      </div>
    </div>
  );
}
