package xxh3

import (
	"unsafe"

	"github.com/klauspost/cpuid/v2"
)

var (
	hasAVX2   = cpuid.CPU.Has(cpuid.AVX2)
	hasSSE2   = cpuid.CPU.Has(cpuid.SSE2) // Always true on amd64
	hasAVX512 = cpuid.CPU.Has(cpuid.AVX512F)
)

//go:noescape
func accumAVX2(acc *[8]u64, data, key unsafe.Pointer, len u64)

//go:noescape
func accumAVX512(acc *[8]u64, data, key unsafe.Pointer, len u64)

//go:noescape
func accumSSE(acc *[8]u64, data, key unsafe.Pointer, len u64)

//go:noescape
func accumBlockAVX2(acc *[8]u64, data, key unsafe.Pointer)

//go:noescape
func accumBlockSSE(acc *[8]u64, data, key unsafe.Pointer)

func withOverrides(avx512, avx2, sse2 bool, cb func()) {
	avx512Orig, avx2Orig, sse2Orig := hasAVX512, hasAVX2, hasSSE2
	hasAVX512, hasAVX2, hasSSE2 = avx512, avx2, sse2
	defer func() { hasAVX512, hasAVX2, hasSSE2 = avx512Orig, avx2Orig, sse2Orig }()
	cb()
}

func withAVX512(cb func())  { withOverrides(hasAVX512, false, false, cb) }
func withAVX2(cb func())    { withOverrides(false, hasAVX2, false, cb) }
func withSSE2(cb func())    { withOverrides(false, false, hasSSE2, cb) }
func withGeneric(cb func()) { withOverrides(false, false, false, cb) }
