// SPDX-License-Identifier: BSD-3-Clause
//go:build aix

package cpu

import (
	"context"
)

func Times(percpu bool) ([]TimesStat, error) {
	return TimesWithContext(context.Background(), percpu)
}

func Info() ([]InfoStat, error) {
	return InfoWithContext(context.Background())
}
