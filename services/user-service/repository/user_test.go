package repository_test

import (
	"database/sql"
	"testing"

	_ "github.com/lib/pq"
	"github.com/mogged/user-service/repository"
)

func getDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", "postgres://mogged:mogged_secret@localhost:5432/mogged?sslmode=disable")
	if err != nil {
		t.Skip("postgres not available")
	}
	if err := db.Ping(); err != nil {
		t.Skip("postgres not reachable")
	}
	return db
}

func TestCountPhotos(t *testing.T) {
	db := getDB(t)
	repo := repository.NewUserRepo(db)
	count, err := repo.CountPhotos("00000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatal(err)
	}
	if count < 0 {
		t.Fatal("expected non-negative count")
	}
}

func TestCountUploadsLastHour(t *testing.T) {
	db := getDB(t)
	repo := repository.NewUserRepo(db)
	count, err := repo.CountUploadsLastHour("00000000-0000-0000-0000-000000000001")
	if err != nil {
		t.Fatal(err)
	}
	if count < 0 {
		t.Fatal("expected non-negative count")
	}
}
