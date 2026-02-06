//go:build arm64 && !gccgo && !appengine
// +build arm64,!gccgo,!appengine

package roaring

//go:noescape
func union2by2(set1 []uint16, set2 []uint16, buffer []uint16) (size int)
