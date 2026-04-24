"""
Entraînement multi-dataset. Utilise tous les datasets disponibles automatiquement.
Datasets supportés : SCUT-FBP5500 (auto), CFD (manuel), MEBeauty (auto).
"""
import joblib
import numpy as np
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

from datasets import load_scut_fbp5500, load_cfd, load_mebeauty

MODEL_OUT = Path("models/model_v1.joblib")


def load_all_datasets() -> tuple[np.ndarray, np.ndarray]:
    X_all, y_all = [], []

    # SCUT-FBP5500 — téléchargement auto HuggingFace
    print("=== SCUT-FBP5500 ===")
    try:
        X, y = load_scut_fbp5500()
        print(f"  → {len(X)} samples chargés")
        X_all.append(X)
        y_all.append(y)
    except Exception as e:
        print(f"  SKIP: {e}")

    # Chicago Face Database — manuel
    print("=== Chicago Face Database ===")
    try:
        X, y = load_cfd()
        print(f"  → {len(X)} samples chargés")
        X_all.append(X)
        y_all.append(y)
    except FileNotFoundError as e:
        print(f"  SKIP (non téléchargé): {e}")
    except Exception as e:
        print(f"  SKIP: {e}")

    # MEBeauty — téléchargement auto HuggingFace
    print("=== MEBeauty ===")
    try:
        X, y = load_mebeauty()
        print(f"  → {len(X)} samples chargés")
        X_all.append(X)
        y_all.append(y)
    except Exception as e:
        print(f"  SKIP: {e}")

    if not X_all:
        raise RuntimeError("Aucun dataset disponible. Vérifier la connexion ou les fichiers.")

    return np.vstack(X_all), np.concatenate(y_all)


def train(X: np.ndarray, y: np.ndarray) -> Pipeline:
    model = Pipeline([
        ("scaler", StandardScaler()),
        ("ridge", Ridge(alpha=1.0)),
    ])
    model.fit(X, y)
    return model


def main():
    print("Loading datasets...")
    X, y = load_all_datasets()
    print(f"\nTotal: {len(X)} samples sur {X.shape[1]} features")

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
