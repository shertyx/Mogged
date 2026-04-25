import styles from './PhotoCard.module.css';
import type { Photo } from '@/store/photos';

const FEATURE_LABELS: Record<string, string> = {
  symmetry: 'Symétrie',
  golden_ratio: 'Golden R.',
  jawline: 'Jawline',
  eyes: 'Yeux',
  nose: 'Nez',
  forehead: 'Front',
};

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  onAnalyze?: (id: string, s3Key: string) => void;
  analyzing?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, onAnalyze, analyzing, selected, onSelect }: Props) {
  const hasScore = photo.chad_score !== null;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${hasScore ? styles.analyzed : ''}`}
      onClick={() => onSelect?.(photo.id)}
    >
      <button
        className={styles.delete}
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
      >
        ✕
      </button>

      {photo.signed_url && (
        <img src={photo.signed_url} alt="photo" className={styles.thumb} />
      )}

      {hasScore && (
        <div className={styles.scoreBlock}>
          <span className={styles.scoreValue}>{Math.round(photo.chad_score!)}%</span>
          <span className={styles.scoreLabel}>Mogg Score</span>
        </div>
      )}

      {hasScore && photo.features && (
        <div className={styles.features}>
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const val = photo.features![key] ?? 0;
            return (
              <div key={key} className={styles.featureRow}>
                <span className={styles.featureName}>{label}</span>
                <div className={styles.barBg}>
                  <div className={styles.barFill} style={{ width: `${val}%` }} />
                </div>
                <span className={styles.featureVal}>{Math.round(val)}</span>
              </div>
            );
          })}
        </div>
      )}

      {!hasScore && !analyzing && onAnalyze && (
        <button
          className={styles.analyzeBtn}
          onClick={(e) => { e.stopPropagation(); onAnalyze(photo.id, photo.s3_key); }}
        >
          Analyze
        </button>
      )}

      {!hasScore && analyzing && (
        <span className={styles.analyzingLabel}>Analyzing…</span>
      )}
    </div>
  );
}
