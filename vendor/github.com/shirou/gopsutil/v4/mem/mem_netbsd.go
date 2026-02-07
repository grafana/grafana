// SPDX-License-Identifier: BSD-3-Clause
//go:build netbsd

package mem

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/sys/unix"
)

func GetPageSize() (uint64, error) {
	return GetPageSizeWithContext(context.Background())
}

func GetPageSizeWithContext(_ context.Context) (uint64, error) {
	uvmexp, err := unix.SysctlUvmexp("vm.uvmexp2")
	if err != nil {
		return 0, err
	}
	return uint64(uvmexp.Pagesize), nil
}

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(_ context.Context) (*VirtualMemoryStat, error) {
	uvmexp, err := unix.SysctlUvmexp("vm.uvmexp2")
	if err != nil {
		return nil, err
	}
	p := uint64(uvmexp.Pagesize)

	ret := &VirtualMemoryStat{
		Total:    uint64(uvmexp.Npages) * p,
		Free:     uint64(uvmexp.Free) * p,
		Active:   uint64(uvmexp.Active) * p,
		Inactive: uint64(uvmexp.Inactive) * p,
		Cached:   0, // not available
		Wired:    uint64(uvmexp.Wired) * p,
	}

	ret.Available = ret.Inactive + ret.Cached + ret.Free
	ret.Used = ret.Total - ret.Available
	ret.UsedPercent = float64(ret.Used) / float64(ret.Total) * 100.0

	// Get buffers from vm.bufmem sysctl
	ret.Buffers, err = unix.SysctlUint64("vm.bufmem")
	if err != nil {
		return nil, err
	}

	return ret, nil
}

// Return swapctl summary info
func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(ctx context.Context) (*SwapMemoryStat, error) {
	out, err := invoke.CommandWithContext(ctx, "swapctl", "-sk")
	if err != nil {
		return &SwapMemoryStat{}, nil
	}

	line := string(out)
	var total, used, free uint64

	_, err = fmt.Sscanf(line,
		"total: %d 1K-blocks allocated, %d used, %d available",
		&total, &used, &free)
	if err != nil {
		return nil, errors.New("failed to parse swapctl output")
	}

	percent := float64(used) / float64(total) * 100
	return &SwapMemoryStat{
		Total:       total * 1024,
		Used:        used * 1024,
		Free:        free * 1024,
		UsedPercent: percent,
	}, nil
}
