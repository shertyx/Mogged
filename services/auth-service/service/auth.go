package service

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/mogged/auth-service/repository"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type AuthService struct {
	repo        *repository.UserRepo
	jwtSecret   []byte
	oauthConfig *oauth2.Config
}

func NewAuthService(repo *repository.UserRepo, jwtSecret, clientID, clientSecret string) *AuthService {
	cfg := &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  "http://localhost:8080/auth/callback",
		Scopes:       []string{"openid", "email", "profile"},
		Endpoint:     google.Endpoint,
	}
	return &AuthService{repo: repo, jwtSecret: []byte(jwtSecret), oauthConfig: cfg}
}

func (s *AuthService) GenerateJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"iat": time.Now().Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

func (s *AuthService) ValidateJWT(tokenStr string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method")
		}
		return s.jwtSecret, nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token: %w", err)
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}
	sub, ok := claims["sub"].(string)
	if !ok {
		return "", fmt.Errorf("missing sub claim")
	}
	return sub, nil
}

func (s *AuthService) OAuthURL(state string) string {
	return s.oauthConfig.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (s *AuthService) ExchangeCode(code string) (userID, accessToken, refreshToken string, err error) {
	ctx := oauth2TimeoutContext()
	oauthToken, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return "", "", "", fmt.Errorf("exchange failed: %w", err)
	}
	idToken, ok := oauthToken.Extra("id_token").(string)
	if !ok {
		return "", "", "", fmt.Errorf("no id_token in response")
	}
	googleID, email, err := parseIDToken(idToken)
	if err != nil {
		return "", "", "", err
	}
	userID, err = s.repo.UpsertUser(googleID, email)
	if err != nil {
		return "", "", "", err
	}
	rt, err := generateOpaqueToken()
	if err != nil {
		return "", "", "", err
	}
	if err := s.repo.SaveRefreshToken(userID, rt, 30*24*3600); err != nil {
		return "", "", "", err
	}
	at, err := s.GenerateJWT(userID)
	return userID, at, rt, err
}

func (s *AuthService) Refresh(refreshToken string) (string, error) {
	userID, err := s.repo.GetUserByRefreshToken(refreshToken)
	if err != nil || userID == "" {
		return "", fmt.Errorf("invalid refresh token")
	}
	return s.GenerateJWT(userID)
}

func (s *AuthService) Logout(refreshToken string) error {
	return s.repo.DeleteRefreshToken(refreshToken)
}

func generateOpaqueToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
