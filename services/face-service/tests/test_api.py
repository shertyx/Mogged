import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch


def make_client():
    with patch("main.AnalysisPipeline") as MockPipeline, \
         patch("main.DBClient"), \
         patch("main.StorageClient"), \
         patch("main.joblib"):
        mock_pipeline_instance = MagicMock()
        MockPipeline.return_value = mock_pipeline_instance
        from main import app
        return TestClient(app), mock_pipeline_instance


def test_health():
    client, _ = make_client()
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_upload_photo_missing_file():
    client, _ = make_client()
    response = client.post("/photos/analyze", data={"photo_id": "uuid-1"})
    assert response.status_code == 422


def test_upload_photo_success():
    client, mock_pipeline = make_client()
    mock_pipeline.analyse_photo.return_value = {
        "chad_score": 82.0,
        "features": {"symmetry": 80.0, "golden_ratio": 70.0,
                     "jawline": 75.0, "eyes": 60.0, "nose": 80.0, "forehead": 65.0},
        "signed_url": "http://minio/signed",
    }
    import io
    fake_image = io.BytesIO(b"fakeimagebytes")
    response = client.post(
        "/photos/analyze",
        data={"photo_id": "uuid-1"},
        files={"file": ("test.jpg", fake_image, "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["chad_score"] == 82.0
    assert "features" in body
    assert "signed_url" in body
