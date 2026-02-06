// SPDX-License-Identifier: BSD-3-Clause
//go:build !darwin && !linux && !freebsd && !openbsd && !solaris && !windows && !plan9 && !aix && !netbsd

package mem

import (
	"context"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(_ context.Context) (*VirtualMemoryStat, error) {
	return nil, common.ErrNotImplementedError
}

func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(_ context.Context) (*SwapMemoryStat, error) {
	return nil, common.ErrNotImplementedError
}

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(_ context.Context) ([]*SwapDevice, error) {
	return nil, common.ErrNotImplementedError
}
