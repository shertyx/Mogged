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
    left_eye_center = pts[36:42].mean(axis=0)
    right_eye_center = pts[42:48].mean(axis=0)
    center_x = (left_eye_center[0] + right_eye_center[0]) / 2

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
    return normalize_score(mean_dev, 0.5, 0.0)


def _golden_ratio_score(pts: np.ndarray) -> float:
    face_width = float(np.linalg.norm(pts[0] - pts[16]))
    face_height = float(np.linalg.norm(pts[8] - pts[27]))
    if face_height == 0:
        return 50.0
    ratio = face_width / face_height
    golden = 0.618
    deviation = abs(ratio - golden)
    return normalize_score(deviation, 0.4, 0.0)


def _jawline_score(pts: np.ndarray) -> float:
    jaw_width = float(np.linalg.norm(pts[4] - pts[12]))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = jaw_width / face_width
    deviation = abs(ratio - 0.7)
    return normalize_score(deviation, 0.3, 0.0)


def _eyes_score(pts: np.ndarray) -> float:
    left_center = pts[36:42].mean(axis=0)
    right_center = pts[42:48].mean(axis=0)
    eye_spacing = float(np.linalg.norm(left_center - right_center))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = eye_spacing / face_width
    deviation = abs(ratio - 0.46)
    return normalize_score(deviation, 0.2, 0.0)


def _nose_score(pts: np.ndarray) -> float:
    nose_width = float(np.linalg.norm(pts[31] - pts[35]))
    face_width = float(np.linalg.norm(pts[0] - pts[16])) or 1
    ratio = nose_width / face_width
    deviation = abs(ratio - 0.25)
    return normalize_score(deviation, 0.2, 0.0)


def _forehead_score(pts: np.ndarray) -> float:
    brow_y = min(pts[19][1], pts[24][1])
    chin_y = pts[8][1]
    nose_y = pts[27][1]
    face_height = float(abs(chin_y - brow_y)) or 1
    upper_third = float(abs(nose_y - brow_y))
    ratio = upper_third / face_height
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
