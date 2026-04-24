package service_test

import (
	"testing"

	"github.com/mogged/auth-service/service"
)

func TestGenerateAndValidateJWT(t *testing.T) {
	svc := service.NewAuthService(nil, "test-secret", "client-id", "client-secret")
	token, err := svc.GenerateJWT("user-uuid-123")
	if err != nil {
		t.Fatal(err)
	}
	if token == "" {
		t.Fatal("expected non-empty token")
	}
	userID, err := svc.ValidateJWT(token)
	if err != nil {
		t.Fatal(err)
	}
	if userID != "user-uuid-123" {
		t.Fatalf("expected user-uuid-123 got %s", userID)
	}
}

func TestValidateJWT_InvalidToken(t *testing.T) {
	svc := service.NewAuthService(nil, "test-secret", "client-id", "client-secret")
	_, err := svc.ValidateJWT("not.a.valid.token")
	if err == nil {
		t.Fatal("expected error for invalid token")
	}
}
