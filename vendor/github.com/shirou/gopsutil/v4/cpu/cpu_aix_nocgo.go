// SPDX-License-Identifier: BSD-3-Clause
//go:build aix && !cgo

package cpu

import (
	"context"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func TimesWithContext(ctx context.Context, percpu bool) ([]TimesStat, error) {
	var ret []TimesStat
	if percpu {
		perOut, err := invoke.CommandWithContext(ctx, "sar", "-u", "-P", "ALL", "10", "1")
		if err != nil {
			return nil, err
		}
		lines := strings.Split(string(perOut), "\n")
		if len(lines) < 6 {
			return []TimesStat{}, common.ErrNotImplementedError
		}

		hp := strings.Fields(lines[5]) // headers
		for l := 6; l < len(lines)-1; l++ {
			ct := &TimesStat{}
			v := strings.Fields(lines[l]) // values
			for i, header := range hp {
				// We're done in any of these use cases
				if i >= len(v) || v[0] == "-" {
					break
				}

				// Position variable for v
				pos := i
				// There is a missing field at the beginning of all but the first line
				// so adjust the position
				if l > 6 {
					pos = i - 1
				}
				// We don't want invalid positions
				if pos < 0 {
					continue
				}

				if t, err := strconv.ParseFloat(v[pos], 64); err == nil {
					switch header {
					case `cpu`:
						ct.CPU = strconv.FormatFloat(t, 'f', -1, 64)
					case `%usr`:
						ct.User = t
					case `%sys`:
						ct.System = t
					case `%wio`:
						ct.Iowait = t
					case `%idle`:
						ct.Idle = t
					}
				}
			}
			// Valid CPU data, so append it
			ret = append(ret, *ct)
		}
	} else {
		out, err := invoke.CommandWithContext(ctx, "sar", "-u", "10", "1")
		if err != nil {
			return nil, err
		}
		lines := strings.Split(string(out), "\n")
		if len(lines) < 5 {
			return []TimesStat{}, common.ErrNotImplementedError
		}

		ct := &TimesStat{CPU: "cpu-total"}
		h := strings.Fields(lines[len(lines)-3]) // headers
		v := strings.Fields(lines[len(lines)-2]) // values
		for i, header := range h {
			if t, err := strconv.ParseFloat(v[i], 64); err == nil {
				switch header {
				case `%usr`:
					ct.User = t
				case `%sys`:
					ct.System = t
				case `%wio`:
					ct.Iowait = t
				case `%idle`:
					ct.Idle = t
				}
			}
		}

		ret = append(ret, *ct)
	}

	return ret, nil
}

func InfoWithContext(ctx context.Context) ([]InfoStat, error) {
	out, err := invoke.CommandWithContext(ctx, "prtconf")
	if err != nil {
		return nil, err
	}

	ret := InfoStat{}
	for _, line := range strings.Split(string(out), "\n") {
		switch {
		case strings.HasPrefix(line, "Number Of Processors:"):
			p := strings.Fields(line)
			if len(p) > 3 {
				if t, err := strconv.ParseUint(p[3], 10, 64); err == nil {
					ret.Cores = int32(t)
				}
			}
		case strings.HasPrefix(line, "Processor Clock Speed:"):
			p := strings.Fields(line)
			if len(p) > 4 {
				if t, err := strconv.ParseFloat(p[3], 64); err == nil {
					switch strings.ToUpper(p[4]) {
					case "MHZ":
						ret.Mhz = t
					case "GHZ":
						ret.Mhz = t * 1000.0
					case "KHZ":
						ret.Mhz = t / 1000.0
					default:
						ret.Mhz = t
					}
				}
			}
		case strings.HasPrefix(line, "System Model:"):
			p := strings.Split(string(line), ":")
			if p != nil {
				ret.VendorID = strings.TrimSpace(p[1])
			}
		case strings.HasPrefix(line, "Processor Type:"):
			p := strings.Split(string(line), ":")
			if p != nil {
				c := strings.Split(string(p[1]), "_")
				if c != nil {
					ret.Family = strings.TrimSpace(c[0])
					ret.Model = strings.TrimSpace(c[1])
				}
			}
		}
	}
	return []InfoStat{ret}, nil
}

func CountsWithContext(ctx context.Context, _ bool) (int, error) {
	info, err := InfoWithContext(ctx)
	if err == nil {
		return int(info[0].Cores), nil
	}
	return 0, err
}
