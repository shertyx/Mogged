package handler

import (
	"encoding/json"
	"net/http"
)

type AuthServiceIface interface {
	OAuthURL(state string) string
	ExchangeCode(code string) (string, string, string, error)
	Refresh(rt string) (string, error)
	Logout(rt string) error
	ValidateJWT(tok string) (string, error)
}

type AuthHandler struct {
	svc AuthServiceIface
}

func NewAuthHandler(svc AuthServiceIface) *AuthHandler {
	return &AuthHandler{svc: svc}
}

func (h *AuthHandler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok", "service": "auth-service"})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	url := h.svc.OAuthURL("random-state")
	http.Redirect(w, r, url, http.StatusFound)
}

func (h *AuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}
	_, accessToken, refreshToken, err := h.svc.ExchangeCode(code)
	if err != nil {
		http.Error(w, "oauth exchange failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.RefreshToken == "" {
		http.Error(w, "missing refresh_token", http.StatusBadRequest)
		return
	}
	at, err := h.svc.Refresh(body.RefreshToken)
	if err != nil {
		http.Error(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"access_token": at})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var body struct {
		RefreshToken string `json:"refresh_token"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	h.svc.Logout(body.RefreshToken)
	w.WriteHeader(http.StatusNoContent)
}

func (h *AuthHandler) Validate(w http.ResponseWriter, r *http.Request) {
	tok := r.Header.Get("Authorization")
	if len(tok) > 7 && tok[:7] == "Bearer " {
		tok = tok[7:]
	}
	userID, err := h.svc.ValidateJWT(tok)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"user_id": userID})
}
