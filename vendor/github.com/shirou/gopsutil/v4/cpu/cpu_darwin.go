// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin

package cpu

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"unsafe"

	"github.com/tklauser/go-sysconf"
	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/internal/common"
)

// sys/resource.h
const (
	CPUser    = 0
	cpNice    = 1
	cpSys     = 2
	cpIntr    = 3
	cpIdle    = 4
	cpUStates = 5
)

// mach/machine.h
const (
	cpuStateUser   = 0
	cpuStateSystem = 1
	cpuStateIdle   = 2
	cpuStateNice   = 3
	cpuStateMax    = 4
)

// mach/processor_info.h
const (
	processorCpuLoadInfo = 2 //nolint:revive //FIXME
)

type hostCpuLoadInfoData struct { //nolint:revive //FIXME
	cpuTicks [cpuStateMax]uint32
}

// default value. from time.h
var ClocksPerSec = float64(128)

func init() {
	clkTck, err := sysconf.Sysconf(sysconf.SC_CLK_TCK)
	// ignore errors
	if err == nil {
		ClocksPerSec = float64(clkTck)
	}
}

func Times(percpu bool) ([]TimesStat, error) {
	return TimesWithContext(context.Background(), percpu)
}

func TimesWithContext(_ context.Context, percpu bool) ([]TimesStat, error) {
	lib, err := common.NewLibrary(common.System)
	if err != nil {
		return nil, err
	}
	defer lib.Close()

	if percpu {
		return perCPUTimes(lib)
	}

	return allCPUTimes(lib)
}

// Returns only one CPUInfoStat on FreeBSD
func Info() ([]InfoStat, error) {
	return InfoWithContext(context.Background())
}

func InfoWithContext(_ context.Context) ([]InfoStat, error) {
	var ret []InfoStat

	c := InfoStat{}
	c.ModelName, _ = unix.Sysctl("machdep.cpu.brand_string")
	family, _ := unix.SysctlUint32("machdep.cpu.family")
	c.Family = strconv.FormatUint(uint64(family), 10)
	model, _ := unix.SysctlUint32("machdep.cpu.model")
	c.Model = strconv.FormatUint(uint64(model), 10)
	stepping, _ := unix.SysctlUint32("machdep.cpu.stepping")
	c.Stepping = int32(stepping)
	features, err := unix.Sysctl("machdep.cpu.features")
	if err == nil {
		for _, v := range strings.Fields(features) {
			c.Flags = append(c.Flags, strings.ToLower(v))
		}
	}
	leaf7Features, err := unix.Sysctl("machdep.cpu.leaf7_features")
	if err == nil {
		for _, v := range strings.Fields(leaf7Features) {
			c.Flags = append(c.Flags, strings.ToLower(v))
		}
	}
	extfeatures, err := unix.Sysctl("machdep.cpu.extfeatures")
	if err == nil {
		for _, v := range strings.Fields(extfeatures) {
			c.Flags = append(c.Flags, strings.ToLower(v))
		}
	}
	cores, _ := unix.SysctlUint32("machdep.cpu.core_count")
	c.Cores = int32(cores)
	cacheSize, _ := unix.SysctlUint32("machdep.cpu.cache.size")
	c.CacheSize = int32(cacheSize)
	c.VendorID, _ = unix.Sysctl("machdep.cpu.vendor")

	v, err := getFrequency()
	if err == nil {
		c.Mhz = v
	}

	return append(ret, c), nil
}

func CountsWithContext(_ context.Context, logical bool) (int, error) {
	var cpuArgument string
	if logical {
		cpuArgument = "hw.logicalcpu"
	} else {
		cpuArgument = "hw.physicalcpu"
	}

	count, err := unix.SysctlUint32(cpuArgument)
	if err != nil {
		return 0, err
	}

	return int(count), nil
}

func perCPUTimes(machLib *common.Library) ([]TimesStat, error) {
	machHostSelf := common.GetFunc[common.MachHostSelfFunc](machLib, common.MachHostSelfSym)
	machTaskSelf := common.GetFunc[common.MachTaskSelfFunc](machLib, common.MachTaskSelfSym)
	hostProcessorInfo := common.GetFunc[common.HostProcessorInfoFunc](machLib, common.HostProcessorInfoSym)
	vmDeallocate := common.GetFunc[common.VMDeallocateFunc](machLib, common.VMDeallocateSym)

	var count, ncpu uint32
	var cpuload *hostCpuLoadInfoData

	status := hostProcessorInfo(machHostSelf(), processorCpuLoadInfo, &ncpu, uintptr(unsafe.Pointer(&cpuload)), &count)

	if status != common.KERN_SUCCESS {
		return nil, fmt.Errorf("host_processor_info error=%d", status)
	}

	defer vmDeallocate(machTaskSelf(), uintptr(unsafe.Pointer(cpuload)), uintptr(ncpu))

	ret := []TimesStat{}
	loads := unsafe.Slice(cpuload, ncpu)

	for i := 0; i < int(ncpu); i++ {
		c := TimesStat{
			CPU:    fmt.Sprintf("cpu%d", i),
			User:   float64(loads[i].cpuTicks[cpuStateUser]) / ClocksPerSec,
			System: float64(loads[i].cpuTicks[cpuStateSystem]) / ClocksPerSec,
			Nice:   float64(loads[i].cpuTicks[cpuStateNice]) / ClocksPerSec,
			Idle:   float64(loads[i].cpuTicks[cpuStateIdle]) / ClocksPerSec,
		}

		ret = append(ret, c)
	}

	return ret, nil
}

func allCPUTimes(machLib *common.Library) ([]TimesStat, error) {
	machHostSelf := common.GetFunc[common.MachHostSelfFunc](machLib, common.MachHostSelfSym)
	hostStatistics := common.GetFunc[common.HostStatisticsFunc](machLib, common.HostStatisticsSym)

	var cpuload hostCpuLoadInfoData
	count := uint32(cpuStateMax)

	status := hostStatistics(machHostSelf(), common.HOST_CPU_LOAD_INFO,
		uintptr(unsafe.Pointer(&cpuload)), &count)

	if status != common.KERN_SUCCESS {
		return nil, fmt.Errorf("host_statistics error=%d", status)
	}

	c := TimesStat{
		CPU:    "cpu-total",
		User:   float64(cpuload.cpuTicks[cpuStateUser]) / ClocksPerSec,
		System: float64(cpuload.cpuTicks[cpuStateSystem]) / ClocksPerSec,
		Nice:   float64(cpuload.cpuTicks[cpuStateNice]) / ClocksPerSec,
		Idle:   float64(cpuload.cpuTicks[cpuStateIdle]) / ClocksPerSec,
	}

	return []TimesStat{c}, nil
}
