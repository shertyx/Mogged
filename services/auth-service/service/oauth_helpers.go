package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

func oauth2TimeoutContext() context.Context {
	ctx, _ := context.WithTimeout(context.Background(), 10*time.Second) //nolint:govet
	return ctx
}

func parseIDToken(idToken string) (googleID, email string, err error) {
	parts := strings.Split(idToken, ".")
	if len(parts) != 3 {
		return "", "", fmt.Errorf("invalid id_token format")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", "", fmt.Errorf("failed to decode id_token payload: %w", err)
	}
	var claims struct {
		Sub   string `json:"sub"`
		Email string `json:"email"`
	}
	if err := json.Unmarshal(payload, &claims); err != nil {
		return "", "", fmt.Errorf("failed to parse id_token claims: %w", err)
	}
	return claims.Sub, claims.Email, nil
}
