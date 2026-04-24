package repository

import (
	"database/sql"

	_ "github.com/lib/pq"
)

type Photo struct {
	ID         string
	UserID     string
	S3Key      string
	ChadScore  *float64
	Features   []byte
	Hash       string
	Used       bool
	UploadedAt string
}

type UserRepo struct {
	db *sql.DB
}

func NewUserRepo(db *sql.DB) *UserRepo {
	return &UserRepo{db: db}
}

func (r *UserRepo) GetProfile(userID string) (map[string]interface{}, error) {
	row := r.db.QueryRow(`
		SELECT id, username, avatar_url, consent_ai FROM users.profiles WHERE id = $1
	`, userID)
	var id, username string
	var avatarURL *string
	var consentAI bool
	if err := row.Scan(&id, &username, &avatarURL, &consentAI); err == sql.ErrNoRows {
		return nil, nil
	} else if err != nil {
		return nil, err
	}
	return map[string]interface{}{
		"id": id, "username": username,
		"avatar_url": avatarURL, "consent_ai": consentAI,
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
