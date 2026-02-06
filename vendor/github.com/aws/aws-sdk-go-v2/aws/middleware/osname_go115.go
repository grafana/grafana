//go:build !go1.16
// +build !go1.16

package middleware

import "runtime"

func getNormalizedOSName() (os string) {
	switch runtime.GOOS {
	case "android":
		os = "android"
	case "linux":
		os = "linux"
	case "windows":
		os = "windows"
	case "darwin":
		// Due to Apple M1 we can't distinguish between macOS and iOS when GOOS/GOARCH is darwin/amd64
		// For now declare this as "other" until we have a better detection mechanism.
		fallthrough
	default:
		os = "other"
	}
	return os
}
