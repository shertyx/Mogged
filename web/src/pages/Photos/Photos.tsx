import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { ConsentModal } from '@/components/ConsentModal/ConsentModal';
import { canUpload, upsertProfile, getProfile } from '@/api/user';
import styles from './Photos.module.css';

export default function Photos() {
  const { photos, loading, analyzingIds, load, upload, analyze, analyzeAll, remove } = usePhotos();
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const handleUploadClick = async () => {
    try { await canUpload(); } catch (e: unknown) { alert((e as Error).message); return; }
    fileInput.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const profile = await getProfile();
    if (!profile?.consent_ai) {
      setPendingFile(file);
      setShowConsent(true);
      e.target.value = '';
      return;
    }
    await upload(file);
    e.target.value = '';
  };

  const handleConsentAccept = async () => {
    await upsertProfile('', true);
    setShowConsent(false);
    if (pendingFile) { await upload(pendingFile); setPendingFile(null); }
  };

  const unanalyzedCount = photos.filter((p) => p.chad_score === null).length;

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <span className={styles.logo}>Mogged</span>
        <div className={styles.navLinks}>
          <button onClick={() => navigate('/matchmaking')} className={styles.navBtn}>Fight</button>
          <button onClick={() => navigate('/profile')} className={styles.navBtn}>Profile</button>
        </div>
      </nav>
      <div className={styles.header}>
        <h1>My Photos</h1>
        <span className={styles.count}>{photos.length}/10</span>
      </div>
      {unanalyzedCount > 0 && (
        <button
          className={styles.analyzeAllBtn}
          onClick={analyzeAll}
          disabled={analyzingIds.size > 0}
        >
          {analyzingIds.size > 0
            ? `Analyzing ${analyzingIds.size}/${unanalyzedCount}…`
            : `Analyze All (${unanalyzedCount})`}
        </button>
      )}
      <div className={styles.grid}>
        {photos.map((p) => (
          <PhotoCard
            key={p.id}
            photo={p}
            onDelete={remove}
            onAnalyze={analyze}
            analyzing={analyzingIds.has(p.id)}
          />
        ))}
      </div>
      <button className={styles.uploadBtn} onClick={handleUploadClick} disabled={loading}>
        {loading ? 'Uploading…' : '+ Upload Photo'}
      </button>
      <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      <ConsentModal
        visible={showConsent}
        onAccept={handleConsentAccept}
        onDecline={() => { setShowConsent(false); setPendingFile(null); }}
      />
    </div>
  );
}
