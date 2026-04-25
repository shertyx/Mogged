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
