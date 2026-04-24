import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { createChallenge } from '@/api/elo';
import styles from './Challenge.module.css';

export default function Challenge() {
  const { photos, load } = usePhotos();
  const [opponentID, setOpponentID] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );

  const send = async () => {
    if (!opponentID.trim()) { alert('Enter opponent ID'); return; }
    if (selected.length !== 3) { alert('Select exactly 3 photos'); return; }
    setLoading(true);
    try {
      const { match_id } = await createChallenge(opponentID.trim(), selected);
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
          placeholder="Opponent user ID"
          value={opponentID}
          onChange={(e) => setOpponentID(e.target.value)}
        />
        <p className={styles.sub}>Select 3 photos ({selected.length}/3)</p>
        <div className={styles.grid}>
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} onDelete={() => {}} selected={selected.includes(p.id)} onSelect={toggleSelect} />
          ))}
        </div>
        <button className={styles.btn} onClick={send} disabled={loading || selected.length !== 3}>
          {loading ? 'Sending…' : 'Send Challenge'}
        </button>
      </div>
    </div>
  );
}
