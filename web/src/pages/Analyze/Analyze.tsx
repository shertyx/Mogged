import { useRef, useState } from 'react';
import { captureAndAnalyze } from '@/api/face';
import { getMogLabel } from '@/lib/mogVocab';
import { BottomNav } from '@/components/BottomNav/BottomNav';
import { BeauTentacule } from '@/components/BeauTentacule/BeauTentacule';
import styles from './Analyze.module.css';

interface AnalyzedPhoto {
  id: string;
  localUrl: string;
  signedUrl: string;
  score: number;
  features: Record<string, number>;
  timestamp: number;
}

const FEATURE_LABELS: Record<string, string> = {
  symmetry: 'Symétrie', golden_ratio: 'Golden Ratio',
  jawline: 'Jawline', eyes: 'Yeux', nose: 'Nez', forehead: 'Front',
};


export default function Analyze() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<AnalyzedPhoto[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAnalyzing(true);
    for (const file of Array.from(files)) {
      const localUrl = URL.createObjectURL(file);
      try {
        const res = await captureAndAnalyze(file);
        const photo: AnalyzedPhoto = {
          id: res.photo_id,
          localUrl,
          signedUrl: res.signed_url || localUrl,
          score: res.chad_score,
          features: res.features ?? {},
          timestamp: Date.now(),
        };
        setPhotos((prev) => [photo, ...prev]);
        setActiveId(res.photo_id);
      } catch (e: unknown) {
        alert(`Erreur: ${(e as Error).message}`);
      }
    }
    setAnalyzing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const active = photos.find((p) => p.id === activeId) ?? photos[0];
  const label = active ? getMogLabel(active.score) : null;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>ANALYSE<span className={styles.titleAccent}>R</span></h1>
        <p className={styles.subtitle}>Teste n'importe quelle photo — jawline judgment</p>
      </header>

      {/* Squidward cali banner */}
      <div className={styles.squidBanner}>
        <div className={styles.squidFace}>
          <BeauTentacule size={52} />
        </div>
        <div className={styles.squidText}>
          <span className={styles.squidName}>BEAU TENTACULE</span>
          <span className={styles.squidQuote}>t'as vu ma jawline ? 📐</span>
          <span className={styles.squidTip}>
            👉 <strong>Photo de face</strong>, lumière naturelle, menton légèrement relevé.<br/>
            <span style={{ color: '#3a7a70' }}>Pas de filtre. Pas de pitié.</span>
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${analyzing ? styles.dropZoneActive : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInput.current?.click()}
      >
        {analyzing ? (
          <>
            <div className={styles.spinner} />
            <p className={styles.dropText}>ANALYSE EN COURS…</p>
            <p className={styles.dropSub}>Détection jawline & symétrie</p>
          </>
        ) : (
          <>
            <span className={styles.dropIcon}>🔬</span>
            <p className={styles.dropText}>IMPORTER UNE PHOTO</p>
            <p className={styles.dropSub}>Glisse ici ou clique • JPG, PNG, HEIC</p>
            <p className={styles.dropSub} style={{ opacity: 0.4 }}>Plusieurs photos supportées</p>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Active result */}
      {active && label && (
        <div className={styles.result} key={active.id}>
          <div className={styles.resultPhotoWrap}>
            <img src={active.signedUrl} className={styles.resultPhoto} alt="" />
            <div className={styles.resultGradient}>
              <span className={styles.resultBadge} style={{ background: label.color }}>
                {label.emoji} {label.word}
              </span>
              <span className={styles.resultScore}>{Math.round(active.score)}<span className={styles.resultPct}>%</span></span>
              <span className={styles.resultDesc}>{label.desc}</span>
            </div>
          </div>

          {/* Feature breakdown */}
          <div className={styles.features}>
            <p className={styles.featuresTitle}>BREAKDOWN</p>
            {Object.entries(FEATURE_LABELS).map(([key, lbl]) => {
              const val = active.features[key] ?? 0;
              const fl = getMogLabel(val);
              return (
                <div key={key} className={styles.featureRow}>
                  <span className={styles.featureName}>{lbl}</span>
                  <div className={styles.barBg}>
                    <div className={styles.barFill} style={{ width: `${val}%`, background: fl.color }} />
                  </div>
                  <span className={styles.featureWord} style={{ color: fl.color }}>{fl.word}</span>
                  <span className={styles.featureVal}>{Math.round(val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Thumbnail gallery */}
      {photos.length > 1 && (
        <div className={styles.gallery}>
          <p className={styles.galleryTitle}>GALERIE</p>
          <div className={styles.galleryGrid}>
            {photos.map((p) => {
              const l = getMogLabel(p.score);
              return (
                <button
                  key={p.id}
                  className={`${styles.thumb} ${p.id === activeId ? styles.thumbActive : ''}`}
                  onClick={() => setActiveId(p.id)}
                  style={{ borderColor: p.id === activeId ? l.color : 'transparent' }}
                >
                  <img src={p.signedUrl} className={styles.thumbImg} alt="" />
                  <span className={styles.thumbScore} style={{ color: l.color }}>
                    {Math.round(p.score)}%
                  </span>
                  <span className={styles.thumbWord} style={{ background: l.color }}>{l.word}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: '80px' }} />
      <BottomNav />
    </div>
  );
}
