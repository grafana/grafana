// SPDX-License-Identifier: BSD-3-Clause
//go:build aix && cgo

package mem

import (
	"context"

	"github.com/power-devops/perfstat"
)

func VirtualMemoryWithContext(ctx context.Context) (*VirtualMemoryStat, error) {
	m, err := perfstat.MemoryTotalStat()
	if err != nil {
		return nil, err
	}
	pagesize := uint64(4096)
	ret := VirtualMemoryStat{
		Total:       uint64(m.RealTotal) * pagesize,
		Available:   uint64(m.RealAvailable) * pagesize,
		Free:        uint64(m.RealFree) * pagesize,
		Used:        uint64(m.RealInUse) * pagesize,
		UsedPercent: 100 * float64(m.RealInUse) / float64(m.RealTotal),
		Active:      uint64(m.VirtualActive) * pagesize,
		SwapTotal:   uint64(m.PgSpTotal) * pagesize,
		SwapFree:    uint64(m.PgSpFree) * pagesize,
	}
	return &ret, nil
}

func SwapMemoryWithContext(ctx context.Context) (*SwapMemoryStat, error) {
	m, err := perfstat.MemoryTotalStat()
	if err != nil {
		return nil, err
	}
	pagesize := uint64(4096)
	swapUsed := uint64(m.PgSpTotal-m.PgSpFree-m.PgSpRsvd) * pagesize
	swapTotal := uint64(m.PgSpTotal) * pagesize
	ret := SwapMemoryStat{
		Total:       swapTotal,
		Free:        uint64(m.PgSpFree) * pagesize,
		Used:        swapUsed,
		UsedPercent: float64(100*swapUsed) / float64(swapTotal),
		Sin:         uint64(m.PgSpIn),
		Sout:        uint64(m.PgSpOut),
		PgIn:        uint64(m.PageIn),
		PgOut:       uint64(m.PageOut),
		PgFault:     uint64(m.PageFaults),
	}
	return &ret, nil
}
