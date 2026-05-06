// Copyright (c) 2020 Klaus Post, released under MIT License. See LICENSE file.

package cpuid

import (
	"runtime"
	"strings"

	"golang.org/x/sys/unix"
)

func detectOS(c *CPUInfo) bool {
	if runtime.GOOS != "ios" {
		tryToFillCPUInfoFomSysctl(c)
	}
	// There are no hw.optional sysctl values for the below features on Mac OS 11.0
	// to detect their supported state dynamically. Assume the CPU features that
	// Apple Silicon M1 supports to be available as a minimal set of features
	// to all Go programs running on darwin/arm64.
	// TODO: Add more if we know them.
	c.featureSet.setIf(runtime.GOOS != "ios", AESARM, PMULL, SHA1, SHA2)

	return true
}

func sysctlGetBool(name string) bool {
	value, err := unix.SysctlUint32(name)
	if err != nil {
		return false
	}
	return value != 0
}

func sysctlGetString(name string) string {
	value, err := unix.Sysctl(name)
	if err != nil {
		return ""
	}
	return value
}

func sysctlGetInt(unknown int, names ...string) int {
	for _, name := range names {
		value, err := unix.SysctlUint32(name)
		if err != nil {
			continue
		}
		if value != 0 {
			return int(value)
		}
	}
	return unknown
}

func sysctlGetInt64(unknown int, names ...string) int {
	for _, name := range names {
		value64, err := unix.SysctlUint64(name)
		if err != nil {
			continue
		}
		if int(value64) != unknown {
			return int(value64)
		}
	}
	return unknown
}

func setFeature(c *CPUInfo, name string, feature FeatureID) {
	c.featureSet.setIf(sysctlGetBool(name), feature)
}
func tryToFillCPUInfoFomSysctl(c *CPUInfo) {
	c.BrandName = sysctlGetString("machdep.cpu.brand_string")

	if len(c.BrandName) != 0 {
		c.VendorString = strings.Fields(c.BrandName)[0]
	}

	c.PhysicalCores = sysctlGetInt(runtime.NumCPU(), "hw.physicalcpu")
	c.ThreadsPerCore = sysctlGetInt(1, "machdep.cpu.thread_count", "kern.num_threads") /
		sysctlGetInt(1, "hw.physicalcpu")
	c.LogicalCores = sysctlGetInt(runtime.NumCPU(), "machdep.cpu.core_count")
	c.Family = sysctlGetInt(0, "machdep.cpu.family", "hw.cpufamily")
	c.Model = sysctlGetInt(0, "machdep.cpu.model")
	c.CacheLine = sysctlGetInt64(0, "hw.cachelinesize")
	c.Cache.L1I = sysctlGetInt64(-1, "hw.l1icachesize")
	c.Cache.L1D = sysctlGetInt64(-1, "hw.l1dcachesize")
	c.Cache.L2 = sysctlGetInt64(-1, "hw.l2cachesize")
	c.Cache.L3 = sysctlGetInt64(-1, "hw.l3cachesize")

	// from https://developer.arm.com/downloads/-/exploration-tools/feature-names-for-a-profile
	setFeature(c, "hw.optional.arm.FEAT_AES", AESARM)
	setFeature(c, "hw.optional.AdvSIMD", ASIMD)
	setFeature(c, "hw.optional.arm.FEAT_DotProd", ASIMDDP)
	setFeature(c, "hw.optional.arm.FEAT_RDM", ASIMDRDM)
	setFeature(c, "hw.optional.FEAT_CRC32", CRC32)
	setFeature(c, "hw.optional.arm.FEAT_DPB", DCPOP)
	// setFeature(c, "", EVTSTRM)
	setFeature(c, "hw.optional.arm.FEAT_FCMA", FCMA)
	setFeature(c, "hw.optional.arm.FEAT_FHM", FHM)
	setFeature(c, "hw.optional.arm.FEAT_FP", FP)
	setFeature(c, "hw.optional.arm.FEAT_FP16", FPHP)
	setFeature(c, "hw.optional.arm.FEAT_PAuth", GPA)
	setFeature(c, "hw.optional.arm.FEAT_RNG", RNDR)
	setFeature(c, "hw.optional.arm.FEAT_JSCVT", JSCVT)
	setFeature(c, "hw.optional.arm.FEAT_LRCPC", LRCPC)
	setFeature(c, "hw.optional.arm.FEAT_PMULL", PMULL)
	setFeature(c, "hw.optional.arm.FEAT_SHA1", SHA1)
	setFeature(c, "hw.optional.arm.FEAT_SHA256", SHA2)
	setFeature(c, "hw.optional.arm.FEAT_SHA3", SHA3)
	setFeature(c, "hw.optional.arm.FEAT_SHA512", SHA512)
	setFeature(c, "hw.optional.arm.FEAT_TLBIOS", TLB)
	setFeature(c, "hw.optional.arm.FEAT_TLBIRANGE", TLB)
	setFeature(c, "hw.optional.arm.FEAT_FlagM", TS)
	setFeature(c, "hw.optional.arm.FEAT_FlagM2", TS)
	// setFeature(c, "", SM3)
	// setFeature(c, "", SM4)
	setFeature(c, "hw.optional.arm.FEAT_SVE", SVE)

	// from empirical observation
	setFeature(c, "hw.optional.AdvSIMD_HPFPCvt", ASIMDHP)
	setFeature(c, "hw.optional.armv8_1_atomics", ATOMICS)
	setFeature(c, "hw.optional.floatingpoint", FP)
	setFeature(c, "hw.optional.armv8_2_sha3", SHA3)
	setFeature(c, "hw.optional.armv8_2_sha512", SHA512)
	setFeature(c, "hw.optional.armv8_3_compnum", FCMA)
	setFeature(c, "hw.optional.armv8_crc32", CRC32)
}
