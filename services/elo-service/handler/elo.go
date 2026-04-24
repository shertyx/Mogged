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

// compile-time check
var _ EloServiceIface = (*service.EloService)(nil)
