package repository_test

import (
	"database/sql"
	"testing"

	_ "github.com/lib/pq"
	"github.com/mogged/auth-service/repository"
)

func getDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := "postgres://mogged:mogged_secret@localhost:5432/mogged?sslmode=disable"
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Skip("postgres not available:", err)
	}
	if err := db.Ping(); err != nil {
		t.Skip("postgres not reachable:", err)
	}
	return db
}

func TestUpsertUser(t *testing.T) {
	db := getDB(t)
	repo := repository.NewUserRepo(db)
	id, err := repo.UpsertUser("google-test-123", "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if id == "" {
		t.Fatal("expected non-empty id")
	}
	id2, err := repo.UpsertUser("google-test-123", "test@example.com")
	if err != nil {
		t.Fatal(err)
	}
	if id != id2 {
		t.Fatalf("expected same id, got %s vs %s", id, id2)
	}
}

func TestSaveAndGetRefreshToken(t *testing.T) {
	db := getDB(t)
	repo := repository.NewUserRepo(db)
	userID, _ := repo.UpsertUser("google-rt-456", "rt@example.com")
	err := repo.SaveRefreshToken(userID, "tok123", 3600)
	if err != nil {
		t.Fatal(err)
	}
	uid, err := repo.GetUserByRefreshToken("tok123")
	if err != nil {
		t.Fatal(err)
	}
	if uid != userID {
		t.Fatalf("expected %s got %s", userID, uid)
	}
}
