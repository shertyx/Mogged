import { apiRequest } from './client';
import type { Photo } from '../store/photos';

export async function getProfile() {
  return apiRequest<{
    id: string;
    username: string;
    avatar_url: string | null;
    consent_ai: boolean;
    username_set: boolean;
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

export async function setUsername(username: string): Promise<void> {
  return apiRequest<void>('/user/profile/username', {
    method: 'PATCH',
    body: JSON.stringify({ username }),
  });
}

export async function listUnanalyzedPhotos() {
  return apiRequest<Photo[]>('/user/photos/unanalyzed');
}

export async function getUserByUsername(username: string) {
  return apiRequest<{ id: string; username: string }>(`/user/by-username?username=${encodeURIComponent(username)}`);
}
