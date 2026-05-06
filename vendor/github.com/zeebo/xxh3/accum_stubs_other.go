//go:build !amd64
// +build !amd64

package xxh3

import (
	"unsafe"
)

const (
	hasAVX2   = false
	hasSSE2   = false
	hasAVX512 = false
)

func accumAVX2(acc *[8]u64, data, key unsafe.Pointer, len u64)   { panic("unreachable") }
func accumSSE(acc *[8]u64, data, key unsafe.Pointer, len u64)    { panic("unreachable") }
func accumBlockAVX2(acc *[8]u64, data, key unsafe.Pointer)       { panic("unreachable") }
func accumBlockSSE(acc *[8]u64, data, key unsafe.Pointer)        { panic("unreachable") }
func accumAVX512(acc *[8]u64, data, key unsafe.Pointer, len u64) { panic("unreachable") }

func withAVX512(cb func())  { cb() }
func withAVX2(cb func())    { cb() }
func withSSE2(cb func())    { cb() }
func withGeneric(cb func()) { cb() }
