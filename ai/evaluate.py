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
