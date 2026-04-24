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
