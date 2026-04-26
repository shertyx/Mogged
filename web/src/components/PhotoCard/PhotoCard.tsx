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

function getScoreLabel(score: number): string {
  if (score >= 90) return '🗿 GIGACHAD';
  if (score >= 75) return '💪 CHAD';
  if (score >= 60) return '😤 BASED';
  if (score >= 45) return '😐 NPC';
  if (score >= 30) return '😬 MEWED';
  return '💀 MOGGED';
}

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
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect?.(photo.id)}
    >
      {selected && <div className={styles.selectedCheck}>✓</div>}

      <button
        className={styles.delete}
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
      >✕</button>

      {photo.signed_url && (
        <div style={{ position: 'relative' }}>
          <img src={photo.signed_url} alt="photo" className={styles.thumb} />
          {hasScore && (
            <div className={styles.overlay}>
              <div className={styles.scoreBadge}>{getScoreLabel(photo.chad_score!)}</div>
              <div className={styles.scoreBlock}>
                <span className={styles.scoreValue}>{Math.round(photo.chad_score!)}</span>
                <span className={styles.scorePercent}>%</span>
              </div>
            </div>
          )}
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

      {!hasScore && (
        <div className={styles.emptyCard}>
          {analyzing ? (
            <div className={styles.analyzingLabel}>
              <span className={styles.analyzeSpinner} />
              Analyse…
            </div>
          ) : onAnalyze ? (
            <button
              className={styles.analyzeBtn}
              onClick={(e) => { e.stopPropagation(); onAnalyze(photo.id, photo.s3_key); }}
            >
              ⚡ Analyser
            </button>
          ) : (
            <span className={styles.analyzingLabel}>Non analysé</span>
          )}
        </div>
      )}
    </div>
  );
}
