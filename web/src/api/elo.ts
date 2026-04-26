import { apiRequest } from './client';

export async function getElo(userID: string) {
  return apiRequest<{ score: number; tier: string }>(`/elo?user_id=${userID}`);
}

export async function createChallenge(opponentId: string, photoId: string) {
  return apiRequest<{ match_id: string }>('/elo/match/challenge', {
    method: 'POST',
    body: JSON.stringify({ player_b: opponentId, photo_a_id: photoId }),
  });
}

export async function acceptChallenge(matchId: string, photoId: string, playerB: string) {
  return apiRequest<{
    winner_id: string;
    match_id: string;
    score_a: number;
    score_b: number;
    player_a: string;
    player_b: string;
  }>('/elo/match/accept', {
    method: 'POST',
    body: JSON.stringify({ match_id: matchId, photo_b_id: photoId, player_b: playerB }),
  });
}

export async function listPendingChallenges(userID: string) {
  return apiRequest<Array<{
    id: string;
    player_a: string;
    player_b: string;
    status: string;
    mode: string;
  }>>(`/elo/match/pending?user_id=${userID}`);
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
