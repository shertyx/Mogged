import styles from './PhotoCard.module.css';
import type { Photo } from '@/store/photos';

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, selected, onSelect }: Props) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect?.(photo.id)}
    >
      {photo.chad_score !== null && (
        <span className={styles.score}>{Math.round(photo.chad_score)}</span>
      )}
      <button
        className={styles.delete}
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
      >
        ✕
      </button>
      {photo.chad_score === null && <span className={styles.pending}>Analyzing…</span>}
    </div>
  );
}
