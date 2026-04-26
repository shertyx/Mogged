import cv2
import dlib
import numpy as np
import joblib
import sys
from pathlib import Path

_detector = dlib.get_frontal_face_detector()

def _crop_face(img: np.ndarray) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = _detector(gray, 1)
    if len(faces) == 0:
        # No face found — return resized original (extract_features will raise later)
        h, w = img.shape[:2]
        scale = 512 / max(h, w)
        return cv2.resize(img, (int(w * scale), int(h * scale)))
    f = faces[0]
    h, w = img.shape[:2]
    pad = int(max(f.width(), f.height()) * 0.45)
    x1 = max(0, f.left() - pad)
    y1 = max(0, f.top() - pad)
    x2 = min(w, f.right() + pad)
    y2 = min(h, f.bottom() + pad)
    crop = img[y1:y2, x1:x2]
    return cv2.resize(crop, (512, 512))

# En local : ai/ est 3 niveaux au dessus. En Docker : extract_features.py est copié dans /app/
_ai_path = Path(__file__).parent.parent.parent / "ai"
if _ai_path.exists():
    sys.path.insert(0, str(_ai_path))

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

        # Auto-crop: detect face bounding box, add 40% padding, resize to 512px
        img = _crop_face(img)

        features = extract_features(img)
        feature_vector = np.array([list(features.values())])
        raw = float(self._model.predict(feature_vector)[0])
        chad_score = float(np.clip(raw, 0.0, 100.0))
        # Sigmoid calibration: amplify extremes, crush the mediocre middle
        x = chad_score / 100.0
        k = 10.0
        s_min = 1.0 / (1.0 + np.exp(k * 0.5))
        s_max = 1.0 / (1.0 + np.exp(-k * 0.5))
        chad_score = float(((1.0 / (1.0 + np.exp(-k * (x - 0.5)))) - s_min) / (s_max - s_min) * 100.0)

        s3_key = self._storage.upload_photo(image_bytes, hash_md5, ext)
        self._db.save_score(hash_md5, photo_id, chad_score, features)
        signed_url = self._storage.get_signed_url(s3_key)

        return {
            "chad_score": chad_score,
            "features": features,
            "signed_url": signed_url,
        }
