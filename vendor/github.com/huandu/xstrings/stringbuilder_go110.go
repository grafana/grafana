//go:build !go1.10
// +build !go1.10

package xstrings

import "bytes"

type stringBuilder struct {
	bytes.Buffer
}
