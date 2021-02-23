package middleware

import (
	"net/http"
	"net/url"
	"regexp"

	log "github.com/sirupsen/logrus"
)

// PathRewrite supports regex matching and replace on Request URIs
func PathRewrite(regexp *regexp.Regexp, replacement string) Interface {
	return pathRewrite{
		regexp:      regexp,
		replacement: replacement,
	}
}

type pathRewrite struct {
	regexp      *regexp.Regexp
	replacement string
}

func (p pathRewrite) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.RequestURI = p.regexp.ReplaceAllString(r.RequestURI, p.replacement)
		r.URL.RawPath = p.regexp.ReplaceAllString(r.URL.EscapedPath(), p.replacement)
		path, err := url.PathUnescape(r.URL.RawPath)
		if err != nil {
			log.Errorf("Got invalid url-encoded path %v after applying path rewrite %v: %v", r.URL.RawPath, p, err)
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		r.URL.Path = path
		next.ServeHTTP(w, r)
	})
}

// PathReplace replcase Request.RequestURI with the specified string.
func PathReplace(replacement string) Interface {
	return pathReplace(replacement)
}

type pathReplace string

func (p pathReplace) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = string(p)
		r.RequestURI = string(p)
		next.ServeHTTP(w, r)
	})
}
