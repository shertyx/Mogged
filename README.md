# Mogged

Application de scoring facial "chad" avec matchmaking ELO.

**Stack :** Go (backend) · Python/FastAPI (IA) · React (web) · React Native/Expo (mobile) · PostgreSQL · MinIO · Docker

---

## Prérequis

- Docker Desktop (avec WSL2 backend sur Windows)
- Node.js 20+
- Python 3.12+ (pour l'entraînement du modèle, hors Docker)
- Go 1.25+ (pour le développement Go local)

---

## Lancer le projet

### 1. Variables d'environnement

```bash
cp .env.example .env
```

Éditer `.env` et remplir :

```env
JWT_SECRET=une_chaine_secrete_longue
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

> **Google OAuth** : créer un projet sur [console.cloud.google.com](https://console.cloud.google.com), activer l'API OAuth2, ajouter `http://localhost:8080/auth/callback` comme redirect URI autorisée.

### 2. Entraîner le modèle IA (première fois)

Le modèle doit exister avant de lancer `face-service`.

```bash
# Installer les dépendances Python
cd /home/cled/Mogged
python3 -m venv .venv
source .venv/bin/activate
pip install -r ai/requirements-ai.txt

# Placer le dataset Chicago Face Database dans ai/datasets/chicago/
# (téléchargement manuel sur chicagofaces.org — nécessite inscription)

# Entraîner
python ai/train.py

# Le modèle est exporté dans ai/models/model_v1.joblib
```

### 3. Démarrer tous les services

```bash
docker compose up --build
```

Ou en arrière-plan :

```bash
docker compose up --build -d
```

### 4. Vérifier que tout est up

```bash
docker compose ps
```

Tous les services doivent être `Up` :

| Service       | Port                        |
|---------------|-----------------------------|
| api-gateway   | http://localhost:8080        |
| auth-service  | http://localhost:8081        |
| user-service  | http://localhost:8082        |
| elo-service   | http://localhost:8083        |
| face-service  | http://localhost:8000        |
| postgres      | localhost:5432               |
| minio         | http://localhost:9000 (API) · http://localhost:9001 (console) |

### 5. Frontend web

```bash
cd web
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000)

### 6. Frontend mobile

```bash
cd mobile
npm install
npx expo start
```

Scanner le QR code avec l'app **Expo Go** (iOS/Android).

---

## Commandes utiles

### Docker

```bash
# Démarrer
docker compose up -d

# Arrêter
docker compose down

# Rebuild un service spécifique
docker compose build face-service
docker compose up -d face-service

# Logs d'un service
docker compose logs -f api-gateway
docker compose logs -f face-service

# Reset complet (supprime les volumes)
docker compose down -v
```

### Base de données

```bash
# Se connecter à PostgreSQL
psql postgres://mogged:mogged_secret@localhost:5432/mogged

# Voir les schémas
\dn

# Voir les tables d'un schéma
\dt users.*
\dt elo.*
\dt auth.*
```

### MinIO

Console web : [http://localhost:9001](http://localhost:9001)
Login : `minioadmin` / `minioadmin123`

```bash
# Lister les buckets via CLI (si mc installé)
mc alias set local http://localhost:9000 minioadmin minioadmin123
mc ls local/mogged-photos
```

### IA — Modèle

```bash
# Activer l'env Python
source .venv/bin/activate

# Entraîner le modèle
python ai/train.py

# Évaluer et comparer deux versions
python ai/evaluate.py

# Tester l'extraction de features sur une image
python -c "
import cv2
from ai.extract_features import extract_features
img = cv2.imread('test.jpg')
print(extract_features(img))
"
```

### Tests Go

```bash
# Tests unitaires (service layer — pas besoin de DB)
cd services/auth-service  && go test ./service/... -v
cd services/user-service  && go test ./service/... -v
cd services/elo-service   && go test ./service/... -v

# Tests d'intégration repository (nécessite Docker Compose up)
cd services/user-service  && go test ./repository/... -v

# Tous les tests d'un service
cd services/auth-service  && go test ./... -v
```

### Build Go (vérification locale)

```bash
cd services/api-gateway   && go build ./...
cd services/auth-service  && go build ./...
cd services/user-service  && go build ./...
cd services/elo-service   && go build ./...
```

### Frontend web

```bash
cd web

# Dev
npm run dev

# Build de prod
npm run build

# Preview du build
npm run preview

# Type check
npm run build  # inclut tsc -b
```

### Frontend mobile

```bash
cd mobile

# Démarrer Metro
npx expo start

# Android
npx expo start --android

# iOS
npx expo start --ios

# Vider le cache Metro
npx expo start --clear
```

---

## Architecture

```
Client (web/mobile)
    ↓
api-gateway :8080  ←── JWT auth middleware
    ├── /auth/*     → auth-service :8081  (Google OAuth, JWT, refresh)
    ├── /user/*     → user-service :8082  (profils, photos, rate limiting)
    ├── /elo/*      → elo-service  :8083  (scores ELO, matchs, tiers)
    ├── /face/*     → face-service :8000  (upload, analyse IA, scoring)
    └── /matchmaking → WebSocket matchmaking temps réel

PostgreSQL (4 schémas séparés : auth · users · elo · face)
MinIO (stockage photos privées, signed URLs)
```

### Tiers ELO

| Tier        | Score ELO  |
|-------------|-----------|
| Bronze      | < 1200    |
| Silver      | 1200–1399 |
| Gold        | 1400–1599 |
| Platinum    | 1600–1799 |
| Diamond     | 1800–1999 |
| Master      | 2000–2199 |
| Grandmaster | 2200–2399 |
| Top 500     | 2400+     |

### Règles photo

- Max **10 photos** stockées par utilisateur
- Max **5 uploads par heure**
- Score calculé à l'upload (pipeline dlib 68 landmarks → Ridge Regression)
- Photos utilisées en matchmaking → supprimées définitivement

### Matchmaking

- **Temps réel** : WebSocket, timeout 5 min, ELO attribué immédiatement
- **Async** : défi 24h, Joueur B doit accepter et choisir ses 3 photos
- Best of 3 rounds — vainqueur du round = photo avec le chad score le plus élevé

---

## Structure du projet

```
Mogged/
├── docker-compose.yml
├── .env.example
├── services/
│   ├── api-gateway/        Go — routing, JWT middleware, WebSocket
│   ├── auth-service/       Go — Google OAuth, JWT, refresh tokens
│   ├── user-service/       Go — profils, photos, rate limiting
│   ├── elo-service/        Go — ELO, tiers, matchs
│   └── face-service/       Python/FastAPI — upload, analyse IA
├── ai/
│   ├── extract_features.py dlib 68 landmarks + OpenCV
│   ├── train.py            entraînement Ridge Regression
│   ├── evaluate.py         MAE + R² entre versions
│   ├── models/             model_v1.joblib, model_v2.joblib…
│   └── datasets/           Chicago Face DB + labels manuels
├── mobile/                 React Native + Expo
├── web/                    React + Vite
├── infra/postgres/         init.sql (4 schémas)
└── docs/superpowers/       specs et plans d'implémentation
```

---

## Contributors

- fcaro
- clément
