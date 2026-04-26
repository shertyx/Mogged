import { apiRequest } from './client';
import type { Photo } from '../store/photos';

export async function getProfile() {
  return apiRequest<{
    id: string;
    username: string;
    avatar_url: string | null;
    consent_ai: boolean;
    username_set: boolean;
    username_changes: number;
    is_admin: boolean;
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

export interface Friend { user_id: string; username: string; status: string }

export async function listFriends() {
  return apiRequest<Friend[]>('/user/friends');
}

export async function listFriendRequests() {
  return apiRequest<Friend[]>('/user/friends/requests');
}

export async function sendFriendRequest(username: string) {
  return apiRequest<void>('/user/friends/request', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function acceptFriendRequest(requesterID: string) {
  return apiRequest<void>('/user/friends/accept', {
    method: 'POST',
    body: JSON.stringify({ requester_id: requesterID }),
  });
}

export async function removeFriend(userID: string) {
  return apiRequest<void>(`/user/friends/remove?user_id=${userID}`, { method: 'DELETE' });
}
