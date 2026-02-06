package x86

import (
	"github.com/segmentio/asm/cpu/cpuid"
	. "golang.org/x/sys/cpu"
)

type CPU cpuid.CPU

func (cpu CPU) Has(feature Feature) bool {
	return cpuid.CPU(cpu).Has(cpuid.Feature(feature))
}

func (cpu *CPU) set(feature Feature, enable bool) {
	(*cpuid.CPU)(cpu).Set(cpuid.Feature(feature), enable)
}

type Feature cpuid.Feature

const (
	SSE                Feature = 1 << iota // SSE functions
	SSE2                                   // P4 SSE functions
	SSE3                                   // Prescott SSE3 functions
	SSE41                                  // Penryn SSE4.1 functions
	SSE42                                  // Nehalem SSE4.2 functions
	SSE4A                                  // AMD Barcelona microarchitecture SSE4a instructions
	SSSE3                                  // Conroe SSSE3 functions
	AVX                                    // AVX functions
	AVX2                                   // AVX2 functions
	AVX512BF16                             // AVX-512 BFLOAT16 Instructions
	AVX512BITALG                           // AVX-512 Bit Algorithms
	AVX512BW                               // AVX-512 Byte and Word Instructions
	AVX512CD                               // AVX-512 Conflict Detection Instructions
	AVX512DQ                               // AVX-512 Doubleword and Quadword Instructions
	AVX512ER                               // AVX-512 Exponential and Reciprocal Instructions
	AVX512F                                // AVX-512 Foundation
	AVX512IFMA                             // AVX-512 Integer Fused Multiply-Add Instructions
	AVX512PF                               // AVX-512 Prefetch Instructions
	AVX512VBMI                             // AVX-512 Vector Bit Manipulation Instructions
	AVX512VBMI2                            // AVX-512 Vector Bit Manipulation Instructions, Version 2
	AVX512VL                               // AVX-512 Vector Length Extensions
	AVX512VNNI                             // AVX-512 Vector Neural Network Instructions
	AVX512VP2INTERSECT                     // AVX-512 Intersect for D/Q
	AVX512VPOPCNTDQ                        // AVX-512 Vector Population Count Doubleword and Quadword
	CMOV                                   // Conditional move
)

func ABI() CPU {
	cpu := CPU(0)
	cpu.set(SSE, true) // TODO: golang.org/x/sys/cpu assumes all CPUs have SEE?
	cpu.set(SSE2, X86.HasSSE2)
	cpu.set(SSE3, X86.HasSSE3)
	cpu.set(SSE41, X86.HasSSE41)
	cpu.set(SSE42, X86.HasSSE42)
	cpu.set(SSE4A, false) // TODO: add upstream support in golang.org/x/sys/cpu?
	cpu.set(SSSE3, X86.HasSSSE3)
	cpu.set(AVX, X86.HasAVX)
	cpu.set(AVX2, X86.HasAVX2)
	cpu.set(AVX512BF16, X86.HasAVX512BF16)
	cpu.set(AVX512BITALG, X86.HasAVX512BITALG)
	cpu.set(AVX512BW, X86.HasAVX512BW)
	cpu.set(AVX512CD, X86.HasAVX512CD)
	cpu.set(AVX512DQ, X86.HasAVX512DQ)
	cpu.set(AVX512ER, X86.HasAVX512ER)
	cpu.set(AVX512F, X86.HasAVX512F)
	cpu.set(AVX512IFMA, X86.HasAVX512IFMA)
	cpu.set(AVX512PF, X86.HasAVX512PF)
	cpu.set(AVX512VBMI, X86.HasAVX512VBMI)
	cpu.set(AVX512VBMI2, X86.HasAVX512VBMI2)
	cpu.set(AVX512VL, X86.HasAVX512VL)
	cpu.set(AVX512VNNI, X86.HasAVX512VNNI)
	cpu.set(AVX512VP2INTERSECT, false) // TODO: add upstream support in golang.org/x/sys/cpu?
	cpu.set(AVX512VPOPCNTDQ, X86.HasAVX512VPOPCNTDQ)
	cpu.set(CMOV, true) // TODO: golang.org/x/sys/cpu assumes all CPUs have CMOV?
	return cpu
}
