# Frontend Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'application web React complète : auth Google OAuth, gestion photos, matchmaking (temps réel WebSocket + défi async), profil ELO — en partageant la logique API avec le mobile.

**Architecture:** Vite + React 18 + TypeScript. Routing via React Router v6. State global Zustand (mêmes stores que le mobile, adaptés). API calls dans `src/api/` — logique identique au mobile, sans expo-secure-store (localStorage à la place). Pas de framework CSS lourd : CSS Modules uniquement. Dark theme par défaut.

**Tech Stack:** Vite, React 18, React Router v6, Zustand, TypeScript, CSS Modules.

---

## File Map

```
web/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx                    # point d'entrée React
│   ├── App.tsx                     # router + AuthGuard
│   ├── api/
│   │   ├── client.ts               # fetch wrapper + JWT inject + refresh (localStorage)
│   │   ├── auth.ts                 # login URL, callback, logout
│   │   ├── user.ts                 # profile, photos CRUD, can-upload
│   │   ├── elo.ts                  # getElo, createChallenge, getMatch
│   │   └── face.ts                 # uploadPhoto multipart
│   ├── store/
│   │   ├── auth.ts                 # Zustand: token, userID, isAuthenticated
│   │   └── photos.ts               # Zustand: photos[], loading
│   ├── hooks/
│   │   ├── usePhotos.ts            # load/upload/delete photos
│   │   └── useAuth.ts              # userID, logout
│   ├── components/
│   │   ├── PhotoCard/
│   │   │   ├── PhotoCard.tsx
│   │   │   └── PhotoCard.module.css
│   │   ├── TierBadge/
│   │   │   ├── TierBadge.tsx
│   │   │   └── TierBadge.module.css
│   │   ├── ConsentModal/
│   │   │   ├── ConsentModal.tsx
│   │   │   └── ConsentModal.module.css
│   │   └── RoundResult/
│   │       ├── RoundResult.tsx
│   │       └── RoundResult.module.css
│   └── pages/
│       ├── Login/
│       │   ├── Login.tsx
│       │   └── Login.module.css
│       ├── Photos/
│       │   ├── Photos.tsx
│       │   └── Photos.module.css
│       ├── Profile/
│       │   ├── Profile.tsx
│       │   └── Profile.module.css
│       ├── Matchmaking/
│       │   ├── Matchmaking.tsx
│       │   └── Matchmaking.module.css
│       └── Match/
│           ├── RealtimeMatch.tsx
│           ├── RealtimeMatch.module.css
│           ├── Challenge.tsx
│           └── Challenge.module.css
```

---

### Task 1: Init projet Vite + React + TypeScript

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/index.html`
- Create: `web/src/main.tsx`

- [ ] **Step 1: Créer le projet Vite**

```bash
cd /home/cled/Mogged/web
npm create vite@latest . -- --template react-ts
```

Expected: projet créé avec `src/`, `index.html`, `vite.config.ts`.

- [ ] **Step 2: Installer les dépendances**

```bash
cd /home/cled/Mogged/web
npm install react-router-dom zustand
npm install --save-dev @types/react @types/react-dom
```

- [ ] **Step 3: Configurer vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/user': 'http://localhost:8080',
      '/elo': 'http://localhost:8080',
      '/face': 'http://localhost:8080',
      '/matchmaking': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
```

- [ ] **Step 4: Configurer tsconfig.json**

Remplacer le contenu de `web/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Nettoyer les fichiers générés inutiles**

```bash
cd /home/cled/Mogged/web
rm -f src/App.css src/index.css src/assets/react.svg public/vite.svg src/App.tsx
```

- [ ] **Step 6: Créer src/main.tsx minimal**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 7: Créer src/App.tsx minimal (sera remplacé Task 4)**

```tsx
export default function App() {
  return <div style={{ color: '#fff', background: '#000', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Mogged</div>;
}
```

- [ ] **Step 8: Vérifier le démarrage**

```bash
cd /home/cled/Mogged/web && npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
kill %1
```

Expected: `200`

- [ ] **Step 9: Commit**

```bash
git add web/
git commit -m "feat(web): init Vite React TypeScript project"
```

---

### Task 2: API client + stores Zustand

**Files:**
- Create: `web/src/api/client.ts`
- Create: `web/src/store/auth.ts`
- Create: `web/src/store/photos.ts`

- [ ] **Step 1: Créer le client HTTP (localStorage à la place de SecureStore)**

Créer `web/src/api/client.ts` :

```typescript
function getToken(): string | null {
  return localStorage.getItem('access_token');
}

async function refreshTokens(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) return null;
  const res = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  localStorage.setItem('access_token', data.access_token);
  return data.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();
  const doFetch = (t: string | null) =>
    fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    token = await refreshTokens();
    if (!token) {
      localStorage.clear();
      window.location.href = '/login';
      throw new Error('unauthenticated');
    }
    res = await doFetch(token);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
```

- [ ] **Step 2: Store auth Zustand**

Créer `web/src/store/auth.ts` :

```typescript
import { create } from 'zustand';

interface AuthState {
  userID: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, userID: string) => void;
  clearTokens: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  userID: null,
  isAuthenticated: false,

  setTokens: (access, refresh, userID) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_id', userID);
    set({ userID, isAuthenticated: true });
  },

  clearTokens: () => {
    localStorage.clear();
    set({ userID: null, isAuthenticated: false });
  },

  hydrate: () => {
    const userID = localStorage.getItem('user_id');
    const token = localStorage.getItem('access_token');
    if (userID && token) set({ userID, isAuthenticated: true });
  },
}));
```

- [ ] **Step 3: Store photos Zustand**

Créer `web/src/store/photos.ts` :

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
  setPhotos: (photos: Photo[]) => void;
  setLoading: (v: boolean) => void;
  removePhoto: (id: string) => void;
}

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: [],
  loading: false,
  setPhotos: (photos) => set({ photos }),
  setLoading: (loading) => set({ loading }),
  removePhoto: (id) =>
    set((s) => ({ photos: s.photos.filter((p) => p.id !== id) })),
}));
```

- [ ] **Step 4: Commit**

```bash
git add web/src/
git commit -m "feat(web): add API client with JWT refresh and Zustand stores"
```

---

### Task 3: API functions

**Files:**
- Create: `web/src/api/auth.ts`
- Create: `web/src/api/user.ts`
- Create: `web/src/api/elo.ts`
- Create: `web/src/api/face.ts`

- [ ] **Step 1: Créer `web/src/api/auth.ts`**

```typescript
import { apiRequest } from './client';

export function getOAuthURL(): string {
  return '/auth/login';
}

export async function exchangeCallback(code: string, state: string) {
  return apiRequest<{ access_token: string; refresh_token: string; user_id: string }>(
    `/auth/callback?code=${code}&state=${state}`
  );
}

export async function logout(refreshToken: string) {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}
```

- [ ] **Step 2: Créer `web/src/api/user.ts`**

```typescript
import { apiRequest } from './client';
import { Photo } from '../store/photos';

export async function getProfile() {
  return apiRequest<{
    id: string;
    username: string;
    avatar_url: string | null;
    consent_ai: boolean;
  }>('/user/profile');
}

export async function upsertProfile(username: string, consentAI: boolean) {
  return apiRequest<void>('/user/profile/upsert', {
    method: 'POST',
    body: JSON.stringify({ username, consent_ai: consentAI }),
  });
}

export async function listPhotos() {
  return apiRequest<Photo[]>('/user/photos');
}

export async function canUpload() {
  return apiRequest<void>('/user/photos/can-upload');
}

export async function deletePhoto(photoID: string) {
  return apiRequest<void>(`/user/photos/delete?photo_id=${photoID}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 3: Créer `web/src/api/face.ts`**

```typescript
export async function uploadPhoto(file: File): Promise<{
  photo_id: string;
  chad_score: number;
  features: Record<string, number>;
  signed_url: string;
}> {
  const token = localStorage.getItem('access_token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/face/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 4: Créer `web/src/api/elo.ts`**

```typescript
import { apiRequest } from './client';

export async function getElo(userID: string) {
  return apiRequest<{ score: number; tier: string }>(`/elo?user_id=${userID}`);
}

export async function createChallenge(playerB: string, photoIDs: string[]) {
  return apiRequest<{ match_id: string }>('/elo/match/create', {
    method: 'POST',
    body: JSON.stringify({ player_b: playerB, photo_ids: photoIDs, mode: 'async' }),
  });
}

export async function getMatch(matchID: string) {
  return apiRequest<{
    id: string;
    player_a: string;
    player_b: string;
    status: string;
    winner_id: string | null;
    mode: string;
  }>(`/elo/match?match_id=${matchID}`);
}

export async function acceptChallenge(matchID: string, photoIDs: string[]) {
  return apiRequest<void>('/elo/match/ready', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchID, photo_ids: photoIDs }),
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add web/src/api/
git commit -m "feat(web): add API functions for auth, user, face, elo"
```

---

### Task 4: App router + Auth guard + Login page

**Files:**
- Create: `web/src/App.tsx` (remplace le minimal)
- Create: `web/src/pages/Login/Login.tsx`
- Create: `web/src/pages/Login/Login.module.css`
- Create: `web/src/hooks/useAuth.ts`

- [ ] **Step 1: Créer useAuth hook**

Créer `web/src/hooks/useAuth.ts` :

```typescript
import { useAuthStore } from '../store/auth';
import { logout as apiLogout } from '../api/auth';

export function useAuth() {
  const { userID, isAuthenticated, clearTokens } = useAuthStore();

  const logout = async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (refresh) await apiLogout(refresh).catch(() => {});
    clearTokens();
    window.location.href = '/login';
  };

  return { userID, isAuthenticated, logout };
}
```

- [ ] **Step 2: Créer App.tsx avec router**

Créer `web/src/App.tsx` :

```tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Login from '@/pages/Login/Login';
import Photos from '@/pages/Photos/Photos';
import Profile from '@/pages/Profile/Profile';
import Matchmaking from '@/pages/Matchmaking/Matchmaking';
import RealtimeMatch from '@/pages/Match/RealtimeMatch';
import Challenge from '@/pages/Match/Challenge';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hydrate } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { hydrate(); }, []);

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, location.pathname]);

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Photos />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/matchmaking" element={<Matchmaking />} />
          <Route path="/match/realtime" element={<RealtimeMatch />} />
          <Route path="/match/challenge" element={<Challenge />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Créer Login page**

Créer `web/src/pages/Login/Login.tsx` :

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCallback, getOAuthURL } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import styles from './Login.module.css';

export default function Login() {
  const { setTokens, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) { navigate('/'); return; }
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state) {
      exchangeCallback(code, state)
        .then((data) => {
          setTokens(data.access_token, data.refresh_token, data.user_id);
          navigate('/');
        })
        .catch(console.error);
    }
  }, []);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Mogged</h1>
      <p className={styles.subtitle}>How chad are you?</p>
      <a className={styles.button} href={getOAuthURL()}>
        Continue with Google
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Créer Login.module.css**

```css
.container {
  min-height: 100vh;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.title {
  font-size: 4rem;
  font-weight: 900;
  color: #fff;
  letter-spacing: -3px;
  margin: 0;
}

.subtitle {
  font-size: 1rem;
  color: #888;
  margin: 0;
}

.button {
  margin-top: 32px;
  background: #fff;
  color: #000;
  font-weight: 700;
  font-size: 1rem;
  padding: 14px 32px;
  border-radius: 12px;
  text-decoration: none;
}

.button:hover {
  background: #eee;
}
```

- [ ] **Step 5: Créer les stubs de pages manquantes (pour que App.tsx compile)**

```bash
mkdir -p /home/cled/Mogged/web/src/pages/Photos \
         /home/cled/Mogged/web/src/pages/Profile \
         /home/cled/Mogged/web/src/pages/Matchmaking \
         /home/cled/Mogged/web/src/pages/Match
```

Créer `web/src/pages/Photos/Photos.tsx` :
```tsx
export default function Photos() { return <div style={{color:'#fff',background:'#000',minHeight:'100vh',padding:'60px 20px'}}>Photos</div>; }
```

Créer `web/src/pages/Profile/Profile.tsx` :
```tsx
export default function Profile() { return <div style={{color:'#fff',background:'#000',minHeight:'100vh',padding:'60px 20px'}}>Profile</div>; }
```

Créer `web/src/pages/Matchmaking/Matchmaking.tsx` :
```tsx
export default function Matchmaking() { return <div style={{color:'#fff',background:'#000',minHeight:'100vh',padding:'60px 20px'}}>Matchmaking</div>; }
```

Créer `web/src/pages/Match/RealtimeMatch.tsx` :
```tsx
export default function RealtimeMatch() { return <div style={{color:'#fff',background:'#000',minHeight:'100vh',padding:'60px 20px'}}>Realtime</div>; }
```

Créer `web/src/pages/Match/Challenge.tsx` :
```tsx
export default function Challenge() { return <div style={{color:'#fff',background:'#000',minHeight:'100vh',padding:'60px 20px'}}>Challenge</div>; }
```

- [ ] **Step 6: Vérifier le build TypeScript**

```bash
cd /home/cled/Mogged/web && npx tsc --noEmit 2>&1
```

Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add web/
git commit -m "feat(web): add router, auth guard and login page"
```

---

### Task 5: Navigation + composants partagés

**Files:**
- Create: `web/src/components/PhotoCard/PhotoCard.tsx`
- Create: `web/src/components/PhotoCard/PhotoCard.module.css`
- Create: `web/src/components/TierBadge/TierBadge.tsx`
- Create: `web/src/components/TierBadge/TierBadge.module.css`
- Create: `web/src/components/ConsentModal/ConsentModal.tsx`
- Create: `web/src/components/ConsentModal/ConsentModal.module.css`
- Create: `web/src/components/RoundResult/RoundResult.tsx`
- Create: `web/src/components/RoundResult/RoundResult.module.css`
- Create: `web/src/hooks/usePhotos.ts`

- [ ] **Step 1: Créer PhotoCard**

Créer `web/src/components/PhotoCard/PhotoCard.tsx` :

```tsx
import styles from './PhotoCard.module.css';
import { Photo } from '@/store/photos';

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, selected, onSelect }: Props) {
  return (
    <div
      className={`${styles.card} ${selected ? styles.selected : ''}`}
      onClick={() => onSelect?.(photo.id)}
    >
      {photo.chad_score !== null && (
        <span className={styles.score}>{Math.round(photo.chad_score)}</span>
      )}
      <button className={styles.delete} onClick={(e) => { e.stopPropagation(); onDelete(photo.id); }}>✕</button>
      {photo.chad_score === null && <span className={styles.pending}>Analyzing…</span>}
    </div>
  );
}
```

Créer `web/src/components/PhotoCard/PhotoCard.module.css` :

```css
.card {
  position: relative;
  aspect-ratio: 1;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
}

.selected { border-color: #fff; }

.score {
  position: absolute;
  top: 6px;
  left: 6px;
  background: rgba(0,0,0,0.75);
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  padding: 2px 6px;
  border-radius: 4px;
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
}

.pending { color: #555; font-size: 12px; }
```

- [ ] **Step 2: Créer TierBadge**

Créer `web/src/components/TierBadge/TierBadge.tsx` :

```tsx
import styles from './TierBadge.module.css';

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32', silver: '#C0C0C0', gold: '#FFD700',
  platinum: '#E5E4E2', diamond: '#B9F2FF', master: '#9B59B6',
  grandmaster: '#E74C3C', top500: '#F39C12',
};

export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  return (
    <span className={styles.badge} style={{ borderColor: color, color }}>
      {tier.toUpperCase()}
    </span>
  );
}
```

Créer `web/src/components/TierBadge/TierBadge.module.css` :

```css
.badge {
  border: 2px solid;
  border-radius: 8px;
  padding: 4px 12px;
  font-weight: 900;
  font-size: 14px;
  letter-spacing: 1px;
}
```

- [ ] **Step 3: Créer ConsentModal**

Créer `web/src/components/ConsentModal/ConsentModal.tsx` :

```tsx
import styles from './ConsentModal.module.css';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ visible, onAccept, onDecline }: Props) {
  if (!visible) return null;
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <h2 className={styles.title}>AI Face Analysis</h2>
        <p className={styles.body}>
          Mogged will analyze your facial features using AI to calculate your chad score.
          Your photo will be stored securely and never shared publicly.
          You can delete your data at any time.
        </p>
        <button className={styles.accept} onClick={onAccept}>I Consent</button>
        <button className={styles.decline} onClick={onDecline}>No thanks</button>
      </div>
    </div>
  );
}
```

Créer `web/src/components/ConsentModal/ConsentModal.module.css` :

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.box {
  background: #1a1a1a;
  border-radius: 16px;
  padding: 32px;
  max-width: 480px;
  width: 90%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.title { color: #fff; font-size: 1.4rem; font-weight: 700; margin: 0; }
.body { color: #aaa; font-size: 0.9rem; line-height: 1.6; margin: 0; }

.accept {
  background: #fff;
  color: #000;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}

.accept:hover { background: #eee; }

.decline {
  background: none;
  border: none;
  color: #555;
  font-size: 0.9rem;
  cursor: pointer;
  padding: 8px;
}
```

- [ ] **Step 4: Créer RoundResult**

Créer `web/src/components/RoundResult/RoundResult.tsx` :

```tsx
import styles from './RoundResult.module.css';

interface Props {
  round: number;
  myScore: number;
  opponentScore: number;
  won: boolean;
}

export function RoundResult({ round, myScore, opponentScore, won }: Props) {
  return (
    <div className={styles.container}>
      <span className={styles.label}>Round {round}</span>
      <div className={styles.scores}>
        <div className={`${styles.side} ${won ? styles.winner : ''}`}>
          <span className={styles.score}>{Math.round(myScore)}</span>
          <span className={styles.name}>You</span>
        </div>
        <span className={styles.vs}>VS</span>
        <div className={`${styles.side} ${!won ? styles.winner : ''}`}>
          <span className={styles.score}>{Math.round(opponentScore)}</span>
          <span className={styles.name}>Opponent</span>
        </div>
      </div>
    </div>
  );
}
```

Créer `web/src/components/RoundResult/RoundResult.module.css` :

```css
.container {
  background: #111;
  border-radius: 12px;
  padding: 16px 24px;
  margin: 6px 0;
}

.label { color: #555; font-size: 12px; display: block; margin-bottom: 8px; }

.scores {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.side {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0.4;
}

.winner { opacity: 1; }

.score { color: #fff; font-size: 2.5rem; font-weight: 900; }
.name { color: #888; font-size: 12px; }
.vs { color: #444; font-weight: 700; }
```

- [ ] **Step 5: Créer usePhotos hook**

Créer `web/src/hooks/usePhotos.ts` :

```typescript
import { useCallback } from 'react';
import { usePhotosStore } from '@/store/photos';
import { listPhotos, deletePhoto } from '@/api/user';
import { uploadPhoto } from '@/api/face';

export function usePhotos() {
  const { photos, loading, setPhotos, setLoading, removePhoto } = usePhotosStore();

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

  const remove = useCallback(async (photoID: string) => {
    await deletePhoto(photoID);
    removePhoto(photoID);
  }, []);

  return { photos, loading, load, upload, remove };
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/
git commit -m "feat(web): add shared components and hooks"
```

---

### Task 6: Page Photos

**Files:**
- Modify: `web/src/pages/Photos/Photos.tsx`
- Create: `web/src/pages/Photos/Photos.module.css`

- [ ] **Step 1: Remplacer Photos.tsx**

```tsx
import { useEffect, useRef, useState } from 'react';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { ConsentModal } from '@/components/ConsentModal/ConsentModal';
import { canUpload, upsertProfile, getProfile } from '@/api/user';
import { useNavigate } from 'react-router-dom';
import styles from './Photos.module.css';

export default function Photos() {
  const { photos, loading, load, upload, remove } = usePhotos();
  const [showConsent, setShowConsent] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const handleUploadClick = async () => {
    try { await canUpload(); } catch (e: any) { alert(e.message); return; }
    const profile = await getProfile();
    if (!profile?.consent_ai) {
      fileInput.current?.click();
      return;
    }
    fileInput.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const profile = await getProfile();
    if (!profile?.consent_ai) {
      setPendingFile(file);
      setShowConsent(true);
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
      <div className={styles.grid}>
        {photos.map((p) => (
          <PhotoCard key={p.id} photo={p} onDelete={remove} />
        ))}
      </div>
      <button className={styles.uploadBtn} onClick={handleUploadClick} disabled={loading}>
        {loading ? 'Uploading…' : '+ Upload Photo'}
      </button>
      <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
      <ConsentModal visible={showConsent} onAccept={handleConsentAccept} onDecline={() => { setShowConsent(false); setPendingFile(null); }} />
    </div>
  );
}
```

- [ ] **Step 2: Créer Photos.module.css**

```css
.page { min-height: 100vh; background: #000; padding: 0 0 40px; }

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px;
  border-bottom: 1px solid #111;
}

.logo { color: #fff; font-weight: 900; font-size: 1.5rem; letter-spacing: -1px; }

.navLinks { display: flex; gap: 16px; }

.navBtn {
  background: none;
  border: none;
  color: #888;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 8px;
}

.navBtn:hover { color: #fff; background: #111; }

.header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 32px 32px 16px;
}

.header h1 { color: #fff; font-size: 2rem; font-weight: 900; margin: 0; }

.count { color: #555; font-size: 1rem; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  padding: 0 32px;
}

.uploadBtn {
  margin: 32px 32px 0;
  display: block;
  width: calc(100% - 64px);
  background: #fff;
  color: #000;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}

.uploadBtn:hover { background: #eee; }
.uploadBtn:disabled { opacity: 0.4; cursor: not-allowed; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Photos/
git commit -m "feat(web): add Photos page with upload and consent"
```

---

### Task 7: Page Profil

**Files:**
- Modify: `web/src/pages/Profile/Profile.tsx`
- Create: `web/src/pages/Profile/Profile.module.css`

- [ ] **Step 1: Remplacer Profile.tsx**

```tsx
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
```

- [ ] **Step 2: Créer Profile.module.css**

```css
.page { min-height: 100vh; background: #000; }

.nav { padding: 20px 32px; border-bottom: 1px solid #111; }

.back {
  background: none;
  border: none;
  color: #888;
  font-size: 0.95rem;
  cursor: pointer;
}

.back:hover { color: #fff; }

.content { max-width: 480px; margin: 0 auto; padding: 40px 32px; display: flex; flex-direction: column; gap: 24px; }

.title { color: #fff; font-size: 2rem; font-weight: 900; margin: 0; }

.section { display: flex; flex-direction: column; gap: 4px; }
.username { color: #fff; font-size: 1.4rem; font-weight: 700; margin: 0; }
.id { color: #444; font-size: 0.75rem; margin: 0; }

.eloSection { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 32px 0; }
.eloScore { color: #fff; font-size: 5rem; font-weight: 900; }
.eloLabel { color: #555; font-size: 0.9rem; }

.logoutBtn {
  background: none;
  border: 1px solid #333;
  color: #888;
  border-radius: 12px;
  padding: 14px;
  font-size: 1rem;
  cursor: pointer;
}

.logoutBtn:hover { border-color: #555; color: #aaa; }
```

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/Profile/
git commit -m "feat(web): add Profile page with ELO and tier badge"
```

---

### Task 8: Page Matchmaking + Match temps réel + Défi async

**Files:**
- Modify: `web/src/pages/Matchmaking/Matchmaking.tsx`
- Create: `web/src/pages/Matchmaking/Matchmaking.module.css`
- Modify: `web/src/pages/Match/RealtimeMatch.tsx`
- Create: `web/src/pages/Match/RealtimeMatch.module.css`
- Modify: `web/src/pages/Match/Challenge.tsx`
- Create: `web/src/pages/Match/Challenge.module.css`

- [ ] **Step 1: Remplacer Matchmaking.tsx**

```tsx
import { useNavigate } from 'react-router-dom';
import styles from './Matchmaking.module.css';

export default function Matchmaking() {
  const navigate = useNavigate();
  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/')} className={styles.back}>← Photos</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Fight</h1>
        <button className={styles.card} onClick={() => navigate('/match/realtime')}>
          <span className={styles.cardTitle}>⚡ Real-time Match</span>
          <span className={styles.cardSub}>Find an opponent now — 5 min timeout</span>
        </button>
        <button className={styles.card} onClick={() => navigate('/match/challenge')}>
          <span className={styles.cardTitle}>📩 Async Challenge</span>
          <span className={styles.cardSub}>Challenge a friend — they have 24h to accept</span>
        </button>
      </div>
    </div>
  );
}
```

Créer `web/src/pages/Matchmaking/Matchmaking.module.css` :

```css
.page { min-height: 100vh; background: #000; }
.nav { padding: 20px 32px; border-bottom: 1px solid #111; }
.back { background: none; border: none; color: #888; font-size: 0.95rem; cursor: pointer; }
.back:hover { color: #fff; }
.content { max-width: 480px; margin: 0 auto; padding: 40px 32px; display: flex; flex-direction: column; gap: 16px; }
.title { color: #fff; font-size: 2rem; font-weight: 900; margin: 0 0 8px; }
.card {
  background: #111;
  border: none;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.card:hover { background: #1a1a1a; }
.cardTitle { color: #fff; font-size: 1.2rem; font-weight: 700; }
.cardSub { color: #666; font-size: 0.9rem; }
```

- [ ] **Step 2: Remplacer RealtimeMatch.tsx**

```tsx
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
      const msg = JSON.parse(e.data);
      if (msg.type === 'matched') setPhase('matched');
      else if (msg.type === 'timeout') { setPhase('selecting'); alert('No opponent found'); }
      else if (msg.type === 'round') setRounds((r) => [...r, { round: msg.round, myScore: msg.my_score, oppScore: msg.opp_score, won: msg.my_score >= msg.opp_score }]);
      else if (msg.type === 'match_end') { setWon(msg.winner_is_me); setPhase('result'); socket.close(); }
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
```

Créer `web/src/pages/Match/RealtimeMatch.module.css` :

```css
.page { min-height: 100vh; background: #000; }
.nav { padding: 20px 32px; border-bottom: 1px solid #111; }
.back { background: none; border: none; color: #888; font-size: 0.95rem; cursor: pointer; }
.back:hover { color: #fff; }
.content { max-width: 640px; margin: 0 auto; padding: 40px 32px; }
.title { color: #fff; font-size: 2rem; font-weight: 900; margin: 0 0 8px; }
.result { color: #fff; font-size: 3rem; font-weight: 900; text-align: center; margin: 0 0 32px; }
.sub { color: #666; margin: 0 0 24px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.btn {
  width: 100%;
  background: #fff;
  color: #000;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 16px;
}
.btn:hover { background: #eee; }
.btn:disabled { opacity: 0.3; cursor: not-allowed; }
```

- [ ] **Step 3: Remplacer Challenge.tsx**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard/PhotoCard';
import { createChallenge } from '@/api/elo';
import styles from './Challenge.module.css';

export default function Challenge() {
  const { photos, load } = usePhotos();
  const [opponentID, setOpponentID] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );

  const send = async () => {
    if (!opponentID.trim()) { alert('Enter opponent ID'); return; }
    if (selected.length !== 3) { alert('Select exactly 3 photos'); return; }
    setLoading(true);
    try {
      const { match_id } = await createChallenge(opponentID.trim(), selected);
      alert(`Challenge sent! Match ID: ${match_id}`);
      navigate('/matchmaking');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <nav className={styles.nav}>
        <button onClick={() => navigate('/matchmaking')} className={styles.back}>← Back</button>
      </nav>
      <div className={styles.content}>
        <h1 className={styles.title}>Challenge</h1>
        <input
          className={styles.input}
          placeholder="Opponent user ID"
          value={opponentID}
          onChange={(e) => setOpponentID(e.target.value)}
        />
        <p className={styles.sub}>Select 3 photos ({selected.length}/3)</p>
        <div className={styles.grid}>
          {photos.map((p) => (
            <PhotoCard key={p.id} photo={p} onDelete={() => {}} selected={selected.includes(p.id)} onSelect={toggleSelect} />
          ))}
        </div>
        <button className={styles.btn} onClick={send} disabled={loading || selected.length !== 3}>
          {loading ? 'Sending…' : 'Send Challenge'}
        </button>
      </div>
    </div>
  );
}
```

Créer `web/src/pages/Match/Challenge.module.css` :

```css
.page { min-height: 100vh; background: #000; }
.nav { padding: 20px 32px; border-bottom: 1px solid #111; }
.back { background: none; border: none; color: #888; font-size: 0.95rem; cursor: pointer; }
.back:hover { color: #fff; }
.content { max-width: 640px; margin: 0 auto; padding: 40px 32px; }
.title { color: #fff; font-size: 2rem; font-weight: 900; margin: 0 0 24px; }
.input {
  width: 100%;
  background: #111;
  border: 1px solid #222;
  border-radius: 10px;
  padding: 12px 16px;
  color: #fff;
  font-size: 0.95rem;
  margin-bottom: 20px;
  box-sizing: border-box;
}
.input::placeholder { color: #444; }
.sub { color: #666; margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
.btn {
  width: 100%;
  background: #fff;
  color: #000;
  border: none;
  border-radius: 12px;
  padding: 14px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
}
.btn:hover { background: #eee; }
.btn:disabled { opacity: 0.3; cursor: not-allowed; }
```

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/
git commit -m "feat(web): add Matchmaking, RealtimeMatch and Challenge pages"
```

---

### Task 9: Global CSS + vérification finale

**Files:**
- Create: `web/src/global.css`
- Modify: `web/src/main.tsx`

- [ ] **Step 1: Créer global.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #000;
  color: #fff;
  -webkit-font-smoothing: antialiased;
}

button { font-family: inherit; }
input { font-family: inherit; }
```

- [ ] **Step 2: Importer global.css dans main.tsx**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Vérifier le build TypeScript**

```bash
cd /home/cled/Mogged/web && npx tsc --noEmit 2>&1
```

Expected: aucune erreur.

- [ ] **Step 4: Vérifier le build Vite**

```bash
cd /home/cled/Mogged/web && npm run build 2>&1 | tail -15
```

Expected: `✓ built in` — aucune erreur.

- [ ] **Step 5: Commit final**

```bash
cd /home/cled/Mogged
git add web/
git commit -m "feat(web): complete React web app"
```
