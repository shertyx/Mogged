import pytest
from unittest.mock import MagicMock, patch


def test_upload_photo_returns_key():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient(
            endpoint="localhost:9000",
            access_key="minioadmin",
            secret_key="minioadmin123",
            bucket="test-bucket",
        )
        key = client.upload_photo(b"fake_image_bytes", "abc123", "jpg")
        assert key == "photos/abc123.jpg"
        mock_s3.put_object.assert_called_once()


def test_get_signed_url_calls_presigned():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "http://minio/signed"
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient("localhost:9000", "key", "secret", "bucket")
        url = client.get_signed_url("photos/abc123.jpg", expiry=3600)
        assert url == "http://minio/signed"


def test_delete_photo_calls_delete():
    with patch("storage.boto3") as mock_boto3:
        mock_s3 = MagicMock()
        mock_boto3.client.return_value = mock_s3
        from storage import StorageClient
        client = StorageClient("localhost:9000", "key", "secret", "bucket")
        client.delete_photo("photos/abc123.jpg")
        mock_s3.delete_object.assert_called_once_with(
            Bucket="bucket", Key="photos/abc123.jpg"
        )
