# Mogged — Architecture Design

Date: 2026-04-24  
Contributors: fcaro, clément

---

## 1. Repository Structure

Monorepo, branche principale `master`, développement sur `dev`.

```
Mogged/
├── docker-compose.yml
├── .env.example
├── services/
│   ├── api-gateway/        # Go — routing, WebSocket matchmaking
│   ├── auth-service/       # Go — Google OAuth, JWT
│   ├── user-service/       # Go — profils, photos metadata, amis
│   ├── elo-service/        # Go — ELO, tiers, historique matchs
│   └── face-service/       # Python/FastAPI — upload, analyse, scoring
├── mobile/                 # React Native + Expo
├── web/                    # React
├── ai/
│   ├── extract_features.py # extraction dlib (partagé prod + entraînement)
│   ├── train.py            # entraînement modèle, export joblib
│   ├── evaluate.py         # métriques MAE, R²
│   ├── models/             # model_v1.joblib, model_v2.joblib...
│   └── datasets/           # Chicago Face DB + labels manuels
├── infra/
│   └── postgres/
│       └── init.sql        # création schémas auth/users/elo/face
└── docs/
    └── superpowers/specs/
```

---

## 2. Infrastructure (Docker)

### Services & Ports

| Service      | Port      | Image            |
|--------------|-----------|------------------|
| api-gateway  | 8080      | Go custom        |
| auth-service | 8081      | Go custom        |
| user-service | 8082      | Go custom        |
| elo-service  | 8083      | Go custom        |
| face-service | 8000      | Python custom    |
| postgres     | 5432      | postgres:16-alpine |
| minio        | 9000/9001 | minio/minio      |

### Communication
```
Client → api-gateway:8080 → auth/user/elo/face services (REST)
                          → WebSocket /ws/matchmaking
face-service → minio (stockage photos)
tous services → postgres (schémas séparés)
```

### Schémas PostgreSQL (instance unique)
- `auth` — users OAuth, JWT refresh tokens
- `users` — profils, photos metadata (max 10 par user, compteur uploads/heure)
- `elo` — scores ELO, tiers, historique matchs
- `face` — scores chad par photo, features breakdown, cache par hash MD5

---

## 3. Service IA

### Stack
- dlib (68 landmarks faciaux) + OpenCV → extraction features
- scikit-learn Ridge Regression ou XGBoost → scoring
- FastAPI → exposition REST
- joblib → sérialisation modèle

### Pipeline upload/analyse
```
Photo reçue (max 5MB)
  → validation format/taille
  → hash MD5 → check cache DB (retour immédiat si déjà analysé)
  → resize 224x224 + normalize
  → dlib détection 68 landmarks
  → extraction 6 features (score 0-100 chacune) :
      - symétrie faciale
      - golden ratio (proportions)
      - jawline width/definition
      - espacement + taille relative des yeux
      - largeur nez relative
      - hauteur front relative
  → modèle joblib → chad_score global (0-100)
  → stockage résultat en DB schéma face
  → upload photo vers MinIO
  → retour : { chad_score, features_breakdown, signed_url }
```

### Entraînement du modèle
- **Phase 1** : Chicago Face Database (~1200 visages, attractiveness scores existants)
- **Phase 2** : labellisation manuelle par fcaro + clément (200-300 visages, définition "chad")
- **Phase 3** : enrichissement (SCUT-FBP5500, MEBeauty)
- Environnement : WSL2 Linux, CPU (ROCm AMD non supporté sous WSL)
- Export : `models/model_vN.joblib`
- Hot-reload : face-service recharge le modèle sans restart si nouveau `.joblib` déposé

### Versionnement modèle
- Chaque modèle entraîné est sauvegardé avec sa version (`model_v1.joblib`)
- `evaluate.py` compare MAE et R² entre versions avant de promouvoir
- Le modèle actif est configuré via variable d'environnement `MODEL_PATH`

---

## 4. Gestion des Photos

### Règles
- Max **10 photos** stockées simultanément par utilisateur
- Max **5 uploads par heure** par utilisateur
- Score chad calculé à l'upload (pas au moment du match)
- Chaque photo a son propre `features_breakdown`
- Photo utilisée en matchmaking → supprimée de MinIO + marquée `used` en DB

### Stockage
- Photos privées dans MinIO, accessibles via signed URLs uniquement
- Suppression automatique après utilisation en matchmaking
- L'utilisateur peut supprimer manuellement une photo pour libérer de la place
- Consentement explicite requis avant première analyse IA

---

## 5. ELO & Matchmaking

### Tiers (par score ELO)
Bronze → Silver → Gold → Platinum → Diamond → Master → Grandmaster → Top 500

### Matchmaking — Flow temps réel (WebSocket)
```
Joueur A → WS /ws/matchmaking → rejoint queue
Joueur B → WS /ws/matchmaking → match trouvé (ELO proche)

Les 2 joueurs choisissent 3 photos parmi leurs photos stockées
  → timeout : 5 minutes total par match (forfait si dépassé)

Round 1 :
  → Chaque joueur voit la photo adverse du round
  → Vainqueur = photo avec chad_score le plus élevé (automatique, pas de vote)
  → Photo utilisée supprimée

Round 2, Round 3 si nécessaire (best of 3)

Fin du match :
  → Gagnant = 2 rounds gagnés
  → ELO recalculé (formule standard, K=32 ajustable)
  → Tier mis à jour si seuil franchi
  → "match_end" envoyé aux 2 joueurs avec nouveau ELO
```

### Timeout
- Match limité à **5 minutes**
- Si un joueur ne répond pas → forfait → adversaire gagne → ELO calculé normalement

### Règles métier
- ELO gagnable **uniquement via matchmaking** (pas d'autres modes)
- Une photo ne peut être utilisée qu'une seule fois en matchmaking
- Classement global (pas de segmentation géographique)

---

## 6. Auth

- **Google OAuth uniquement** (pas d'email/password)
- auth-service gère le flow OAuth + émission JWT
- JWT pour toutes les requêtes API internes
- Refresh tokens stockés en DB schéma `auth`

---

## 7. Sécurité & RGPD

- Images accessibles uniquement via signed URLs (jamais publiques)
- Services internes non exposés hors Docker network
- Consentement explicite utilisateur avant analyse IA du visage
- Suppression photos après matchmaking
- Utilisateur peut supprimer toutes ses données (droit à l'effacement RGPD)

---

## 8. Ordre d'implémentation

1. **Infra** — docker-compose, PostgreSQL init.sql, MinIO, variables d'environnement
2. **IA** — pipeline feature extraction + modèle de base (Chicago Face DB)
3. **Backend** — api-gateway, auth-service, user-service, elo-service, face-service
4. **Frontend** — mobile Expo (priorité) puis web React
