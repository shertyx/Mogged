package main

import (
	"log"
	"net/http"
	"os"

	"github.com/mogged/api-gateway/handler"
	"github.com/mogged/api-gateway/middleware"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	jwtSecret := os.Getenv("JWT_SECRET")
	authURL := os.Getenv("AUTH_SERVICE_URL")
	userURL := os.Getenv("USER_SERVICE_URL")
	eloURL := os.Getenv("ELO_SERVICE_URL")
	faceURL := os.Getenv("FACE_SERVICE_URL")

	mq := handler.NewMatchQueue()
	mux := http.NewServeMux()

	// public
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/auth/", handler.NewReverseProxy(authURL))

	// protected
	protected := http.NewServeMux()
	protected.Handle("/user/", handler.NewReverseProxy(userURL))
	protected.Handle("/elo/", handler.NewReverseProxy(eloURL))
	protected.Handle("/face/", handler.NewReverseProxy(faceURL))


	mux.Handle("/user/", middleware.JWTAuth(jwtSecret, protected))
	mux.Handle("/elo/", middleware.JWTAuth(jwtSecret, protected))
	mux.Handle("/face/", middleware.JWTAuth(jwtSecret, protected))
	// /matchmaking auth is handled inside the WS handler (token sent in first message)
	mux.HandleFunc("/matchmaking", mq.HandleMatchmaking(eloURL, faceURL, userURL, jwtSecret))

	log.Printf("api-gateway listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
