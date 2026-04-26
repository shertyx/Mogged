# Mogged — End-to-End Debug + AI Model Training Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the full system so upload, photo display, matchmaking/fight, and AI scoring all work end-to-end, then train a real model on SCUT-FBP5500.

**Architecture:** Debug-first approach — audit each service layer for broken wiring, fix sequentially (upload → photos → fight → score), then train the AI model and validate with a real photo.

**Tech Stack:** Go (user/auth/elo/api-gateway), Python FastAPI (face-service), React (web frontend), dlib + scikit-learn Ridge Regression, HuggingFace `datasets` for SCUT-FBP5500.

---

## Section 1 — Code Audit

Before fixing anything, audit the wiring between components to identify all broken paths.

### 1.1 API Gateway routes
- Verify every route in api-gateway proxies to the correct service and port
- Verify JWT middleware is applied to all protected routes (`/user/*`, `/elo/*`, `/face/*`)
- Verify WebSocket `/matchmaking` upgrade headers are forwarded correctly

### 1.2 face-service → user-service integration
- After `POST /face/photos/analyze`, face-service must call:
  1. `POST /user/photos/register` (RegisterUpload) — creates the photo record in `users.photos`
  2. `PATCH /user/photos/{id}/score` (UpdatePhotoScore) — sets `chad_score` + `features` JSONB
- Verify these HTTP calls exist in face-service `main.py` or `pipeline.py`
- Verify the user-service URLs are passed as env vars to face-service in docker-compose

### 1.3 Frontend API calls
- Verify web `src/api/photos.ts` calls the correct paths with Bearer token
- Verify the Photos page re-fetches after upload and displays `signed_url` images
- Verify the counter uses `listPhotos().length` and updates reactively

### 1.4 ELO / Match flow
- Verify `POST /elo/match` creates a match with status `pending`
- Verify `SetMatchReady` transitions match to `active` when both players ready
- Verify `ResolveMatch` picks winner per round (highest chad_score), updates ELO, deletes used photos
- Verify api-gateway WebSocket sends match ID to both clients after pairing

---

## Section 2 — Fix Upload Flow

**Goal:** Upload a photo → see it in the Photos page with a real chad_score.

### Flow
```
Frontend (FormData) → POST /face/photos/analyze (api-gateway → face-service)
  → face-service: decode image, extract features, predict score
  → face-service: POST /user/photos/register (user-service internal)
  → face-service: PATCH /user/photos/{id}/score (user-service internal)
  → face-service: returns { photo_id, chad_score, features, signed_url }
Frontend: re-fetches GET /user/photos → displays photo with score + counter updates
```

### Known issues to fix
- face-service must have `USER_SERVICE_URL` env var in docker-compose
- face-service must call user-service after analysis (currently unclear if this exists)
- Frontend must handle multipart FormData upload (not JSON), and show success/error feedback
- `signed_url` returned by face-service must be proxied correctly through nginx

### Validation
Upload the project root photo `capture d'ecran...` via the web UI → photo appears in Photos page with a chad_score between 0-100.

---

## Section 3 — Fix Matchmaking / Fight Flow

**Goal:** Two browser sessions can match, fight 3 rounds, and see ELO update.

### Flow
```
Player A + B → WebSocket /matchmaking → api-gateway pairs them → sends match_id
Both players → GET /elo/match/{id} → select 3 photos each
Both players → POST /elo/match/{id}/ready { photo_ids: [...] }
api-gateway (or elo-service) → ResolveMatch → best-of-3, winner gets ELO
Used photos → deleted from users.photos + MinIO
Both players → redirected to result screen with ELO delta
```

### Known issues to fix
- WebSocket handler in api-gateway must send `match_id` to both clients after pairing
- Frontend Match page must poll or use WebSocket to know when opponent is ready
- `ResolveMatch` must delete used photos (call user-service `DeletePhoto`)
- ELO update must write to `elo.scores` table

### Validation
Two browser sessions (two Google accounts) complete a full match → ELO changes on profile page.

---

## Section 4 — AI Model Training

**Goal:** Train a real Ridge Regression model on facial attractiveness data so face-service returns meaningful scores.

### Dataset: SCUT-FBP5500
- Source: HuggingFace `datasets` library, dataset id `SCUT-FBP5500` (no account required)
- ~5500 face images with attractiveness scores 1.0–5.0 from human raters
- Normalize scores: `chad_score = (rating - 1.0) / 4.0 * 100`

### Chicago Face Database (CFD)
- Requires manual download from chicagofaces.org (registration required)
- If credentials are available: script downloads ZIP, extracts to `ai/datasets/chicago/`
- If not available: skip for v1, use SCUT only

### Training pipeline (`ai/train.py`)
1. Load SCUT-FBP5500 from HuggingFace → extract features via dlib for each image
2. If Chicago dataset present → load CSV ratings, extract features, merge with SCUT
3. Fit `StandardScaler` → `Ridge(alpha=1.0)` on combined feature matrix
4. Evaluate: MAE + R² on 20% holdout split
5. Save to `ai/models/model_v1.joblib` (overwrite)
6. Rebuild face-service Docker image to pick up new model

### Feature vector (from `extract_features.py`)
```python
["symmetry", "golden_ratio", "jawline", "eyes", "nose", "forehead"]  # 6 features
```

### Expected output
- Model file: `ai/models/model_v1.joblib`
- Training log: MAE < 15, R² > 0.3 (acceptable for v1 with limited data)

### Validation
Upload `capture d'ecran...` photo → face-service returns a `chad_score` that reflects facial features (not random, not always 50).

---

## Section 5 — Validation Checklist

- [ ] Upload photo via web UI → photo appears in Photos page with score
- [ ] Photo counter shows correct count (e.g. 1/10)
- [ ] Two sessions complete a match → ELO updated on both profiles
- [ ] Used photos deleted after match
- [ ] Model returns non-trivial scores (not 0, not 50 for all photos)
- [ ] face-service logs show no crash on startup or during analysis

---

## Out of Scope
- Automated test suite (CI/CD, pytest, go test integration) — future work
- Mobile frontend debug — web only for now
- Chicago Face Database if download requires manual steps beyond scripting
- Model v2 with additional datasets
