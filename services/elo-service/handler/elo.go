package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/mogged/elo-service/repository"
	"github.com/mogged/elo-service/service"
)

type EloServiceIface interface {
	GetElo(userID string) (int, string, error)
	CreateMatch(playerA, playerB, mode string) (string, error)
	CreateMatchWithPhoto(playerA, playerB, mode, photoAID string) (string, error)
	GetMatch(matchID string) (*repository.Match, error)
	SetMatchReady(matchID string) error
	SetMatchPhotos(matchID, photoAID, photoBID string) error
	ResolveMatch(matchID, playerA, playerB string, rounds []service.RoundInput) (string, error)
	ExpireStaleMatches() ([]repository.Match, error)
	ListPendingChallenges(userID string) ([]repository.Match, error)
	GetMatchPhotos(matchID string) (string, string, error)
}

type EloHandler struct {
	svc            EloServiceIface
	faceServiceURL string
	userServiceURL string
}

func NewEloHandler(svc EloServiceIface) *EloHandler {
	return &EloHandler{svc: svc}
}

func NewEloHandlerWithURLs(svc EloServiceIface, faceServiceURL, userServiceURL string) *EloHandler {
	return &EloHandler{svc: svc, faceServiceURL: faceServiceURL, userServiceURL: userServiceURL}
}

func (h *EloHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
}

func (h *EloHandler) GetElo(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}
	score, tier, err := h.svc.GetElo(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"score": score, "tier": tier})
}

func (h *EloHandler) CreateMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		PlayerA string `json:"player_a"`
		PlayerB string `json:"player_b"`
		Mode    string `json:"mode"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if body.PlayerA == "" || body.PlayerB == "" || body.Mode == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}
	matchID, err := h.svc.CreateMatch(body.PlayerA, body.PlayerB, body.Mode)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"match_id": matchID})
}

func (h *EloHandler) GetMatch(w http.ResponseWriter, r *http.Request) {
	matchID := r.URL.Query().Get("match_id")
	if matchID == "" {
		http.Error(w, "missing match_id", http.StatusBadRequest)
		return
	}
	match, err := h.svc.GetMatch(matchID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if match == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(match)
}

func (h *EloHandler) SetMatchReady(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MatchID string `json:"match_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.SetMatchReady(body.MatchID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *EloHandler) ResolveMatch(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MatchID string              `json:"match_id"`
		PlayerA string              `json:"player_a"`
		PlayerB string              `json:"player_b"`
		Rounds  []service.RoundInput `json:"rounds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	winnerID, err := h.svc.ResolveMatch(body.MatchID, body.PlayerA, body.PlayerB, body.Rounds)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"winner_id": winnerID})
}

func (h *EloHandler) CreateChallenge(w http.ResponseWriter, r *http.Request) {
	playerA := r.Header.Get("X-User-ID")
	var body struct {
		PlayerB  string `json:"player_b"`
		PhotoAID string `json:"photo_a_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if playerA == "" || body.PlayerB == "" || body.PhotoAID == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}
	matchID, err := h.svc.CreateMatchWithPhoto(playerA, body.PlayerB, "async", body.PhotoAID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"match_id": matchID})
}

func (h *EloHandler) ListPendingChallenges(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}
	matches, err := h.svc.ListPendingChallenges(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(matches)
}

func (h *EloHandler) AcceptChallenge(w http.ResponseWriter, r *http.Request) {
	var body struct {
		MatchID  string `json:"match_id"`
		PhotoBID string `json:"photo_b_id"`
		PlayerB  string `json:"player_b"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if body.MatchID == "" || body.PhotoBID == "" || body.PlayerB == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}

	match, err := h.svc.GetMatch(body.MatchID)
	if err != nil || match == nil {
		http.Error(w, "match not found", http.StatusNotFound)
		return
	}

	photoAID, _, err := h.svc.GetMatchPhotos(body.MatchID)
	if err != nil || photoAID == "" {
		http.Error(w, "photo_a not set on match", http.StatusBadRequest)
		return
	}

	// Analyze both photos concurrently via face-service
	type analyzeResult struct {
		score float64
		err   error
	}
	analyzePhoto := func(photoID, s3Key, userID string) (float64, error) {
		var buf bytes.Buffer
		mw := multipart.NewWriter(&buf)
		_ = mw.WriteField("photo_id", photoID)
		_ = mw.WriteField("s3_key", s3Key)
		mw.Close()
		req, err := http.NewRequest(http.MethodPost, h.faceServiceURL+"/face/photos/analyze-stored", &buf)
		if err != nil {
			return 0, err
		}
		req.Header.Set("Content-Type", mw.FormDataContentType())
		req.Header.Set("X-User-ID", userID)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return 0, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return 0, fmt.Errorf("face-service: %s", b)
		}
		var result struct {
			ChadScore float64 `json:"chad_score"`
		}
		json.NewDecoder(resp.Body).Decode(&result)
		return result.ChadScore, nil
	}

	// Get s3 keys for both photos from user-service
	getS3Key := func(photoID string) (string, error) {
		resp, err := http.Get(h.userServiceURL + "/user/photos/by-id?photo_id=" + photoID)
		if err != nil {
			return "", err
		}
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusNotFound {
			return "", fmt.Errorf("photo not found: %s", photoID)
		}
		var photo struct {
			S3Key string `json:"s3_key"`
		}
		json.NewDecoder(resp.Body).Decode(&photo)
		if photo.S3Key == "" {
			return "", fmt.Errorf("empty s3_key for photo %s", photoID)
		}
		return photo.S3Key, nil
	}

	s3A, err := getS3Key(photoAID)
	if err != nil {
		http.Error(w, "failed to fetch photo A: "+err.Error(), http.StatusInternalServerError)
		return
	}
	s3B, err := getS3Key(body.PhotoBID)
	if err != nil {
		http.Error(w, "failed to fetch photo B: "+err.Error(), http.StatusInternalServerError)
		return
	}

	aCh := make(chan analyzeResult, 1)
	bCh := make(chan analyzeResult, 1)
	go func() { score, err := analyzePhoto(photoAID, s3A, match.PlayerA); aCh <- analyzeResult{score, err} }()
	go func() { score, err := analyzePhoto(body.PhotoBID, s3B, body.PlayerB); bCh <- analyzeResult{score, err} }()
	aRes, bRes := <-aCh, <-bCh

	if aRes.err != nil || bRes.err != nil {
		http.Error(w, "photo analysis failed", http.StatusInternalServerError)
		return
	}

	if err := h.svc.SetMatchPhotos(body.MatchID, photoAID, body.PhotoBID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	winnerID, err := h.svc.ResolveMatch(body.MatchID, match.PlayerA, body.PlayerB, []service.RoundInput{
		{PhotoA: photoAID, PhotoB: body.PhotoBID, ScoreA: aRes.score, ScoreB: bRes.score},
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Mark both photos as used via user-service
	markUsed := func(photoID string) {
		b, _ := json.Marshal(map[string]string{"photo_id": photoID})
		req, _ := http.NewRequest(http.MethodPatch, h.userServiceURL+"/user/photos/mark-used", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}
	markUsed(photoAID)
	markUsed(body.PhotoBID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"winner_id":  winnerID,
		"match_id":   body.MatchID,
		"score_a":    aRes.score,
		"score_b":    bRes.score,
		"player_a":   match.PlayerA,
		"player_b":   body.PlayerB,
	})
}

// compile-time check
var _ EloServiceIface = (*service.EloService)(nil)
