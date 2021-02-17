package sockjs

import (
	"fmt"
	"net/http"
	"time"
)

func xhrCorsFactory(opts Options) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		header := rw.Header()
		var corsEnabled bool
		var corsOrigin string

		if opts.CheckOrigin != nil {
			corsEnabled = opts.CheckOrigin(req)
			if corsEnabled {
				corsOrigin = req.Header.Get("origin")
				if corsOrigin == "" {
					corsOrigin = "*"
				}
			}
		} else {
			corsEnabled = true
			corsOrigin = opts.Origin
			if corsOrigin == "" {
				corsOrigin = req.Header.Get("origin")
			}
			if corsOrigin == "" || corsOrigin == "null" {
				corsOrigin = "*"
			}
		}

		if corsEnabled {
			header.Set("Access-Control-Allow-Origin", corsOrigin)
			if allowHeaders := req.Header.Get("Access-Control-Request-Headers"); allowHeaders != "" && allowHeaders != "null" {
				header.Add("Access-Control-Allow-Headers", allowHeaders)
			}
			header.Set("Access-Control-Allow-Credentials", "true")
		}
	}
}

func xhrOptions(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("Access-Control-Allow-Methods", "OPTIONS, POST")
	rw.WriteHeader(http.StatusNoContent) // 204
}

func cacheFor(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", 365*24*60*60))
	rw.Header().Set("Expires", time.Now().AddDate(1, 0, 0).Format(time.RFC1123))
	rw.Header().Set("Access-Control-Max-Age", fmt.Sprintf("%d", 365*24*60*60))
}

func noCache(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
}

func welcomeHandler(rw http.ResponseWriter, req *http.Request) {
	rw.Header().Set("content-type", "text/plain;charset=UTF-8")
	fmt.Fprint(rw, "Welcome to SockJS!\n")
}

func httpError(w http.ResponseWriter, error string, code int) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(code)
	fmt.Fprint(w, error)
}
