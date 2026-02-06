// SPDX-License-Identifier: BSD-3-Clause
//go:build netbsd

package cpu

import (
	"context"
	"fmt"
	"runtime"
	"unsafe"

	"github.com/tklauser/go-sysconf"
	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/internal/common"
)

const (
	// sys/sysctl.h
	ctlKern    = 1  // "high kernel": proc, limits
	ctlHw      = 6  // CTL_HW
	kernCpTime = 51 // KERN_CPTIME
)

var ClocksPerSec = float64(100)

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

func TimesWithContext(_ context.Context, percpu bool) (ret []TimesStat, err error) {
	if !percpu {
		mib := []int32{ctlKern, kernCpTime}
		buf, _, err := common.CallSyscall(mib)
		if err != nil {
			return ret, err
		}
		times := (*cpuTimes)(unsafe.Pointer(&buf[0]))
		stat := TimesStat{
			CPU:    "cpu-total",
			User:   float64(times.User),
			Nice:   float64(times.Nice),
			System: float64(times.Sys),
			Idle:   float64(times.Idle),
			Irq:    float64(times.Intr),
		}
		return []TimesStat{stat}, nil
	}

	ncpu, err := unix.SysctlUint32("hw.ncpu")
	if err != nil {
		return //nolint:nakedret //FIXME
	}

	var i uint32
	for i = 0; i < ncpu; i++ {
		mib := []int32{ctlKern, kernCpTime, int32(i)}
		buf, _, err := common.CallSyscall(mib)
		if err != nil {
			return ret, err
		}

		stats := (*cpuTimes)(unsafe.Pointer(&buf[0]))
		ret = append(ret, TimesStat{
			CPU:    fmt.Sprintf("cpu%d", i),
			User:   float64(stats.User),
			Nice:   float64(stats.Nice),
			System: float64(stats.Sys),
			Idle:   float64(stats.Idle),
			Irq:    float64(stats.Intr),
		})
	}

	return ret, nil
}

// Returns only one (minimal) CPUInfoStat on NetBSD
func Info() ([]InfoStat, error) {
	return InfoWithContext(context.Background())
}

func InfoWithContext(_ context.Context) ([]InfoStat, error) {
	var ret []InfoStat
	var err error

	c := InfoStat{}

	mhz, err := unix.Sysctl("machdep.dmi.processor-frequency")
	if err != nil {
		return nil, err
	}
	_, err = fmt.Sscanf(mhz, "%f", &c.Mhz)
	if err != nil {
		return nil, err
	}

	ncpu, err := unix.SysctlUint32("hw.ncpuonline")
	if err != nil {
		return nil, err
	}
	c.Cores = int32(ncpu)

	if c.ModelName, err = unix.Sysctl("machdep.dmi.processor-version"); err != nil {
		return nil, err
	}

	return append(ret, c), nil
}

func CountsWithContext(_ context.Context, _ bool) (int, error) {
	return runtime.NumCPU(), nil
}
