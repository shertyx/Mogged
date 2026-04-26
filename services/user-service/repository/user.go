package repository

import (
	"database/sql"
	"encoding/json"
	"fmt"

	_ "github.com/lib/pq"
)

type Photo struct {
	ID         string          `json:"id"`
	UserID     string          `json:"user_id"`
	S3Key      string          `json:"s3_key"`
	ChadScore  *float64        `json:"chad_score"`
	Features   json.RawMessage `json:"features"`
	Hash       string          `json:"hash"`
	Used       bool            `json:"used"`
	UploadedAt string          `json:"uploaded_at"`
}

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) GetProfile(userID string) (map[string]interface{}, error) {
	row := r.db.QueryRow(`
		SELECT p.id, p.username, p.avatar_url, p.consent_ai, p.username_set, p.username_changes, u.email
		FROM users.profiles p
		JOIN auth.users u ON u.id = p.id
		WHERE p.id = $1
	`, userID)
	var id, username, email string
	var avatarURL *string
	var consentAI, usernameSet bool
	var usernameChanges int
	if err := row.Scan(&id, &username, &avatarURL, &consentAI, &usernameSet, &usernameChanges, &email); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"id":               id,
		"username":         username,
		"avatar_url":       avatarURL,
		"consent_ai":       consentAI,
		"username_set":     usernameSet,
		"username_changes": usernameChanges,
		"email":            email,
	}, nil
}

func (r *UserRepo) UpsertProfile(userID, username string, consentAI bool) error {
	_, err := r.db.Exec(`
		INSERT INTO users.profiles (id, username, consent_ai)
		VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET username = $2, consent_ai = $3, updated_at = NOW()
	`, userID, username, consentAI)
	return err
}

func (r *UserRepo) SetUsername(userID, username string) error {
	res, err := r.db.Exec(`
		UPDATE users.profiles
		SET username = $2, username_set = TRUE, username_changes = username_changes + 1, updated_at = NOW()
		WHERE id = $1 AND username_changes < 3
	`, userID, username)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("username change limit reached (max 3)")
	}
	return nil
}

func (r *UserRepo) CountPhotos(userID string) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM users.photos WHERE user_id = $1 AND used = false
	`, userID).Scan(&count)
	return count, err
}

func (r *UserRepo) CountUploadsLastHour(userID string) (int, error) {
	var count int
	err := r.db.QueryRow(`
		SELECT COUNT(*) FROM users.upload_rate
		WHERE user_id = $1 AND uploaded_at > NOW() - INTERVAL '1 hour'
	`, userID).Scan(&count)
	return count, err
}

func (r *UserRepo) AddUploadRecord(userID string) error {
	_, err := r.db.Exec(`INSERT INTO users.upload_rate (user_id) VALUES ($1)`, userID)
	return err
}

func (r *UserRepo) InsertPhoto(userID, s3Key, hash string) (string, error) {
	var id string
	err := r.db.QueryRow(`
		INSERT INTO users.photos (user_id, s3_key, hash)
		VALUES ($1, $2, $3)
		ON CONFLICT (hash) DO UPDATE SET hash = EXCLUDED.hash
		RETURNING id
	`, userID, s3Key, hash).Scan(&id)
	return id, err
}

func (r *UserRepo) ListPhotos(userID string) ([]Photo, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, s3_key, chad_score, features, hash, used, uploaded_at
		FROM users.photos WHERE user_id = $1 AND used = false
		ORDER BY uploaded_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var photos []Photo
	for rows.Next() {
		var p Photo
		if err := rows.Scan(&p.ID, &p.UserID, &p.S3Key, &p.ChadScore,
			&p.Features, &p.Hash, &p.Used, &p.UploadedAt); err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	return photos, nil
}

func (r *UserRepo) DeletePhoto(photoID, userID string) (string, error) {
	var s3Key string
	err := r.db.QueryRow(`
		DELETE FROM users.photos WHERE id = $1 AND user_id = $2 RETURNING s3_key
	`, photoID, userID).Scan(&s3Key)
	return s3Key, err
}

func (r *UserRepo) UpdatePhotoScore(photoID string, chadScore float64, features []byte) error {
	_, err := r.db.Exec(`
		UPDATE users.photos SET chad_score = $1, features = $2 WHERE id = $3
	`, chadScore, features, photoID)
	return err
}

type Friend struct {
	UserID   string `json:"user_id"`
	Username string `json:"username"`
	Status   string `json:"status"`
}

func (r *UserRepo) SendFriendRequest(requesterID, addresseeID string) error {
	_, err := r.db.Exec(`
		INSERT INTO users.friendships (requester_id, addressee_id)
		VALUES ($1, $2)
		ON CONFLICT DO NOTHING
	`, requesterID, addresseeID)
	return err
}

func (r *UserRepo) AcceptFriendRequest(userID, requesterID string) error {
	_, err := r.db.Exec(`
		UPDATE users.friendships SET status = 'accepted'
		WHERE requester_id = $2 AND addressee_id = $1 AND status = 'pending'
	`, userID, requesterID)
	return err
}

func (r *UserRepo) RemoveFriend(userID, otherID string) error {
	_, err := r.db.Exec(`
		DELETE FROM users.friendships
		WHERE (requester_id = $1 AND addressee_id = $2)
		   OR (requester_id = $2 AND addressee_id = $1)
	`, userID, otherID)
	return err
}

func (r *UserRepo) ListFriends(userID string) ([]Friend, error) {
	rows, err := r.db.Query(`
		SELECT
			CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END AS friend_id,
			p.username,
			f.status
		FROM users.friendships f
		JOIN users.profiles p ON p.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
		WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var friends []Friend
	for rows.Next() {
		var f Friend
		if err := rows.Scan(&f.UserID, &f.Username, &f.Status); err != nil {
			return nil, err
		}
		friends = append(friends, f)
	}
	return friends, nil
}

func (r *UserRepo) ListPendingRequests(userID string) ([]Friend, error) {
	rows, err := r.db.Query(`
		SELECT f.requester_id, p.username, f.status
		FROM users.friendships f
		JOIN users.profiles p ON p.id = f.requester_id
		WHERE f.addressee_id = $1 AND f.status = 'pending'
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var friends []Friend
	for rows.Next() {
		var f Friend
		if err := rows.Scan(&f.UserID, &f.Username, &f.Status); err != nil {
			return nil, err
		}
		friends = append(friends, f)
	}
	return friends, nil
}

func (r *UserRepo) FindUserByUsername(username string) (string, error) {
	var id string
	err := r.db.QueryRow(`SELECT id FROM users.profiles WHERE username = $1`, username).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return id, err
}
