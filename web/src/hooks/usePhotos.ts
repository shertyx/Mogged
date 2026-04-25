import { useCallback } from 'react';
import { usePhotosStore, type Photo } from '@/store/photos';
import { listPhotos, deletePhoto } from '@/api/user';
import { uploadPhoto, analyzeStoredPhoto, getSignedUrls } from '@/api/face';

export function usePhotos() {
  const { photos, loading, analyzingIds, setPhotos, setLoading, removePhoto, updatePhoto, setAnalyzing } = usePhotosStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: Photo[] = (await listPhotos()) ?? [];
      if (data.length > 0) {
        const keys = data.map((p) => p.s3_key);
        const urls = await getSignedUrls(keys);
        setPhotos(data.map((p) => ({ ...p, signed_url: urls[p.s3_key] })));
      } else {
        setPhotos([]);
      }
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
