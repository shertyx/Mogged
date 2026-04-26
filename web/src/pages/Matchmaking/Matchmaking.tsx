import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listPendingChallenges, acceptChallenge } from '@/api/elo';
import { listUnanalyzedPhotos } from '@/api/user';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { MatchResult } from '@/components/MatchResult/MatchResult';
import { useAuthStore } from '@/store/auth';
import type { Photo } from '@/store/photos';
import styles from './Matchmaking.module.css';

interface Challenge {
  id: string;
  player_a: string;
}

interface MatchEndData {
  winnerIsMe: boolean;
  myScore: number;
  oppScore: number;
  myPhotoUrl: string;
  oppPhotoUrl: string;
}

export default function Matchmaking() {
  const navigate = useNavigate();
  const userID = useAuthStore((s) => s.userID);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [acceptingID, setAcceptingID] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<MatchEndData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userID) return;
    listPendingChallenges(userID).then(setChallenges).catch(() => {});
  }, [userID]);

  const openAccept = async (matchID: string) => {
    setAcceptingID(matchID);
    setSelectedPhoto(null);
    const p = await listUnanalyzedPhotos().catch(() => [] as Photo[]);
    setPhotos(p);
  };

  const confirmAccept = async () => {
    if (!acceptingID || !selectedPhoto || !userID) return;
    setLoading(true);
    try {
      const result = await acceptChallenge(acceptingID, selectedPhoto, userID);
      const iAmPlayerB = result.player_b === userID;
      setMatchResult({
        winnerIsMe: result.winner_id === userID,
        myScore: iAmPlayerB ? result.score_b : result.score_a,
        oppScore: iAmPlayerB ? result.score_a : result.score_b,
        myPhotoUrl: '',
        oppPhotoUrl: '',
      });
      setChallenges((prev) => prev.filter((c) => c.id !== acceptingID));
      setAcceptingID(null);
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (matchResult) {
    return (
      <MatchResult
        winnerIsMe={matchResult.winnerIsMe}
        myScore={matchResult.myScore}
        oppScore={matchResult.oppScore}
        myPhotoUrl={matchResult.myPhotoUrl}
        oppPhotoUrl={matchResult.oppPhotoUrl}
        onBack={() => setMatchResult(null)}
      />
    );
  }

  if (acceptingID) {
    return (
      <div className={styles.page}>
        <nav className={styles.nav}>
          <button onClick={() => setAcceptingID(null)} className={styles.back}>← Back</button>
        </nav>
        <div className={styles.content}>
          <h1 className={styles.title}>Accept Challenge</h1>
          {photos.length === 0 ? (
            <p>No unanalyzed photos available — upload one first.</p>
          ) : (
            <>
              <p>Select 1 photo to fight with</p>
              <div className={styles.grid}>
                {photos.map((p) => (
                  <PhotoCard
                    key={p.id}
                    photo={p}
                    onDelete={() => {}}
                    selected={selectedPhoto === p.id}
                    onSelect={(id) => setSelectedPhoto((prev) => (prev === id ? null : id))}
                  />
                ))}
              </div>
            </>
          )}
          <button
            className={styles.card}
            onClick={confirmAccept}
            disabled={!selectedPhoto || loading}
          >
            {loading ? 'Accepting…' : 'Accept & Fight'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Photos</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Fight</h1>
        <button className={styles.card} onClick={() => navigate('/match/realtime')}>
          <span className={styles.cardTitle}>⚡ Real-time Match</span>
          <span className={styles.cardSub}>Find an opponent now — 5 min timeout</span>
        </button>
        <button className={styles.card} onClick={() => navigate('/match/challenge')}>
          <span className={styles.cardTitle}>📩 Async Challenge</span>
          <span className={styles.cardSub}>Challenge a friend — they have 24h to accept</span>
        </button>

        {challenges.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Pending Challenges</h2>
            {challenges.map((c) => (
              <div key={c.id} className={styles.challengeRow}>
                <span className={styles.challengeLabel}>Challenge from {c.player_a.slice(0, 8)}…</span>
                <button className={styles.acceptBtn} onClick={() => openAccept(c.id)}>
                  Accept
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
