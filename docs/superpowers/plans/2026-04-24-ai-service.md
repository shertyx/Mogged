# AI Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construire le pipeline d'analyse faciale complet : extraction de features via dlib, entraînement d'un modèle de régression sur le Chicago Face Database, et exposition via FastAPI.

**Architecture:** Feature extraction (dlib 68 landmarks + OpenCV) → score normalisé 0-100 par feature → Ridge Regression (joblib) → chad_score global. Le modèle est entraîné offline dans `ai/` et chargé au démarrage du face-service. Hot-reload sans restart via variable `MODEL_PATH`.

**Tech Stack:** Python 3.11, dlib, OpenCV, scikit-learn, FastAPI, joblib, PostgreSQL (psycopg2), MinIO (boto3), pytest.

---

## File Map

```
ai/
├── extract_features.py       # extraction dlib — partagé prod + entraînement
├── train.py                  # chargement dataset, entraînement, export joblib
├── evaluate.py               # métriques MAE, R² entre versions
├── models/                   # model_v1.joblib (gitignore *.joblib)
└── datasets/                 # gitignore — données locales seulement

services/face-service/
├── Dockerfile                # déjà créé en infra
├── requirements.txt          # à enrichir
├── main.py                   # FastAPI — routes upload + analyse
├── pipeline.py               # orchestration upload → analyse → DB → MinIO
├── storage.py                # MinIO client (upload, signed URL, delete)
├── db.py                     # PostgreSQL client (cache, save score)
└── tests/
    ├── test_extract_features.py
    ├── test_pipeline.py
    └── test_api.py
```

---

### Task 1: Setup environnement Python pour l'IA

**Files:**
- Create: `ai/requirements-ai.txt`

- [x] **Step 1: Créer requirements-ai.txt**

```
dlib==19.24.4
opencv-python-headless==4.9.0.80
scikit-learn==1.4.2
numpy==1.26.4
pandas==2.2.2
joblib==1.4.0
matplotlib==3.8.4
requests==2.31.0
```

- [x] **Step 2: Créer un venv et installer**

```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-ai.txt
```

Attendu : installation sans erreur. dlib peut prendre 5-10 minutes à compiler.

- [x] **Step 3: Vérifier dlib**

```bash
python3 -c "import dlib; print(dlib.__version__)"
```

Attendu : `19.24.4`

- [x] **Step 4: Télécharger le modèle dlib 68 landmarks**

```bash
mkdir -p models
curl -L "http://dlib.net/files/shape_predictor_68_face_landmarks.dat.bz2" -o models/shape_predictor_68_face_landmarks.dat.bz2
bunzip2 models/shape_predictor_68_face_landmarks.dat.bz2
```

Attendu : fichier `models/shape_predictor_68_face_landmarks.dat` (~95MB).

- [x] **Step 5: Commit**

```bash
cd ..
git add ai/requirements-ai.txt
git commit -m "chore: add ai requirements"
```

---

### Task 2: Module d'extraction de features

**Files:**
- Create: `ai/extract_features.py`
- Create: `ai/tests/test_extract_features.py`

- [x] **Step 1: Écrire le test**

Créer `ai/tests/__init__.py` (vide) et `ai/tests/test_extract_features.py` :

```python
import numpy as np
import pytest
from extract_features import extract_features, normalize_score

def test_normalize_score_clamps():
    assert normalize_score(0.0, 0.0, 1.0) == 0.0
    assert normalize_score(1.0, 0.0, 1.0) == 100.0
    assert normalize_score(0.5, 0.0, 1.0) == 50.0

def test_normalize_score_out_of_range():
    assert normalize_score(-1.0, 0.0, 1.0) == 0.0
    assert normalize_score(2.0, 0.0, 1.0) == 100.0

def test_extract_features_returns_dict():
    # Image noire 300x300 — dlib ne détecte pas de visage, doit lever une exception
    black_img = np.zeros((300, 300, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="No face detected"):
        extract_features(black_img)

def test_extract_features_keys():
    # Test avec une vraie image — charger une image de test depuis datasets/
    import cv2, os
    test_img_path = os.environ.get("TEST_FACE_IMAGE")
    if not test_img_path:
        pytest.skip("TEST_FACE_IMAGE not set")
    img = cv2.imread(test_img_path)
    result = extract_features(img)
    expected_keys = {"symmetry", "golden_ratio", "jawline", "eyes", "nose", "forehead"}
    assert expected_keys == set(result.keys())
    for v in result.values():
        assert 0.0 <= v <= 100.0
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
cd ai && source .venv/bin/activate
python3 -m pytest tests/test_extract_features.py -v
```

Attendu : `ImportError: No module named 'extract_features'`

- [x] **Step 3: Implémenter extract_features.py**

```python
import cv2
import dlib
import numpy as np
from pathlib import Path

_detector = dlib.get_frontal_face_detector()
_predictor = dlib.shape_predictor(
    str(Path(__file__).parent / "models" / "shape_predictor_68_face_landmarks.dat")
)


def normalize_score(value: float, min_val: float, max_val: float) -> float:
    if max_val == min_val:
        return 50.0
    score = (value - min_val) / (max_val - min_val) * 100.0
    return float(np.clip(score, 0.0, 100.0))


def _get_landmarks(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _detector(gray, 1)
    if len(faces) == 0:
        raise ValueError("No face detected in image")
    shape = _predictor(gray, faces[0])
    return np.array([[shape.part(i).x, shape.part(i).y] for i in range(68)])


def _symmetry_score(pts: np.ndarray) -> float:
    # Centre du visage = milieu des yeux (pts 36-41 gauche, 42-47 droit)
    left_eye_center = pts[36:42].mean(axis=0)
    right_eye_center = pts[42:48].mean(axis=0)
    center_x = (left_eye_center[0] + right_eye_center[0]) / 2

    # Paires symétriques (gauche/droite)
    pairs = [(0, 16), (1, 15), (2, 14), (3, 13), (4, 12),
             (5, 11), (6, 10), (7, 9), (17, 26), (18, 25),
             (19, 24), (20, 23), (21, 22)]
    deviations = []
    for l, r in pairs:
        dist_l = abs(pts[l][0] - center_x)
        dist_r = abs(pts[r][0] - center_x)
        face_width = abs(pts[0][0] - pts[16][0]) or 1
        deviations.append(abs(dist_l - dist_r) / face_width)

    mean_dev = float(np.mean(deviations))
    # 0 déviation = 100, 0.5 déviation = 0
    return normalize_score(mean_dev, 0.5, 0.0)


def _golden_ratio_score(pts: np.ndarray) -> float:
    # Ratio idéal : largeur visage / hauteur visage ≈ 0.618
    face_width = float(np.linalg.norm(pts[0] - pts[16]))
    face_height = float(np.linalg.norm(pts[8] - pts[27]))
    if face_height == 0:
        return 50.0
    ratio = face_width / face_height
    golden = 0.618
    deviation = abs(ratio - golden)
    return normalize_score(deviation, 0.4, 0.0)


def _jawline_score(pts: np.ndarray) -> float:
    # Largeur mâchoire (pts 4-12) relative à largeur totale (pts 0-16)
    jaw_width = float(np.linalg.norm(pts[4] - pts[12]))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = jaw_width / face_width
    # Ratio idéal ~0.7 pour une mâchoire définie
    deviation = abs(ratio - 0.7)
    return normalize_score(deviation, 0.3, 0.0)


def _eyes_score(pts: np.ndarray) -> float:
    # Espacement des yeux relatif à largeur du visage
    left_center = pts[36:42].mean(axis=0)
    right_center = pts[42:48].mean(axis=0)
    eye_spacing = float(np.linalg.norm(left_center - right_center))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = eye_spacing / face_width
    # Ratio idéal ~0.46
    deviation = abs(ratio - 0.46)
    return normalize_score(deviation, 0.2, 0.0)


def _nose_score(pts: np.ndarray) -> float:
    # Largeur nez (pts 31-35) relative à largeur visage
    nose_width = float(np.linalg.norm(pts[31] - pts[35]))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = nose_width / face_width
    # Ratio idéal ~0.25
    deviation = abs(ratio - 0.25)
    return normalize_score(deviation, 0.2, 0.0)


def _forehead_score(pts: np.ndarray) -> float:
    # Hauteur front estimée : du sommet des sourcils (pts 19/24) jusqu'en haut
    brow_y = min(pts[19][1], pts[24][1])
    chin_y = pts[8][1]
    nose_y = pts[27][1]
    face_height = float(abs(chin_y - brow_y)) or 1
    upper_third = float(abs(nose_y - brow_y))
    ratio = upper_third / face_height
    # Ratio idéal ~0.33
    deviation = abs(ratio - 0.33)
    return normalize_score(deviation, 0.2, 0.0)


def extract_features(img: np.ndarray) -> dict[str, float]:
    pts = _get_landmarks(img)
    return {
        "symmetry": _symmetry_score(pts),
        "golden_ratio": _golden_ratio_score(pts),
        "jawline": _jawline_score(pts),
        "eyes": _eyes_score(pts),
        "nose": _nose_score(pts),
        "forehead": _forehead_score(pts),
    }
```

- [x] **Step 4: Lancer les tests**

```bash
python3 -m pytest tests/test_extract_features.py -v
```

Attendu : 3 tests PASS (`test_normalize_score_clamps`, `test_normalize_score_out_of_range`, `test_extract_features_returns_dict`). Le test `test_extract_features_keys` est skipped sans `TEST_FACE_IMAGE`.

- [x] **Step 5: Commit**

```bash
cd ..
git add ai/extract_features.py ai/tests/
git commit -m "feat(ai): add facial feature extraction with dlib landmarks"
```

---

### Task 3: Entraînement du modèle sur Chicago Face Database

**Files:**
- Create: `ai/train.py`
- Create: `ai/evaluate.py`

- [x] **Step 1: Télécharger Chicago Face Database**

Aller sur https://chicagofaces.org/ → télécharger le dataset (requiert inscription gratuite).
Placer les images dans `ai/datasets/CFD/` et le fichier de ratings `CFD Norming Data.xlsx` dans `ai/datasets/`.

Structure attendue :
```
ai/datasets/
├── CFD Norming Data.xlsx
└── CFD/
    ├── CFD-AF-200-228-N.jpg
    ├── ...
```

- [x] **Step 2: Créer train.py**

```python
import os
import cv2
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

import sys
sys.path.insert(0, str(Path(__file__).parent))
from extract_features import extract_features

DATASET_DIR = Path("datasets/CFD")
RATINGS_FILE = Path("datasets/CFD Norming Data.xlsx")
MODEL_OUT = Path("models/model_v1.joblib")


def load_dataset() -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_excel(RATINGS_FILE, sheet_name=0)
    # La colonne d'attractivité dans CFD s'appelle "Attractive"
    # Garder uniquement les lignes avec photo + score
    df = df[["Target", "Attractive"]].dropna()

    X, y = [], []
    for _, row in df.iterrows():
        img_name = str(row["Target"]).strip()
        # Chercher l'image (extension jpg ou png)
        for ext in [".jpg", ".JPG", ".png"]:
            img_path = DATASET_DIR / (img_name + ext)
            if img_path.exists():
                break
        else:
            continue

        img = cv2.imread(str(img_path))
        if img is None:
            continue

        try:
            features = extract_features(img)
        except ValueError:
            continue

        X.append(list(features.values()))
        # Normaliser attractiveness (1-7 dans CFD) vers 0-100
        y.append((float(row["Attractive"]) - 1) / 6 * 100)

    return np.array(X), np.array(y)


def train(X: np.ndarray, y: np.ndarray) -> Pipeline:
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=1.0)),
    ])
    model.fit(X, y)
    return model


def main():
    print("Loading dataset...")
    X, y = load_dataset()
    print(f"Loaded {len(X)} samples")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print("Training model...")
    model = train(X_train, y_train)

    MODEL_OUT.parent.mkdir(exist_ok=True)
    joblib.dump(model, MODEL_OUT)
    print(f"Model saved to {MODEL_OUT}")

    score = model.score(X_test, y_test)
    print(f"R² on test set: {score:.4f}")


if __name__ == "__main__":
    main()
```

- [x] **Step 3: Créer evaluate.py**

```python
import joblib
import numpy as np
from pathlib import Path
from sklearn.metrics import mean_absolute_error, r2_score
from train import load_dataset
from sklearn.model_selection import train_test_split


def evaluate(model_path: str):
    model = joblib.load(model_path)
    X, y = load_dataset()
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    y_pred = model.predict(X_test)
    print(f"Model: {model_path}")
    print(f"  MAE : {mean_absolute_error(y_test, y_pred):.2f}")
    print(f"  R²  : {r2_score(y_test, y_pred):.4f}")


if __name__ == "__main__":
    import sys
    paths = sys.argv[1:] or list(Path("models").glob("*.joblib"))
    for p in paths:
        evaluate(str(p))
```

- [x] **Step 4: Lancer l'entraînement**

```bash
cd ai && source .venv/bin/activate
python3 train.py
```

Attendu :
```
Loading dataset...
Loaded NNN samples
Training model...
Model saved to models/model_v1.joblib
R² on test set: X.XXXX
```

Un R² > 0.3 est acceptable pour une première version. Si < 0.1, vérifier que les colonnes du fichier Excel correspondent (ouvrir le fichier et inspecter les noms de colonnes réels).

- [x] **Step 5: Évaluer le modèle**

```bash
python3 evaluate.py models/model_v1.joblib
```

Attendu : affichage MAE et R².

- [x] **Step 6: Commit**

```bash
cd ..
git add ai/train.py ai/evaluate.py
git commit -m "feat(ai): add training pipeline and evaluation script"
```

---

### Task 4: Enrichir le face-service — dépendances

**Files:**
- Modify: `services/face-service/requirements.txt`

- [x] **Step 1: Mettre à jour requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-dotenv==1.0.1
dlib==19.24.4
opencv-python-headless==4.9.0.80
scikit-learn==1.4.2
numpy==1.26.4
joblib==1.4.0
psycopg2-binary==2.9.9
boto3==1.34.84
python-multipart==0.0.9
```

- [x] **Step 2: Commit**

```bash
git add services/face-service/requirements.txt
git commit -m "chore(face-service): add full python dependencies"
```

---

### Task 5: Module storage (MinIO)

**Files:**
- Create: `services/face-service/storage.py`
- Create: `services/face-service/tests/test_storage.py`

- [x] **Step 1: Écrire le test**

```python
import pytest
from unittest.mock import MagicMock, patch


def test_upload_photo_returns_key():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin123",
            bucket="test-bucket",
        )
        key = client.upload_photo(b"fake_image_bytes", "abc123", "jpg")
        assert key == "photos/abc123.jpg"
        mock_s3.put_object.assert_called_once()


def test_get_signed_url_calls_presigned():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "http://minio/signed"
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient("localhost:9000", "key", "secret", "bucket")
        url = client.get_signed_url("photos/abc123.jpg", expiry=3600)
        assert url == "http://minio/signed"


def test_delete_photo_calls_delete():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient("localhost:9000", "key", "secret", "bucket")
        client.delete_photo("photos/abc123.jpg")
        mock_s3.delete_object.assert_called_once_with(
            Bucket="bucket", Key="photos/abc123.jpg"
        )
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
cd services/face-service
python3 -m pytest tests/test_storage.py -v
```

Attendu : `ImportError: No module named 'storage'`

- [x] **Step 3: Implémenter storage.py**

```python
import boto3
from botocore.client import Config


class StorageClient:
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str):
        self._bucket = bucket
        self._s3 = boto3.client(
            "s3",
            endpoint_url=f"http://{endpoint}",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
        )

    def upload_photo(self, data: bytes, hash_md5: str, ext: str) -> str:
        key = f"photos/{hash_md5}.{ext}"
        self._s3.put_object(Bucket=self._bucket, Key=key, Body=data)
        return key

    def get_signed_url(self, key: str, expiry: int = 3600) -> str:
        return self._s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expiry,
        )

    def delete_photo(self, key: str) -> None:
        self._s3.delete_object(Bucket=self._bucket, Key=key)
```

- [x] **Step 4: Lancer les tests**

```bash
python3 -m pytest tests/test_storage.py -v
```

Attendu : 3 tests PASS.

- [x] **Step 5: Commit**

```bash
cd ../..
git add services/face-service/storage.py services/face-service/tests/
git commit -m "feat(face-service): add minio storage client"
```

---

### Task 6: Module db (PostgreSQL cache + scores)

**Files:**
- Create: `services/face-service/db.py`
- Create: `services/face-service/tests/test_db.py`

- [x] **Step 1: Écrire le test**

```python
import pytest
from unittest.mock import MagicMock, patch


def test_get_cached_score_returns_none_if_missing():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("unknownhash")
        assert result is None


def test_get_cached_score_returns_score_if_exists():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (75.5, '{"symmetry": 80.0}')
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("knownhash")
        assert result["chad_score"] == 75.5


def test_save_score_inserts_row():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        client.save_score(
            photo_hash="abc123",
            photo_id="uuid-1",
            chad_score=82.0,
            features={"symmetry": 80.0, "golden_ratio": 75.0, "jawline": 90.0,
                       "eyes": 70.0, "nose": 85.0, "forehead": 65.0},
        )
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
python3 -m pytest tests/test_db.py -v
```

Attendu : `ImportError: No module named 'db'`

- [x] **Step 3: Implémenter db.py**

```python
import json
import psycopg2
from psycopg2.extras import RealDictCursor


class DBClient:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def _conn(self):
        return psycopg2.connect(self._dsn)

    def get_cached_score(self, photo_hash: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT chad_score, row_to_json(face.scores) FROM face.scores WHERE photo_hash = %s",
                    (photo_hash,),
                )
                row = cur.fetchone()
                if row is None:
                    return None
                return {"chad_score": row[0], "features": row[1]}

    def save_score(
        self,
        photo_hash: str,
        photo_id: str,
        chad_score: float,
        features: dict[str, float],
    ) -> None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO face.scores
                        (photo_hash, photo_id, chad_score, symmetry, golden_ratio,
                         jawline, eyes, nose, forehead)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (photo_hash) DO NOTHING
                    """,
                    (
                        photo_hash,
                        photo_id,
                        chad_score,
                        features["symmetry"],
                        features["golden_ratio"],
                        features["jawline"],
                        features["eyes"],
                        features["nose"],
                        features["forehead"],
                    ),
                )
            conn.commit()
```

- [x] **Step 4: Lancer les tests**

```bash
python3 -m pytest tests/test_db.py -v
```

Attendu : 3 tests PASS.

- [x] **Step 5: Commit**

```bash
cd ../..
git add services/face-service/db.py services/face-service/tests/test_db.py
git commit -m "feat(face-service): add postgres db client for score cache"
```

---

### Task 7: Pipeline d'analyse complet

**Files:**
- Create: `services/face-service/pipeline.py`
- Create: `services/face-service/tests/test_pipeline.py`

- [x] **Step 1: Écrire le test**

```python
import pytest
import numpy as np
from unittest.mock import MagicMock, patch


def test_analyse_photo_uses_cache():
    mock_db = MagicMock()
    mock_db.get_cached_score.return_value = {
        "chad_score": 75.0,
        "features": {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0}
    }
    mock_storage = MagicMock()
    mock_storage.get_signed_url.return_value = "http://minio/signed"

    from pipeline import AnalysisPipeline
    p = AnalysisPipeline(db=mock_db, storage=mock_storage, model=MagicMock())
    result = p.analyse_photo(b"fake", "abc123", "jpg", "photo-uuid")

    assert result["chad_score"] == 75.0
    mock_db.get_cached_score.assert_called_once_with("abc123")
    mock_db.save_score.assert_not_called()


def test_analyse_photo_runs_pipeline_on_cache_miss():
    mock_db = MagicMock()
    mock_db.get_cached_score.return_value = None
    mock_storage = MagicMock()
    mock_storage.upload_photo.return_value = "photos/abc123.jpg"
    mock_storage.get_signed_url.return_value = "http://minio/signed"
    mock_model = MagicMock()
    mock_model.predict.return_value = np.array([82.0])

    fake_features = {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0}

    with patch("pipeline.extract_features", return_value=fake_features), \
         patch("pipeline.cv2.imdecode", return_value=np.zeros((224, 224, 3), dtype=np.uint8)):
        from pipeline import AnalysisPipeline
        p = AnalysisPipeline(db=mock_db, storage=mock_storage, model=mock_model)
        result = p.analyse_photo(b"fake_jpg_bytes", "abc123", "jpg", "photo-uuid")

    assert result["chad_score"] == pytest.approx(82.0)
    assert "features" in result
    assert "signed_url" in result
    mock_db.save_score.assert_called_once()
    mock_storage.upload_photo.assert_called_once()
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
python3 -m pytest tests/test_pipeline.py -v
```

Attendu : `ImportError: No module named 'pipeline'`

- [x] **Step 3: Implémenter pipeline.py**

```python
import cv2
import numpy as np
import joblib
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "ai"))
from extract_features import extract_features

from db import DBClient
from storage import StorageClient


class AnalysisPipeline:
    def __init__(self, db: DBClient, storage: StorageClient, model):
        self._db = db
        self._storage = storage
        self._model = model

    def analyse_photo(
        self, image_bytes: bytes, hash_md5: str, ext: str, photo_id: str
    ) -> dict:
        cached = self._db.get_cached_score(hash_md5)
        if cached:
            signed_url = self._storage.get_signed_url(f"photos/{hash_md5}.{ext}")
            return {**cached, "signed_url": signed_url}

        arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Cannot decode image")

        # Resize pour la détection
        img = cv2.resize(img, (224, 224))

        features = extract_features(img)
        feature_vector = np.array([list(features.values())])
        chad_score = float(self._model.predict(feature_vector)[0])
        chad_score = float(np.clip(chad_score, 0.0, 100.0))

        s3_key = self._storage.upload_photo(image_bytes, hash_md5, ext)
        self._db.save_score(hash_md5, photo_id, chad_score, features)
        signed_url = self._storage.get_signed_url(s3_key)

        return {
            "chad_score": chad_score,
            "features": features,
            "signed_url": signed_url,
        }
```

- [x] **Step 4: Lancer les tests**

```bash
python3 -m pytest tests/test_pipeline.py -v
```

Attendu : 2 tests PASS.

- [x] **Step 5: Commit**

```bash
cd ../..
git add services/face-service/pipeline.py services/face-service/tests/test_pipeline.py
git commit -m "feat(face-service): add analysis pipeline with cache"
```

---

### Task 8: Routes FastAPI

**Files:**
- Modify: `services/face-service/main.py`
- Create: `services/face-service/tests/test_api.py`

- [x] **Step 1: Écrire le test**

```python
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch


def make_client():
    with patch("main.AnalysisPipeline") as MockPipeline, \
         patch("main.DBClient"), \
         patch("main.StorageClient"), \
         patch("main.joblib"):
        mock_pipeline_instance = MagicMock()
        MockPipeline.return_value = mock_pipeline_instance
        from main import app
        return TestClient(app), mock_pipeline_instance


def test_health():
    client, _ = make_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_upload_photo_missing_file():
    client, _ = make_client()
    response = client.post("/photos/analyze", data={"photo_id": "uuid-1"})
    assert response.status_code == 422


def test_upload_photo_success():
    client, mock_pipeline = make_client()
    mock_pipeline.analyse_photo.return_value = {
        "chad_score": 82.0,
        "features": {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0},
        "signed_url": "http://minio/signed",
    }
    import io
    fake_image = io.BytesIO(b"fakeimagebytes")
    response = client.post(
        "/photos/analyze",
        data={"photo_id": "uuid-1"},
        files={"file": ("test.jpg", fake_image, "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chad_score"] == 82.0
    assert "features" in body
    assert "signed_url" in body
```

- [x] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
python3 -m pytest tests/test_api.py -v
```

Attendu : tests API échouent (routes non implémentées).

- [x] **Step 3: Réécrire main.py**

```python
import hashlib
import os
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

    return result
```

- [x] **Step 4: Lancer les tests**

```bash
python3 -m pytest tests/test_api.py -v
```

Attendu : 3 tests PASS.

- [x] **Step 5: Commit**

```bash
cd ../..
git add services/face-service/main.py services/face-service/tests/test_api.py
git commit -m "feat(face-service): add photo upload and analysis endpoint"
```

---

### Task 9: Vérification end-to-end dans Docker

- [x] **Step 1: Copier le modèle entraîné**

```bash
cp ai/models/model_v1.joblib ai/models/
# Le docker-compose monte ai/models/ dans face-service en lecture seule
```

- [x] **Step 2: Builder et démarrer**

```bash
docker compose up --build -d face-service postgres minio
```

- [x] **Step 3: Tester le health check**

```bash
curl http://localhost:8000/health
```

Attendu : `{"status":"ok","service":"face-service"}`

- [x] **Step 4: Tester l'analyse avec une vraie photo**

```bash
curl -X POST http://localhost:8000/photos/analyze \
  -F "photo_id=test-uuid" \
  -F "file=@/chemin/vers/une/photo.jpg"
```

Attendu : JSON avec `chad_score`, `features`, `signed_url`.

- [x] **Step 5: Arrêter**

```bash
docker compose down
```

- [x] **Step 6: Commit final**

```bash
git add .
git commit -m "feat(ai): ai service complete — feature extraction, training, fastapi endpoint"
```
