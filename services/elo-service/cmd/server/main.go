package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
	"github.com/mogged/elo-service/handler"
	"github.com/mogged/elo-service/repository"
	"github.com/mogged/elo-service/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}
	dsn := os.Getenv("POSTGRES_DSN")

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("db open:", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatal("db ping:", err)
	}

	repo := repository.NewEloRepo(db)
	svc := service.NewEloService(repo)
	h := handler.NewEloHandler(svc)

	// background goroutine: expire stale async matches every minute
	go func() {
		for range time.Tick(time.Minute) {
			if _, err := svc.ExpireStaleMatches(); err != nil {
				log.Println("expire stale matches:", err)
			}
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/elo", h.GetElo)
	mux.HandleFunc("/elo/match/create", h.CreateMatch)
	mux.HandleFunc("/elo/match", h.GetMatch)
	mux.HandleFunc("/elo/match/ready", h.SetMatchReady)
	mux.HandleFunc("/elo/match/resolve", h.ResolveMatch)
	mux.HandleFunc("/elo/leaderboard", h.GetLeaderboard)
	mux.HandleFunc("/elo/history", h.GetMatchHistory)
	mux.HandleFunc("/elo/duel/send", h.SendDuelRequest)
	mux.HandleFunc("/elo/duel/pending", h.ListPendingDuels)
	mux.HandleFunc("/elo/duel/accept", h.AcceptDuelRequest)
	mux.HandleFunc("/elo/duel/decline", h.DeclineDuelRequest)
	mux.HandleFunc("/elo/feed", h.GetFeed)

	log.Printf("elo-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
