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
