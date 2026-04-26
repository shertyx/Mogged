import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { listFriends, listFriendRequests, sendFriendRequest, acceptFriendRequest, removeFriend, type Friend } from '@/api/user';
import { sendDuelRequest, listPendingDuels, acceptDuelRequest, declineDuelRequest, type DuelRequest } from '@/api/elo';
import { CameraCapture, type CaptureResult } from '@/components/CameraCapture/CameraCapture';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import styles from './Friends.module.css';

type View = 'list' | 'requests' | 'duels' | 'challenge' | 'accept-duel';

export default function Friends() {
  const userID = useAuthStore((s) => s.userID);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [duels, setDuels] = useState<DuelRequest[]>([]);
  const [view, setView] = useState<View>('list');
  const [addUsername, setAddUsername] = useState('');
  const [addStatus, setAddStatus] = useState('');
  const [challengeTarget, setChallengeTarget] = useState<Friend | null>(null);
  const [activeDuel, setActiveDuel] = useState<DuelRequest | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [captureMode, setCaptureMode] = useState<'challenge' | 'accept' | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ won: boolean; captureA?: string; captureB?: string; scoreA?: number; scoreB?: number } | null>(null);

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    const [f, r, d] = await Promise.all([listFriends(), listFriendRequests(), listPendingDuels()]);
    setFriends(f ?? []);
    setRequests(r ?? []);
    setDuels(d ?? []);
  };

  const handleAdd = async () => {
    if (!addUsername.trim()) return;
    try {
      await sendFriendRequest(addUsername.trim());
      setAddStatus('✓ Demande envoyée !');
      setAddUsername('');
    } catch (e: unknown) { setAddStatus((e as Error).message); }
  };

  const handleCaptureForChallenge = async (capture: CaptureResult) => {
    if (!challengeTarget) return;
    setShowCamera(false);
    setLoading(true);
    try {
      await sendDuelRequest(challengeTarget.user_id, [capture.photo_id]);
      setView('list');
      setChallengeTarget(null);
      alert(`Défi envoyé à ${challengeTarget.username} ! 🗿`);
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const handleCaptureForAccept = async (capture: CaptureResult) => {
    if (!activeDuel) return;
    setShowCamera(false);
    setLoading(true);
    try {
      const { winner_id } = await acceptDuelRequest(activeDuel.ID, [capture.photo_id]);
      setResult({
        won: winner_id === userID,
        captureB: capture.signed_url,
        scoreB: capture.chad_score,
      });
      await refresh();
    } catch (e: unknown) { alert((e as Error).message); }
    finally { setLoading(false); }
  };

  const openCamera = (mode: 'challenge' | 'accept') => {
    setCaptureMode(mode);
    setShowCamera(true);
  };

  // ── Challenge view ──
  if (view === 'challenge' && challengeTarget) return (
    <div className={styles.page}>
      {showCamera && captureMode === 'challenge' && (
        <CameraCapture
          label={`DÉFIER ${challengeTarget.username.toUpperCase()}`}
          onCapture={handleCaptureForChallenge}
          onCancel={() => setShowCamera(false)}
        />
      )}
      <button className={styles.backBtn} onClick={() => setView('list')}>← Retour</button>
      <div className={styles.challengeHeader}>
        <h1 className={styles.challengeTitle}>
          DÉFIER<br /><span className={styles.target}>{challengeTarget.username.toUpperCase()}</span>
        </h1>
        <p className={styles.sub}>Une photo live • le meilleur score gagne</p>
      </div>
      <div className={styles.content}>
        <div className={styles.cameraPrompt}>
          <span className={styles.cameraIcon}>📷</span>
          <p className={styles.cameraPromptText}>Prends ta photo maintenant</p>
          <p className={styles.cameraPromptSub}>Face caméra, menton bas, regard droit</p>
          <button className={styles.sendBtn} onClick={() => openCamera('challenge')} disabled={loading}>
            {loading ? 'Envoi…' : '⚔️ PRENDRE LA PHOTO'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Accept duel view ──
  if (view === 'accept-duel' && activeDuel) return (
    <div className={styles.page}>
      {showCamera && captureMode === 'accept' && (
        <CameraCapture
          label={`VS ${activeDuel.ChallengerName.toUpperCase()}`}
          onCapture={handleCaptureForAccept}
          onCancel={() => setShowCamera(false)}
        />
      )}
      {result ? (
        <div className={styles.resultBlock}>
          <div className={`${styles.resultText} ${result.won ? styles.resultWin : styles.resultLoss}`}>
            <span>{result.won ? '🏆' : '💀'}</span>
            <span>{result.won ? 'VICTOIRE' : 'MOGGED'}</span>
          </div>
          {result.scoreA !== undefined && result.scoreB !== undefined && (
            <div className={styles.resultScores}>
              <div className={styles.resultScoreCol}>
                <span className={styles.resultPlayerName}>{activeDuel.ChallengerName}</span>
                <span className={styles.resultScoreVal}>{Math.round(result.scoreA)}%</span>
              </div>
              <span className={styles.resultVs}>VS</span>
              <div className={styles.resultScoreCol}>
                <span className={styles.resultPlayerName}>Toi</span>
                <span className={styles.resultScoreVal}>{Math.round(result.scoreB)}%</span>
              </div>
            </div>
          )}
          <button className={styles.resultBtn} onClick={() => { setView('list'); setResult(null); setActiveDuel(null); }}>
            Retour
          </button>
        </div>
      ) : (
        <>
          <button className={styles.backBtn} onClick={() => setView('duels')}>← Retour</button>
          <div className={styles.challengeHeader}>
            <h1 className={styles.challengeTitle}>
              VS<br /><span className={styles.target}>{activeDuel.ChallengerName.toUpperCase()}</span>
            </h1>
            <p className={styles.sub}>Il a lancé le défi • à toi de jouer</p>
          </div>
          <div className={styles.content}>
            <div className={styles.cameraPrompt}>
              <span className={styles.cameraIcon}>⚔️</span>
              <p className={styles.cameraPromptText}>Prends ta photo maintenant</p>
              <p className={styles.cameraPromptSub}>Le meilleur chad score gagne</p>
              <button className={styles.sendBtn} onClick={() => openCamera('accept')} disabled={loading}>
                {loading ? 'Combat…' : '⚔️ ACCEPTER & COMBATTRE'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── Main view ──
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>DU<span className={styles.pageTitleAccent}>ELS</span></h1>
      </div>

      <div className={styles.tabs}>
        <button className={`${styles.tab} ${view === 'list' ? styles.active : ''}`} onClick={() => setView('list')}>
          Amis {friends.length > 0 && <span className={styles.count}>{friends.length}</span>}
        </button>
        <button className={`${styles.tab} ${view === 'requests' ? styles.active : ''}`} onClick={() => setView('requests')}>
          Demandes {requests.length > 0 && <span className={styles.notif}>{requests.length}</span>}
        </button>
        <button className={`${styles.tab} ${view === 'duels' ? styles.active : ''}`} onClick={() => setView('duels')}>
          Défis {duels.length > 0 && <span className={styles.notif}>{duels.length}</span>}
        </button>
      </div>

      <div className={styles.content}>
        {/* Add friend */}
        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="Pseudo de l'ami…"
            value={addUsername}
            onChange={(e) => { setAddUsername(e.target.value); setAddStatus(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className={styles.addBtn} onClick={handleAdd}>+</button>
        </div>
        {addStatus && <p className={styles.addStatus}>{addStatus}</p>}

        {view === 'list' && (
          <>
            {friends.length === 0 && (
              <div className={styles.empty}>
                <span>🤝</span>
                <p>Aucun ami pour l'instant</p>
                <p style={{ fontSize: '0.72rem' }}>Ajoute quelqu'un par pseudo</p>
              </div>
            )}
            {friends.map((f) => (
              <div key={f.user_id} className={styles.friendRow}>
                <span className={styles.friendName}>{f.username}</span>
                <div className={styles.actions}>
                  <button className={styles.challengeBtn} onClick={() => { setChallengeTarget(f); setView('challenge'); }}>
                    ⚔️ Défier
                  </button>
                  <button className={styles.removeBtn} onClick={() => removeFriend(f.user_id).then(refresh)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}

        {view === 'requests' && (
          <>
            {requests.length === 0 && (
              <div className={styles.empty}><span>📭</span><p>Aucune demande en attente</p></div>
            )}
            {requests.map((r) => (
              <div key={r.user_id} className={styles.friendRow}>
                <span className={styles.friendName}>{r.username}</span>
                <button className={styles.acceptBtn} onClick={() => acceptFriendRequest(r.user_id).then(refresh)}>✓ Accepter</button>
              </div>
            ))}
          </>
        )}

        {view === 'duels' && (
          <>
            {duels.length === 0 && (
              <div className={styles.empty}><span>⚔️</span><p>Aucun défi reçu</p></div>
            )}
            {duels.map((d) => (
              <div key={d.ID} className={styles.friendRow}>
                <span className={styles.friendName}>⚔️ <strong>{d.ChallengerName}</strong> te défie !</span>
                <div className={styles.actions}>
                  <button className={styles.challengeBtn} onClick={() => { setActiveDuel(d); setResult(null); setView('accept-duel'); }}>
                    Accepter
                  </button>
                  <button className={styles.removeBtn} onClick={() => declineDuelRequest(d.ID).then(refresh)}>Refuser</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
