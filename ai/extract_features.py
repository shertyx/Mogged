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
    return normalize_score(mean_dev, 0.35, 0.0)


def _golden_ratio_score(pts: np.ndarray) -> float:
    # Rule of thirds: face splits into 3 equal vertical zones
    # brow_top → eye center → nose base → chin should be roughly equal
    brow_top_y = float(np.min(pts[17:27, 1]))
    eye_center_y = float(pts[36:48].mean(axis=0)[1])
    nose_base_y = float(pts[33][1])
    chin_y = float(pts[8][1])

    upper = abs(eye_center_y - brow_top_y)
    middle = abs(nose_base_y - eye_center_y)
    lower = abs(chin_y - nose_base_y)
    avg = (upper + middle + lower) / 3 or 1

    variance = (abs(upper - avg) + abs(middle - avg) + abs(lower - avg)) / (3 * avg)
    return normalize_score(variance, 0.35, 0.0)


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
    # Forehead height = brow to estimated hairline (extrapolated from face proportions)
    brow_y = float(min(pts[19][1], pts[24][1]))
    chin_y = float(pts[8][1])
    nose_base_y = float(pts[33][1])
    # Lower face height (chin to nose base) as reference
    lower_face = abs(chin_y - nose_base_y) or 1
    # Brow to nose base = mid face
    mid_face = abs(nose_base_y - brow_y)
    # Ideal: brow-to-nose ≈ 0.9-1.1× lower face (balanced thirds)
    ratio = mid_face / lower_face
    deviation = abs(ratio - 1.0)
    return normalize_score(deviation, 0.4, 0.0)


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
