package service

import (
	"fmt"

	"github.com/mogged/user-service/repository"
)

type UserRepoIface interface {
	CountPhotos(userID string) (int, error)
	CountUploadsLastHour(userID string) (int, error)
	AddUploadRecord(userID string) error
	InsertPhoto(userID, s3Key, hash string) (string, error)
	GetProfile(userID string) (map[string]interface{}, error)
	UpsertProfile(userID, username string, consentAI bool) error
	ListPhotos(userID string) ([]repository.Photo, error)
	DeletePhoto(photoID, userID string) (string, error)
	UpdatePhotoScore(photoID string, score float64, features []byte) error
	SetUsername(userID, username string) error
}

type UserService struct {
	repo UserRepoIface
}

func NewUserService(repo UserRepoIface) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) CanUpload(userID string) error {
	count, err := s.repo.CountPhotos(userID)
	if err != nil {
		return err
	}
	if count >= 10 {
		return fmt.Errorf("max 10 photos reached — delete one first")
	}
	uploads, err := s.repo.CountUploadsLastHour(userID)
	if err != nil {
		return err
	}
	if uploads >= 5 {
		return fmt.Errorf("max 5 uploads per hour reached")
	}
	return nil
}

func (s *UserService) RegisterUpload(userID, s3Key, hash string) (string, error) {
	if err := s.repo.AddUploadRecord(userID); err != nil {
		return "", err
	}
	return s.repo.InsertPhoto(userID, s3Key, hash)
}

func (s *UserService) GetProfile(userID string) (map[string]interface{}, error) {
	return s.repo.GetProfile(userID)
}

func (s *UserService) UpsertProfile(userID, username string, consentAI bool) error {
	return s.repo.UpsertProfile(userID, username, consentAI)
}

func (s *UserService) ListPhotos(userID string) ([]repository.Photo, error) {
	return s.repo.ListPhotos(userID)
}

func (s *UserService) DeletePhoto(photoID, userID string) (string, error) {
	return s.repo.DeletePhoto(photoID, userID)
}

func (s *UserService) UpdatePhotoScore(photoID string, score float64, features []byte) error {
	return s.repo.UpdatePhotoScore(photoID, score, features)
}

func (s *UserService) SetUsername(userID, username string) error {
	if len(username) < 3 || len(username) > 20 {
		return fmt.Errorf("username must be 3–20 characters")
	}
	for _, c := range username {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return fmt.Errorf("username may only contain letters, digits and underscores")
		}
	}
	return s.repo.SetUsername(userID, username)
}
