# Analyze Button + Stats Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Analyze" button per photo card and an "Analyze All" button on the Photos page — photos upload without score, user triggers analysis manually, score + 6 feature bars are displayed on the card.

**Architecture:** New face-service endpoint `POST /face/photos/analyze-stored` fetches the photo from MinIO by `s3_key` and runs the pipeline. Frontend: upload flow split from analyze flow, PhotoCard shows analyze button when `chad_score === null`, expands to show feature bars after analysis.

**Tech Stack:** FastAPI (Python), React + TypeScript + CSS Modules, Zustand.

---

## Files Modified / Created

| File | Action | What changes |
|------|--------|--------------|
| `services/face-service/main.py` | Modify | Add `POST /face/photos/analyze-stored` endpoint |
| `web/src/api/face.ts` | Modify | Add `analyzeStoredPhoto(photoId, s3Key)` function, split upload from analyze |
| `web/src/hooks/usePhotos.ts` | Modify | Add `analyze(photoId, s3Key)` and `analyzeAll()` hooks |
| `web/src/store/photos.ts` | Modify | Add `analyzingIds: Set<string>` to track in-progress analyses, add `updatePhoto` action |
| `web/src/pages/Photos/Photos.tsx` | Modify | Add "Analyze All" button, pass `onAnalyze` to PhotoCard |
| `web/src/pages/Photos/Photos.module.css` | Modify | Add `.analyzeAllBtn` style |
| `web/src/components/PhotoCard/PhotoCard.tsx` | Modify | Show "Analyze" button when no score, show feature bars when score present |
| `web/src/components/PhotoCard/PhotoCard.module.css` | Modify | Add styles for analyze button, feature bars, score display |

---

## Task 1: face-service — analyze-stored endpoint

**Files:**
- Modify: `services/face-service/main.py`

The new endpoint receives `photo_id` and `s3_key`, downloads the photo bytes from MinIO, runs the pipeline, then calls user-service `UpdatePhotoScore`.

- [ ] **Step 1: Read current main.py**

```bash
cat services/face-service/main.py
```

- [ ] **Step 2: Add analyze-stored endpoint**

Add the following after the existing `analyze_photo` function in `services/face-service/main.py`:

```python
@app.post("/face/photos/analyze-stored")
@app.post("/photos/analyze-stored")
async def analyze_stored_photo(
    request: Request,
    photo_id: str = Form(...),
    s3_key: str = Form(...),
):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    user_id = request.headers.get("X-User-ID", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing user id")

    # Download photo from MinIO
    try:
        contents = _storage.download_photo(s3_key)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Photo not found in storage: {e}")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = s3_key.rsplit(".", 1)[-1].lower() if "." in s3_key else "jpg"

    try:
        result = _pipeline.analyse_photo(contents, hash_md5, ext, photo_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    async with httpx.AsyncClient() as client:
        score_resp = await client.patch(
            f"{_user_service_url}/user/photos/score",
            json={
                "photo_id": photo_id,
                "score": result["chad_score"],
                "features": result["features"],
            },
        )
        if score_resp.status_code not in (200, 201, 204):
            raise HTTPException(status_code=502, detail=f"UpdatePhotoScore failed: {score_resp.text}")

    return {**result, "photo_id": photo_id}
```

- [ ] **Step 3: Add `download_photo` method to StorageClient**

In `services/face-service/storage.py`, add after `upload_photo`:

```python
    def download_photo(self, key: str) -> bytes:
        response = self._s3.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()
```

- [ ] **Step 4: Rebuild and restart face-service**

```bash
docker compose build face-service && docker compose up -d face-service
sleep 3 && docker compose logs face-service | tail -5
```

Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 5: Test the new endpoint manually**

First get a valid token from browser localStorage (F12 → Application → Local Storage → `access_token`), then:

```bash
# Replace TOKEN and PHOTO_ID/S3_KEY with real values from your DB
curl -X POST http://localhost:8000/photos/analyze-stored \
  -H "X-User-ID: test-user" \
  -F "photo_id=some-uuid" \
  -F "s3_key=photos/abc123.png"
```

Expected: JSON with `chad_score`, `features`, `photo_id` or 404 if photo doesn't exist yet.

- [ ] **Step 6: Commit**

```bash
git add services/face-service/main.py services/face-service/storage.py
git commit -m "feat(face-service): add analyze-stored endpoint for on-demand analysis"
```

---

## Task 2: Split upload flow — upload no longer auto-analyzes

**Context:** Currently `POST /face/photos/analyze` uploads AND analyzes in one step. We want upload to just register the photo (store in MinIO + create DB record with no score), and analysis to happen separately on demand.

The existing `/face/photos/analyze` stays as-is for now (it still works for the initial upload flow). We'll change the frontend upload to use a simpler endpoint that only registers without analyzing — but since user-service `RegisterUpload` already exists and face-service currently does both, the simplest approach is: keep the current upload flow but make `uploadPhoto` in the frontend NOT call analyze. Instead it will just upload the raw file to a new lightweight endpoint.

**Simplest approach:** Change `POST /face/photos/analyze` to **only** register the photo (no ML analysis), and use `POST /face/photos/analyze-stored` for on-demand analysis.

**Files:**
- Modify: `services/face-service/main.py`
- Modify: `web/src/api/face.ts`

- [ ] **Step 1: Rename existing analyze endpoint to upload-only**

In `services/face-service/main.py`, replace the `analyze_photo` function body so it registers the photo without running ML:

```python
@app.post("/face/photos/analyze")
@app.post("/photos/analyze")
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
):
    user_id = request.headers.get("X-User-ID", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="missing user id")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()
    s3_key = _storage.upload_photo(contents, hash_md5, ext)

    async with httpx.AsyncClient() as client:
        reg_resp = await client.post(
            f"{_user_service_url}/user/photos/register",
            json={"s3_key": s3_key, "hash": hash_md5},
            headers={"X-User-ID": user_id},
        )
        if reg_resp.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail=f"RegisterUpload failed: {reg_resp.text}")
        photo_id = reg_resp.json()["photo_id"]

    signed_url = _storage.get_signed_url(s3_key)
    return {"photo_id": photo_id, "s3_key": s3_key, "signed_url": signed_url}
```

- [ ] **Step 2: Update `web/src/api/face.ts` — add analyzeStoredPhoto, update uploadPhoto return type**

Replace the entire content of `web/src/api/face.ts`:

```typescript
import { apiRequest } from './client';

export async function uploadPhoto(file: File): Promise<{
  photo_id: string;
  s3_key: string;
  signed_url: string;
}> {
  const token = localStorage.getItem('access_token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/face/photos/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeStoredPhoto(photoId: string, s3Key: string): Promise<{
  photo_id: string;
  chad_score: number;
  features: Record<string, number>;
  signed_url: string;
}> {
  const token = localStorage.getItem('access_token');
  const form = new FormData();
  form.append('photo_id', photoId);
  form.append('s3_key', s3Key);
  const res = await fetch('/face/photos/analyze-stored', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 3: Rebuild face-service**

```bash
docker compose build face-service && docker compose up -d face-service
sleep 3 && docker compose logs face-service | tail -5
```

Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 4: Commit**

```bash
git add services/face-service/main.py web/src/api/face.ts
git commit -m "feat: split upload (register only) from analyze (on-demand ML)"
```

---

## Task 3: Zustand store — add analyzingIds and updatePhoto

**Files:**
- Modify: `web/src/store/photos.ts`

- [ ] **Step 1: Read current store**

```bash
cat web/src/store/photos.ts
```

- [ ] **Step 2: Replace photos store with updated version**

Replace the entire content of `web/src/store/photos.ts`:

```typescript
import { create } from 'zustand';

export interface Photo {
  id: string;
  s3_key: string;
  chad_score: number | null;
  features: Record<string, number> | null;
  hash: string;
  uploaded_at: string;
}

interface PhotosState {
  photos: Photo[];
  loading: boolean;
  analyzingIds: Set<string>;
  setPhotos: (photos: Photo[]) => void;
  setLoading: (v: boolean) => void;
  removePhoto: (id: string) => void;
  updatePhoto: (id: string, patch: Partial<Photo>) => void;
  setAnalyzing: (id: string, analyzing: boolean) => void;
}

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: [],
  loading: false,
  analyzingIds: new Set(),
  setPhotos: (photos) => set({ photos }),
  setLoading: (loading) => set({ loading }),
  removePhoto: (id) =>
    set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
  updatePhoto: (id, patch) =>
    set((s) => ({
      photos: s.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),
  setAnalyzing: (id, analyzing) =>
    set((s) => {
      const next = new Set(s.analyzingIds);
      analyzing ? next.add(id) : next.delete(id);
      return { analyzingIds: next };
    }),
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/store/photos.ts
git commit -m "feat(store): add analyzingIds and updatePhoto to photos store"
```

---

## Task 4: usePhotos hook — add analyze and analyzeAll

**Files:**
- Modify: `web/src/hooks/usePhotos.ts`

- [ ] **Step 1: Replace usePhotos.ts**

Replace the entire content of `web/src/hooks/usePhotos.ts`:

```typescript
import { useCallback } from 'react';
import { usePhotosStore } from '@/store/photos';
import { listPhotos, deletePhoto } from '@/api/user';
import { uploadPhoto, analyzeStoredPhoto } from '@/api/face';

export function usePhotos() {
  const { photos, loading, analyzingIds, setPhotos, setLoading, removePhoto, updatePhoto, setAnalyzing } = usePhotosStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPhotos();
      setPhotos(data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    try {
      await uploadPhoto(file);
      await load();
    } finally {
      setLoading(false);
    }
  }, [load]);

  const analyze = useCallback(async (photoId: string, s3Key: string) => {
    setAnalyzing(photoId, true);
    try {
      const result = await analyzeStoredPhoto(photoId, s3Key);
      updatePhoto(photoId, {
        chad_score: result.chad_score,
        features: result.features,
      });
    } finally {
      setAnalyzing(photoId, false);
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    const unanalyzed = photos.filter((p) => p.chad_score === null);
    await Promise.all(unanalyzed.map((p) => analyze(p.id, p.s3_key)));
  }, [photos, analyze]);

  const remove = useCallback(async (photoID: string) => {
    await deletePhoto(photoID);
    removePhoto(photoID);
  }, []);

  return { photos, loading, analyzingIds, load, upload, analyze, analyzeAll, remove };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/src/hooks/usePhotos.ts
git commit -m "feat(hooks): add analyze and analyzeAll to usePhotos"
```

---

## Task 5: PhotoCard — analyze button + feature bars

**Files:**
- Modify: `web/src/components/PhotoCard/PhotoCard.tsx`
- Modify: `web/src/components/PhotoCard/PhotoCard.module.css`

- [ ] **Step 1: Replace PhotoCard.tsx**

Replace the entire content of `web/src/components/PhotoCard/PhotoCard.tsx`:

```typescript
import styles from './PhotoCard.module.css';
import type { Photo } from '@/store/photos';

const FEATURE_LABELS: Record<string, string> = {
  symmetry: 'Symétrie',
  golden_ratio: 'Golden R.',
  jawline: 'Jawline',
  eyes: 'Yeux',
  nose: 'Nez',
  forehead: 'Front',
};

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  onAnalyze?: (id: string, s3Key: string) => void;
  analyzing?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, onAnalyze, analyzing, selected, onSelect }: Props) {
  const hasScore = photo.chad_score !== null;

  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''} ${hasScore ? styles.analyzed : ''}`}
      onClick={() => onSelect?.(photo.id)}
    >
      <button
        className={styles.delete}
        onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}
      >
        ✕
      </button>

      {hasScore && (
        <div className={styles.scoreBlock}>
          <span className={styles.scoreValue}>{Math.round(photo.chad_score!)}%</span>
          <span className={styles.scoreLabel}>Mogg Score</span>
        </div>
      )}

      {hasScore && photo.features && (
        <div className={styles.features}>
          {Object.entries(FEATURE_LABELS).map(([key, label]) => {
            const val = photo.features![key] ?? 0;
            return (
              <div key={key} className={styles.featureRow}>
                <span className={styles.featureName}>{label}</span>
                <div className={styles.barBg}>
                  <div className={styles.barFill} style={{ width: `${val}%` }} />
                </div>
                <span className={styles.featureVal}>{Math.round(val)}</span>
              </div>
            );
          })}
        </div>
      )}

      {!hasScore && !analyzing && onAnalyze && (
        <button
          className={styles.analyzeBtn}
          onClick={(e) => { e.stopPropagation(); onAnalyze(photo.id, photo.s3_key); }}
        >
          Analyze
        </button>
      )}

      {!hasScore && analyzing && (
        <span className={styles.analyzingLabel}>Analyzing…</span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace PhotoCard.module.css**

Replace the entire content of `web/src/components/PhotoCard/PhotoCard.module.css`:

```css
.card {
  position: relative;
  background: #111;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px 10px 10px;
  min-height: 160px;
  gap: 6px;
  transition: border-color 0.15s;
}

.selected { border-color: #fff; }

.analyzed {
  justify-content: flex-start;
  padding-top: 28px;
}

.delete {
  position: absolute;
  top: 6px;
  right: 6px;
  background: rgba(200,0,0,0.85);
  color: #fff;
  border: none;
  border-radius: 4px;
  width: 22px;
  height: 22px;
  font-size: 11px;
  cursor: pointer;
  font-weight: 700;
  z-index: 2;
}

/* Score block */
.scoreBlock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.scoreValue {
  color: #fff;
  font-weight: 900;
  font-size: 1.6rem;
  line-height: 1;
}

.scoreLabel {
  color: #555;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Feature bars */
.features {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.featureRow {
  display: flex;
  align-items: center;
  gap: 4px;
}

.featureName {
  color: #666;
  font-size: 0.6rem;
  width: 46px;
  flex-shrink: 0;
}

.barBg {
  flex: 1;
  height: 4px;
  background: #222;
  border-radius: 2px;
  overflow: hidden;
}

.barFill {
  height: 100%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.4s ease;
}

.featureVal {
  color: #555;
  font-size: 0.6rem;
  width: 18px;
  text-align: right;
  flex-shrink: 0;
}

/* Analyze button */
.analyzeBtn {
  background: #fff;
  color: #000;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-weight: 700;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.analyzeBtn:hover { background: #ddd; }

.analyzingLabel {
  color: #555;
  font-size: 0.8rem;
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/PhotoCard/PhotoCard.tsx web/src/components/PhotoCard/PhotoCard.module.css
git commit -m "feat(PhotoCard): add analyze button and feature bars display"
```

---

## Task 6: Photos page — wire analyze + Analyze All button

**Files:**
- Modify: `web/src/pages/Photos/Photos.tsx`
- Modify: `web/src/pages/Photos/Photos.module.css`

- [ ] **Step 1: Replace Photos.tsx**

Replace the entire content of `web/src/pages/Photos/Photos.tsx`:

```typescript
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
```

- [ ] **Step 2: Add analyzeAllBtn style to Photos.module.css**

Add at the end of `web/src/pages/Photos/Photos.module.css`:

```css
.analyzeAllBtn {
  margin: 0 32px 16px;
  display: block;
  width: calc(100% - 64px);
  background: #111;
  color: #fff;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 12px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
}

.analyzeAllBtn:hover { background: #1a1a1a; border-color: #555; }
.analyzeAllBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | tail -10
```

Expected: build succeeds.

- [ ] **Step 4: Rebuild web container**

```bash
docker compose build web && docker compose up -d web
```

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/Photos/Photos.tsx web/src/pages/Photos/Photos.module.css
git commit -m "feat(Photos): add Analyze All button and wire per-photo analyze"
```

---

## Task 7: Manual validation

- [ ] **Step 1: Open http://localhost:3000 and log in**

- [ ] **Step 2: Upload a photo**

Click "+ Upload Photo". Photo should appear in grid **without** a score — just an "Analyze" button.

- [ ] **Step 3: Click "Analyze" on a single photo**

Button changes to "Analyzing…". After a few seconds, score and 6 feature bars appear.

- [ ] **Step 4: Upload 2 more photos, then click "Analyze All"**

Button shows "Analyze All (2)". Both photos analyze in parallel. Progress counter shows "Analyzing 2/2…".

- [ ] **Step 5: Verify feature bars look correct**

Each bar should be proportional to its value (0–100). Score should be between 0–100.

---

## Self-Review

**Spec coverage:**
- Upload without score → Task 2 (upload endpoint no longer runs ML)
- "Analyze" button per card → Task 5 (PhotoCard)
- "Analyze All" button → Task 6 (Photos page)
- Feature bars (6 features) → Task 5 (PhotoCard feature bars)
- Score displayed as percentage → Task 5 (`scoreValue` with `%`)
- Spinner during analysis → Task 5 (`analyzingLabel`) + Task 3/4 (`analyzingIds`)
- Parallel analyzeAll → Task 4 (`Promise.all`)

**No placeholders.**

**Type consistency:**
- `analyzeStoredPhoto` returns `{ photo_id, chad_score, features, signed_url }` → `updatePhoto` patches `{ chad_score, features }` ✓
- `PhotoCard` receives `onAnalyze: (id: string, s3Key: string) => void` → `usePhotos.analyze(photoId, s3Key)` ✓
- `analyzingIds: Set<string>` → `analyzingIds.has(p.id)` ✓
