package arm

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
	SWP      Feature = 1 << iota // SWP instruction support
	HALF                         // Half-word load and store support
	THUMB                        // ARM Thumb instruction set
	BIT26                        // Address space limited to 26-bits
	FASTMUL                      // 32-bit operand, 64-bit result multiplication support
	FPA                          // Floating point arithmetic support
	VFP                          // Vector floating point support
	EDSP                         // DSP Extensions support
	JAVA                         // Java instruction set
	IWMMXT                       // Intel Wireless MMX technology support
	CRUNCH                       // MaverickCrunch context switching and handling
	THUMBEE                      // Thumb EE instruction set
	NEON                         // NEON instruction set
	VFPv3                        // Vector floating point version 3 support
	VFPv3D16                     // Vector floating point version 3 D8-D15
	TLS                          // Thread local storage support
	VFPv4                        // Vector floating point version 4 support
	IDIVA                        // Integer divide instruction support in ARM mode
	IDIVT                        // Integer divide instruction support in Thumb mode
	VFPD32                       // Vector floating point version 3 D15-D31
	LPAE                         // Large Physical Address Extensions
	EVTSTRM                      // Event stream support
	AES                          // AES hardware implementation
	PMULL                        // Polynomial multiplication instruction set
	SHA1                         // SHA1 hardware implementation
	SHA2                         // SHA2 hardware implementation
	CRC32                        // CRC32 hardware implementation
)

func ABI() CPU {
	cpu := CPU(0)
	cpu.set(SWP, ARM.HasSWP)
	cpu.set(HALF, ARM.HasHALF)
	cpu.set(THUMB, ARM.HasTHUMB)
	cpu.set(BIT26, ARM.Has26BIT)
	cpu.set(FASTMUL, ARM.HasFASTMUL)
	cpu.set(FPA, ARM.HasFPA)
	cpu.set(VFP, ARM.HasVFP)
	cpu.set(EDSP, ARM.HasEDSP)
	cpu.set(JAVA, ARM.HasJAVA)
	cpu.set(IWMMXT, ARM.HasIWMMXT)
	cpu.set(CRUNCH, ARM.HasCRUNCH)
	cpu.set(THUMBEE, ARM.HasTHUMBEE)
	cpu.set(NEON, ARM.HasNEON)
	cpu.set(VFPv3, ARM.HasVFPv3)
	cpu.set(VFPv3D16, ARM.HasVFPv3D16)
	cpu.set(TLS, ARM.HasTLS)
	cpu.set(VFPv4, ARM.HasVFPv4)
	cpu.set(IDIVA, ARM.HasIDIVA)
	cpu.set(IDIVT, ARM.HasIDIVT)
	cpu.set(VFPD32, ARM.HasVFPD32)
	cpu.set(LPAE, ARM.HasLPAE)
	cpu.set(EVTSTRM, ARM.HasEVTSTRM)
	cpu.set(AES, ARM.HasAES)
	cpu.set(PMULL, ARM.HasPMULL)
	cpu.set(SHA1, ARM.HasSHA1)
	cpu.set(SHA2, ARM.HasSHA2)
	cpu.set(CRC32, ARM.HasCRC32)
	return cpu
}
