import pytest
from unittest.mock import MagicMock, patch, call


def _make_mock_pg(fetchone_return=None):
    mock_pg = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = fetchone_return
    mock_conn = MagicMock()
    mock_conn.__enter__ = lambda s: mock_conn
    mock_conn.__exit__ = MagicMock(return_value=False)
    mock_conn.cursor.return_value.__enter__ = lambda s: mock_cursor
    mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    mock_pg.connect.return_value = mock_conn
    return mock_pg, mock_conn, mock_cursor


def test_get_cached_score_returns_none_if_missing():
    mock_pg, mock_conn, mock_cursor = _make_mock_pg(fetchone_return=None)
    with patch("db.psycopg2", mock_pg):
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("unknownhash")
        assert result is None
        mock_cursor.execute.assert_called_once()


def test_get_cached_score_returns_score_if_exists():
    mock_pg, mock_conn, mock_cursor = _make_mock_pg(fetchone_return=(75.5, '{"symmetry": 80.0}'))
    with patch("db.psycopg2", mock_pg):
        from db import DBClient
        client = DBClient("postgresql://user:pass@localhost/db")
        result = client.get_cached_score("knownhash")
        assert result["chad_score"] == 75.5


def test_save_score_inserts_row():
    mock_pg, mock_conn, mock_cursor = _make_mock_pg()
    with patch("db.psycopg2", mock_pg):
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
