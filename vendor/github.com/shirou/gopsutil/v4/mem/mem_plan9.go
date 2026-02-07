// SPDX-License-Identifier: BSD-3-Clause
//go:build plan9

package mem

import (
	"context"
	"os"

	stats "github.com/lufia/plan9stats"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(ctx context.Context) (*SwapMemoryStat, error) {
	root := os.Getenv("HOST_ROOT")
	m, err := stats.ReadMemStats(ctx, stats.WithRootDir(root))
	if err != nil {
		return nil, err
	}
	u := 0.0
	if m.SwapPages.Avail != 0 {
		u = float64(m.SwapPages.Used) / float64(m.SwapPages.Avail) * 100.0
	}
	return &SwapMemoryStat{
		Total:       uint64(m.SwapPages.Avail * m.PageSize),
		Used:        uint64(m.SwapPages.Used * m.PageSize),
		Free:        uint64(m.SwapPages.Free() * m.PageSize),
		UsedPercent: u,
	}, nil
}

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(ctx context.Context) (*VirtualMemoryStat, error) {
	root := os.Getenv("HOST_ROOT")
	m, err := stats.ReadMemStats(ctx, stats.WithRootDir(root))
	if err != nil {
		return nil, err
	}
	u := 0.0
	if m.UserPages.Avail != 0 {
		u = float64(m.UserPages.Used) / float64(m.UserPages.Avail) * 100.0
	}
	return &VirtualMemoryStat{
		Total:       uint64(m.Total),
		Available:   uint64(m.UserPages.Free() * m.PageSize),
		Used:        uint64(m.UserPages.Used * m.PageSize),
		UsedPercent: u,
		Free:        uint64(m.UserPages.Free() * m.PageSize),

		SwapTotal: uint64(m.SwapPages.Avail * m.PageSize),
		SwapFree:  uint64(m.SwapPages.Free() * m.PageSize),
	}, nil
}

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(_ context.Context) ([]*SwapDevice, error) {
	return nil, common.ErrNotImplementedError
}
