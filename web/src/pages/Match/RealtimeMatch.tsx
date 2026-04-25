import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { RoundResult } from '@/components/RoundResult/RoundResult';
import styles from './RealtimeMatch.module.css';

type Phase = 'selecting' | 'searching' | 'matched' | 'result';
interface Round { round: number; myScore: number; oppScore: number; won: boolean }

export default function RealtimeMatch() {
  const { photos, load } = usePhotos();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('selecting');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [won, setWon] = useState<boolean | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );

  const joinQueue = () => {
    if (selected.length !== 3) { alert('Select exactly 3 photos'); return; }
    const token = localStorage.getItem('access_token');
    setPhase('searching');
    const socket = new WebSocket(`ws://${window.location.host}/matchmaking?token=${encodeURIComponent(token ?? '')}`);
    ws.current = socket;
    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data) as { type: string; my_score?: number; opp_score?: number; round?: number; winner_is_me?: boolean };
      if (msg.type === 'matched') { setPhase('matched'); socket.send(JSON.stringify({ photo_ids: selected })); }
      else if (msg.type === 'timeout') { setPhase('selecting'); alert('No opponent found'); }
      else if (msg.type === 'round') setRounds((r) => [...r, { round: msg.round!, myScore: msg.my_score!, oppScore: msg.opp_score!, won: (msg.my_score ?? 0) >= (msg.opp_score ?? 0) }]);
      else if (msg.type === 'match_end') { setWon(msg.winner_is_me ?? false); setPhase('result'); socket.close(); }
    };
    socket.onerror = () => { setPhase('selecting'); alert('Connection error'); };
  };

  if (phase === 'result') return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.result}>{won ? '🏆 You won!' : '💀 You lost'}</h1>
        {rounds.map((r) => <RoundResult key={r.round} round={r.round} myScore={r.myScore} opponentScore={r.oppScore} won={r.won} />)}
        <button className={styles.btn} onClick={() => navigate('/matchmaking')}>Back</button>
      </div>
    </div>
  );

  if (phase === 'searching' || phase === 'matched') return (
    <div className={styles.page}>
      <div className={styles.content}>
        <h1 className={styles.title}>{phase === 'searching' ? 'Finding opponent…' : 'Opponent found!'}</h1>
        <p className={styles.sub}>{phase === 'searching' ? 'Timeout in 5 minutes' : 'Match starting…'}</p>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/matchmaking')} className={styles.back}>← Back</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Select 3 Photos</h1>
        <p className={styles.sub}>{selected.length}/3 selected</p>
        <div className={styles.grid}>
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} onDelete={() => {}} selected={selected.includes(p.id)} onSelect={toggleSelect} />
          ))}
        </div>
        <button className={styles.btn} onClick={joinQueue} disabled={selected.length !== 3}>Find Match</button>
      </div>
    </div>
  );
}
