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
