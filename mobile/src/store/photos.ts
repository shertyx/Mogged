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
