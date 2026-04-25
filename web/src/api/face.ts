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

export async function getSignedUrls(s3Keys: string[]): Promise<Record<string, string>> {
  const token = localStorage.getItem('access_token');
  const res = await fetch('/face/photos/signed-urls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ s3_keys: s3Keys }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.urls;
}
