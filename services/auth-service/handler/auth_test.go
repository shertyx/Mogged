package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/mogged/auth-service/handler"
)

type mockAuthSvc struct{}

func (m *mockAuthSvc) OAuthURL(state string) string {
	return "http://accounts.google.com/o/oauth2/auth?state=" + state
}
func (m *mockAuthSvc) ExchangeCode(code string) (string, string, string, error) {
	return "user-1", "access-tok", "refresh-tok", nil
}
func (m *mockAuthSvc) Refresh(rt string) (string, error)    { return "new-access-tok", nil }
func (m *mockAuthSvc) Logout(rt string) error               { return nil }
func (m *mockAuthSvc) ValidateJWT(tok string) (string, error) { return "user-1", nil }

func TestHealthHandler(t *testing.T) {
	h := handler.NewAuthHandler(&mockAuthSvc{})
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()
	h.Health(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 got %d", rr.Code)
	}
}

func TestLoginRedirects(t *testing.T) {
	h := handler.NewAuthHandler(&mockAuthSvc{})
	req := httptest.NewRequest(http.MethodGet, "/auth/login", nil)
	rr := httptest.NewRecorder()
	h.Login(rr, req)
	if rr.Code != http.StatusFound {
		t.Fatalf("expected 302 got %d", rr.Code)
	}
}
