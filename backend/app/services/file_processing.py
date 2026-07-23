"""Extracts page count + a preview thumbnail from an uploaded invoice file.

This is purely structural/visual inspection for the Upload module — it does
not read invoice content. OCR and field extraction are later modules.
"""
import logging
from dataclasses import dataclass
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image, UnidentifiedImageError

logger = logging.getLogger(__name__)

_IMAGE_EXTENSIONS = {"jpg", "jpeg", "png"}


@dataclass
class ExtractionResult:
    page_count: int | None
    thumbnail_bytes: bytes | None
    error_message: str | None

    @property
    def succeeded(self) -> bool:
        return self.error_message is None


def extract_metadata(file_path: Path, extension: str, thumbnail_max_dim: int) -> ExtractionResult:
    extension = extension.lower()
    if extension == "pdf":
        return _extract_pdf(file_path, thumbnail_max_dim)
    if extension in _IMAGE_EXTENSIONS:
        return _extract_image(file_path, thumbnail_max_dim)
    return ExtractionResult(
        page_count=None,
        thumbnail_bytes=None,
        error_message=f"Cannot generate a preview for '.{extension}' files.",
    )


def _extract_pdf(file_path: Path, thumbnail_max_dim: int) -> ExtractionResult:
    try:
        with fitz.open(file_path) as doc:
            page_count = doc.page_count
            if page_count == 0:
                return ExtractionResult(None, None, "PDF has no pages.")

            first_page = doc.load_page(0)
            rect = first_page.rect
            scale = thumbnail_max_dim / max(rect.width, rect.height)
            matrix = fitz.Matrix(scale, scale)
            pixmap = first_page.get_pixmap(matrix=matrix)
            thumbnail_bytes = pixmap.tobytes("jpg")
        return ExtractionResult(page_count=page_count, thumbnail_bytes=thumbnail_bytes, error_message=None)
    except Exception as exc:  # noqa: BLE001 - any malformed PDF should degrade to an error state, not a 500
        logger.warning("Failed to process PDF %s: %s", file_path, exc)
        return ExtractionResult(
            page_count=None,
            thumbnail_bytes=None,
            error_message="Unreadable scan: the PDF appears to be corrupted or password protected.",
        )


def _extract_image(file_path: Path, thumbnail_max_dim: int) -> ExtractionResult:
    try:
        with Image.open(file_path) as img:
            img.verify()
        # verify() leaves the file unusable for further ops, reopen fresh.
        with Image.open(file_path) as img:
            img = img.convert("RGB")
            img.thumbnail((thumbnail_max_dim, thumbnail_max_dim))
            from io import BytesIO

            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=85)
            thumbnail_bytes = buffer.getvalue()
        return ExtractionResult(page_count=1, thumbnail_bytes=thumbnail_bytes, error_message=None)
    except (UnidentifiedImageError, OSError) as exc:
        logger.warning("Failed to process image %s: %s", file_path, exc)
        return ExtractionResult(
            page_count=None,
            thumbnail_bytes=None,
            error_message="Unreadable scan: the image file appears to be corrupted.",
        )
