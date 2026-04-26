import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUnanalyzedPhotos, getUserByUsername } from '@/api/user';
import { createChallenge } from '@/api/elo';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { useAuthStore } from '@/store/auth';
import type { Photo } from '@/store/photos';
import styles from './Challenge.module.css';

export default function Challenge() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [opponentUsername, setOpponentUsername] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const userID = useAuthStore((s) => s.userID);
  const navigate = useNavigate();

  useEffect(() => {
    listUnanalyzedPhotos().then(setPhotos).catch(() => {});
  }, []);

  const send = async () => {
    if (!opponentUsername.trim()) { alert('Enter opponent username'); return; }
    if (!selected) { alert('Select a photo'); return; }
    setLoading(true);
    try {
      const opponent = await getUserByUsername(opponentUsername.trim());
      if (opponent.id === userID) { alert('Cannot challenge yourself'); return; }
      const { match_id } = await createChallenge(opponent.id, selected);
      alert(`Challenge sent! Match ID: ${match_id}`);
      navigate('/matchmaking');
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/matchmaking')} className={styles.back}>← Back</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Challenge</h1>
        <input
          className={styles.input}
          placeholder="Opponent username"
          value={opponentUsername}
          onChange={(e) => setOpponentUsername(e.target.value)}
        />
        {photos.length === 0 ? (
          <p className={styles.sub}>Upload a photo first — only unanalyzed photos can be used</p>
        ) : (
          <>
            <p className={styles.sub}>Select 1 photo ({selected ? '1' : '0'}/1)</p>
            <div className={styles.grid}>
              {photos.map((p) => (
                <PhotoCard
                  key={p.id}
                  photo={p}
                  onDelete={() => {}}
                  selected={selected === p.id}
                  onSelect={(id) => setSelected((prev) => (prev === id ? null : id))}
                />
              ))}
            </div>
          </>
        )}
        <button
          className={styles.btn}
          onClick={send}
          disabled={loading || !selected || photos.length === 0}
        >
          {loading ? 'Sending…' : 'Send Challenge'}
        </button>
      </div>
    </div>
  );
}
