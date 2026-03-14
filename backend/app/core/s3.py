import boto3
import os
import uuid
from fastapi import UploadFile

S3_BUCKET = os.getenv("S3_BUCKET", "7basic")
S3_REGION = os.getenv("S3_REGION", "eu-north-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

s3_client = boto3.client(
    "s3",
    region_name=S3_REGION,
    aws_access_key_id=AWS_ACCESS_KEY_ID,
    aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
)


async def upload_file_to_s3(file: UploadFile, folder: str = "qr-codes") -> str:
    ext = file.filename.split(".")[-1].lower()
    key = f"{folder}/{uuid.uuid4()}.{ext}"

    content_type = file.content_type or "image/png"
    file_bytes = await file.read()

    s3_client.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )

    # Return presigned URL (valid for 7 days) since bucket doesn't allow public ACLs
    presigned_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=604800,  # 7 days
    )
    return presigned_url
