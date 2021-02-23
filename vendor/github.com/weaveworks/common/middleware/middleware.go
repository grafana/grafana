package middleware

import (
	"net/http"
)

// Interface is the shared contract for all middlesware, and allows middlesware
// to wrap handlers.
type Interface interface {
	Wrap(http.Handler) http.Handler
}

// Func is to Interface as http.HandlerFunc is to http.Handler
type Func func(http.Handler) http.Handler

// Wrap implements Interface
func (m Func) Wrap(next http.Handler) http.Handler {
	return m(next)
}

// Identity is an Interface which doesn't do anything.
var Identity Interface = Func(func(h http.Handler) http.Handler { return h })

// Merge produces a middleware that applies multiple middlesware in turn;
// ie Merge(f,g,h).Wrap(handler) == f.Wrap(g.Wrap(h.Wrap(handler)))
func Merge(middlesware ...Interface) Interface {
	return Func(func(next http.Handler) http.Handler {
		for i := len(middlesware) - 1; i >= 0; i-- {
			next = middlesware[i].Wrap(next)
		}
		return next
	})
}
