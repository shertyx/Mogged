import cv2
import numpy as np
import joblib
import sys
from pathlib import Path

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

        # Extract features on full-size image (dlib needs enough resolution to detect face)
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
