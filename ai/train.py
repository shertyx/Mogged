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
    df = df[["Target", "Attractive"]].dropna()

    X, y = [], []
    for _, row in df.iterrows():
        img_name = str(row["Target"]).strip()
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
