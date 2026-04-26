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
	SendFriendRequest(requesterID, addresseeID string) error
	AcceptFriendRequest(userID, requesterID string) error
	RemoveFriend(userID, otherID string) error
	ListFriends(userID string) ([]repository.Friend, error)
	ListPendingRequests(userID string) ([]repository.Friend, error)
	FindUserByUsername(username string) (string, error)
}

type UserService struct {
	repo UserRepoIface
}

func NewUserService(repo UserRepoIface) *UserService {
	return &UserService{repo: repo}
}

func (s *UserService) CanUpload(userID string) error {
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

func (s *UserService) SendFriendRequest(requesterID, addresseeID string) error {
	return s.repo.SendFriendRequest(requesterID, addresseeID)
}

func (s *UserService) AcceptFriendRequest(userID, requesterID string) error {
	return s.repo.AcceptFriendRequest(userID, requesterID)
}

func (s *UserService) RemoveFriend(userID, otherID string) error {
	return s.repo.RemoveFriend(userID, otherID)
}

func (s *UserService) ListFriends(userID string) ([]repository.Friend, error) {
	return s.repo.ListFriends(userID)
}

func (s *UserService) ListPendingRequests(userID string) ([]repository.Friend, error) {
	return s.repo.ListPendingRequests(userID)
}

func (s *UserService) FindUserByUsername(username string) (string, error) {
	return s.repo.FindUserByUsername(username)
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
