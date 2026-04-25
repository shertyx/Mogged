# E2E Debug + AI Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the full upload → photo display → matchmaking → AI scoring flow so everything works end-to-end in the browser, then train a real Ridge Regression model on SCUT-FBP5500.

**Architecture:** Sequential debug approach — fix upload wiring (face-service ↔ user-service), fix frontend API call mismatches, fix matchmaking round resolution, then train and deploy the AI model.

**Tech Stack:** Go (net/http), Python FastAPI, React + Zustand, dlib + scikit-learn Ridge Regression, HuggingFace `datasets`.

---

## Bug Inventory (read before starting)

These are the exact bugs found by code audit:

| # | Location | Bug |
|---|----------|-----|
| 1 | `web/src/api/face.ts` | Calls `/face/upload` but face-service endpoint is `/photos/analyze` → 404 |
| 2 | `web/src/api/face.ts` | Doesn't send `photo_id` form field (face-service requires `Form(...)`) |
| 3 | `services/face-service/main.py` | Never calls user-service `RegisterUpload` or `UpdatePhotoScore` after analysis |
| 4 | `docker-compose.yml` | `face-service` has no `USER_SERVICE_URL` env var |
| 5 | `services/api-gateway/handler/matchmaking.go` | Creates match but never resolves rounds (no `match_end` message sent) |
| 6 | `web/src/pages/Match/RealtimeMatch.tsx` | Sends photo selections over WebSocket but matchmaking handler ignores them |

---

## Files Modified / Created

| File | Action | What changes |
|------|--------|--------------|
| `web/src/api/face.ts` | Modify | Fix URL `/face/upload` → `/face/photos/analyze`, generate + send `photo_id`, return `photo_id` |
| `services/face-service/main.py` | Modify | Add HTTP calls to user-service after analysis (RegisterUpload + UpdatePhotoScore) |
| `docker-compose.yml` | Modify | Add `USER_SERVICE_URL` env var to face-service |
| `services/api-gateway/handler/matchmaking.go` | Modify | After pairing: read photo selections from both clients, call elo-service ResolveMatch, send round results + match_end |
| `web/src/pages/Match/RealtimeMatch.tsx` | Modify | Send selected photo IDs over WebSocket after `matched` event |
| `ai/train.py` | Verify/run | Run as-is after confirming SCUT loads correctly |

---

## Task 1: Fix frontend upload URL and photo_id

**Files:**
- Modify: `web/src/api/face.ts`

- [ ] **Step 1: Read current face.ts**

```bash
cat web/src/api/face.ts
```

Expected output: function calls `/face/upload`, no `photo_id`.

- [ ] **Step 2: Replace face.ts with corrected version**

Replace the entire content of `web/src/api/face.ts` with:

```typescript
import { v4 as uuidv4 } from 'uuid';

export async function uploadPhoto(file: File): Promise<{
  photo_id: string;
  chad_score: number;
  features: Record<string, number>;
  signed_url: string;
}> {
  const token = localStorage.getItem('access_token');
  const photo_id = uuidv4();
  const form = new FormData();
  form.append('file', file);
  form.append('photo_id', photo_id);
  const res = await fetch('/face/photos/analyze', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

- [ ] **Step 3: Install uuid if not present**

```bash
cd web && npm list uuid 2>/dev/null | grep uuid || npm install uuid && npm install --save-dev @types/uuid
```

Expected: `uuid` appears in node_modules.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/api/face.ts web/package.json web/package-lock.json
git commit -m "fix(web): correct upload endpoint URL and add photo_id"
```

---

## Task 2: Add USER_SERVICE_URL to docker-compose

**Files:**
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add env var to face-service in docker-compose.yml**

In `docker-compose.yml`, find the `face-service` environment block and add `USER_SERVICE_URL`:

```yaml
  face-service:
    build:
      context: .
      dockerfile: services/face-service/Dockerfile
    ports:
      - "8000:8000"
    environment:
      POSTGRES_DSN: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
      MINIO_ENDPOINT: minio:9000
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET}
      MODEL_PATH: ${MODEL_PATH}
      USER_SERVICE_URL: http://user-service:8082
```

- [ ] **Step 2: Commit**

```bash
git add docker-compose.yml
git commit -m "fix(infra): add USER_SERVICE_URL env var to face-service"
```

---

## Task 3: face-service calls user-service after analysis

**Files:**
- Modify: `services/face-service/main.py`

- [ ] **Step 1: Replace main.py with version that calls user-service**

Replace the entire content of `services/face-service/main.py` with:

```python
import hashlib
import os
import uuid
import httpx
import joblib
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from dotenv import load_dotenv

from pipeline import AnalysisPipeline
from db import DBClient
from storage import StorageClient

load_dotenv()

app = FastAPI()

_db = DBClient(os.environ["POSTGRES_DSN"])
_storage = StorageClient(
    endpoint=os.environ["MINIO_ENDPOINT"],
    access_key=os.environ["MINIO_ROOT_USER"],
    secret_key=os.environ["MINIO_ROOT_PASSWORD"],
    bucket=os.environ["MINIO_BUCKET"],
)

_model_path = os.environ.get("MODEL_PATH", "/app/models/model_v1.joblib")
_model = joblib.load(_model_path) if os.path.exists(_model_path) else None

_pipeline = AnalysisPipeline(db=_db, storage=_storage, model=_model)

_user_service_url = os.environ.get("USER_SERVICE_URL", "http://user-service:8082")


@app.get("/health")
def health():
    return {"status": "ok", "service": "face-service"}


@app.post("/photos/analyze")
async def analyze_photo(
    photo_id: str = Form(...),
    file: UploadFile = File(...),
):
    if _model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    hash_md5 = hashlib.md5(contents).hexdigest()
    ext = (file.filename or "jpg").rsplit(".", 1)[-1].lower()

    try:
        result = _pipeline.analyse_photo(contents, hash_md5, ext, photo_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Register photo in user-service
    async with httpx.AsyncClient() as client:
        reg_resp = await client.post(
            f"{_user_service_url}/user/photos/register",
            json={"photo_id": photo_id, "s3_key": f"photos/{hash_md5}.{ext}", "hash": hash_md5},
        )
        if reg_resp.status_code not in (200, 201, 204):
            raise HTTPException(status_code=502, detail=f"RegisterUpload failed: {reg_resp.text}")

        score_resp = await client.patch(
            f"{_user_service_url}/user/photos/score",
            json={
                "photo_id": photo_id,
                "chad_score": result["chad_score"],
                "features": result["features"],
            },
        )
        if score_resp.status_code not in (200, 201, 204):
            raise HTTPException(status_code=502, detail=f"UpdatePhotoScore failed: {score_resp.text}")

    return {**result, "photo_id": photo_id}
```

- [ ] **Step 2: Add httpx to face-service requirements**

```bash
grep httpx services/face-service/requirements.txt || echo "httpx" >> services/face-service/requirements.txt
```

- [ ] **Step 3: Check user-service RegisterUpload handler signature**

```bash
grep -A 30 "func.*RegisterUpload" services/user-service/handler/user.go
```

Note the exact JSON fields expected (`photo_id`, `s3_key`, `hash`) — adjust the `json={}` dict in main.py if field names differ.

- [ ] **Step 4: Check UpdatePhotoScore handler signature**

```bash
grep -A 30 "func.*UpdatePhotoScore" services/user-service/handler/user.go
```

Note the exact JSON fields expected (`photo_id`, `chad_score`, `features`) — adjust if needed.

- [ ] **Step 5: Rebuild and restart face-service**

```bash
docker compose build face-service && docker compose up -d face-service
sleep 3 && docker compose logs face-service | tail -10
```

Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 6: Commit**

```bash
git add services/face-service/main.py services/face-service/requirements.txt
git commit -m "fix(face-service): call user-service RegisterUpload and UpdatePhotoScore after analysis"
```

---

## Task 4: Rebuild web and test upload end-to-end

**Files:**
- No code changes — test only.

- [ ] **Step 1: Rebuild web container**

```bash
docker compose build web && docker compose up -d web
```

- [ ] **Step 2: Open browser at http://localhost:3000**

Log in with Google. Navigate to Photos page.

- [ ] **Step 3: Upload the test photo**

Click "+ Upload Photo", select `Capture d'écran 2026-02-18 184721.png` from the project root.

Expected:
- No error alert
- Photo appears in the grid with a chad_score (0–100)
- Counter shows `1/10`

- [ ] **Step 4: Check face-service logs if upload fails**

```bash
docker compose logs face-service | tail -30
```

Look for Python tracebacks or HTTP error codes. Fix before continuing.

- [ ] **Step 5: Check user-service logs**

```bash
docker compose logs user-service | tail -20
```

Expected: POST /user/photos/register 200, PATCH /user/photos/score 200.

---

## Task 5: Fix matchmaking round resolution

**Context:** The WebSocket handler pairs two players and sends `match_id`, but never plays the rounds. The fix: after pairing, read each player's selected photo scores from the DB (via elo-service or user-service), resolve 3 rounds (highest chad_score wins each round), send results, update ELO.

**Files:**
- Modify: `services/api-gateway/handler/matchmaking.go`

- [ ] **Step 1: Read the current matchmaking handler**

```bash
cat services/api-gateway/handler/matchmaking.go
```

- [ ] **Step 2: Read the RealtimeMatch frontend to understand the WebSocket protocol**

```bash
cat web/src/pages/Match/RealtimeMatch.tsx
```

Note: frontend sends photo IDs after receiving `matched`, then expects `round` messages and a `match_end` message.

- [ ] **Step 3: Replace matchmaking.go with full round resolution**

Replace the entire content of `services/api-gateway/handler/matchmaking.go` with:

```go
package handler

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type queueEntry struct {
	userID string
	conn   *websocket.Conn
	joined time.Time
}

type MatchQueue struct {
	mu      sync.Mutex
	waiting *queueEntry
}

func NewMatchQueue() *MatchQueue {
	return &MatchQueue{}
}

type matchMsg struct {
	Type        string  `json:"type"`
	MatchID     string  `json:"match_id,omitempty"`
	Opponent    string  `json:"opponent,omitempty"`
	Message     string  `json:"message,omitempty"`
	Round       int     `json:"round,omitempty"`
	MyScore     float64 `json:"my_score,omitempty"`
	OppScore    float64 `json:"opp_score,omitempty"`
	WinnerIsMe  bool    `json:"winner_is_me,omitempty"`
}

type photoSelectMsg struct {
	PhotoIDs []string `json:"photo_ids"`
}

type photoScore struct {
	PhotoID   string  `json:"photo_id"`
	ChadScore float64 `json:"chad_score"`
}

func (q *MatchQueue) HandleMatchmaking(eloServiceURL string, userServiceURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-User-ID")
		if userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}

		entry := &queueEntry{userID: userID, conn: conn, joined: time.Now()}

		q.mu.Lock()
		if q.waiting == nil {
			q.waiting = entry
			q.mu.Unlock()

			conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
			conn.ReadMessage()
			q.mu.Lock()
			if q.waiting == entry {
				q.waiting = nil
				q.mu.Unlock()
				conn.WriteJSON(matchMsg{Type: "timeout", Message: "no opponent found"})
				conn.Close()
			} else {
				q.mu.Unlock()
			}
			return
		}

		opponent := q.waiting
		q.waiting = nil
		q.mu.Unlock()

		matchID, err := createRealtimeMatch(eloServiceURL, opponent.userID, userID)
		if err != nil {
			log.Println("create match:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to create match"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to create match"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Notify both players of match
		opponent.conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID, Opponent: userID})
		conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID, Opponent: opponent.userID})

		// Read photo selections from both players concurrently
		type selectionResult struct {
			photoIDs []string
			err      error
		}
		aCh := make(chan selectionResult, 1)
		bCh := make(chan selectionResult, 1)

		readSelection := func(c *websocket.Conn, ch chan selectionResult) {
			c.SetReadDeadline(time.Now().Add(2 * time.Minute))
			_, msg, err := c.ReadMessage()
			if err != nil {
				ch <- selectionResult{err: err}
				return
			}
			var sel photoSelectMsg
			if err := json.Unmarshal(msg, &sel); err != nil || len(sel.PhotoIDs) != 3 {
				ch <- selectionResult{err: err}
				return
			}
			ch <- selectionResult{photoIDs: sel.PhotoIDs}
		}

		go readSelection(opponent.conn, aCh)
		go readSelection(conn, bCh)

		aResult := <-aCh
		bResult := <-bCh

		if aResult.err != nil || bResult.err != nil {
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "photo selection failed"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "photo selection failed"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Fetch chad scores for all selected photos
		aScores, err := fetchPhotoScores(userServiceURL, aResult.photoIDs)
		if err != nil {
			log.Println("fetch scores player A:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			opponent.conn.Close()
			conn.Close()
			return
		}
		bScores, err := fetchPhotoScores(userServiceURL, bResult.photoIDs)
		if err != nil {
			log.Println("fetch scores player B:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Play 3 rounds
		aWins, bWins := 0, 0
		type roundInput struct {
			PhotoA    string  `json:"photo_a"`
			PhotoB    string  `json:"photo_b"`
			ScoreA    float64 `json:"score_a"`
			ScoreB    float64 `json:"score_b"`
			WinnerPhoto string `json:"winner_photo"`
		}
		var rounds []roundInput

		for i := 0; i < 3; i++ {
			sa := aScores[i]
			sb := bScores[i]
			winnerPhoto := aResult.photoIDs[i]
			if sb > sa {
				winnerPhoto = bResult.photoIDs[i]
				bWins++
			} else {
				aWins++
			}
			rounds = append(rounds, roundInput{
				PhotoA:      aResult.photoIDs[i],
				PhotoB:      bResult.photoIDs[i],
				ScoreA:      sa,
				ScoreB:      sb,
				WinnerPhoto: winnerPhoto,
			})
			// Send round result to both players
			opponent.conn.WriteJSON(matchMsg{Type: "round", Round: i + 1, MyScore: sa, OppScore: sb, WinnerIsMe: sa >= sb})
			conn.WriteJSON(matchMsg{Type: "round", Round: i + 1, MyScore: sb, OppScore: sa, WinnerIsMe: sb >= sa})
		}

		// Determine overall winner
		aWon := aWins > bWins

		// Resolve match in elo-service
		resolveBody := map[string]interface{}{
			"match_id": matchID,
			"player_a": opponent.userID,
			"player_b": userID,
			"rounds":   rounds,
		}
		if err := resolveMatch(eloServiceURL, resolveBody); err != nil {
			log.Println("resolve match:", err)
		}

		// Send final result
		opponent.conn.WriteJSON(matchMsg{Type: "match_end", WinnerIsMe: aWon})
		conn.WriteJSON(matchMsg{Type: "match_end", WinnerIsMe: !aWon})

		opponent.conn.Close()
		conn.Close()
	}
}

func fetchPhotoScores(userServiceURL string, photoIDs []string) ([]float64, error) {
	scores := make([]float64, len(photoIDs))
	for i, id := range photoIDs {
		resp, err := http.Get(userServiceURL + "/user/photos?photo_id=" + id)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var photos []struct {
			ID        string  `json:"id"`
			ChadScore float64 `json:"chad_score"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&photos); err != nil {
			return nil, err
		}
		for _, p := range photos {
			if p.ID == id {
				scores[i] = p.ChadScore
				break
			}
		}
	}
	return scores, nil
}

func createRealtimeMatch(eloServiceURL, playerA, playerB string) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"player_a": playerA,
		"player_b": playerB,
		"mode":     "realtime",
	})
	resp, err := http.Post(eloServiceURL+"/elo/match/create", "application/json",
		bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		MatchID string `json:"match_id"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.MatchID, nil
}

func resolveMatch(eloServiceURL string, body map[string]interface{}) error {
	b, _ := json.Marshal(body)
	resp, err := http.Post(eloServiceURL+"/elo/match/resolve", "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
```

- [ ] **Step 4: Update api-gateway main.go to pass USER_SERVICE_URL to HandleMatchmaking**

In `services/api-gateway/cmd/server/main.go`, find these lines:

```go
mq := handler.NewMatchQueue()
```

and

```go
protected.HandleFunc("/matchmaking", mq.HandleMatchmaking(eloURL))
```

Replace the matchmaking line with:

```go
protected.HandleFunc("/matchmaking", mq.HandleMatchmaking(eloURL, userURL))
```

- [ ] **Step 5: Update frontend to send photo IDs after matched event**

In `web/src/pages/Match/RealtimeMatch.tsx`, find the `socket.onmessage` handler. Replace the `if (msg.type === 'matched')` branch:

Current:
```typescript
if (msg.type === 'matched') setPhase('matched');
```

Replace with:
```typescript
if (msg.type === 'matched') {
  setPhase('matched');
  socket.send(JSON.stringify({ photo_ids: selected }));
}
```

- [ ] **Step 6: Rebuild api-gateway**

```bash
docker compose build api-gateway && docker compose up -d api-gateway
sleep 2 && docker compose logs api-gateway | tail -5
```

Expected: `api-gateway listening on :8080`

- [ ] **Step 7: Rebuild web**

```bash
docker compose build web && docker compose up -d web
```

- [ ] **Step 8: Commit**

```bash
git add services/api-gateway/handler/matchmaking.go services/api-gateway/cmd/server/main.go web/src/pages/Match/RealtimeMatch.tsx
git commit -m "fix(matchmaking): resolve rounds server-side and send round/match_end events"
```

---

## Task 6: Test matchmaking end-to-end

- [ ] **Step 1: Make sure you have at least 3 photos uploaded (Task 4 must be complete)**

Navigate to Photos page. Upload photos until you have at least 3.

- [ ] **Step 2: Open two browser windows (or use incognito)**

Window A: log in with your main Google account.
Window B: log in with a second Google account.

Both must have at least 3 photos uploaded.

- [ ] **Step 3: Both navigate to Fight → Real-time Match**

Select 3 photos in each window. Click "Find Match" in both.

Expected sequence:
1. "Finding opponent…" appears in both
2. "Opponent found!" appears in both
3. Round results (1/2/3) appear with scores
4. Win/Loss result screen appears
5. Profile page shows updated ELO

- [ ] **Step 4: Check logs if match fails**

```bash
docker compose logs api-gateway | tail -30
docker compose logs elo-service | tail -20
```

---

## Task 7: Train AI model on SCUT-FBP5500

**Prerequisites:** Python 3.12+, virtual env active, dlib installed (required for feature extraction).

- [ ] **Step 1: Activate Python venv**

```bash
cd /home/cled/Mogged
source .venv/bin/activate
```

If `.venv` doesn't exist:
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r ai/requirements-ai.txt
```

- [ ] **Step 2: Verify dlib shape predictor model exists**

```bash
ls ai/models/shape_predictor_68_face_landmarks.dat
```

Expected: file exists (~99MB). If missing:
```bash
cd ai/models
wget http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2
bunzip2 shape_predictor_68_face_landmarks.dat.bz2
cd ../..
```

- [ ] **Step 3: Run training**

```bash
cd /home/cled/Mogged
python ai/train.py
```

Expected output (takes 10-30 minutes — SCUT has 5500 images, dlib processes each):
```
=== SCUT-FBP5500 ===
  Downloading SCUT train from HuggingFace...
  SCUT train: 4400 images
  SCUT test: 1100 images
  → NNNN samples chargés
=== Chicago Face Database ===
  SKIP (non téléchargé): ...
=== MEBeauty ===
  → NNN samples chargés (or SKIP)
Total: NNNN samples sur 6 features
Training model...
Model saved to models/model_v1.joblib
R² on test set: 0.XXXX
```

R² > 0.1 is acceptable for v1. R² > 0.3 is good.

- [ ] **Step 4: Verify model file created**

```bash
ls -lh ai/models/model_v1.joblib
```

Expected: file exists, size 5-50KB.

- [ ] **Step 5: Rebuild face-service to pick up new model**

```bash
docker compose build face-service && docker compose up -d face-service
sleep 3 && docker compose logs face-service | tail -5
```

Expected: `Uvicorn running on http://0.0.0.0:8000` (no "Model not loaded" error).

- [ ] **Step 6: Commit model**

```bash
git add ai/models/model_v1.joblib
git commit -m "feat(ai): train Ridge Regression model on SCUT-FBP5500"
```

---

## Task 8: Validate full end-to-end with AI score

- [ ] **Step 1: Upload the test photo via the web UI**

Navigate to Photos page. Upload `Capture d'écran 2026-02-18 184721.png` from the project root.

- [ ] **Step 2: Verify the photo appears with a real score**

Expected: photo card shows a chad_score between 0–100 (not 0, not 503 error).

- [ ] **Step 3: Check the score is meaningful**

```bash
docker compose logs face-service | grep chad_score
```

If score is always 50 or always 0, check that the model was loaded:
```bash
docker compose exec face-service python -c "import joblib; m = joblib.load('/app/models/model_v1.joblib'); print(type(m))"
```

- [ ] **Step 4: Final validation checklist**

- [ ] Upload works, photo appears in grid
- [ ] Counter shows correct count (N/10)
- [ ] chad_score is a real number between 0–100
- [ ] Two accounts can complete a real-time match
- [ ] ELO updates on profile page after match
- [ ] Used photos are deleted after match

---

## Self-Review

**Spec coverage:**
- Section 1 (Code Audit) → covered by Bug Inventory table above
- Section 2 (Upload flow) → Tasks 1, 2, 3, 4
- Section 3 (Matchmaking) → Tasks 5, 6
- Section 4 (AI training) → Tasks 7, 8
- Section 5 (Validation checklist) → Task 8 Step 4

**No placeholders found.**

**Type consistency:** `photoSelectMsg.PhotoIDs []string` matches frontend `JSON.stringify({ photo_ids: selected })`. `matchMsg` fields match frontend destructuring (`msg.type`, `msg.round`, `msg.my_score`, `msg.opp_score`, `msg.winner_is_me`).
