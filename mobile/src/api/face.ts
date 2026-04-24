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
