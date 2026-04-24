import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TierBadge } from '@/components/TierBadge/TierBadge';
import { getProfile } from '@/api/user';
import { getElo } from '@/api/elo';
import styles from './Profile.module.css';

interface EloData { score: number; tier: string }
interface ProfileData { id: string; username: string; consent_ai: boolean }

export default function Profile() {
  const { userID, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!userID) return;
    getProfile().then(setProfile).catch(console.error);
    getElo(userID).then(setElo).catch(console.error);
  }, [userID]);

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Photos</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Profile</h1>
        {profile && (
          <div className={styles.section}>
            <p className={styles.username}>{profile.username || 'Anonymous'}</p>
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
