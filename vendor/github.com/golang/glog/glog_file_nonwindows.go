//go:build !windows

package glog

import "os/user"

// shouldRegisterStderrSink determines whether we should register a log sink that writes to stderr.
// Today, this always returns true on non-Windows platforms, as it specifically checks for a
// condition that is only present on Windows.
func shouldRegisterStderrSink() bool {
	return true
}

func lookupUser() string {
	if current, err := user.Current(); err == nil {
		return current.Username
	}
	return ""
}
