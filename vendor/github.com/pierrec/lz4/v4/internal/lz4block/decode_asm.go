//go:build (amd64 || arm || arm64) && !appengine && gc && !noasm
// +build amd64 arm arm64
// +build !appengine
// +build gc
// +build !noasm

package lz4block

//go:noescape
func decodeBlock(dst, src, dict []byte) int
