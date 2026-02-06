//go:build tools
// +build tools

// We include our tool dependencies for `go generate` here to ensure they're
// properly tracked by the go tool. See the Go Wiki for the rationale behind this:
// https://github.com/golang/go/wiki/Modules#how-can-i-track-tool-dependencies-for-a-module.

package dns

import _ "golang.org/x/tools/go/packages"
