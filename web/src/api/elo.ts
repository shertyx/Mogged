import { apiRequest } from './client';

export async function getElo(userID: string) {
  return apiRequest<{ score: number; tier: string; tier_name: string; division: number; sr: number }>(`/elo?user_id=${userID}`);
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

export interface LeaderboardEntry {
  user_id: string; username: string; score: number; tier: string; rank: number;
}

export async function getLeaderboard() {
  return apiRequest<LeaderboardEntry[]>('/elo/leaderboard');
}

export interface MatchHistoryEntry {
  match_id: string; opponent_id: string; opponent: string;
  won: boolean; elo_change: number; played_at: string;
}

export async function getMatchHistory(userID: string) {
  return apiRequest<MatchHistoryEntry[]>(`/elo/history?user_id=${userID}`);
}

export interface FeedEntry {
  match_id: string;
  player_a_id: string; player_a: string;
  player_b_id: string; player_b: string;
  winner_id: string;
  s3key_a: string; s3key_b: string;
  score_a: number; score_b: number;
  played_at: string;
}

export async function getFeed() {
  return apiRequest<FeedEntry[]>('/elo/feed');
}

export interface DuelRequest {
  ID: string;
  ChallengerID: string;
  ChallengerName: string;
  ChallengerPhotos: string[];
  Status: string;
  CreatedAt: string;
}

export async function sendDuelRequest(challengedID: string, photoIDs: string[]) {
  return apiRequest<{ duel_id: string }>('/elo/duel/send', {
    method: 'POST',
    body: JSON.stringify({ challenged_id: challengedID, photo_ids: photoIDs }),
  });
}

export async function listPendingDuels() {
  return apiRequest<DuelRequest[]>('/elo/duel/pending');
}

export async function acceptDuelRequest(duelID: string, photoIDs: string[]) {
  return apiRequest<{ winner_id: string }>('/elo/duel/accept', {
    method: 'POST',
    body: JSON.stringify({ duel_id: duelID, photo_ids: photoIDs }),
  });
}

export async function declineDuelRequest(duelID: string) {
  return apiRequest<void>('/elo/duel/decline', {
    method: 'POST',
    body: JSON.stringify({ duel_id: duelID }),
  });
}
