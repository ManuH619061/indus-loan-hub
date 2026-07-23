"""Pytest fixtures.

The DB/storage location env vars must be set *before* `app.main` (and the
modules it imports) are first imported, since `app/db/session.py` builds its
SQLAlchemy engine at import time and `app/core/config.get_settings` is
`lru_cache`d. So this module sets them at collection time, before any `app.*`
import below.
"""
import os
import tempfile

_TEST_ROOT = tempfile.mkdtemp(prefix="invoice_app_test_")
os.environ["DATABASE_URL"] = f"sqlite:///{_TEST_ROOT}/test.db"
os.environ["STORAGE_DIR"] = f"{_TEST_ROOT}/storage"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as test_client:
        yield test_client
