package repository

import (
	"database/sql"
	"time"

	_ "github.com/lib/pq"
)

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) UpsertUser(googleID, email string) (string, error) {
	var id string
	err := r.db.QueryRow(`
		INSERT INTO auth.users (google_id, email)
		VALUES ($1, $2)
		ON CONFLICT (google_id) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, googleID, email).Scan(&id)
	return id, err
}

func (r *UserRepo) SaveRefreshToken(userID, token string, ttlSeconds int) error {
	expiresAt := time.Now().Add(time.Duration(ttlSeconds) * time.Second)
	_, err := r.db.Exec(`
		INSERT INTO auth.refresh_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
	`, userID, token, expiresAt)
	return err
}

func (r *UserRepo) GetUserByRefreshToken(token string) (string, error) {
	var userID string
	err := r.db.QueryRow(`
		SELECT user_id FROM auth.refresh_tokens
		WHERE token = $1 AND expires_at > NOW()
	`, token).Scan(&userID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return userID, err
}

func (r *UserRepo) DeleteRefreshToken(token string) error {
	_, err := r.db.Exec(`DELETE FROM auth.refresh_tokens WHERE token = $1`, token)
	return err
}
