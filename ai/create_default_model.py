"""
Crée un modèle par défaut avec des poids basés sur la littérature sur l'attractivité faciale.
À remplacer par train.py une fois le dataset disponible.
"""
import numpy as np
import joblib
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

# Poids relatifs par feature (littérature attractivité faciale)
# Ordre: symmetry, golden_ratio, jawline, eyes, nose, forehead
WEIGHTS = np.array([0.25, 0.20, 0.20, 0.15, 0.10, 0.10])

# Génère des données synthétiques cohérentes avec ces poids
np.random.seed(42)
n = 500
X = np.random.uniform(20, 80, size=(n, 6))
noise = np.random.normal(0, 5, n)
y = np.clip(X @ WEIGHTS + noise + (100 - WEIGHTS.sum() * 50), 0, 100)

model = Pipeline([
    ("scaler", StandardScaler()),
    ("ridge", Ridge(alpha=1.0)),
])
model.fit(X, y)

out = Path("models/model_v1.joblib")
out.parent.mkdir(exist_ok=True)
joblib.dump(model, out)
print(f"Default model saved to {out}")
print("NOTE: Ce modèle est basé sur des poids synthétiques.")
print("Lancez train.py avec le Chicago Face Database pour un vrai modèle.")
