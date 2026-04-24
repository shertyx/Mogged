import pytest
from unittest.mock import MagicMock, patch


def test_get_cached_score_returns_none_if_missing():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("unknownhash")
        assert result is None


def test_get_cached_score_returns_score_if_exists():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = (75.5, '{"symmetry": 80.0}')
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("knownhash")
        assert result["chad_score"] == 75.5


def test_save_score_inserts_row():
    with patch("db.psycopg2") as mock_pg:
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
        mock_pg.connect.return_value = mock_conn
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        client.save_score(
            photo_hash="abc123",
            photo_id="uuid-1",
            chad_score=82.0,
            features={"symmetry": 80.0, "golden_ratio": 75.0, "jawline": 90.0,
                       "eyes": 70.0, "nose": 85.0, "forehead": 65.0},
        )
        mock_cursor.execute.assert_called_once()
        mock_conn.commit.assert_called_once()
