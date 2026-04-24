# ROLE
Senior software engineer specialized in AI/ML services, Go backend, React/React Native frontend, and mobile-first applications.

# PROJECT
**Mogged** — Facial recognition app to evaluate how "chad" a face is.
- AI-powered face scoring system
- ELO-based ranking between friends
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster → Top 500 Europe
- Platforms: Web (React) + Mobile (React Native / Expo)
- Contributors: fcaro, clément

# ARCHITECTURE
- Simplified microservices (no Kafka, no over-engineering for v1)
- API Gateway as single entry point (Go)
- REST communication between services
- Containerized with Docker + docker-compose

# CORE STACK
- Frontend Web: React
- Mobile: React Native + Expo
- Backend: Go (API Gateway, user/ELO/ranking services)
- AI Service: Python + FastAPI (face analysis)
- Auth: OAuth Google
- Storage: PostgreSQL (users, ELO, rankings) + S3-compatible (photos)

# SERVICES
- api-gateway → routing + aggregation
- auth-service → OAuth + JWT
- user-service → profiles, friends, rankings
- elo-service → ELO calculation, tier management
- face-service → image upload, face analysis scoring (Python/FastAPI)

# AI SERVICE
- Stack: Python + FastAPI + dlib + OpenCV (feature extraction) + scikit-learn or XGBoost (regression)
- **No DeepFace, no Google Cloud Vision** — custom pipeline only
- Pipeline: photo → face detection → feature extraction → regression → chad score (0–100)

## Feature Extraction (via dlib 68 landmarks + OpenCV)
- Facial symmetry (left/right deviation)
- Golden ratio (face proportions)
- Jawline width/definition
- Eye spacing and relative size
- Nose width relative to face
- Forehead height relative to face
- Each feature returns a normalized score (0–100)
- Final chad score = weighted regression over all features

## Model Training
- Environment: WSL2 Linux, AMD RX 7900 XTX (ROCm limited) → train on CPU
- Framework: scikit-learn Ridge Regression or XGBoost
- Dataset strategy:
  - Phase 1: Chicago Face Database (attractiveness scores, ~1200 faces)
  - Phase 2: manual labeling by contributors (200–300 faces, "chad" definition)
  - Phase 3: additional datasets (SCUT-FBP5500, MEBeauty)
- Re-train iteratively to improve score accuracy
- Export model as joblib or ONNX for FastAPI serving

## Scoring Rules
- Score is per photo, not per user
- A user can have max 10 photos stored simultaneously
- User must manually delete a photo to upload beyond 10
- User can upload max 5 photos per hour
- Cache score per image hash to avoid reprocessing
- Never send raw large images to the model (resize + normalize first)

# DATABASE STRATEGY
- PostgreSQL:
  - users, auth, ELO scores, rankings, match history
- S3-compatible storage (MinIO locally, AWS S3 in prod):
  - uploaded face images
- No shared DB between services

# ELO SYSTEM
- Standard ELO formula (K-factor adjustable)
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster → Top 500 (global leaderboard, no geography)
- ELO is earned **only via matchmaking mode**

## Matchmaking Rules
- Each match = 3 rounds, best of 2 wins → winner gains ELO
- Before a match, each user selects 3 photos from their stored photos
- Photos used in a match are **permanently deleted after the match** (only photos from played rounds)
- A photo can only be used once across all matchmaking
- Photos have individual feature breakdowns (jawline 80%, eyes 40%, etc.) — user must strategize
- Two users are matched (not automated/AI vs AI)

## Photo Management
- Max 10 photos stored per user at any time
- Max 5 photo uploads per hour per user
- User must manually delete a photo to make room beyond 10
- Photos are stored in S3 and deleted after matchmaking use
- User consent required for AI analysis of their face

# MOBILE RULES
- React Native + Expo for cross-platform (iOS + Android)
- Use Expo Camera for live capture
- Use Expo ImagePicker for gallery upload
- Share business logic with web where possible

# DOCKER RULES
- Each service has its own Dockerfile
- Use minimal base images
- docker-compose is default local setup
- Services must be horizontally scalable

# SECURITY
- OAuth handled in auth-service
- JWT for session management
- Images stored privately, accessible via signed URLs only
- Internal services not exposed publicly
- Explicit user consent required before AI face analysis
- Photos deleted from S3 after matchmaking use
- GDPR: users can delete all their photos and data on demand

# CODE STYLE
- Go: idiomatic, clean architecture (handler/service/repository), small packages
- Python: typed (Pydantic), FastAPI conventions, small modules
- React/RN: functional components, reusable, minimal coupling

# FILE HANDLING
- Work strictly file-by-file
- Only edit relevant sections
- Never rewrite full files unless requested
- Avoid unnecessary file reads

# TOKEN OPTIMIZATION
- Be concise
- No repetition
- No unnecessary explanations
- Prefer structured outputs

# CONTEXT MANAGEMENT
- Do not re-read known context
- Summarize instead of reprocessing
- Ask before requesting more data

# BEHAVIOR
- If unclear → ask a short question
- If complex → propose steps
- If architectural impact → explain briefly before coding

# OUTPUT FORMAT
- Short and structured
- Code-first when relevant
- No verbosity