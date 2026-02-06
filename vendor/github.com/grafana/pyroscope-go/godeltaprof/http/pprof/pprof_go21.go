//go:build !go1.22

package pprof

func routePrefix() string {
	return ""
}
