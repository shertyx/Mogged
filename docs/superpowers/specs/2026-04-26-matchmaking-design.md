# Matchmaking Redesign — Design Spec

**Goal:** Make real-time matches and async challenges fully functional. Each match is 1 round, using 1 unanalyzed photo per player. The photo gets analyzed live during the match.

---

## Rules

- **1 round per match** — highest chad_score wins
- **Only unanalyzed photos** can be used (no chad_score yet)
- Player selects 1 photo before joining queue / sending challenge
- Photo is analyzed by face-service during the match server-side
- Photo is marked `used = true` after the match (deleted from pool)
- ELO updated immediately after match resolves

---

## Real-Time Match Flow

1. Player goes to Fight → Real-time Match
2. Page shows only unanalyzed photos — player picks 1
3. Player clicks "Find Match" → WebSocket connects to `/matchmaking`
4. Client sends `{ type: "join", photo_id: "..." }` immediately on connect
5. Server pairs two players → calls face-service `analyze-stored` on both photos concurrently
6. Server compares scores → sends `match_end` to both with full result
7. Frontend shows both photos side-by-side with scores + winner banner

### WebSocket messages (server → client)

```json
{ "type": "waiting" }
{ "type": "matched", "match_id": "..." }
{ "type": "analyzing" }
{ "type": "match_end", "winner_is_me": true, "my_score": 72.3, "opp_score": 61.1, "my_photo": "<signed_url>", "opp_photo": "<signed_url>" }
{ "type": "timeout", "message": "no opponent found" }
{ "type": "error", "message": "..." }
```

### WebSocket messages (client → server)

```json
{ "type": "join", "photo_id": "..." }
```

---

## Async Challenge Flow

1. Player goes to Fight → Challenge
2. Enters opponent **username** (not UUID) + picks 1 unanalyzed photo
3. Sends challenge → stored as `pending` match in DB with `photo_a_id`
4. Opponent sees "Pending challenges" section on Fight page
5. Opponent picks 1 unanalyzed photo → clicks Accept
6. Server analyzes both photos → resolves match → stores result
7. Both players can see result via `GET /elo/match?match_id=`

---

## Backend Changes

### DB migrations

```sql
-- Fix column name inconsistency (winner → winner_id)
ALTER TABLE elo.matches RENAME COLUMN winner TO winner_id;

-- Store photo selections on the match
ALTER TABLE elo.matches ADD COLUMN photo_a_id UUID REFERENCES users.photos(id);
ALTER TABLE elo.matches ADD COLUMN photo_b_id UUID REFERENCES users.photos(id);
```

### user-service

- Add `GET /user/by-username?username=` → returns `{ id, username }`
- Add `GET /user/photos/unanalyzed` → returns photos where `chad_score IS NULL AND used = false`
- Add `PATCH /user/photos/mark-used` → `{ photo_id }` → sets `used = true`

### elo-service

- `ResolveMatch`: accept 1 round instead of requiring exactly 3
- `CreateMatch`: accept optional `photo_a_id` (for async challenges)
- `AcceptChallenge`: new endpoint `POST /elo/match/accept` → `{ match_id, photo_b_id }` → analyzes both photos via face-service, resolves match
- `ListPendingChallenges`: new endpoint `GET /elo/match/pending?user_id=` → returns matches where `player_b = user_id AND status = pending`
- Repository: update queries to use `winner_id` column name

### api-gateway — HandleMatchmaking

- Remove 3-photo selection logic entirely
- On connect: read `{ type: "join", photo_id }` message
- On pair: send `matched`, then call face-service `analyze-stored` on both photos concurrently
- Send `match_end` with scores + signed URLs for both photos
- Call elo-service `ResolveMatch` with 1 round
- Call user-service `mark-used` on both photos

### face-service

- Existing `POST /face/photos/analyze-stored` is reused as-is
- `GET /face/photos/signed-url?s3_key=` — single signed URL (for match result display); reuse existing batch endpoint

---

## Frontend Changes

### `web/src/api/user.ts`

- Add `listUnanalyzedPhotos()` → `GET /user/photos/unanalyzed`

### `web/src/api/elo.ts`

- Update `createChallenge(opponentUsername, photoId)` — takes username now, sends `{ opponent_username, photo_a_id }`
- Add `acceptChallenge(matchId, photoId)` → `POST /elo/match/accept`
- Add `listPendingChallenges()` → `GET /elo/match/pending`

### `web/src/pages/Match/RealtimeMatch.tsx`

- Show only unanalyzed photos (filter `chad_score === null`)
- Select 1 photo (not 3)
- On connect: immediately send `{ type: "join", photo_id }`
- Handle `analyzing` state: show "Analyzing photos…" spinner
- Handle `match_end`: show both photos side-by-side with scores + win/lose banner
- Remove round-by-round display

### `web/src/pages/Match/Challenge.tsx`

- Input: opponent **username** (not UUID)
- Select 1 unanalyzed photo
- On submit: `createChallenge(username, photoId)`

### `web/src/pages/Matchmaking/Matchmaking.tsx`

- Add "Pending Challenges" section listing incoming challenges
- Each challenge: show opponent username + Accept button
- Accept opens photo selection → calls `acceptChallenge(matchId, photoId)`

### `web/src/components/MatchResult/MatchResult.tsx` (new)

- Shows two photo thumbnails side-by-side
- My score vs opponent score
- Winner banner ("You won 🏆" / "You lost 💀")
- ELO change (optional, read from profile after match)

---

## Error Cases

- Player has no unanalyzed photos → show message "Upload a photo first" (disable Find Match / Send Challenge button)
- Photo analysis fails during match → send `error` message, match cancelled, photo not marked used
- Opponent disconnects before analysis completes → timeout + cancel
- Username not found → 404 from user-service, show "User not found"

---

## What's Removed

- 3-round / best-of-2 logic in elo-service
- `RoundResult` component (replaced by `MatchResult`)
- Photo selection after WebSocket connect
- Selecting analyzed photos for matchmaking
