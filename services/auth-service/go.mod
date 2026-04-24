module github.com/mogged/auth-service

go 1.25.0

require (
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/lib/pq v1.12.3
	golang.org/x/oauth2 v0.27.0
)

require cloud.google.com/go/compute/metadata v0.3.0 // indirect
