import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { TierBadge } from '@/components/TierBadge/TierBadge';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import { getProfile, setUsername } from '@/api/user';
import { getElo, getMatchHistory, type MatchHistoryEntry } from '@/api/elo';
import styles from './Profile.module.css';

interface EloData { score: number; tier: string; tier_name: string; division: number; sr: number }
interface ProfileData { id: string; username: string; username_set: boolean; username_changes: number; consent_ai: boolean; is_admin: boolean }

export default function Profile() {
  const { userID, logout } = useAuth();
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const setStoreUsername = useAuthStore((s) => s.setUsername);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[]>([]);
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    if (!userID) return;
    getProfile().then((p) => {
      setProfile(p);
      setAdmin(!!p?.is_admin);
      if (p?.username) setStoreUsername(p.username);
    }).catch(console.error);
    getElo(userID).then(setElo).catch(console.error);
    getMatchHistory(userID).then((h) => setHistory(h ?? [])).catch(console.error);
  }, [userID]);

  const handleSetUsername = async () => {
    setUsernameError('');
    setUsernameSaving(true);
    try {
      const newUsername = (usernameInput || profile?.username || '').trim();
      await setUsername(newUsername);
      setStoreUsername(newUsername);
      setProfile((p) => p ? { ...p, username: newUsername, username_set: true, username_changes: (p.username_changes ?? 0) + 1 } : p);
      setUsernameInput('');
    } catch (e: unknown) {
      setUsernameError((e as Error).message);
    } finally {
      setUsernameSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.avatar}>🗿</div>
        <h1 className={styles.heroName}>
          {profile?.username
            ? <><span className={styles.heroNameAccent}>{profile.username.slice(0, 1)}</span>{profile.username.slice(1)}</>
            : <span className={styles.heroNameAccent}>???</span>}
        </h1>
        <span className={styles.heroId}>{userID}</span>
      </div>

      <div className={styles.content}>
        {/* ELO */}
        {elo && (
          <div className={styles.card} style={{ animationDelay: '0.05s' }}>
            <div className={styles.cardTitle}>Rang</div>
            <div className={styles.eloWrap}>
              <TierBadge tierName={elo.tier_name} division={elo.division} sr={elo.sr} size="lg" />
            </div>
          </div>
        )}

        {/* Username */}
        {profile && (
          <div className={styles.card} style={{ animationDelay: '0.1s' }}>
            <div className={styles.cardTitle}>Pseudo</div>
            <div className={styles.usernameBlock}>
              {profile.username_changes >= 3 ? (
                <>
                  <span className={styles.usernameLabel}>Pseudo verrouillé (3/3 modifs)</span>
                  <input className={styles.usernameInputLocked} value={profile.username} disabled />
                </>
              ) : (
                <>
                  {profile.username_changes > 0 && (
                    <p className={styles.usernameWarning}>
                      ⚠️ {3 - profile.username_changes} modification{3 - profile.username_changes > 1 ? 's' : ''} restante{3 - profile.username_changes > 1 ? 's' : ''}
                    </p>
                  )}
                  {profile.username_changes === 0 && (
                    <p className={styles.usernameWarning}>⚠️ Max 3 modifications possibles</p>
                  )}
                  <div className={styles.usernameRow}>
                    <input
                      className={styles.usernameInput}
                      value={usernameInput || profile.username}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      placeholder="3–20 caractères"
                      maxLength={20}
                    />
                    <button
                      className={styles.usernameBtn}
                      onClick={handleSetUsername}
                      disabled={usernameSaving || (usernameInput || profile.username).trim().length < 3}
                    >
                      {usernameSaving ? '…' : 'OK'}
                    </button>
                  </div>
                  {usernameError && <p className={styles.usernameError}>{usernameError}</p>}
                </>
              )}
            </div>
          </div>
        )}

        {/* Match history */}
        {history.length > 0 && (
          <div className={styles.card} style={{ animationDelay: '0.15s' }}>
            <div className={styles.cardTitle}>Historique</div>
            <div className={styles.historyList}>
              {history.map((h) => (
                <div key={h.match_id} className={`${styles.historyRow} ${h.won ? styles.win : styles.loss}`}>
                  <span className={styles.historyOpp}>vs {h.opponent}</span>
                  <span className={styles.historyResult}>{h.won ? '🏆 Victoire' : '💀 Défaite'}</span>
                  <span className={styles.historyElo}>{h.elo_change > 0 ? '+' : ''}{h.elo_change} SR</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className={styles.logoutBtn} onClick={logout}>Déconnexion</button>
      </div>

      <BottomNav />
    </div>
  );
}
