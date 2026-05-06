package arm64

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
	FP       Feature = 1 << iota // Floating-point instruction set (always available)
	ASIMD                        // Advanced SIMD (always available)
	EVTSTRM                      // Event stream support
	AES                          // AES hardware implementation
	PMULL                        // Polynomial multiplication instruction set
	SHA1                         // SHA1 hardware implementation
	SHA2                         // SHA2 hardware implementation
	CRC32                        // CRC32 hardware implementation
	ATOMICS                      // Atomic memory operation instruction set
	FPHP                         // Half precision floating-point instruction set
	ASIMDHP                      // Advanced SIMD half precision instruction set
	CPUID                        // CPUID identification scheme registers
	ASIMDRDM                     // Rounding double multiply add/subtract instruction set
	JSCVT                        // Javascript conversion from floating-point to integer
	FCMA                         // Floating-point multiplication and addition of complex numbers
	LRCPC                        // Release Consistent processor consistent support
	DCPOP                        // Persistent memory support
	SHA3                         // SHA3 hardware implementation
	SM3                          // SM3 hardware implementation
	SM4                          // SM4 hardware implementation
	ASIMDDP                      // Advanced SIMD double precision instruction set
	SHA512                       // SHA512 hardware implementation
	SVE                          // Scalable Vector Extensions
	ASIMDFHM                     // Advanced SIMD multiplication FP16 to FP32
)

func ABI() CPU {
	cpu := CPU(0)
	cpu.set(FP, ARM64.HasFP)
	cpu.set(ASIMD, ARM64.HasASIMD)
	cpu.set(EVTSTRM, ARM64.HasEVTSTRM)
	cpu.set(AES, ARM64.HasAES)
	cpu.set(PMULL, ARM64.HasPMULL)
	cpu.set(SHA1, ARM64.HasSHA1)
	cpu.set(SHA2, ARM64.HasSHA2)
	cpu.set(CRC32, ARM64.HasCRC32)
	cpu.set(ATOMICS, ARM64.HasATOMICS)
	cpu.set(FPHP, ARM64.HasFPHP)
	cpu.set(ASIMDHP, ARM64.HasASIMDHP)
	cpu.set(CPUID, ARM64.HasCPUID)
	cpu.set(ASIMDRDM, ARM64.HasASIMDRDM)
	cpu.set(JSCVT, ARM64.HasJSCVT)
	cpu.set(FCMA, ARM64.HasFCMA)
	cpu.set(LRCPC, ARM64.HasLRCPC)
	cpu.set(DCPOP, ARM64.HasDCPOP)
	cpu.set(SHA3, ARM64.HasSHA3)
	cpu.set(SM3, ARM64.HasSM3)
	cpu.set(SM4, ARM64.HasSM4)
	cpu.set(ASIMDDP, ARM64.HasASIMDDP)
	cpu.set(SHA512, ARM64.HasSHA512)
	cpu.set(SVE, ARM64.HasSVE)
	cpu.set(ASIMDFHM, ARM64.HasASIMDFHM)
	return cpu
}
