// SPDX-License-Identifier: BSD-3-Clause
//go:build aix && !cgo

package net

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func parseNetstatI(output string) ([]IOCountersStat, error) {
	lines := strings.Split(string(output), "\n")
	ret := make([]IOCountersStat, 0, len(lines)-1)
	exists := make([]string, 0, len(ret))

	// Check first line is header
	if len(lines) > 0 && strings.Fields(lines[0])[0] != "Name" {
		return nil, errors.New("not a 'netstat -i' output")
	}

	for _, line := range lines[1:] {
		values := strings.Fields(line)
		if len(values) < 1 || values[0] == "Name" {
			continue
		}
		if common.StringsHas(exists, values[0]) {
			// skip if already get
			continue
		}
		exists = append(exists, values[0])

		if len(values) < 9 {
			continue
		}

		base := 1
		// sometimes Address is omitted
		if len(values) < 10 {
			base = 0
		}

		parsed := make([]uint64, 0, 5)
		vv := []string{
			values[base+3], // Ipkts == PacketsRecv
			values[base+4], // Ierrs == Errin
			values[base+5], // Opkts == PacketsSent
			values[base+6], // Oerrs == Errout
			values[base+8], // Drops == Dropout
		}

		for _, target := range vv {
			if target == "-" {
				parsed = append(parsed, 0)
				continue
			}

			t, err := strconv.ParseUint(target, 10, 64)
			if err != nil {
				return nil, err
			}
			parsed = append(parsed, t)
		}

		n := IOCountersStat{
			Name:        values[0],
			PacketsRecv: parsed[0],
			Errin:       parsed[1],
			PacketsSent: parsed[2],
			Errout:      parsed[3],
			Dropout:     parsed[4],
		}
		ret = append(ret, n)
	}
	return ret, nil
}

func IOCountersWithContext(ctx context.Context, pernic bool) ([]IOCountersStat, error) {
	out, err := invoke.CommandWithContext(ctx, "netstat", "-idn")
	if err != nil {
		return nil, err
	}

	iocounters, err := parseNetstatI(string(out))
	if err != nil {
		return nil, err
	}
	if !pernic {
		return getIOCountersAll(iocounters), nil
	}
	return iocounters, nil
}
