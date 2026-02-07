// SPDX-License-Identifier: BSD-3-Clause
//go:build aix && cgo

package cpu

import (
	"context"

	"github.com/power-devops/perfstat"
)

func TimesWithContext(ctx context.Context, percpu bool) ([]TimesStat, error) {
	var ret []TimesStat
	if percpu {
		cpus, err := perfstat.CpuStat()
		if err != nil {
			return nil, err
		}
		for _, c := range cpus {
			ct := &TimesStat{
				CPU:    c.Name,
				Idle:   float64(c.Idle),
				User:   float64(c.User),
				System: float64(c.Sys),
				Iowait: float64(c.Wait),
			}
			ret = append(ret, *ct)
		}
	} else {
		c, err := perfstat.CpuUtilTotalStat()
		if err != nil {
			return nil, err
		}
		ct := &TimesStat{
			CPU:    "cpu-total",
			Idle:   float64(c.IdlePct),
			User:   float64(c.UserPct),
			System: float64(c.KernPct),
			Iowait: float64(c.WaitPct),
		}
		ret = append(ret, *ct)
	}
	return ret, nil
}

func InfoWithContext(ctx context.Context) ([]InfoStat, error) {
	c, err := perfstat.CpuTotalStat()
	if err != nil {
		return nil, err
	}
	info := InfoStat{
		CPU:   0,
		Mhz:   float64(c.ProcessorHz / 1000000),
		Cores: int32(c.NCpusCfg),
	}
	result := []InfoStat{info}
	return result, nil
}

func CountsWithContext(ctx context.Context, logical bool) (int, error) {
	c, err := perfstat.CpuTotalStat()
	if err != nil {
		return 0, err
	}
	return c.NCpusCfg, nil
}
