import { apiRequest } from './client';

interface BotRound {
  round: number;
  my_score: number;
  bot_score: number;
  won_round: boolean;
}

interface BotMatchResult {
  won: boolean;
  rounds: BotRound[];
}

export async function playBotMatch(photoIds: string[]): Promise<BotMatchResult> {
  return apiRequest<BotMatchResult>('/matchmaking/bot', {
    method: 'POST',
    body: JSON.stringify({ photo_ids: photoIds }),
  });
}
