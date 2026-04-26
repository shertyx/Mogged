package handler

import (
	"encoding/json"
	"net/http"

	"github.com/mogged/elo-service/repository"
	"github.com/mogged/elo-service/service"
)

type EloServiceIface interface {
	GetElo(userID string) (int, string, error)
	CreateMatch(playerA, playerB, mode string) (string, error)
	GetMatch(matchID string) (*repository.Match, error)
	SetMatchReady(matchID string) error
	ResolveMatch(matchID, playerA, playerB string, rounds []service.RoundInput) (string, error)
	ExpireStaleMatches() ([]repository.Match, error)
	GetLeaderboard(limit int) ([]repository.LeaderboardEntry, error)
	GetMatchHistory(userID string, limit int) ([]repository.MatchHistoryEntry, error)
	SendDuelRequest(challengerID, challengedID string, photoIDs []string) (string, error)
	ListPendingDuels(userID string) ([]repository.DuelRequest, error)
	AcceptDuelRequest(duelID, challengedID string, challengedPhotos []string) (string, error)
	DeclineDuelRequest(duelID, challengedID string) error
	GetFeed(userID string, limit int) ([]repository.FeedEntry, error)
}

type EloHandler struct {
	svc EloServiceIface
}

func NewEloHandler(svc EloServiceIface) *EloHandler {
	return &EloHandler{svc: svc}
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
	info := service.TierInfoFromELO(score)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score":     score,
		"tier":      tier,
		"tier_name": info.Name,
		"division":  info.Division,
		"sr":        info.SR,
	})
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

func (h *EloHandler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	entries, err := h.svc.GetLeaderboard(100)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if entries == nil {
		entries = []repository.LeaderboardEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *EloHandler) GetMatchHistory(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		userID = r.Header.Get("X-User-ID")
	}
	if userID == "" {
		http.Error(w, "missing user_id", http.StatusBadRequest)
		return
	}
	entries, err := h.svc.GetMatchHistory(userID, 20)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if entries == nil {
		entries = []repository.MatchHistoryEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *EloHandler) SendDuelRequest(w http.ResponseWriter, r *http.Request) {
	challengerID := r.Header.Get("X-User-ID")
	var body struct {
		ChallengedID string   `json:"challenged_id"`
		PhotoIDs     []string `json:"photo_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.ChallengedID == "" || len(body.PhotoIDs) != 1 {
		http.Error(w, "bad request: need challenged_id and 1 photo_id", http.StatusBadRequest)
		return
	}
	id, err := h.svc.SendDuelRequest(challengerID, body.ChallengedID, body.PhotoIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"duel_id": id})
}

func (h *EloHandler) ListPendingDuels(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	duels, err := h.svc.ListPendingDuels(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if duels == nil {
		duels = []repository.DuelRequest{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(duels)
}

func (h *EloHandler) AcceptDuelRequest(w http.ResponseWriter, r *http.Request) {
	challengedID := r.Header.Get("X-User-ID")
	var body struct {
		DuelID   string   `json:"duel_id"`
		PhotoIDs []string `json:"photo_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.DuelID == "" || len(body.PhotoIDs) != 1 {
		http.Error(w, "bad request: need duel_id and 1 photo_id", http.StatusBadRequest)
		return
	}
	winnerID, err := h.svc.AcceptDuelRequest(body.DuelID, challengedID, body.PhotoIDs)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"winner_id": winnerID})
}

func (h *EloHandler) DeclineDuelRequest(w http.ResponseWriter, r *http.Request) {
	challengedID := r.Header.Get("X-User-ID")
	var body struct {
		DuelID string `json:"duel_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.DuelID == "" {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if err := h.svc.DeclineDuelRequest(body.DuelID, challengedID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *EloHandler) GetFeed(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		http.Error(w, "missing user", http.StatusUnauthorized)
		return
	}
	feed, err := h.svc.GetFeed(userID, 30)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if feed == nil {
		feed = []repository.FeedEntry{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(feed)
}

// compile-time check
var _ EloServiceIface = (*service.EloService)(nil)
