import pytest
import numpy as np
from unittest.mock import MagicMock, patch


def test_analyse_photo_uses_cache():
    mock_db = MagicMock()
    mock_db.get_cached_score.return_value = {
        "chad_score": 75.0,
        "features": {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0}
    }
    mock_storage = MagicMock()
    mock_storage.get_signed_url.return_value = "http://minio/signed"

    from pipeline import AnalysisPipeline
    p = AnalysisPipeline(db=mock_db, storage=mock_storage, model=MagicMock())
    result = p.analyse_photo(b"fake", "abc123", "jpg", "photo-uuid")

    assert result["chad_score"] == 75.0
    mock_db.get_cached_score.assert_called_once_with("abc123")
    mock_db.save_score.assert_not_called()


def test_analyse_photo_runs_pipeline_on_cache_miss():
    mock_db = MagicMock()
    mock_db.get_cached_score.return_value = None
    mock_storage = MagicMock()
    mock_storage.upload_photo.return_value = "photos/abc123.jpg"
    mock_storage.get_signed_url.return_value = "http://minio/signed"
    mock_model = MagicMock()
    mock_model.predict.return_value = np.array([82.0])

    fake_features = {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0}

    with patch("pipeline.extract_features", return_value=fake_features), \
         patch("pipeline.cv2.imdecode", return_value=np.zeros((224, 224, 3), dtype=np.uint8)):
        from pipeline import AnalysisPipeline
        p = AnalysisPipeline(db=mock_db, storage=mock_storage, model=mock_model)
        result = p.analyse_photo(b"fake_jpg_bytes", "abc123", "jpg", "photo-uuid")

    assert result["chad_score"] == pytest.approx(82.0)
    assert "features" in result
    assert "signed_url" in result
    mock_db.save_score.assert_called_once()
    mock_storage.upload_photo.assert_called_once()
