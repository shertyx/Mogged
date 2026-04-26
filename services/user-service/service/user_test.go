package service_test

import (
	"testing"

	"github.com/mogged/user-service/repository"
	"github.com/mogged/user-service/service"
)

type mockRepo struct {
	photoCount  int
	uploadCount int
}

func (m *mockRepo) CountPhotos(userID string) (int, error)          { return m.photoCount, nil }
func (m *mockRepo) CountUploadsLastHour(userID string) (int, error) { return m.uploadCount, nil }
func (m *mockRepo) AddUploadRecord(userID string) error             { return nil }
func (m *mockRepo) InsertPhoto(userID, s3Key, hash string) (string, error) {
	return "photo-uuid", nil
}
func (m *mockRepo) GetProfile(userID string) (map[string]interface{}, error) { return nil, nil }
func (m *mockRepo) UpsertProfile(userID, username string, consentAI bool) error { return nil }
func (m *mockRepo) ListPhotos(userID string) ([]repository.Photo, error) { return nil, nil }
func (m *mockRepo) DeletePhoto(photoID, userID string) (string, error)  { return "s3key", nil }
func (m *mockRepo) UpdatePhotoScore(photoID string, score float64, features []byte) error {
	return nil
}
func (m *mockRepo) SetUsername(userID, username string) error                        { return nil }
func (m *mockRepo) GetUserByUsername(username string) (string, error)                { return "", nil }
func (m *mockRepo) ListUnanalyzedPhotos(userID string) ([]repository.Photo, error)   { return nil, nil }
func (m *mockRepo) MarkPhotoUsed(photoID string) error                               { return nil }
func (m *mockRepo) GetPhotoByID(photoID string) (*repository.Photo, error)           { return nil, nil }

func TestCanUpload_UnderLimit(t *testing.T) {
	svc := service.NewUserService(&mockRepo{photoCount: 5, uploadCount: 2})
	err := svc.CanUpload("user-1")
	if err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestCanUpload_TooManyPhotos(t *testing.T) {
	svc := service.NewUserService(&mockRepo{photoCount: 10, uploadCount: 0})
	err := svc.CanUpload("user-1")
	if err == nil {
		t.Fatal("expected error for 10 photos")
	}
}

func TestCanUpload_TooManyUploadsThisHour(t *testing.T) {
	svc := service.NewUserService(&mockRepo{photoCount: 3, uploadCount: 5})
	err := svc.CanUpload("user-1")
	if err == nil {
		t.Fatal("expected error for 5 uploads/hour")
	}
}
