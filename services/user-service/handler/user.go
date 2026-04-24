package handler

import (
	"encoding/json"
	"net/http"

	"github.com/mogged/user-service/repository"
	"github.com/mogged/user-service/service"
)

type UserServiceIface interface {
	CanUpload(userID string) error
	RegisterUpload(userID, s3Key, hash string) (string, error)
	GetProfile(userID string) (map[string]interface{}, error)
	UpsertProfile(userID, username string, consentAI bool) error
	ListPhotos(userID string) ([]repository.Photo, error)
	DeletePhoto(photoID, userID string) (string, error)
	UpdatePhotoScore(photoID string, score float64, features []byte) error
}

type UserHandler struct {
	svc UserServiceIface
}

func NewUserHandler(svc UserServiceIface) *UserHandler {
	return &UserHandler{svc: svc}
}

func (h *UserHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	profile, err := h.svc.GetProfile(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if profile == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(profile)
}

func (h *UserHandler) UpsertProfile(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	var body struct {
		Username  string `json:"username"`
		ConsentAI bool   `json:"consent_ai"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.UpsertProfile(userID, body.Username, body.ConsentAI); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) ListPhotos(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	photos, err := h.svc.ListPhotos(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(photos)
}

func (h *UserHandler) DeletePhoto(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	photoID := r.URL.Query().Get("photo_id")
	if userID == "" || photoID == "" {
		http.Error(w, "missing params", http.StatusBadRequest)
		return
	}
	s3Key, err := h.svc.DeletePhoto(photoID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"s3_key": s3Key})
}

func (h *UserHandler) CanUpload(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	if err := h.svc.CanUpload(userID); err != nil {
		http.Error(w, err.Error(), http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *UserHandler) RegisterUpload(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	var body struct {
		S3Key string `json:"s3_key"`
		Hash  string `json:"hash"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	photoID, err := h.svc.RegisterUpload(userID, body.S3Key, body.Hash)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"photo_id": photoID})
}

func (h *UserHandler) UpdatePhotoScore(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PhotoID  string  `json:"photo_id"`
		Score    float64 `json:"score"`
		Features []byte  `json:"features"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.UpdatePhotoScore(body.PhotoID, body.Score, body.Features); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// compile-time check
var _ UserServiceIface = (*service.UserService)(nil)
