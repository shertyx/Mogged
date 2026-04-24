package repository

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

type Match struct {
	ID        string
	PlayerA   string
	PlayerB   string
	WinnerID  *string
	Mode      string
	Status    string
	ExpiresAt *time.Time
	CreatedAt time.Time
}

type EloRecord struct {
	UserID    string
	Score     int
	Tier      string
	UpdatedAt time.Time
}

type EloRepo struct {
	db *sql.DB
}

func NewEloRepo(db *sql.DB) *EloRepo {
	return &EloRepo{db: db}
}

func (r *EloRepo) GetElo(userID string) (int, error) {
	var score int
	err := r.db.QueryRow(`SELECT score FROM elo.ratings WHERE user_id = $1`, userID).Scan(&score)
	if err == sql.ErrNoRows {
		return 1000, nil
	}
	return score, err
}

func (r *EloRepo) UpsertElo(userID string, score int, tier string) error {
	_, err := r.db.Exec(`
		INSERT INTO elo.ratings (user_id, score, tier)
		VALUES ($1, $2, $3)
		ON CONFLICT (user_id) DO UPDATE SET score = $2, tier = $3, updated_at = NOW()
	`, userID, score, tier)
	return err
}

func (r *EloRepo) CreateMatch(playerA, playerB, mode string, expiresAt *time.Time) (string, error) {
	var id string
	err := r.db.QueryRow(`
		INSERT INTO elo.matches (player_a, player_b, mode, status, expires_at)
		VALUES ($1, $2, $3, 'pending', $4)
		RETURNING id
	`, playerA, playerB, mode, expiresAt).Scan(&id)
	return id, err
}

func (r *EloRepo) GetMatch(matchID string) (*Match, error) {
	m := &Match{}
	err := r.db.QueryRow(`
		SELECT id, player_a, player_b, winner_id, mode, status, expires_at, created_at
		FROM elo.matches WHERE id = $1
	`, matchID).Scan(&m.ID, &m.PlayerA, &m.PlayerB, &m.WinnerID, &m.Mode, &m.Status, &m.ExpiresAt, &m.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return m, err
}

func (r *EloRepo) SetMatchReady(matchID string) error {
	_, err := r.db.Exec(`UPDATE elo.matches SET status = 'ready' WHERE id = $1`, matchID)
	return err
}

func (r *EloRepo) CompleteMatch(matchID, winnerID string) error {
	_, err := r.db.Exec(`
		UPDATE elo.matches SET status = 'completed', winner_id = $2 WHERE id = $1
	`, matchID, winnerID)
	return err
}

func (r *EloRepo) ExpireStaleMatches() ([]Match, error) {
	rows, err := r.db.Query(`
		UPDATE elo.matches SET status = 'expired'
		WHERE status = 'pending' AND expires_at < NOW()
		RETURNING id, player_a, player_b, winner_id, mode, status, expires_at, created_at
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var matches []Match
	for rows.Next() {
		var m Match
		if err := rows.Scan(&m.ID, &m.PlayerA, &m.PlayerB, &m.WinnerID, &m.Mode, &m.Status, &m.ExpiresAt, &m.CreatedAt); err != nil {
			return nil, err
		}
		matches = append(matches, m)
	}
	return matches, nil
}

func (r *EloRepo) InsertRound(matchID, photoA, photoB, winnerPhoto string, round int) error {
	_, err := r.db.Exec(`
		INSERT INTO elo.rounds (match_id, photo_a, photo_b, winner_photo, round_number)
		VALUES ($1, $2, $3, $4, $5)
	`, matchID, photoA, photoB, winnerPhoto, round)
	return err
}
