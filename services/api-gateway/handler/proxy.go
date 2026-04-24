package handler

import (
	"net/http"
	"net/http/httputil"
	"net/url"
)

func NewReverseProxy(target string) http.Handler {
	u, err := url.Parse(target)
	if err != nil {
		panic("invalid proxy target: " + target)
	}
	proxy := httputil.NewSingleHostReverseProxy(u)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxy.ServeHTTP(w, r)
	})
}
