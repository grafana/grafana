// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin

package mem

import (
	"context"
	"fmt"
	"unsafe"

	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func getHwMemsize() (uint64, error) {
	total, err := unix.SysctlUint64("hw.memsize")
	if err != nil {
		return 0, err
	}
	return total, nil
}

// xsw_usage in sys/sysctl.h
type swapUsage struct {
	Total     uint64
	Avail     uint64
	Used      uint64
	Pagesize  int32
	Encrypted bool
}

// SwapMemory returns swapinfo.
func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(_ context.Context) (*SwapMemoryStat, error) {
	// https://github.com/yanllearnn/go-osstat/blob/ae8a279d26f52ec946a03698c7f50a26cfb427e3/memory/memory_darwin.go
	var ret *SwapMemoryStat

	value, err := unix.SysctlRaw("vm.swapusage")
	if err != nil {
		return ret, err
	}
	if len(value) != 32 {
		return ret, fmt.Errorf("unexpected output of sysctl vm.swapusage: %v (len: %d)", value, len(value))
	}
	swap := (*swapUsage)(unsafe.Pointer(&value[0]))

	u := float64(0)
	if swap.Total != 0 {
		u = ((float64(swap.Total) - float64(swap.Avail)) / float64(swap.Total)) * 100.0
	}

	ret = &SwapMemoryStat{
		Total:       swap.Total,
		Used:        swap.Used,
		Free:        swap.Avail,
		UsedPercent: u,
	}

	return ret, nil
}

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(_ context.Context) ([]*SwapDevice, error) {
	return nil, common.ErrNotImplementedError
}

type vmStatisticsData struct {
	freeCount     uint32
	activeCount   uint32
	inactiveCount uint32
	wireCount     uint32
	_             [44]byte // Not used here
}

// VirtualMemory returns VirtualmemoryStat.
func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(_ context.Context) (*VirtualMemoryStat, error) {
	machLib, err := common.NewLibrary(common.System)
	if err != nil {
		return nil, err
	}
	defer machLib.Close()

	hostStatistics := common.GetFunc[common.HostStatisticsFunc](machLib, common.HostStatisticsSym)
	machHostSelf := common.GetFunc[common.MachHostSelfFunc](machLib, common.MachHostSelfSym)

	count := uint32(common.HOST_VM_INFO_COUNT)
	var vmstat vmStatisticsData

	status := hostStatistics(machHostSelf(), common.HOST_VM_INFO,
		uintptr(unsafe.Pointer(&vmstat)), &count)

	if status != common.KERN_SUCCESS {
		return nil, fmt.Errorf("host_statistics error=%d", status)
	}

	pageSizeAddr, _ := machLib.Dlsym("vm_kernel_page_size")
	pageSize := **(**uint64)(unsafe.Pointer(&pageSizeAddr))
	total, err := getHwMemsize()
	if err != nil {
		return nil, err
	}
	totalCount := uint32(total / pageSize)

	availableCount := vmstat.inactiveCount + vmstat.freeCount
	usedPercent := 100 * float64(totalCount-availableCount) / float64(totalCount)

	usedCount := totalCount - availableCount

	return &VirtualMemoryStat{
		Total:       total,
		Available:   pageSize * uint64(availableCount),
		Used:        pageSize * uint64(usedCount),
		UsedPercent: usedPercent,
		Free:        pageSize * uint64(vmstat.freeCount),
		Active:      pageSize * uint64(vmstat.activeCount),
		Inactive:    pageSize * uint64(vmstat.inactiveCount),
		Wired:       pageSize * uint64(vmstat.wireCount),
	}, nil
}
