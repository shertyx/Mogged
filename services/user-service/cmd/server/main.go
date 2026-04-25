package main

import (
	"database/sql"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
	"github.com/mogged/user-service/handler"
	"github.com/mogged/user-service/repository"
	"github.com/mogged/user-service/service"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	dsn := os.Getenv("POSTGRES_DSN")

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal("db open:", err)
	}
	if err := db.Ping(); err != nil {
		log.Fatal("db ping:", err)
	}

	repo := repository.NewUserRepo(db)
	svc := service.NewUserService(repo)
	h := handler.NewUserHandler(svc)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/user/profile", h.GetProfile)
	mux.HandleFunc("/user/profile/upsert", h.UpsertProfile)
	mux.HandleFunc("/user/profile/username", h.SetUsername)
	mux.HandleFunc("/user/photos", h.ListPhotos)
	mux.HandleFunc("/user/photos/delete", h.DeletePhoto)
	mux.HandleFunc("/user/photos/can-upload", h.CanUpload)
	mux.HandleFunc("/user/photos/register", h.RegisterUpload)
	mux.HandleFunc("/user/photos/score", h.UpdatePhotoScore)

	log.Printf("user-service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}
