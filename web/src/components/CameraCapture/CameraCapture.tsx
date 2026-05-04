import { useRef, useEffect, useState } from 'react';
import { captureAndAnalyze } from '@/api/face';
import { MogMeter } from '@/components/MogMeter/MogMeter';
import { useFaceMesh } from './useFaceMesh';
import styles from './CameraCapture.module.css';

export interface CaptureResult {
  photo_id: string;
  signed_url: string;
  chad_score: number;
  features: Record<string, number>;
  zones?: Record<string, { cx: number; cy: number; rx: number; ry: number }>;
}

interface Props {
  onCapture: (result: CaptureResult) => void;
  onCancel: () => void;
  label?: string;
  autoSubmit?: boolean; // soumet direct sans montrer le résultat interne
}

type Phase = 'preview' | 'captured' | 'analyzing' | 'done' | 'error';

const FEATURE_LABELS: Record<string, string> = {
  symmetry: 'Symétrie', golden_ratio: 'Golden R.', jawline: 'Jawline',
  eyes: 'Yeux', nose: 'Nez', forehead: 'Front',
};

function getScoreLabel(score: number): string {
  if (score >= 90) return '🗿 GIGACHAD';
  if (score >= 75) return '💪 CHAD';
  if (score >= 60) return '😤 BASED';
  if (score >= 45) return '😐 NPC';
  if (score >= 30) return '😬 MEWED';
  return '💀 MOGGED';
}

export function CameraCapture({ onCapture, onCancel, label, autoSubmit }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>('preview');
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [result, setResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);

  useFaceMesh(videoRef, canvasRef, phase === 'preview');

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      // Fallback: use file input for mobile
      setPhase('error');
      setError('Caméra non disponible — utilise le bouton ci-dessous');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCountdown = () => {
    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count === 0) {
        clearInterval(interval);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(count);
      }
    }, 1000);
  };

  const doCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const url = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedUrl(url);
    setPhase('captured');
    stopCamera();
  };

  const confirmCapture = async () => {
    if (!capturedUrl) return;
    setPhase('analyzing');
    try {
      const blob = await (await fetch(capturedUrl)).blob();
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
      const res = await captureAndAnalyze(file);
      const capture: CaptureResult = {
        photo_id: res.photo_id,
        signed_url: res.signed_url || capturedUrl,
        chad_score: res.chad_score,
        features: res.features,
        zones: res.features?.zones as unknown as Record<string, { cx: number; cy: number; rx: number; ry: number }>,
      };
      setResult(capture);
      if (autoSubmit) { onCapture(capture); return; }
      setPhase('done');
    } catch (e: unknown) {
      setError((e as Error).message);
      setPhase('error');
    }
  };

  const retake = () => {
    setCapturedUrl(null);
    setResult(null);
    setError('');
    setPhase('preview');
    startCamera();
  };

  // Mobile fallback
  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCapturedUrl(url);
    setPhase('analyzing');
    try {
      const res = await captureAndAnalyze(file);
      const capture = { photo_id: res.photo_id, signed_url: res.signed_url || url, chad_score: res.chad_score, features: res.features };
      setResult(capture);
      if (autoSubmit) { onCapture(capture); return; }
      setPhase('done');
    } catch (err: unknown) {
      setError((err as Error).message);
      setPhase('error');
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {label && <p className={styles.label}>{label}</p>}

        {/* Camera preview */}
        {phase === 'preview' && (
          <>
            <div className={styles.viewfinder}>
              <video ref={videoRef} className={`${styles.video} ${styles.videoMirror}`} autoPlay playsInline muted />
              <canvas ref={canvasRef} className={styles.landmarkCanvas} />
              {countdown !== null && (
                <div className={styles.countdown}>{countdown}</div>
              )}
            </div>
            <div className={styles.controls}>
              <button className={styles.cancelBtn} onClick={onCancel}>Annuler</button>
              <button className={styles.captureBtn} onClick={startCountdown} disabled={countdown !== null}>
                <span className={styles.captureBtnInner} />
              </button>
              <label className={styles.importBtn} title="Importer une photo">
                📁
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileInput} />
              </label>
            </div>
          </>
        )}

        {/* Captured — confirm or retake */}
        {phase === 'captured' && capturedUrl && (
          <>
            <div className={styles.viewfinder}>
              <img src={capturedUrl} className={styles.video} alt="capture" />
            </div>
            <div className={styles.controls}>
              <button className={styles.cancelBtn} onClick={retake}>Reprendre</button>
              <button className={styles.confirmBtn} onClick={confirmCapture}>
                ✓ Confirmer
              </button>
            </div>
          </>
        )}

        {/* Analyzing */}
        {phase === 'analyzing' && (
          <div className={styles.analyzing}>
            {capturedUrl && <img src={capturedUrl} className={styles.analyzeThumb} alt="" />}
            <MogMeter analyzing={true} score={undefined} />
            <p className={styles.analyzeSubtext}>Détection jawline & symétrie en cours…</p>
          </div>
        )}

        {/* Result */}
        {phase === 'done' && result && (
          <div className={styles.result}>
            <MogMeter analyzing={false} score={result.chad_score} />
            <div className={styles.resultThumbWrap}>
              <img src={result.signed_url} className={styles.resultThumb} alt="capture" />
              <div className={styles.resultOverlay}>
                <span className={styles.resultBadge}>{getScoreLabel(result.chad_score)}</span>
                <span className={styles.resultScore}>{Math.round(result.chad_score)}<span className={styles.resultPct}>%</span></span>
              </div>
            </div>
            {result.features && (
              <div className={styles.features}>
                {Object.entries(FEATURE_LABELS).map(([key, lbl]) => {
                  const val = result.features[key] ?? 0;
                  return (
                    <div key={key} className={styles.featureRow}>
                      <span className={styles.featureName}>{lbl}</span>
                      <div className={styles.barBg}>
                        <div className={styles.barFill} style={{ width: `${val}%` }} />
                      </div>
                      <span className={styles.featureVal}>{Math.round(val)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className={styles.controls} style={{ marginTop: 12 }}>
              <button className={styles.cancelBtn} onClick={retake}>Reprendre</button>
              <button className={styles.confirmBtn} onClick={() => onCapture(result)}>
                ⚔️ Utiliser
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className={styles.errorWrap}>
            <p className={styles.errorText}>{error}</p>
            <label className={styles.confirmBtn}>
              📷 Choisir une photo
              <input type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFileInput} />
            </label>
            <button className={styles.cancelBtn} onClick={onCancel}>Annuler</button>
          </div>
        )}
      </div>
    </div>
  );
}
