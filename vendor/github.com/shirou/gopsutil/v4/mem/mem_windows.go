// SPDX-License-Identifier: BSD-3-Clause
//go:build windows

package mem

import (
	"context"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/shirou/gopsutil/v4/internal/common"
)

var (
	procEnumPageFilesW       = common.ModPsapi.NewProc("EnumPageFilesW")
	procGetNativeSystemInfo  = common.Modkernel32.NewProc("GetNativeSystemInfo")
	procGetPerformanceInfo   = common.ModPsapi.NewProc("GetPerformanceInfo")
	procGlobalMemoryStatusEx = common.Modkernel32.NewProc("GlobalMemoryStatusEx")
)

type memoryStatusEx struct {
	cbSize                  uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64 // in bytes
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(_ context.Context) (*VirtualMemoryStat, error) {
	var memInfo memoryStatusEx
	memInfo.cbSize = uint32(unsafe.Sizeof(memInfo))
	mem, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memInfo)))
	if mem == 0 {
		return nil, windows.GetLastError()
	}

	ret := &VirtualMemoryStat{
		Total:       memInfo.ullTotalPhys,
		Available:   memInfo.ullAvailPhys,
		Free:        memInfo.ullAvailPhys,
		UsedPercent: float64(memInfo.dwMemoryLoad),
	}

	ret.Used = ret.Total - ret.Available
	return ret, nil
}

type performanceInformation struct {
	cb                uint32
	commitTotal       uint64
	commitLimit       uint64
	commitPeak        uint64
	physicalTotal     uint64
	physicalAvailable uint64
	systemCache       uint64
	kernelTotal       uint64
	kernelPaged       uint64
	kernelNonpaged    uint64
	pageSize          uint64
	handleCount       uint32
	processCount      uint32
	threadCount       uint32
}

func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(_ context.Context) (*SwapMemoryStat, error) {
	// Use the performance counter to get the swap usage percentage
	counter, err := common.NewWin32PerformanceCounter("swap_percentage", `\Paging File(_Total)\% Usage`)
	if err != nil {
		return nil, err
	}
	defer common.PdhCloseQuery.Call(uintptr(counter.Query))

	usedPercent, err := counter.GetValue()
	if err != nil {
		return nil, err
	}

	// Get total memory from performance information
	var perfInfo performanceInformation
	perfInfo.cb = uint32(unsafe.Sizeof(perfInfo))
	mem, _, _ := procGetPerformanceInfo.Call(uintptr(unsafe.Pointer(&perfInfo)), uintptr(perfInfo.cb))
	if mem == 0 {
		return nil, windows.GetLastError()
	}
	totalPhys := perfInfo.physicalTotal * perfInfo.pageSize
	totalSys := perfInfo.commitLimit * perfInfo.pageSize
	total := totalSys - totalPhys

	var used uint64
	if total > 0 {
		used = uint64(0.01 * usedPercent * float64(total))
	} else {
		usedPercent = 0.0
		used = 0
	}

	ret := &SwapMemoryStat{
		Total:       total,
		Used:        used,
		Free:        total - used,
		UsedPercent: common.Round(usedPercent, 1),
	}

	return ret, nil
}

var (
	pageSize     uint64
	pageSizeOnce sync.Once
)

type systemInfo struct {
	wProcessorArchitecture      uint16
	wReserved                   uint16
	dwPageSize                  uint32
	lpMinimumApplicationAddress uintptr
	lpMaximumApplicationAddress uintptr
	dwActiveProcessorMask       uintptr
	dwNumberOfProcessors        uint32
	dwProcessorType             uint32
	dwAllocationGranularity     uint32
	wProcessorLevel             uint16
	wProcessorRevision          uint16
}

// system type as defined in https://docs.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-enum_page_file_information
type enumPageFileInformation struct {
	cb         uint32
	reserved   uint32
	totalSize  uint64
	totalInUse uint64
	peakUsage  uint64
}

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(_ context.Context) ([]*SwapDevice, error) {
	pageSizeOnce.Do(func() {
		var sysInfo systemInfo
		procGetNativeSystemInfo.Call(uintptr(unsafe.Pointer(&sysInfo)))
		pageSize = uint64(sysInfo.dwPageSize)
	})

	// the following system call invokes the supplied callback function once for each page file before returning
	// see https://docs.microsoft.com/en-us/windows/win32/api/psapi/nf-psapi-enumpagefilesw
	var swapDevices []*SwapDevice
	result, _, _ := procEnumPageFilesW.Call(windows.NewCallback(pEnumPageFileCallbackW), uintptr(unsafe.Pointer(&swapDevices)))
	if result == 0 {
		return nil, windows.GetLastError()
	}

	return swapDevices, nil
}

// system callback as defined in https://docs.microsoft.com/en-us/windows/win32/api/psapi/nc-psapi-penum_page_file_callbackw
func pEnumPageFileCallbackW(swapDevices *[]*SwapDevice, enumPageFileInfo *enumPageFileInformation, lpFilenamePtr *[syscall.MAX_LONG_PATH]uint16) *bool {
	*swapDevices = append(*swapDevices, &SwapDevice{
		Name:      syscall.UTF16ToString((*lpFilenamePtr)[:]),
		UsedBytes: enumPageFileInfo.totalInUse * pageSize,
		FreeBytes: (enumPageFileInfo.totalSize - enumPageFileInfo.totalInUse) * pageSize,
	})

	// return true to continue enumerating page files
	ret := true
	return &ret
}
