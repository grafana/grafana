// SPDX-License-Identifier: BSD-3-Clause
//go:build aix

package mem

import (
	"context"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapDevices() ([]*SwapDevice, error) {
	return nil, common.ErrNotImplementedError
}
