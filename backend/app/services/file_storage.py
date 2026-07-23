"""Disk storage for uploaded invoice originals and generated thumbnails."""
import logging
import shutil
import uuid
from pathlib import Path

import aiofiles
from fastapi import UploadFile

from app.core.config import Settings
from app.core.exceptions import FileTooLargeError

logger = logging.getLogger(__name__)

# Read/write in chunks so a 1000-file upload session never holds a whole
# file in memory at once.
_CHUNK_SIZE = 1024 * 1024  # 1 MB


def ensure_root_storage_dir(settings: Settings) -> None:
    settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)


def ensure_client_storage_dirs(settings: Settings, client_id: str) -> None:
    settings.client_originals_dir(client_id).mkdir(parents=True, exist_ok=True)
    settings.client_thumbnails_dir(client_id).mkdir(parents=True, exist_ok=True)


def delete_client_storage_dir(settings: Settings, client_id: str) -> None:
    shutil.rmtree(settings.client_dir(client_id), ignore_errors=True)


def build_stored_filename(extension: str) -> str:
    return f"{uuid.uuid4().hex}.{extension}"


async def save_upload_stream(upload_file: UploadFile, destination: Path, max_size_bytes: int) -> int:
    """Stream an UploadFile to disk, enforcing a max size. Returns bytes written."""
    total_bytes = 0
    try:
        async with aiofiles.open(destination, "wb") as out_file:
            while chunk := await upload_file.read(_CHUNK_SIZE):
                total_bytes += len(chunk)
                if total_bytes > max_size_bytes:
                    raise FileTooLargeError(max_size_bytes // (1024 * 1024))
                await out_file.write(chunk)
    except FileTooLargeError:
        destination.unlink(missing_ok=True)
        raise
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    finally:
        await upload_file.close()
    return total_bytes


def delete_file_if_exists(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete file %s", path, exc_info=True)
