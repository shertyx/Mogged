import json
import psycopg2
from psycopg2.extras import RealDictCursor


class DBClient:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def _conn(self):
        return psycopg2.connect(self._dsn)

    def get_cached_score(self, photo_hash: str) -> dict | None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT chad_score, row_to_json(face.scores) FROM face.scores WHERE photo_hash = %s",
                    (photo_hash,),
                )
                row = cur.fetchone()
                if row is None:
                    return None
                return {"chad_score": row[0], "features": row[1]}

    def save_score(
        self,
        photo_hash: str,
        photo_id: str,
        chad_score: float,
        features: dict[str, float],
    ) -> None:
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO face.scores
                        (photo_hash, photo_id, chad_score, symmetry, golden_ratio,
                         jawline, eyes, nose, forehead)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (photo_hash) DO NOTHING
                    """,
                    (
                        photo_hash,
                        photo_id,
                        chad_score,
                        features["symmetry"],
                        features["golden_ratio"],
                        features["jawline"],
                        features["eyes"],
                        features["nose"],
                        features["forehead"],
                    ),
                )
            conn.commit()
