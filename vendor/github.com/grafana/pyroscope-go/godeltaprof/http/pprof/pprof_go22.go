//go:build go1.22

package pprof

func routePrefix() string {
	// As of go 1.23 we will panic if we don't prefix with "GET "
	// https://github.com/golang/go/blob/9fcffc53593c5cd103630d0d24ef8bd91e17246d/src/net/http/pprof/pprof.go#L98-L97
	// https://github.com/golang/go/commit/9fcffc53593c5cd103630d0d24ef8bd91e17246d
	return "GET "
}
