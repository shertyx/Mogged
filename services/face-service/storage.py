import boto3
from botocore.client import Config


class StorageClient:
    def __init__(self, endpoint: str, access_key: str, secret_key: str, bucket: str, public_endpoint: str = ""):
        self._bucket = bucket
        self._s3 = boto3.client(
            "s3",
            endpoint_url=f"http://{endpoint}",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
        )
        # Separate client for presigning — uses the browser-accessible host
        public = public_endpoint or endpoint
        self._s3_public = boto3.client(
            "s3",
            endpoint_url=f"http://{public}",
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version="s3v4"),
        )
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            self._s3.head_bucket(Bucket=self._bucket)
        except Exception:
            self._s3.create_bucket(Bucket=self._bucket)

    def upload_photo(self, data: bytes, hash_md5: str, ext: str) -> str:
        key = f"photos/{hash_md5}.{ext}"
        self._s3.put_object(Bucket=self._bucket, Key=key, Body=data)
        return key

    def get_signed_url(self, key: str, expiry: int = 3600) -> str:
        return self._s3_public.generate_presigned_url(
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expiry,
        )

    def download_photo(self, key: str) -> bytes:
        response = self._s3.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()

    def delete_photo(self, key: str) -> None:
        self._s3.delete_object(Bucket=self._bucket, Key=key)
