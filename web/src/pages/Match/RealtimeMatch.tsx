import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listUnanalyzedPhotos } from '@/api/user';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { MatchResult } from '@/components/MatchResult/MatchResult';
import type { Photo } from '@/store/photos';
import styles from './RealtimeMatch.module.css';

type Phase = 'selecting' | 'waiting' | 'matched' | 'analyzing' | 'result';

interface MatchEndData {
  winnerIsMe: boolean;
  myScore: number;
  oppScore: number;
  myPhoto: string;
  oppPhoto: string;
}

export default function RealtimeMatch() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('selecting');
  const [result, setResult] = useState<MatchEndData | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listUnanalyzedPhotos().then(setPhotos).catch(() => {});
  }, []);

  const joinQueue = () => {
    if (!selected) return;
    const token = localStorage.getItem('access_token');
    if (!token) { alert('Session expirée, reconnecte-toi'); return; }
    setPhase('waiting');
    const socket = new WebSocket(`ws://${window.location.host}/matchmaking`);
    ws.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'join', photo_id: selected, token }));
    };

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as {
        type: string;
        match_id?: string;
        message?: string;
        my_score?: number;
        opp_score?: number;
        winner_is_me?: boolean;
        my_photo?: string;
        opp_photo?: string;
      };

      if (msg.type === 'waiting') {
        setPhase('waiting');
      } else if (msg.type === 'matched') {
        setPhase('matched');
      } else if (msg.type === 'analyzing') {
        setPhase('analyzing');
      } else if (msg.type === 'match_end') {
        setResult({
          winnerIsMe: msg.winner_is_me ?? false,
          myScore: msg.my_score ?? 0,
          oppScore: msg.opp_score ?? 0,
          myPhoto: msg.my_photo ?? '',
          oppPhoto: msg.opp_photo ?? '',
        });
        setPhase('result');
        socket.close();
      } else if (msg.type === 'timeout') {
        setPhase('selecting');
        alert('No opponent found');
      } else if (msg.type === 'error') {
        setPhase('selecting');
        alert(msg.message ?? 'An error occurred');
      }
    };

    socket.onerror = () => {
      setPhase('selecting');
      alert('Connection error');
    };
  };

  if (phase === 'result' && result) {
    return (
      <MatchResult
        winnerIsMe={result.winnerIsMe}
        myScore={result.myScore}
        oppScore={result.oppScore}
        myPhotoUrl={result.myPhoto}
        oppPhotoUrl={result.oppPhoto}
        onBack={() => navigate('/matchmaking')}
      />
    );
  }

  if (phase !== 'selecting') {
    const labels: Record<Phase, string> = {
      waiting: 'Finding opponent…',
      matched: 'Opponent found!',
      analyzing: 'Analyzing photos…',
      result: '',
      selecting: '',
    };
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <h1 className={styles.title}>{labels[phase]}</h1>
          {phase === 'waiting' && <p className={styles.sub}>Timeout in 5 minutes</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/matchmaking')} className={styles.back}>← Back</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Select 1 Photo</h1>
        {photos.length === 0 ? (
          <p className={styles.sub}>Upload a photo first — only unanalyzed photos can be used</p>
        ) : (
          <>
            <p className={styles.sub}>{selected ? '1/1 selected' : '0/1 selected'}</p>
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
          onClick={joinQueue}
          disabled={!selected || photos.length === 0}
        >
          Find Match
        </button>
      </div>
    </div>
  );
}
