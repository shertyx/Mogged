package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/mogged/auth-service/handler"
	"github.com/mogged/auth-service/repository"
	"github.com/mogged/auth-service/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}
	dsn := os.Getenv("POSTGRES_DSN")
	jwtSecret := os.Getenv("JWT_SECRET")
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	clientSecret := os.Getenv("GOOGLE_CLIENT_SECRET")

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("db open:", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatal("db ping:", err)
	}

	repo := repository.NewUserRepo(db)
	svc := service.NewAuthService(repo, jwtSecret, clientID, clientSecret)
	h := handler.NewAuthHandler(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/auth/login", h.Login)
	mux.HandleFunc("/auth/callback", h.Callback)
	mux.HandleFunc("/auth/refresh", h.Refresh)
	mux.HandleFunc("/auth/logout", h.Logout)
	mux.HandleFunc("/auth/validate", h.Validate)

	log.Printf("auth-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
