"""
Loaders pour chaque dataset. Chaque loader retourne (X, y) avec y normalisé 0-100.
"""
import io
import cv2
import numpy as np
import requests
from pathlib import Path
from typing import Optional

from extract_features import extract_features


def _process_image_bytes(img_bytes: bytes) -> Optional[np.ndarray]:
    arr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def _extract(img: np.ndarray) -> Optional[list[float]]:
    try:
        f = extract_features(img)
        return list(f.values())
    except ValueError:
        return None


def load_scut_fbp5500(cache_dir: Path = Path("datasets/scut")) -> tuple[np.ndarray, np.ndarray]:
    """SCUT-FBP5500 via HuggingFace (téléchargement auto). 5500 visages, scores 1-5."""
    import pyarrow.parquet as pq

    cache_dir.mkdir(parents=True, exist_ok=True)
    X, y = [], []

    for split in ["train", "test"]:
        cache_file = cache_dir / f"{split}.parquet"
        if not cache_file.exists():
            url = f"https://huggingface.co/datasets/MnLgt/scut-fbp5500/resolve/main/data/{split}-00000-of-00001.parquet"
            print(f"  Downloading SCUT {split} from HuggingFace...")
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            cache_file.write_bytes(r.content)

        tbl = pq.read_table(str(cache_file))
        rows = tbl.to_pydict()
        n = len(rows["beauty_score"])
        print(f"  SCUT {split}: {n} images")

        for i in range(n):
            img_bytes = rows["image"][i]["bytes"]
            score_raw = float(rows["beauty_score"][i])
            img = _process_image_bytes(img_bytes)
            if img is None:
                continue
            feats = _extract(img)
            if feats is None:
                continue
            X.append(feats)
            # Normalise 1-5 → 0-100
            y.append((score_raw - 1) / 4 * 100)

    return np.array(X), np.array(y)


def load_cfd(dataset_dir: Path = Path("datasets/CFD"),
             ratings_file: Path = Path("datasets/CFD Norming Data.xlsx")) -> tuple[np.ndarray, np.ndarray]:
    """Chicago Face Database. Nécessite téléchargement manuel depuis chicagofaces.org."""
    import pandas as pd

    if not ratings_file.exists():
        raise FileNotFoundError(
            f"CFD ratings non trouvé: {ratings_file}\n"
            "Télécharger depuis https://chicagofaces.org/download/"
        )

    df = pd.read_excel(ratings_file, sheet_name=0)
    df = df[["Target", "Attractive"]].dropna()

    X, y = [], []
    for _, row in df.iterrows():
        img_name = str(row["Target"]).strip()
        for ext in [".jpg", ".JPG", ".png"]:
            img_path = dataset_dir / (img_name + ext)
            if img_path.exists():
                break
        else:
            continue
        img = cv2.imread(str(img_path))
        if img is None:
            continue
        feats = _extract(img)
        if feats is None:
            continue
        X.append(feats)
        # Normalise 1-7 → 0-100
        y.append((float(row["Attractive"]) - 1) / 6 * 100)

    return np.array(X), np.array(y)


def load_mebeauty(cache_dir: Path = Path("datasets/mebeauty")) -> tuple[np.ndarray, np.ndarray]:
    """MEBeauty via HuggingFace (multi-ethnic, scores 1-5)."""
    import pyarrow.parquet as pq

    # Cherche le dataset sur HuggingFace
    hf_id = "arnabdhar/MEBeauty"
    cache_dir.mkdir(parents=True, exist_ok=True)

    meta_url = f"https://huggingface.co/api/datasets/{hf_id}"
    r = requests.get(meta_url, timeout=15)
    if r.status_code != 200:
        raise RuntimeError(f"MEBeauty non disponible sur HuggingFace ({r.status_code})")

    siblings = r.json().get("siblings", [])
    parquet_files = [s["rfilename"] for s in siblings if s["rfilename"].endswith(".parquet")]

    if not parquet_files:
        raise RuntimeError("Aucun fichier parquet trouvé pour MEBeauty")

    X, y = [], []
    for fname in parquet_files:
        cache_file = cache_dir / Path(fname).name
        if not cache_file.exists():
            url = f"https://huggingface.co/datasets/{hf_id}/resolve/main/{fname}"
            print(f"  Downloading MEBeauty {fname}...")
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            cache_file.write_bytes(r.content)

        tbl = pq.read_table(str(cache_file))
        rows = tbl.to_pydict()

        # Détecte la colonne score
        score_col = next((c for c in rows if "score" in c.lower() or "rating" in c.lower() or "beauty" in c.lower()), None)
        img_col = next((c for c in rows if "image" in c.lower() or "img" in c.lower()), None)
        if not score_col or not img_col:
            print(f"  MEBeauty: colonnes non reconnues {list(rows.keys())}, skip")
            continue

        n = len(rows[score_col])
        print(f"  MEBeauty {fname}: {n} images")
        scores = [float(s) for s in rows[score_col]]
        score_min, score_max = min(scores), max(scores)

        for i in range(n):
            raw = rows[img_col][i]
            img_bytes = raw["bytes"] if isinstance(raw, dict) else raw
            img = _process_image_bytes(img_bytes)
            if img is None:
                continue
            feats = _extract(img)
            if feats is None:
                continue
            X.append(feats)
            y.append((scores[i] - score_min) / (score_max - score_min) * 100)

    return np.array(X), np.array(y)
