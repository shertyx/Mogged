import styles from './RoundResult.module.css';

interface Props {
  round: number;
  myScore: number;
  opponentScore: number;
  won: boolean;
}

export function RoundResult({ round, myScore, opponentScore, won }: Props) {
  return (
    <div className={styles.container}>
      <span className={styles.label}>Round {round}</span>
      <div className={styles.scores}>
        <div className={`${styles.side} ${won ? styles.winner : ''}`}>
          <span className={styles.score}>{Math.round(myScore)}</span>
          <span className={styles.name}>You</span>
        </div>
        <span className={styles.vs}>VS</span>
        <div className={`${styles.side} ${!won ? styles.winner : ''}`}>
          <span className={styles.score}>{Math.round(opponentScore)}</span>
          <span className={styles.name}>Opponent</span>
        </div>
      </div>
    </div>
  );
}
