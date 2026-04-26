import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { playBotMatch } from '@/api/admin';
import styles from './Admin.module.css';

interface BotRound { round: number; my_score: number; bot_score: number; won_round: boolean }

export default function Admin() {
  const navigate = useNavigate();
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const { photos, load } = usePhotos();
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<{ won: boolean; rounds: BotRound[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) { navigate('/'); return; }
    load();
  }, [isAdmin]);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );

  const runBotMatch = async () => {
    if (selected.length !== 3) { alert('Select exactly 3 photos'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await playBotMatch(selected);
      setResult(res);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Back</button>
        <span className={styles.badge}>⚙ Admin</span>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Admin Panel</h1>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Bot Match Test</h2>
          <p className={styles.sub}>Select 3 photos to fight against the bot ({selected.length}/3)</p>
          <div className={styles.grid}>
            {photos.map((p) => (
              <PhotoCard key={p.id} photo={p} onDelete={() => {}} selected={selected.includes(p.id)} onSelect={toggleSelect} />
            ))}
          </div>
          <button className={styles.btn} onClick={runBotMatch} disabled={loading || selected.length !== 3}>
            {loading ? 'Fighting…' : 'Fight Bot'}
          </button>

          {result && (
            <div className={styles.result}>
              <h3 className={result.won ? styles.win : styles.loss}>
                {result.won ? '🏆 You win!' : '💀 You lost'}
              </h3>
              <div className={styles.rounds}>
                {result.rounds.map((r) => (
                  <div key={r.round} className={`${styles.round} ${r.won_round ? styles.roundWin : styles.roundLoss}`}>
                    <span>Round {r.round}</span>
                    <span>You: {r.my_score.toFixed(1)}</span>
                    <span>Bot: {r.bot_score.toFixed(1)}</span>
                    <span>{r.won_round ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
