# Frontend Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire l'application mobile React Native/Expo complète : auth Google, gestion photos (upload/delete/score), matchmaking temps réel (WebSocket) et async (défi 24h), profil + classement ELO.

**Architecture:** Expo Router (file-based routing) avec 3 groupes de routes : `(auth)` pour l'onboarding OAuth, `(tabs)` pour les écrans principaux connectés, `match` pour le flow matchmaking. State global via Zustand. API calls centralisés dans `src/api/`. Pas de Redux, pas d'Axios — `fetch` natif + token interceptor.

**Tech Stack:** Expo SDK 52, React Native, Expo Router v3, Expo Camera, Expo Image Picker, Expo SecureStore (tokens), Expo Notifications, Zustand (state), TypeScript.

---

## File Map

```
mobile/
├── app.json                        # config Expo
├── package.json
├── tsconfig.json
├── babel.config.js
├── app/
│   ├── _layout.tsx                 # root layout, AuthGuard
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx               # bouton Google OAuth → WebBrowser
│   ├── (tabs)/
│   │   ├── _layout.tsx             # bottom tab navigator
│   │   ├── index.tsx               # écran Photos (liste + upload)
│   │   ├── matchmaking.tsx         # choix mode (realtime / async)
│   │   └── profile.tsx             # profil + ELO + tier
│   └── match/
│       ├── realtime.tsx            # WS matchmaking + rounds
│       └── challenge.tsx           # défi async (créer/accepter)
├── src/
│   ├── api/
│   │   ├── client.ts               # fetch wrapper + JWT inject + refresh
│   │   ├── auth.ts                 # login, callback, refresh, logout
│   │   ├── user.ts                 # profile, photos CRUD, can-upload
│   │   ├── elo.ts                  # getElo, createChallenge, getMatch
│   │   └── face.ts                 # uploadPhoto → analyse
│   ├── store/
│   │   ├── auth.ts                 # Zustand: token, userID, isAuthenticated
│   │   └── photos.ts               # Zustand: photos[], loading
│   ├── components/
│   │   ├── PhotoCard.tsx           # carte photo avec score + features
│   │   ├── PhotoGrid.tsx           # grille de PhotoCards
│   │   ├── TierBadge.tsx           # badge tier (Bronze…Top500) coloré
│   │   ├── RoundResult.tsx         # résultat d'un round (photo A vs B)
│   │   └── ConsentModal.tsx        # modal consentement IA (RGPD)
│   └── hooks/
│       ├── useAuth.ts              # read/write auth store
│       └── usePhotos.ts            # load/upload/delete photos
```

---

### Task 1: Init projet Expo + TypeScript

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/app.json`
- Create: `mobile/tsconfig.json`
- Create: `mobile/babel.config.js`

- [ ] **Step 1: Créer le projet Expo**

```bash
cd /home/cled/Mogged/mobile
npx create-expo-app@latest . --template blank-typescript
```

Expected: projet créé avec `app.json`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Installer les dépendances**

```bash
cd /home/cled/Mogged/mobile
npx expo install expo-router expo-secure-store expo-camera expo-image-picker expo-web-browser expo-notifications
npm install zustand
npm install --save-dev @types/react @types/react-native
```

- [ ] **Step 3: Configurer Expo Router dans app.json**

Remplacer le contenu de `mobile/app.json` :

```json
{
  "expo": {
    "name": "Mogged",
    "slug": "mogged",
    "version": "1.0.0",
    "scheme": "mogged",
    "platforms": ["ios", "android"],
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "assetBundlePatterns": ["**/*"],
    "ios": { "supportsTablet": false },
    "android": { "adaptiveIcon": { "backgroundColor": "#000000" } },
    "plugins": [
      "expo-router",
      "expo-secure-store",
      ["expo-camera", { "cameraPermission": "Mogged needs camera access to capture your face." }],
      "expo-image-picker"
    ],
    "extra": {
      "apiUrl": "http://localhost:8080",
      "eas": { "projectId": "mogged" }
    }
  }
}
```

- [ ] **Step 4: Configurer babel.config.js**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['expo-router/babel'],
  };
};
```

- [ ] **Step 5: Configurer tsconfig.json**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 6: Vérifier le démarrage**

```bash
cd /home/cled/Mogged/mobile && npx expo start --no-dev-client 2>&1 | head -20
```

Expected: Metro bundler démarre sans erreur.

- [ ] **Step 7: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): init Expo project with TypeScript and Expo Router"
```

---

### Task 2: API client + stores Zustand

**Files:**
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/store/auth.ts`
- Create: `mobile/src/store/photos.ts`

- [ ] **Step 1: Créer le client HTTP avec injection JWT**

Créer `mobile/src/api/client.ts` :

```typescript
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}

async function refreshTokens(): Promise<string | null> {
  const refresh = await SecureStore.getItemAsync('refresh_token');
  if (!refresh) return null;
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  await SecureStore.setItemAsync('access_token', data.access_token);
  return data.access_token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = await getToken();
  const doFetch = async (t: string | null) =>
    fetch(`${API_URL}${path}`, {
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
    if (!token) throw new Error('unauthenticated');
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

Créer `mobile/src/store/auth.ts` :

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  userID: string | null;
  isAuthenticated: boolean;
  setTokens: (access: string, refresh: string, userID: string) => Promise<void>;
  clearTokens: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  userID: null,
  isAuthenticated: false,

  setTokens: async (access, refresh, userID) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
    await SecureStore.setItemAsync('user_id', userID);
    set({ userID, isAuthenticated: true });
  },

  clearTokens: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
    await SecureStore.deleteItemAsync('user_id');
    set({ userID: null, isAuthenticated: false });
  },

  hydrate: async () => {
    const userID = await SecureStore.getItemAsync('user_id');
    const token = await SecureStore.getItemAsync('access_token');
    if (userID && token) set({ userID, isAuthenticated: true });
  },
}));
```

- [ ] **Step 3: Store photos Zustand**

Créer `mobile/src/store/photos.ts` :

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
git add mobile/src/
git commit -m "feat(mobile): add API client with JWT refresh and Zustand stores"
```

---

### Task 3: API functions

**Files:**
- Create: `mobile/src/api/auth.ts`
- Create: `mobile/src/api/user.ts`
- Create: `mobile/src/api/elo.ts`
- Create: `mobile/src/api/face.ts`

- [ ] **Step 1: Créer `mobile/src/api/auth.ts`**

```typescript
import { apiRequest } from './client';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export function getOAuthURL(): string {
  return `${API_URL}/auth/login`;
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

- [ ] **Step 2: Créer `mobile/src/api/user.ts`**

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

- [ ] **Step 3: Créer `mobile/src/api/face.ts`**

```typescript
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

export async function uploadPhoto(uri: string, mimeType: string): Promise<{
  photo_id: string;
  chad_score: number;
  features: Record<string, number>;
  signed_url: string;
}> {
  const token = await SecureStore.getItemAsync('access_token');
  const filename = uri.split('/').pop() ?? 'photo.jpg';
  const form = new FormData();
  form.append('file', { uri, name: filename, type: mimeType } as any);
  const res = await fetch(`${API_URL}/face/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 4: Créer `mobile/src/api/elo.ts`**

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
git add mobile/src/api/
git commit -m "feat(mobile): add API functions for auth, user, face, elo"
```

---

### Task 4: Root layout + Auth guard

**Files:**
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(auth)/_layout.tsx`
- Create: `mobile/app/(auth)/login.tsx`

- [ ] **Step 1: Créer le root layout avec AuthGuard**

Créer `mobile/app/_layout.tsx` :

```tsx
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  const { isAuthenticated, hydrate } = useAuthStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    const inAuth = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="match" />
    </Stack>
  );
}
```

- [ ] **Step 2: Layout auth group**

Créer `mobile/app/(auth)/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Écran login Google OAuth**

Créer `mobile/app/(auth)/login.tsx` :

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { getOAuthURL, exchangeCallback } from '@/api/auth';
import { useAuthStore } from '@/store/auth';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { setTokens } = useAuthStore();

  useEffect(() => {
    const sub = Linking.addEventListener('url', async ({ url }) => {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;
      if (code && state) {
        const data = await exchangeCallback(code, state);
        await setTokens(data.access_token, data.refresh_token, data.user_id);
      }
    });
    return () => sub.remove();
  }, []);

  const handleLogin = async () => {
    await WebBrowser.openAuthSessionAsync(
      getOAuthURL(),
      Linking.createURL('/')
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mogged</Text>
      <Text style={styles.subtitle}>How chad are you?</Text>
      <Pressable style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', gap: 16 },
  title: { fontSize: 48, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  subtitle: { fontSize: 16, color: '#888' },
  button: { marginTop: 32, backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/app/
git commit -m "feat(mobile): add root layout with auth guard and Google OAuth login screen"
```

---

### Task 5: Tab navigator + écran Photos

**Files:**
- Create: `mobile/app/(tabs)/_layout.tsx`
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/src/components/PhotoCard.tsx`
- Create: `mobile/src/components/PhotoGrid.tsx`
- Create: `mobile/src/components/ConsentModal.tsx`
- Create: `mobile/src/hooks/usePhotos.ts`

- [ ] **Step 1: Créer le hook usePhotos**

Créer `mobile/src/hooks/usePhotos.ts` :

```typescript
import { useCallback } from 'react';
import { usePhotosStore } from '../store/photos';
import { listPhotos, deletePhoto } from '../api/user';
import { uploadPhoto } from '../api/face';

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

  const upload = useCallback(async (uri: string, mimeType: string) => {
    setLoading(true);
    try {
      await uploadPhoto(uri, mimeType);
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

- [ ] **Step 2: Créer PhotoCard**

Créer `mobile/src/components/PhotoCard.tsx` :

```tsx
import { View, Image, Text, Pressable, StyleSheet } from 'react-native';
import { Photo } from '../store/photos';

interface Props {
  photo: Photo;
  onDelete: (id: string) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
}

export function PhotoCard({ photo, onDelete, selected, onSelect }: Props) {
  return (
    <Pressable
      style={[styles.card, selected && styles.selected]}
      onPress={() => onSelect?.(photo.id)}
    >
      {photo.chad_score !== null && (
        <View style={styles.score}>
          <Text style={styles.scoreText}>{Math.round(photo.chad_score)}</Text>
        </View>
      )}
      <Pressable style={styles.delete} onPress={() => onDelete(photo.id)}>
        <Text style={styles.deleteText}>✕</Text>
      </Pressable>
      {photo.chad_score === null && (
        <View style={styles.pending}>
          <Text style={styles.pendingText}>Analyzing…</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: '31%', aspectRatio: 1, backgroundColor: '#1a1a1a', borderRadius: 8, margin: '1%', overflow: 'hidden' },
  selected: { borderWidth: 2, borderColor: '#fff' },
  score: { position: 'absolute', top: 4, left: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  scoreText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  delete: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(200,0,0,0.8)', borderRadius: 4, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  pending: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pendingText: { color: '#666', fontSize: 11 },
});
```

- [ ] **Step 3: Créer ConsentModal**

Créer `mobile/src/components/ConsentModal.tsx` :

```tsx
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function ConsentModal({ visible, onAccept, onDecline }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>AI Face Analysis</Text>
          <Text style={styles.body}>
            Mogged will analyze your facial features using AI to calculate your chad score.
            Your photo will be stored securely and never shared publicly.
            You can delete your data at any time.
          </Text>
          <Pressable style={styles.accept} onPress={onAccept}>
            <Text style={styles.acceptText}>I Consent</Text>
          </Pressable>
          <Pressable style={styles.decline} onPress={onDecline}>
            <Text style={styles.declineText}>No thanks</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, width: '85%', gap: 12 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  body: { color: '#aaa', fontSize: 14, lineHeight: 20 },
  accept: { backgroundColor: '#fff', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  acceptText: { color: '#000', fontWeight: '700', fontSize: 16 },
  decline: { alignItems: 'center', paddingVertical: 8 },
  declineText: { color: '#555', fontSize: 14 },
});
```

- [ ] **Step 4: Créer l'écran Photos (tab index)**

Créer `mobile/app/(tabs)/index.tsx` :

```tsx
import { View, Text, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { ConsentModal } from '@/components/ConsentModal';
import { canUpload, upsertProfile, getProfile } from '@/api/user';

export default function PhotosScreen() {
  const { photos, loading, load, upload, remove } = usePhotos();
  const [showConsent, setShowConsent] = useState(false);
  const [pendingUri, setPendingUri] = useState<{ uri: string; mimeType: string } | null>(null);

  useEffect(() => { load(); }, []);

  const handleUpload = async () => {
    try {
      await canUpload();
    } catch (e: any) {
      Alert.alert('Cannot upload', e.message);
      return;
    }
    const profile = await getProfile();
    if (!profile?.consent_ai) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      setPendingUri({ uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg' });
      setShowConsent(true);
      return;
    }
    pickAndUpload();
  };

  const pickAndUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await upload(asset.uri, asset.mimeType ?? 'image/jpeg');
  };

  const handleConsentAccept = async () => {
    await upsertProfile('', true);
    setShowConsent(false);
    if (pendingUri) {
      await upload(pendingUri.uri, pendingUri.mimeType);
      setPendingUri(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Photos</Text>
      <Text style={styles.count}>{photos.length}/10 photos</Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PhotoCard photo={item} onDelete={remove} />
        )}
        contentContainerStyle={styles.grid}
      />
      <Pressable style={styles.uploadBtn} onPress={handleUpload} disabled={loading}>
        <Text style={styles.uploadText}>{loading ? 'Uploading…' : '+ Upload Photo'}</Text>
      </Pressable>
      <ConsentModal
        visible={showConsent}
        onAccept={handleConsentAccept}
        onDecline={() => { setShowConsent(false); setPendingUri(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', paddingHorizontal: 20, marginBottom: 4 },
  count: { color: '#666', fontSize: 13, paddingHorizontal: 20, marginBottom: 12 },
  grid: { paddingHorizontal: 12 },
  uploadBtn: { margin: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  uploadText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 5: Créer le tab layout**

Créer `mobile/app/(tabs)/_layout.tsx` :

```tsx
import { Tabs } from 'expo-router';
import { Text } from 'react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#000', borderTopColor: '#222' },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: '#555',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Photos', tabBarIcon: () => <Text>📸</Text> }} />
      <Tabs.Screen name="matchmaking" options={{ title: 'Fight', tabBarIcon: () => <Text>⚔️</Text> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }} />
    </Tabs>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add Photos tab with upload, delete, consent modal"
```

---

### Task 6: Écran Profil + TierBadge

**Files:**
- Create: `mobile/app/(tabs)/profile.tsx`
- Create: `mobile/src/components/TierBadge.tsx`
- Create: `mobile/src/hooks/useAuth.ts`

- [ ] **Step 1: Créer TierBadge**

Créer `mobile/src/components/TierBadge.tsx` :

```tsx
import { View, Text, StyleSheet } from 'react-native';

const TIER_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#E5E4E2',
  diamond: '#B9F2FF',
  master: '#9B59B6',
  grandmaster: '#E74C3C',
  top500: '#F39C12',
};

export function TierBadge({ tier }: { tier: string }) {
  const color = TIER_COLORS[tier] ?? '#888';
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{tier.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderWidth: 2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4 },
  text: { fontWeight: '900', fontSize: 14, letterSpacing: 1 },
});
```

- [ ] **Step 2: Créer useAuth hook**

Créer `mobile/src/hooks/useAuth.ts` :

```typescript
import { useAuthStore } from '../store/auth';
import * as SecureStore from 'expo-secure-store';
import { logout as apiLogout } from '../api/auth';

export function useAuth() {
  const { userID, isAuthenticated, clearTokens } = useAuthStore();

  const logout = async () => {
    const refresh = await SecureStore.getItemAsync('refresh_token');
    if (refresh) await apiLogout(refresh).catch(() => {});
    await clearTokens();
  };

  return { userID, isAuthenticated, logout };
}
```

- [ ] **Step 3: Créer l'écran Profil**

Créer `mobile/app/(tabs)/profile.tsx` :

```tsx
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { TierBadge } from '@/components/TierBadge';
import { getProfile } from '@/api/user';
import { getElo } from '@/api/elo';

interface EloData { score: number; tier: string }
interface ProfileData { id: string; username: string; consent_ai: boolean }

export default function ProfileScreen() {
  const { userID, logout } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);

  useEffect(() => {
    if (!userID) return;
    getProfile().then(setProfile).catch(console.error);
    getElo(userID).then(setElo).catch(console.error);
  }, [userID]);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Profile</Text>
      {profile && (
        <View style={styles.section}>
          <Text style={styles.username}>{profile.username || 'Anonymous'}</Text>
          <Text style={styles.id}>{userID}</Text>
        </View>
      )}
      {elo && (
        <View style={styles.eloSection}>
          <Text style={styles.eloScore}>{elo.score}</Text>
          <Text style={styles.eloLabel}>ELO</Text>
          <TierBadge tier={elo.tier} />
        </View>
      )}
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', paddingHorizontal: 20, marginBottom: 24 },
  section: { paddingHorizontal: 20, marginBottom: 32 },
  username: { color: '#fff', fontSize: 22, fontWeight: '700' },
  id: { color: '#444', fontSize: 11, marginTop: 4 },
  eloSection: { alignItems: 'center', marginBottom: 40, gap: 8 },
  eloScore: { color: '#fff', fontSize: 64, fontWeight: '900' },
  eloLabel: { color: '#555', fontSize: 14 },
  logoutBtn: { marginHorizontal: 20, borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: '#888', fontSize: 16 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add Profile tab with ELO display and tier badge"
```

---

### Task 7: Matchmaking tab + écran temps réel

**Files:**
- Create: `mobile/app/(tabs)/matchmaking.tsx`
- Create: `mobile/app/match/realtime.tsx`
- Create: `mobile/src/components/RoundResult.tsx`

- [ ] **Step 1: Créer RoundResult**

Créer `mobile/src/components/RoundResult.tsx` :

```tsx
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  round: number;
  myScore: number;
  opponentScore: number;
  won: boolean;
}

export function RoundResult({ round, myScore, opponentScore, won }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.round}>Round {round}</Text>
      <View style={styles.scores}>
        <View style={[styles.side, won && styles.winner]}>
          <Text style={styles.scoreText}>{Math.round(myScore)}</Text>
          <Text style={styles.label}>You</Text>
        </View>
        <Text style={styles.vs}>VS</Text>
        <View style={[styles.side, !won && styles.winner]}>
          <Text style={styles.scoreText}>{Math.round(opponentScore)}</Text>
          <Text style={styles.label}>Opponent</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#111', borderRadius: 12, padding: 16, marginVertical: 6 },
  round: { color: '#666', fontSize: 12, marginBottom: 8 },
  scores: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { alignItems: 'center', flex: 1, opacity: 0.5 },
  winner: { opacity: 1 },
  scoreText: { color: '#fff', fontSize: 32, fontWeight: '900' },
  label: { color: '#888', fontSize: 12 },
  vs: { color: '#444', fontSize: 16, fontWeight: '700' },
});
```

- [ ] **Step 2: Créer l'écran matchmaking (choix de mode)**

Créer `mobile/app/(tabs)/matchmaking.tsx` :

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function MatchmakingScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Fight</Text>
      <Pressable style={styles.card} onPress={() => router.push('/match/realtime')}>
        <Text style={styles.cardTitle}>⚡ Real-time Match</Text>
        <Text style={styles.cardSub}>Find an opponent now — 5 min timeout</Text>
      </Pressable>
      <Pressable style={styles.card} onPress={() => router.push('/match/challenge')}>
        <Text style={styles.cardTitle}>📩 Async Challenge</Text>
        <Text style={styles.cardSub}>Challenge a friend — they have 24h to accept</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20, gap: 16 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16 },
  card: { backgroundColor: '#111', borderRadius: 16, padding: 24, gap: 8 },
  cardTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  cardSub: { color: '#666', fontSize: 14 },
});
```

- [ ] **Step 3: Créer l'écran realtime match**

Créer `mobile/app/match/realtime.tsx` :

```tsx
import { View, Text, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { RoundResult } from '@/components/RoundResult';
import { useRouter } from 'expo-router';

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? 'ws://localhost:8080';

type Phase = 'selecting' | 'searching' | 'matched' | 'result';

interface Round { round: number; myScore: number; oppScore: number; won: boolean }

export default function RealtimeMatchScreen() {
  const { photos, load } = usePhotos();
  const [selected, setSelected] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>('selecting');
  const [matchID, setMatchID] = useState('');
  const [rounds, setRounds] = useState<Round[]>([]);
  const [won, setWon] = useState<boolean | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const joinQueue = async () => {
    if (selected.length !== 3) {
      Alert.alert('Select exactly 3 photos');
      return;
    }
    const token = await SecureStore.getItemAsync('access_token');
    setPhase('searching');
    const socket = new WebSocket(`${WS_URL}/matchmaking`, undefined, {
      headers: { Authorization: `Bearer ${token}` },
    } as any);
    ws.current = socket;

    socket.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'matched') {
        setMatchID(msg.match_id);
        setPhase('matched');
      } else if (msg.type === 'timeout') {
        setPhase('selecting');
        Alert.alert('No opponent found', 'Try again later');
      } else if (msg.type === 'round') {
        setRounds((r) => [...r, { round: msg.round, myScore: msg.my_score, oppScore: msg.opp_score, won: msg.my_score >= msg.opp_score }]);
      } else if (msg.type === 'match_end') {
        setWon(msg.winner_is_me);
        setPhase('result');
        socket.close();
      }
    };
    socket.onerror = () => {
      setPhase('selecting');
      Alert.alert('Connection error');
    };
  };

  if (phase === 'result') {
    return (
      <View style={styles.container}>
        <Text style={styles.result}>{won ? '🏆 You won!' : '💀 You lost'}</Text>
        {rounds.map((r) => <RoundResult key={r.round} {...r} />)}
        <Pressable style={styles.btn} onPress={() => router.back()}>
          <Text style={styles.btnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'searching') {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Finding opponent…</Text>
        <Text style={styles.sub}>Timeout in 5 minutes</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select 3 Photos</Text>
      <Text style={styles.sub}>{selected.length}/3 selected</Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PhotoCard
            photo={item}
            onDelete={() => {}}
            selected={selected.includes(item.id)}
            onSelect={toggleSelect}
          />
        )}
      />
      <Pressable style={[styles.btn, selected.length !== 3 && styles.btnDisabled]} onPress={joinQueue}>
        <Text style={styles.btnText}>Find Match</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 8 },
  sub: { color: '#666', marginBottom: 16 },
  result: { color: '#fff', fontSize: 40, fontWeight: '900', textAlign: 'center', marginBottom: 32 },
  btn: { marginVertical: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 4: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add matchmaking tab, realtime match screen with WebSocket"
```

---

### Task 8: Écran défi async

**Files:**
- Create: `mobile/app/match/challenge.tsx`
- Create: `mobile/app/match/_layout.tsx`

- [ ] **Step 1: Créer le layout match group**

Créer `mobile/app/match/_layout.tsx` :

```tsx
import { Stack } from 'expo-router';

export default function MatchLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: 'modal' }} />
  );
}
```

- [ ] **Step 2: Créer l'écran défi async**

Créer `mobile/app/match/challenge.tsx` :

```tsx
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePhotos } from '@/hooks/usePhotos';
import { PhotoCard } from '@/components/PhotoCard';
import { createChallenge } from '@/api/elo';

export default function ChallengeScreen() {
  const { photos, load } = usePhotos();
  const [opponentID, setOpponentID] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => { load(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const send = async () => {
    if (!opponentID.trim()) { Alert.alert('Enter opponent ID'); return; }
    if (selected.length !== 3) { Alert.alert('Select exactly 3 photos'); return; }
    setLoading(true);
    try {
      const { match_id } = await createChallenge(opponentID.trim(), selected);
      Alert.alert('Challenge sent!', `Match ID: ${match_id}`);
      router.back();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Challenge</Text>
      <TextInput
        style={styles.input}
        placeholder="Opponent user ID"
        placeholderTextColor="#444"
        value={opponentID}
        onChangeText={setOpponentID}
        autoCapitalize="none"
      />
      <Text style={styles.sub}>Select 3 photos ({selected.length}/3)</Text>
      <FlatList
        data={photos}
        numColumns={3}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PhotoCard
            photo={item}
            onDelete={() => {}}
            selected={selected.includes(item.id)}
            onSelect={toggleSelect}
          />
        )}
      />
      <Pressable
        style={[styles.btn, (loading || selected.length !== 3) && styles.btnDisabled]}
        onPress={send}
        disabled={loading}
      >
        <Text style={styles.btnText}>{loading ? 'Sending…' : 'Send Challenge'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 60, paddingHorizontal: 20 },
  header: { color: '#fff', fontSize: 28, fontWeight: '900', marginBottom: 16 },
  input: { backgroundColor: '#111', color: '#fff', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 15 },
  sub: { color: '#666', marginBottom: 12 },
  btn: { marginVertical: 20, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 3: Commit**

```bash
git add mobile/
git commit -m "feat(mobile): add async challenge screen"
```

---

### Task 9: Vérification finale

**Files:** aucun nouveau fichier

- [ ] **Step 1: Vérifier le build TypeScript**

```bash
cd /home/cled/Mogged/mobile && npx tsc --noEmit 2>&1
```

Expected: aucune erreur.

- [ ] **Step 2: Lancer le bundler Expo**

```bash
cd /home/cled/Mogged/mobile && npx expo start 2>&1 | head -30
```

Expected: Metro bundler démarre, aucune erreur de module.

- [ ] **Step 3: Vérifier les imports critiques**

```bash
cd /home/cled/Mogged/mobile && grep -r "from '@/" app/ src/ --include="*.tsx" --include="*.ts" | head -20
```

Expected: tous les imports `@/*` résolvent correctement.

- [ ] **Step 4: Commit final**

```bash
cd /home/cled/Mogged
git add mobile/
git commit -m "feat(mobile): complete Expo mobile app"
```
