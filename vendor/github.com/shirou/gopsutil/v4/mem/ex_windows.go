// SPDX-License-Identifier: BSD-3-Clause
//go:build windows

package mem

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

// ExVirtualMemory represents Windows specific information
// https://learn.microsoft.com/en-us/windows/win32/api/sysinfoapi/ns-sysinfoapi-memorystatusex
// https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-performance_information
type ExVirtualMemory struct {
	CommitLimit  uint64 `json:"commitLimit"`
	CommitTotal  uint64 `json:"commitTotal"`
	VirtualTotal uint64 `json:"virtualTotal"`
	VirtualAvail uint64 `json:"virtualAvail"`
}

type ExWindows struct{}

func NewExWindows() *ExWindows {
	return &ExWindows{}
}

func (e *ExWindows) VirtualMemory() (*ExVirtualMemory, error) {
	var memInfo memoryStatusEx
	memInfo.cbSize = uint32(unsafe.Sizeof(memInfo))
	mem, _, _ := procGlobalMemoryStatusEx.Call(uintptr(unsafe.Pointer(&memInfo)))
	if mem == 0 {
		return nil, windows.GetLastError()
	}

	var perfInfo performanceInformation
	perfInfo.cb = uint32(unsafe.Sizeof(perfInfo))
	perf, _, _ := procGetPerformanceInfo.Call(uintptr(unsafe.Pointer(&perfInfo)), uintptr(perfInfo.cb))
	if perf == 0 {
		return nil, windows.GetLastError()
	}

	ret := &ExVirtualMemory{
		CommitLimit:  perfInfo.commitLimit * perfInfo.pageSize,
		CommitTotal:  perfInfo.commitTotal * perfInfo.pageSize,
		VirtualTotal: memInfo.ullTotalVirtual,
		VirtualAvail: memInfo.ullAvailVirtual,
	}

	return ret, nil
}
