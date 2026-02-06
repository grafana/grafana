// SPDX-License-Identifier: BSD-3-Clause
//go:build plan9

package cpu

import (
	"context"
	"os"
	"runtime"

	stats "github.com/lufia/plan9stats"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func Times(percpu bool) ([]TimesStat, error) {
	return TimesWithContext(context.Background(), percpu)
}

func TimesWithContext(ctx context.Context, _ bool) ([]TimesStat, error) {
	// BUG: percpu flag is not supported yet.
	root := os.Getenv("HOST_ROOT")
	c, err := stats.ReadCPUType(ctx, stats.WithRootDir(root))
	if err != nil {
		return nil, err
	}
	s, err := stats.ReadCPUStats(ctx, stats.WithRootDir(root))
	if err != nil {
		return nil, err
	}
	return []TimesStat{
		{
			CPU:    c.Name,
			User:   s.User.Seconds(),
			System: s.Sys.Seconds(),
			Idle:   s.Idle.Seconds(),
		},
	}, nil
}

func Info() ([]InfoStat, error) {
	return InfoWithContext(context.Background())
}

func InfoWithContext(_ context.Context) ([]InfoStat, error) {
	return []InfoStat{}, common.ErrNotImplementedError
}

func CountsWithContext(_ context.Context, _ bool) (int, error) {
	return runtime.NumCPU(), nil
}
