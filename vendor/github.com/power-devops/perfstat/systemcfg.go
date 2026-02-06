//go:build aix
// +build aix

package perfstat

import "golang.org/x/sys/unix"

// function Getsystemcfg() is defined in golang.org/x/sys/unix
// we define here just missing constants for the function and some helpers

// Calls to getsystemcfg()
const (
	SC_ARCH         = 1  /* processor architecture */
	SC_IMPL         = 2  /* processor implementation */
	SC_VERS         = 3  /* processor version */
	SC_WIDTH        = 4  /* width (32 || 64) */
	SC_NCPUS        = 5  /* 1 = UP, n = n-way MP */
	SC_L1C_ATTR     = 6  /* L1 cache attributes (bit flags) */
	SC_L1C_ISZ      = 7  /* size of L1 instruction cache */
	SC_L1C_DSZ      = 8  /* size of L1 data cache */
	SC_L1C_ICA      = 9  /* L1 instruction cache associativity */
	SC_L1C_DCA      = 10 /* L1 data cache associativity */
	SC_L1C_IBS      = 11 /* L1 instruction cache block size */
	SC_L1C_DBS      = 12 /* L1 data cache block size */
	SC_L1C_ILS      = 13 /* L1 instruction cache line size */
	SC_L1C_DLS      = 14 /* L1 data cache line size */
	SC_L2C_SZ       = 15 /* size of L2 cache, 0 = No L2 cache */
	SC_L2C_AS       = 16 /* L2 cache associativity */
	SC_TLB_ATTR     = 17 /* TLB attributes (bit flags) */
	SC_ITLB_SZ      = 18 /* entries in instruction TLB */
	SC_DTLB_SZ      = 19 /* entries in data TLB */
	SC_ITLB_ATT     = 20 /* instruction tlb associativity */
	SC_DTLB_ATT     = 21 /* data tlb associativity */
	SC_RESRV_SZ     = 22 /* size of reservation */
	SC_PRI_LC       = 23 /* spin lock count in supevisor mode */
	SC_PRO_LC       = 24 /* spin lock count in problem state */
	SC_RTC_TYPE     = 25 /* RTC type */
	SC_VIRT_AL      = 26 /* 1 if hardware aliasing is supported */
	SC_CAC_CONG     = 27 /* number of page bits for cache synonym */
	SC_MOD_ARCH     = 28 /* used by system for model determination */
	SC_MOD_IMPL     = 29 /* used by system for model determination */
	SC_XINT         = 30 /* used by system for time base conversion */
	SC_XFRAC        = 31 /* used by system for time base conversion */
	SC_KRN_ATTR     = 32 /* kernel attributes, see below */
	SC_PHYSMEM      = 33 /* bytes of OS available memory */
	SC_SLB_ATTR     = 34 /* SLB attributes */
	SC_SLB_SZ       = 35 /* size of slb (0 = no slb) */
	SC_ORIG_NCPUS   = 36 /* original number of CPUs */
	SC_MAX_NCPUS    = 37 /* max cpus supported by this AIX image */
	SC_MAX_REALADDR = 38 /* max supported real memory address +1 */
	SC_ORIG_ENT_CAP = 39 /* configured entitled processor capacity at boot required by cross-partition LPAR tools. */
	SC_ENT_CAP      = 40 /* entitled processor capacity */
	SC_DISP_WHE     = 41 /* Dispatch wheel time period (TB units) */
	SC_CAPINC       = 42 /* delta by which capacity can change */
	SC_VCAPW        = 43 /* priority weight for idle capacity distribution */
	SC_SPLP_STAT    = 44 /* State of SPLPAR enablement: 0x1 => 1=SPLPAR capable; 0=not, 0x2 => SPLPAR enabled 0=dedicated, 1=shared */
	SC_SMT_STAT     = 45 /* State of SMT enablement: 0x1 = SMT Capable  0=no/1=yes, 0x2 = SMT Enabled  0=no/1=yes, 0x4 = SMT threads bound true 0=no/1=yes */
	SC_SMT_TC       = 46 /* Number of SMT Threads per Physical CPU */
	SC_VMX_VER      = 47 /* RPA defined VMX version: 0 = VMX not available or disabled, 1 = VMX capable, 2 = VMX and VSX capable */
	SC_LMB_SZ       = 48 /* Size of an LMB on this system. */
	SC_MAX_XCPU     = 49 /* Number of exclusive cpus on line */
	SC_EC_LVL       = 50 /* Kernel error checking level */
	SC_AME_STAT     = 51 /* AME status */
	SC_ECO_STAT     = 52 /* extended cache options */
	SC_DFP_STAT     = 53 /* RPA defined DFP version, 0=none/disabled */
	SC_VRM_STAT     = 54 /* VRM Capable/enabled */
	SC_PHYS_IMP     = 55 /* physical processor implementation */
	SC_PHYS_VER     = 56 /* physical processor version */
	SC_SPCM_STATUS  = 57
	SC_SPCM_MAX     = 58
	SC_TM_VER       = 59 /* Transaction Memory version, 0 - not capable */
	SC_NX_CAP       = 60 /* NX GZIP capable */
	SC_PKS_STATE    = 61 /* Platform KeyStore */
	SC_MMA_VER      = 62
)

/* kernel attributes                        */
/* bit          0/1 meaning                 */
/* -----------------------------------------*/
/* 31   32-bit kernel / 64-bit kernel       */
/* 30   non-LPAR      / LPAR                */
/* 29   old 64bit ABI / 64bit Large ABI     */
/* 28   non-NUMA      / NUMA                */
/* 27   UP            / MP                  */
/* 26   no DR CPU add / DR CPU add support  */
/* 25   no DR CPU rm  / DR CPU rm  support  */
/* 24   no DR MEM add / DR MEM add support  */
/* 23   no DR MEM rm  / DR MEM rm  support  */
/* 22   kernel keys disabled / enabled      */
/* 21   no recovery   / recovery enabled    */
/* 20   non-MLS    / MLS enabled            */
/* 19   enhanced affinity indicator         */
/* 18   non-vTPM    / vTPM enabled          */
/* 17   non-VIOS    / VIOS                  */

// Values for architecture field
const (
	ARCH_POWER_RS = 0x0001 /* Power Classic architecture */
	ARCH_POWER_PC = 0x0002 /* Power PC architecture */
	ARCH_IA64     = 0x0003 /* Intel IA64 architecture */
)

// Values for implementation field for POWER_PC Architectures
const (
	IMPL_POWER_RS1     = 0x00001     /* RS1 class CPU */
	IMPL_POWER_RSC     = 0x00002     /* RSC class CPU */
	IMPL_POWER_RS2     = 0x00004     /* RS2 class CPU */
	IMPL_POWER_601     = 0x00008     /* 601 class CPU */
	IMPL_POWER_603     = 0x00020     /* 603 class CPU */
	IMPL_POWER_604     = 0x00010     /* 604 class CPU */
	IMPL_POWER_620     = 0x00040     /* 620 class CPU */
	IMPL_POWER_630     = 0x00080     /* 630 class CPU */
	IMPL_POWER_A35     = 0x00100     /* A35 class CPU */
	IMPL_POWER_RS64II  = 0x0200      /* RS64-II class CPU */
	IMPL_POWER_RS64III = 0x0400      /* RS64-III class CPU */
	IMPL_POWER4        = 0x0800      /* 4 class CPU */
	IMPL_POWER_RS64IV  = IMPL_POWER4 /* 4 class CPU */
	IMPL_POWER_MPC7450 = 0x1000      /* MPC7450 class CPU */
	IMPL_POWER5        = 0x2000      /* 5 class CPU */
	IMPL_POWER6        = 0x4000      /* 6 class CPU */
	IMPL_POWER7        = 0x8000      /* 7 class CPU */
	IMPL_POWER8        = 0x10000     /* 8 class CPU */
	IMPL_POWER9        = 0x20000     /* 9 class CPU */
	IMPL_POWER10       = 0x20000     /* 10 class CPU */
)

// Values for implementation field for IA64 Architectures
const (
	IMPL_IA64_M1 = 0x0001 /* IA64 M1 class CPU (Itanium) */
	IMPL_IA64_M2 = 0x0002 /* IA64 M2 class CPU */
)

// Values for the version field
const (
	PV_601        = 0x010001 /* Power PC 601 */
	PV_601A       = 0x010002 /* Power PC 601 */
	PV_603        = 0x060000 /* Power PC 603 */
	PV_604        = 0x050000 /* Power PC 604 */
	PV_620        = 0x070000 /* Power PC 620 */
	PV_630        = 0x080000 /* Power PC 630 */
	PV_A35        = 0x090000 /* Power PC A35 */
	PV_RS64II     = 0x0A0000 /* Power PC RS64II */
	PV_RS64III    = 0x0B0000 /* Power PC RS64III */
	PV_4          = 0x0C0000 /* Power PC 4 */
	PV_RS64IV     = PV_4     /* Power PC 4 */
	PV_MPC7450    = 0x0D0000 /* Power PC MPC7450 */
	PV_4_2        = 0x0E0000 /* Power PC 4 */
	PV_4_3        = 0x0E0001 /* Power PC 4 */
	PV_5          = 0x0F0000 /* Power PC 5 */
	PV_5_2        = 0x0F0001 /* Power PC 5 */
	PV_5_3        = 0x0F0002 /* Power PC 5 */
	PV_6          = 0x100000 /* Power PC 6 */
	PV_6_1        = 0x100001 /* Power PC 6 DD1.x */
	PV_7          = 0x200000 /* Power PC 7 */
	PV_8          = 0x300000 /* Power PC 8 */
	PV_9          = 0x400000 /* Power PC 9 */
	PV_10         = 0x500000 /* Power PC 10 */
	PV_5_Compat   = 0x0F8000 /* Power PC 5 */
	PV_6_Compat   = 0x108000 /* Power PC 6 */
	PV_7_Compat   = 0x208000 /* Power PC 7 */
	PV_8_Compat   = 0x308000 /* Power PC 8 */
	PV_9_Compat   = 0x408000 /* Power PC 9 */
	PV_10_Compat  = 0x508000 /* Power PC 10 */
	PV_RESERVED_2 = 0x0A0000 /* source compatability */
	PV_RESERVED_3 = 0x0B0000 /* source compatability */
	PV_RS2        = 0x040000 /* Power RS2 */
	PV_RS1        = 0x020000 /* Power RS1 */
	PV_RSC        = 0x030000 /* Power RSC */
	PV_M1         = 0x008000 /* Intel IA64 M1 */
	PV_M2         = 0x008001 /* Intel IA64 M2 */
)

// Values for rtc_type
const (
	RTC_POWER    = 1 /* rtc as defined by Power Arch. */
	RTC_POWER_PC = 2 /* rtc as defined by Power PC Arch. */
	RTC_IA64     = 3 /* rtc as defined by IA64 Arch. */
)

const NX_GZIP_PRESENT = 0x00000001

const (
	PKS_STATE_CAPABLE = 1
	PKS_STATE_ENABLED = 2
)

// Macros for identifying physical processor
const (
	PPI4_1  = 0x35
	PPI4_2  = 0x38
	PPI4_3  = 0x39
	PPI4_4  = 0x3C
	PPI4_5  = 0x44
	PPI5_1  = 0x3A
	PPI5_2  = 0x3B
	PPI6_1  = 0x3E
	PPI7_1  = 0x3F
	PPI7_2  = 0x4A
	PPI8_1  = 0x4B
	PPI8_2  = 0x4D
	PPI9    = 0x4E
	PPI9_1  = 0x4E
	PPI10_1 = 0x80
)

// Macros for kernel attributes
const (
	KERN_TYPE            = 0x1
	KERN_LPAR            = 0x2
	KERN_64BIT_LARGE_ABI = 0x4
	KERN_NUMA            = 0x8
	KERN_UPMP            = 0x10
	KERN_DR_CPU_ADD      = 0x20
	KERN_DR_CPU_RM       = 0x40
	KERN_DR_MEM_ADD      = 0x80
	KERN_DR_MEM_RM       = 0x100
	KERN_KKEY_ENABLED    = 0x200
	KERN_RECOVERY        = 0x400
	KERN_MLS             = 0x800
	KERN_ENH_AFFINITY    = 0x1000
	KERN_VTPM            = 0x2000
	KERN_VIOS            = 0x4000
)

// macros for SPLPAR environment.
const (
	SPLPAR_CAPABLE        = 0x1
	SPLPAR_ENABLED        = 0x2
	SPLPAR_DONATE_CAPABLE = 0x4
)

// Macros for SMT status determination
const (
	SMT_CAPABLE = 0x1
	SMT_ENABLE  = 0x2
	SMT_BOUND   = 0x4
	SMT_ORDER   = 0x8
)

// Macros for VRM status determination
const (
	VRM_CAPABLE  = 0x1
	VRM_ENABLE   = 0x2
	CMOX_CAPABLE = 0x4
)

// Macros for AME status determination
const AME_ENABLE = 0x1

// Macros for extended cache options
const (
	ECO_CAPABLE = 0x1
	ECO_ENABLE  = 0x2
)

// These define blocks of values for model_arch and model_impl that are reserved for OEM use.
const (
	MODEL_ARCH_RSPC         = 2
	MODEL_ARCH_CHRP         = 3
	MODEL_ARCH_IA64         = 4
	MODEL_ARCH_OEM_START    = 1024
	MODEL_ARCH_OEM_END      = 2047
	MODEL_IMPL_RS6K_UP_MCA  = 1
	MODEL_IMPL_RS6K_SMP_MCA = 2
	MODEL_IMPL_RSPC_UP_PCI  = 3
	MODEL_IMPL_RSPC_SMP_PCI = 4
	MODEL_IMPL_CHRP_UP_PCI  = 5
	MODEL_IMPL_CHRP_SMP_PCI = 6
	MODEL_IMPL_IA64_COM     = 7
	MODEL_IMPL_IA64_SOFTSDV = 8
	MODEL_IMPL_MAMBO_SIM    = 9
	MODEL_IMPL_POWER_KVM    = 10
	MODEL_IMPL_OEM_START    = 1024
	MODEL_IMPL_OEM_END      = 2047
)

// example determining processor compatibilty mode on AIX:
// impl := unix.Getsystemcfg(SC_IMPL)
// if impl&IMPL_POWER8 != 0 {
//     // we are running on POWER8
// }
// if impl&IMPL_POWER9 != 0 {
//     // we are running on POWER9
// }

func GetCPUImplementation() string {
	impl := unix.Getsystemcfg(SC_IMPL)
	switch {
	case impl&IMPL_POWER4 != 0:
		return "POWER4"
	case impl&IMPL_POWER5 != 0:
		return "POWER5"
	case impl&IMPL_POWER6 != 0:
		return "POWER6"
	case impl&IMPL_POWER7 != 0:
		return "POWER7"
	case impl&IMPL_POWER8 != 0:
		return "POWER8"
	case impl&IMPL_POWER9 != 0:
		return "POWER9"
	case impl&IMPL_POWER10 != 0:
		return "Power10"
	default:
		return "Unknown"
	}
}

func POWER10OrNewer() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER10 != 0 {
		return true
	}
	return false
}

func POWER10() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER10 != 0 {
		return true
	}
	return false
}

func POWER9OrNewer() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER10 != 0 || impl&IMPL_POWER9 != 0 {
		return true
	}
	return false
}

func POWER9() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER9 != 0 {
		return true
	}
	return false
}

func POWER8OrNewer() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER10 != 0 || impl&IMPL_POWER9 != 0 || impl&IMPL_POWER8 != 0 {
		return true
	}
	return false
}

func POWER8() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER8 != 0 {
		return true
	}
	return false
}

func POWER7OrNewer() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER10 != 0 || impl&IMPL_POWER9 != 0 || impl&IMPL_POWER8 != 0 || impl&IMPL_POWER7 != 0 {
		return true
	}
	return false
}

func POWER7() bool {
	impl := unix.Getsystemcfg(SC_IMPL)
	if impl&IMPL_POWER7 != 0 {
		return true
	}
	return false
}

func HasTransactionalMemory() bool {
	impl := unix.Getsystemcfg(SC_TM_VER)
	if impl > 0 {
		return true
	}
	return false
}

func Is64Bit() bool {
	impl := unix.Getsystemcfg(SC_WIDTH)
	if impl == 64 {
		return true
	}
	return false
}

func IsSMP() bool {
	impl := unix.Getsystemcfg(SC_NCPUS)
	if impl > 1 {
		return true
	}
	return false
}

func HasVMX() bool {
	impl := unix.Getsystemcfg(SC_VMX_VER)
	if impl > 0 {
		return true
	}
	return false
}

func HasVSX() bool {
	impl := unix.Getsystemcfg(SC_VMX_VER)
	if impl > 1 {
		return true
	}
	return false
}

func HasDFP() bool {
	impl := unix.Getsystemcfg(SC_DFP_STAT)
	if impl > 1 {
		return true
	}
	return false
}

func HasNxGzip() bool {
	impl := unix.Getsystemcfg(SC_NX_CAP)
	if impl&NX_GZIP_PRESENT > 0 {
		return true
	}
	return false
}

func PksCapable() bool {
	impl := unix.Getsystemcfg(SC_PKS_STATE)
	if impl&PKS_STATE_CAPABLE > 0 {
		return true
	}
	return false
}

func PksEnabled() bool {
	impl := unix.Getsystemcfg(SC_PKS_STATE)
	if impl&PKS_STATE_ENABLED > 0 {
		return true
	}
	return false
}

func CPUMode() string {
	impl := unix.Getsystemcfg(SC_VERS)
	switch impl {
	case PV_10, PV_10_Compat:
		return "Power10"
	case PV_9, PV_9_Compat:
		return "POWER9"
	case PV_8, PV_8_Compat:
		return "POWER8"
	case PV_7, PV_7_Compat:
		return "POWER7"
	default:
		return "Unknown"
	}
}

func KernelBits() int {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_TYPE == KERN_TYPE {
		return 64
	}
	return 32
}

func IsLPAR() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_LPAR == KERN_LPAR {
		return true
	}
	return false
}

func CpuAddCapable() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_DR_CPU_ADD == KERN_DR_CPU_ADD {
		return true
	}
	return false
}

func CpuRemoveCapable() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_DR_CPU_RM == KERN_DR_CPU_RM {
		return true
	}
	return false
}

func MemoryAddCapable() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_DR_MEM_ADD == KERN_DR_MEM_ADD {
		return true
	}
	return false
}

func MemoryRemoveCapable() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_DR_MEM_RM == KERN_DR_MEM_RM {
		return true
	}
	return false
}

func DLparCapable() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&(KERN_DR_CPU_ADD|KERN_DR_CPU_RM|KERN_DR_MEM_ADD|KERN_DR_MEM_RM) > 0 {
		return true
	}
	return false
}

func IsNUMA() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_NUMA > 0 {
		return true
	}
	return false
}

func KernelKeys() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_KKEY_ENABLED > 0 {
		return true
	}
	return false
}

func RecoveryMode() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_RECOVERY > 0 {
		return true
	}
	return false
}

func EnhancedAffinity() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_ENH_AFFINITY > 0 {
		return true
	}
	return false
}

func VTpmEnabled() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_VTPM > 0 {
		return true
	}
	return false
}

func IsVIOS() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_VIOS > 0 {
		return true
	}
	return false
}

func MLSEnabled() bool {
	impl := unix.Getsystemcfg(SC_KRN_ATTR)
	if impl&KERN_MLS > 0 {
		return true
	}
	return false
}

func SPLparCapable() bool {
	impl := unix.Getsystemcfg(SC_SPLP_STAT)
	if impl&SPLPAR_CAPABLE > 0 {
		return true
	}
	return false
}

func SPLparEnabled() bool {
	impl := unix.Getsystemcfg(SC_SPLP_STAT)
	if impl&SPLPAR_ENABLED > 0 {
		return true
	}
	return false
}

func DedicatedLpar() bool {
	return !SPLparEnabled()
}

func SPLparCapped() bool {
	impl := unix.Getsystemcfg(SC_VCAPW)
	if impl == 0 {
		return true
	}
	return false
}

func SPLparDonating() bool {
	impl := unix.Getsystemcfg(SC_SPLP_STAT)
	if impl&SPLPAR_DONATE_CAPABLE > 0 {
		return true
	}
	return false
}

func SmtCapable() bool {
	impl := unix.Getsystemcfg(SC_SMT_STAT)
	if impl&SMT_CAPABLE > 0 {
		return true
	}
	return false
}

func SmtEnabled() bool {
	impl := unix.Getsystemcfg(SC_SMT_STAT)
	if impl&SMT_ENABLE > 0 {
		return true
	}
	return false
}

func VrmCapable() bool {
	impl := unix.Getsystemcfg(SC_VRM_STAT)
	if impl&VRM_CAPABLE > 0 {
		return true
	}
	return false
}

func VrmEnabled() bool {
	impl := unix.Getsystemcfg(SC_VRM_STAT)
	if impl&VRM_ENABLE > 0 {
		return true
	}
	return false
}

func AmeEnabled() bool {
	impl := unix.Getsystemcfg(SC_AME_STAT)
	if impl&AME_ENABLE > 0 {
		return true
	}
	return false
}

func EcoCapable() bool {
	impl := unix.Getsystemcfg(SC_ECO_STAT)
	if impl&ECO_CAPABLE > 0 {
		return true
	}
	return false
}

func EcoEnabled() bool {
	impl := unix.Getsystemcfg(SC_ECO_STAT)
	if impl&ECO_ENABLE > 0 {
		return true
	}
	return false
}
