package handler

import (
	"encoding/json"
	"net/http"
	"strings"

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
	SetUsername(userID, username string) error
	SendFriendRequest(requesterID, addresseeID string) error
	AcceptFriendRequest(userID, requesterID string) error
	RemoveFriend(userID, otherID string) error
	ListFriends(userID string) ([]repository.Friend, error)
	ListPendingRequests(userID string) ([]repository.Friend, error)
	FindUserByUsername(username string) (string, error)
}

type UserHandler struct {
	svc         UserServiceIface
	adminEmails map[string]bool
}

func NewUserHandler(svc UserServiceIface, adminEmails string) *UserHandler {
	admins := map[string]bool{}
	for _, e := range strings.Split(adminEmails, ",") {
		e = strings.TrimSpace(e)
		if e != "" {
			admins[e] = true
		}
	}
	return &UserHandler{svc: svc, adminEmails: admins}
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
		// Auto-create empty profile on first access
		if err := h.svc.UpsertProfile(userID, "", false); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		profile = map[string]interface{}{
			"id": userID, "username": "", "avatar_url": nil, "consent_ai": false, "username_set": false, "email": "",
		}
	}
	email, _ := profile["email"].(string)
	profile["is_admin"] = h.adminEmails[email]
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

func (h *UserHandler) SetUsername(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user id", http.StatusBadRequest)
		return
	}
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.SetUsername(userID, body.Username); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
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
		PhotoID  string              `json:"photo_id"`
		Score    float64             `json:"score"`
		Features map[string]float64  `json:"features"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	featBytes, err := json.Marshal(body.Features)
	if err != nil {
		http.Error(w, "bad features", http.StatusBadRequest)
		return
	}
	if err := h.svc.UpdatePhotoScore(body.PhotoID, body.Score, featBytes); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) SendFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	var body struct {
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Username == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	targetID, err := h.svc.FindUserByUsername(body.Username)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if targetID == "" {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}
	if targetID == userID {
		http.Error(w, "cannot add yourself", http.StatusBadRequest)
		return
	}
	if err := h.svc.SendFriendRequest(userID, targetID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) AcceptFriendRequest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	var body struct {
		RequesterID string `json:"requester_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.AcceptFriendRequest(userID, body.RequesterID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) RemoveFriend(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	otherID := r.URL.Query().Get("user_id")
	if otherID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}
	if err := h.svc.RemoveFriend(userID, otherID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *UserHandler) ListFriends(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	friends, err := h.svc.ListFriends(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if friends == nil {
		friends = []repository.Friend{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(friends)
}

func (h *UserHandler) ListPendingRequests(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	reqs, err := h.svc.ListPendingRequests(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if reqs == nil {
		reqs = []repository.Friend{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reqs)
}

// compile-time check
var _ UserServiceIface = (*service.UserService)(nil)
