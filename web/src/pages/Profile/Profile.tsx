import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TierBadge } from '@/components/TierBadge/TierBadge';
import { getProfile, setUsername } from '@/api/user';
import { getElo } from '@/api/elo';
import styles from './Profile.module.css';

interface EloData { score: number; tier: string }
interface ProfileData { id: string; username: string; username_set: boolean; consent_ai: boolean }

export default function Profile() {
  const { userID, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);
  const navigate = useNavigate();
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);

  useEffect(() => {
    if (!userID) return;
    getProfile().then(setProfile).catch(console.error);
    getElo(userID).then(setElo).catch(console.error);
  }, [userID]);

  const handleSetUsername = async () => {
    setUsernameError('');
    setUsernameSaving(true);
    try {
      await setUsername(usernameInput.trim());
      setProfile((p) => p ? { ...p, username: usernameInput.trim(), username_set: true } : p);
    } catch (e: unknown) {
      setUsernameError((e as Error).message);
    } finally {
      setUsernameSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Photos</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Profile</h1>
        {profile && (
          <div className={styles.section}>
            {profile.username_set ? (
              <div className={styles.usernameBlock}>
                <span className={styles.usernameLabel}>Pseudo</span>
                <input
                  className={styles.usernameInputLocked}
                  value={profile.username}
                  disabled
                />
              </div>
            ) : (
              <div className={styles.usernameBlock}>
                <span className={styles.usernameLabel}>Pseudo</span>
                <p className={styles.usernameWarning}>
                  Attention : le pseudo ne peut être modifié qu'une seule fois.
                </p>
                <div className={styles.usernameRow}>
                  <input
                    className={styles.usernameInput}
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="3–20 caractères, lettres/chiffres/_"
                    maxLength={20}
                  />
                  <button
                    className={styles.usernameBtn}
                    onClick={handleSetUsername}
                    disabled={usernameSaving || usernameInput.trim().length < 3}
                  >
                    {usernameSaving ? '…' : 'Enregistrer'}
                  </button>
                </div>
                {usernameError && <p className={styles.usernameError}>{usernameError}</p>}
              </div>
            )}
            <p className={styles.id}>{userID}</p>
          </div>
        )}
        {elo && (
          <div className={styles.eloSection}>
            <span className={styles.eloScore}>{elo.score}</span>
            <span className={styles.eloLabel}>ELO</span>
            <TierBadge tier={elo.tier} />
          </div>
        )}
        <button className={styles.logoutBtn} onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
