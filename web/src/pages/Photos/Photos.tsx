import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { usePhotos } from '@/hooks/usePhotos';
import { ConsentModal } from '@/components/ConsentModal/ConsentModal';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import { FeedCard } from '@/components/FeedCard/FeedCard';
import { canUpload, upsertProfile, getProfile } from '@/api/user';
import { getFeed, type FeedEntry } from '@/api/elo';
import { getSignedUrls } from '@/api/face';
import styles from './Photos.module.css';

const SIGMA_QUOTES = [
  'SIGMA GRINDSET 🗿', 'MEWING DAILY 🦷', 'JAW ON GRANITE 💪',
  'GIGACHAD ENERGY 👁️', 'MOGGING THE COMPETITION 🏋️', 'LOOKSMAXXING IN PROGRESS 🧠',
];

export default function Photos() {
  const { load, upload } = usePhotos();
  const username = useAuthStore((s) => s.username);
  const userID = useAuthStore((s) => s.userID);
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [quote] = useState(() => SIGMA_QUOTES[Math.floor(Math.random() * SIGMA_QUOTES.length)]);
  const [feed, setFeed] = useState<(FeedEntry & { url_a?: string; url_b?: string })[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load();
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setFeedLoading(true);
    try {
      const entries = await getFeed() ?? [];
      // Fetch signed URLs for photos
      const keys = [...new Set(entries.flatMap((e) => [e.s3key_a, e.s3key_b].filter(Boolean)))];
      const urls = keys.length > 0 ? await getSignedUrls(keys) : {};
      setFeed(entries.map((e) => ({ ...e, url_a: urls[e.s3key_a], url_b: urls[e.s3key_b] })));
    } catch {
      setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  };

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

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logo}>MOGGED</span>
          <span className={styles.headerSub}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        </div>
        <div className={styles.headerRight}>
          {username && <span className={styles.username}>{username}</span>}
        </div>
      </header>

      {/* Quote banner */}
      <div className={styles.quoteBanner}>
        <span className={styles.quoteDot} />
        <span className={styles.quoteText}>{quote}</span>
      </div>

      {/* Feed */}
      <div className={styles.feed}>
        {feedLoading && (
          <div className={styles.feedLoading}>
            <span style={{ fontSize: '2.5rem', display: 'block', animation: 'float 1.5s ease-in-out infinite' }}>🗿</span>
            <p>Chargement du feed…</p>
          </div>
        )}

        {!feedLoading && feed.length === 0 && (
          <div className={styles.emptyFeed}>
            <span className={styles.emptyIcon}>⚔️</span>
            <p className={styles.emptyTitle}>AUCUN MATCH</p>
            <p className={styles.emptySub}>Défie un ami pour commencer</p>
            <p className={styles.emptySub} style={{ marginTop: 20, opacity: 0.5, fontSize: '0.7rem' }}>
              Tes photos perso sont accessibles depuis le profil
            </p>
          </div>
        )}

        {feed.map((entry, i) => (
          <FeedCard
            key={entry.match_id}
            entry={entry}
            myID={userID ?? ''}
            style={{ animationDelay: `${i * 0.08}s` }}
          />
        ))}
      </div>

      {/* Camera button — for solo profile photos */}
      <div className={styles.cameraWrap}>
        <button className={styles.cameraBtn} onClick={handleUploadClick} aria-label="Photo profil">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            <circle cx="12" cy="13" r="4"/>
          </svg>
        </button>
        <span className={styles.cameraLabel}>PROFIL</span>
      </div>

      <div style={{ height: '90px' }} />

      <input ref={fileInput} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFileChange} />
      <ConsentModal
        visible={showConsent}
        onAccept={handleConsentAccept}
        onDecline={() => { setShowConsent(false); setPendingFile(null); }}
      />
      <BottomNav />
    </div>
  );
}
