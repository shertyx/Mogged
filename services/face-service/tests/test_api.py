import pytest
from unittest.mock import MagicMock, patch
import importlib


def make_client():
    with patch("pipeline.AnalysisPipeline") as MockPipeline, \
         patch("pipeline.DBClient"), \
         patch("pipeline.StorageClient"), \
         patch("builtins.__import__", side_effect=lambda name, *args, **kwargs: __import__(name, *args, **kwargs)):
        mock_pipeline_instance = MagicMock()
        MockPipeline.return_value = mock_pipeline_instance

        import main
        importlib.reload(main)
        from fastapi.testclient import TestClient
        return TestClient(main.app), mock_pipeline_instance


def test_health():
    with patch.dict("os.environ", {
        "POSTGRES_DSN": "postgresql://u:p@localhost/db",
        "MINIO_ENDPOINT": "localhost:9000",
        "MINIO_ROOT_USER": "key",
        "MINIO_ROOT_PASSWORD": "secret",
        "MINIO_BUCKET": "bucket",
    }), patch("main.DBClient"), patch("main.StorageClient"), patch("main.joblib"), patch("main.AnalysisPipeline"):
        import main
        importlib.reload(main)
        from fastapi.testclient import TestClient
        client = TestClient(main.app)
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


def test_upload_photo_missing_file():
    with patch.dict("os.environ", {
        "POSTGRES_DSN": "postgresql://u:p@localhost/db",
        "MINIO_ENDPOINT": "localhost:9000",
        "MINIO_ROOT_USER": "key",
        "MINIO_ROOT_PASSWORD": "secret",
        "MINIO_BUCKET": "bucket",
    }), patch("main.DBClient"), patch("main.StorageClient"), patch("main.joblib"), patch("main.AnalysisPipeline"):
        import main
        importlib.reload(main)
        from fastapi.testclient import TestClient
        client = TestClient(main.app)
        response = client.post("/photos/analyze", data={"photo_id": "uuid-1"})
        assert response.status_code == 422
