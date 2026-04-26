import styles from './MatchResult.module.css';

interface Props {
  winnerIsMe: boolean;
  myScore: number;
  oppScore: number;
  myPhotoUrl: string;
  oppPhotoUrl: string;
  onBack: () => void;
}

export function MatchResult({ winnerIsMe, myScore, oppScore, myPhotoUrl, oppPhotoUrl, onBack }: Props) {
  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={`${styles.banner} ${winnerIsMe ? styles.win : styles.lose}`}>
          {winnerIsMe ? 'You won' : 'You lost'}
        </h1>
        <div className={styles.photos}>
          <div className={`${styles.side} ${winnerIsMe ? styles.winner : styles.loser}`}>
            {myPhotoUrl && <img className={styles.photo} src={myPhotoUrl} alt="Your photo" />}
            <span className={styles.score}>{myScore.toFixed(1)}</span>
            <span className={styles.label}>You</span>
          </div>
          <span className={styles.vs}>VS</span>
          <div className={`${styles.side} ${!winnerIsMe ? styles.winner : styles.loser}`}>
            {oppPhotoUrl && <img className={styles.photo} src={oppPhotoUrl} alt="Opponent photo" />}
            <span className={styles.score}>{oppScore.toFixed(1)}</span>
            <span className={styles.label}>Opponent</span>
          </div>
        </div>
        <button className={styles.btn} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}
