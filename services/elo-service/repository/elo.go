package repository

import (
	"database/sql"
	"time"

	"github.com/lib/pq"
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

func (r *EloRepo) InsertMatchHistory(matchID, userID, opponentID string, won bool, eloChange int) error {
	_, err := r.db.Exec(`
		INSERT INTO elo.match_history (match_id, user_id, opponent_id, won, elo_change)
		VALUES ($1, $2, $3, $4, $5)
	`, matchID, userID, opponentID, won, eloChange)
	return err
}

type LeaderboardEntry struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Score    int    `json:"score"`
	Tier     string `json:"tier"`
	Rank     int    `json:"rank"`
}

func (r *EloRepo) GetLeaderboard(limit int) ([]LeaderboardEntry, error) {
	rows, err := r.db.Query(`
		SELECT r.user_id, p.username, r.score, r.tier,
		       RANK() OVER (ORDER BY r.score DESC) AS rank
		FROM elo.ratings r
		JOIN users.profiles p ON p.id = r.user_id
		ORDER BY r.score DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []LeaderboardEntry
	for rows.Next() {
		var e LeaderboardEntry
		if err := rows.Scan(&e.UserID, &e.Username, &e.Score, &e.Tier, &e.Rank); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

type MatchHistoryEntry struct {
	MatchID    string    `json:"match_id"`
	OpponentID string    `json:"opponent_id"`
	Opponent   string    `json:"opponent"`
	Won        bool      `json:"won"`
	EloChange  int       `json:"elo_change"`
	PlayedAt   time.Time `json:"played_at"`
}

func (r *EloRepo) GetMatchHistory(userID string, limit int) ([]MatchHistoryEntry, error) {
	rows, err := r.db.Query(`
		SELECT h.match_id, h.opponent_id, p.username, h.won, h.elo_change, h.played_at
		FROM elo.match_history h
		JOIN users.profiles p ON p.id = h.opponent_id
		WHERE h.user_id = $1
		ORDER BY h.played_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var entries []MatchHistoryEntry
	for rows.Next() {
		var e MatchHistoryEntry
		if err := rows.Scan(&e.MatchID, &e.OpponentID, &e.Opponent, &e.Won, &e.EloChange, &e.PlayedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, nil
}

type DuelRequest struct {
	ID                string
	ChallengerID      string
	ChallengerName    string
	ChallengedID      string
	ChallengerPhotos  []string
	Status            string
	MatchID           *string
	CreatedAt         string
}

func (r *EloRepo) CreateDuelRequest(challengerID, challengedID string, photoIDs []string) (string, error) {
	var id string
	err := r.db.QueryRow(`
		INSERT INTO elo.duel_requests (challenger_id, challenged_id, challenger_photos)
		VALUES ($1, $2, $3) RETURNING id
	`, challengerID, challengedID, pq.Array(photoIDs)).Scan(&id)
	return id, err
}

func (r *EloRepo) ListPendingDuels(userID string) ([]DuelRequest, error) {
	rows, err := r.db.Query(`
		SELECT dr.id, dr.challenger_id, p.username, dr.challenger_photos, dr.created_at
		FROM elo.duel_requests dr
		JOIN users.profiles p ON p.id = dr.challenger_id
		WHERE dr.challenged_id = $1 AND dr.status = 'pending'
		ORDER BY dr.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var duels []DuelRequest
	for rows.Next() {
		var d DuelRequest
		if err := rows.Scan(&d.ID, &d.ChallengerID, &d.ChallengerName, pq.Array(&d.ChallengerPhotos), &d.CreatedAt); err != nil {
			return nil, err
		}
		duels = append(duels, d)
	}
	return duels, nil
}

func (r *EloRepo) ResolveDuelRequest(duelID, matchID string) error {
	_, err := r.db.Exec(`
		UPDATE elo.duel_requests SET status = 'accepted', match_id = $2 WHERE id = $1
	`, duelID, matchID)
	return err
}

func (r *EloRepo) DeclineDuelRequest(duelID string) error {
	_, err := r.db.Exec(`UPDATE elo.duel_requests SET status = 'declined' WHERE id = $1`, duelID)
	return err
}

func (r *EloRepo) GetDuelRequest(duelID string) (*DuelRequest, error) {
	var d DuelRequest
	err := r.db.QueryRow(`
		SELECT id, challenger_id, challenged_id, challenger_photos, status FROM elo.duel_requests WHERE id = $1
	`, duelID).Scan(&d.ID, &d.ChallengerID, &d.ChallengedID, pq.Array(&d.ChallengerPhotos), &d.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &d, err
}

func (r *EloRepo) GetPhotoScore(photoID string) (float64, error) {
	var score float64
	err := r.db.QueryRow(`SELECT COALESCE(chad_score, 0) FROM users.photos WHERE id = $1`, photoID).Scan(&score)
	return score, err
}

type FeedEntry struct {
	MatchID   string    `json:"match_id"`
	PlayerAID string    `json:"player_a_id"`
	PlayerA   string    `json:"player_a"`
	PlayerBID string    `json:"player_b_id"`
	PlayerB   string    `json:"player_b"`
	WinnerID  string    `json:"winner_id"`
	S3KeyA    string    `json:"s3key_a"`
	S3KeyB    string    `json:"s3key_b"`
	ScoreA    float64   `json:"score_a"`
	ScoreB    float64   `json:"score_b"`
	PlayedAt  time.Time `json:"played_at"`
}

func (r *EloRepo) GetFeed(userID string, limit int) ([]FeedEntry, error) {
	rows, err := r.db.Query(`
		SELECT
			m.id, m.player_a, pa.username, m.player_b, pb.username,
			COALESCE(m.winner_id::text, ''),
			COALESCE(ph_a.s3_key, ''), COALESCE(ph_b.s3_key, ''),
			COALESCE(ph_a.chad_score, 0), COALESCE(ph_b.chad_score, 0),
			m.created_at
		FROM elo.matches m
		JOIN users.profiles pa ON pa.id = m.player_a
		JOIN users.profiles pb ON pb.id = m.player_b
		LEFT JOIN elo.rounds r ON r.match_id = m.id AND r.round_number = 1
		LEFT JOIN users.photos ph_a ON ph_a.id = r.photo_a
		LEFT JOIN users.photos ph_b ON ph_b.id = r.photo_b
		WHERE m.status = 'completed'
		  AND (
		    m.player_a = $1 OR m.player_b = $1
		    OR m.player_a IN (
		      SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
		      FROM users.friendships WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
		    )
		    OR m.player_b IN (
		      SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
		      FROM users.friendships WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
		    )
		  )
		ORDER BY m.created_at DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var feed []FeedEntry
	for rows.Next() {
		var e FeedEntry
		if err := rows.Scan(
			&e.MatchID, &e.PlayerAID, &e.PlayerA, &e.PlayerBID, &e.PlayerB,
			&e.WinnerID, &e.S3KeyA, &e.S3KeyB, &e.ScoreA, &e.ScoreB, &e.PlayedAt,
		); err != nil {
			return nil, err
		}
		feed = append(feed, e)
	}
	return feed, nil
}
