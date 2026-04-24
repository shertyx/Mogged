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
    black_img = np.zeros((300, 300, 3), dtype=np.uint8)
    with pytest.raises(ValueError, match="No face detected"):
        extract_features(black_img)

def test_extract_features_keys():
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
