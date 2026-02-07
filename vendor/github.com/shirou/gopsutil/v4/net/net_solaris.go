// SPDX-License-Identifier: BSD-3-Clause
//go:build solaris

package net

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"github.com/shirou/gopsutil/v4/internal/common"
)

var kstatSplit = regexp.MustCompile(`[:\s]+`)

func IOCountersWithContext(ctx context.Context, pernic bool) ([]IOCountersStat, error) {
	// collect all the net class's links with below statistics
	filterstr := "/^(?!vnic)/::phys:/^rbytes64$|^ipackets64$|^idrops64$|^ierrors$|^obytes64$|^opackets64$|^odrops64$|^oerrors$/"
	if runtime.GOOS == "illumos" {
		filterstr = "/[^vnic]/::mac:/^rbytes64$|^ipackets64$|^idrops64$|^ierrors$|^obytes64$|^opackets64$|^odrops64$|^oerrors$/"
	}
	kstatSysOut, err := invoke.CommandWithContext(ctx, "kstat", "-c", "net", "-p", filterstr)
	if err != nil {
		return nil, fmt.Errorf("cannot execute kstat: %w", err)
	}

	lines := strings.Split(strings.TrimSpace(string(kstatSysOut)), "\n")
	if len(lines) == 0 {
		return nil, errors.New("no interface found")
	}
	rbytes64arr := make(map[string]uint64)
	ipackets64arr := make(map[string]uint64)
	idrops64arr := make(map[string]uint64)
	ierrorsarr := make(map[string]uint64)
	obytes64arr := make(map[string]uint64)
	opackets64arr := make(map[string]uint64)
	odrops64arr := make(map[string]uint64)
	oerrorsarr := make(map[string]uint64)

	for _, line := range lines {
		fields := kstatSplit.Split(line, -1)
		interfaceName := fields[0]
		instance := fields[1]
		switch fields[3] {
		case "rbytes64":
			rbytes64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse rbytes64: %w", err)
			}
		case "ipackets64":
			ipackets64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse ipackets64: %w", err)
			}
		case "idrops64":
			idrops64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse idrops64: %w", err)
			}
		case "ierrors":
			ierrorsarr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse ierrors: %w", err)
			}
		case "obytes64":
			obytes64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse obytes64: %w", err)
			}
		case "opackets64":
			opackets64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse opackets64: %w", err)
			}
		case "odrops64":
			odrops64arr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse odrops64: %w", err)
			}
		case "oerrors":
			oerrorsarr[interfaceName+instance], err = strconv.ParseUint(fields[4], 10, 64)
			if err != nil {
				return nil, fmt.Errorf("cannot parse oerrors: %w", err)
			}
		}
	}
	ret := make([]IOCountersStat, 0)
	for k := range rbytes64arr {
		nic := IOCountersStat{
			Name:        k,
			BytesRecv:   rbytes64arr[k],
			PacketsRecv: ipackets64arr[k],
			Errin:       ierrorsarr[k],
			Dropin:      idrops64arr[k],
			BytesSent:   obytes64arr[k],
			PacketsSent: opackets64arr[k],
			Errout:      oerrorsarr[k],
			Dropout:     odrops64arr[k],
		}
		ret = append(ret, nic)
	}

	if !pernic {
		return getIOCountersAll(ret), nil
	}

	return ret, nil
}

func IOCountersByFileWithContext(ctx context.Context, pernic bool, _ string) ([]IOCountersStat, error) {
	return IOCountersWithContext(ctx, pernic)
}

func FilterCountersWithContext(_ context.Context) ([]FilterStat, error) {
	return nil, common.ErrNotImplementedError
}

func ConntrackStatsWithContext(_ context.Context, _ bool) ([]ConntrackStat, error) {
	return nil, common.ErrNotImplementedError
}

func ProtoCountersWithContext(_ context.Context, _ []string) ([]ProtoCountersStat, error) {
	return nil, common.ErrNotImplementedError
}

// Deprecated: use process.PidsWithContext instead
func PidsWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func ConnectionsWithContext(_ context.Context, _ string) ([]ConnectionStat, error) {
	return []ConnectionStat{}, common.ErrNotImplementedError
}

func ConnectionsMaxWithContext(ctx context.Context, kind string, maxConn int) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithContext(ctx, kind, 0, maxConn)
}

func ConnectionsWithoutUidsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	return ConnectionsMaxWithoutUidsWithContext(ctx, kind, 0)
}

func ConnectionsMaxWithoutUidsWithContext(ctx context.Context, kind string, maxConn int) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithoutUidsWithContext(ctx, kind, 0, maxConn)
}

func ConnectionsPidWithoutUidsWithContext(ctx context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, 0)
}

func ConnectionsPidWithContext(ctx context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithContext(ctx, kind, pid, 0)
}

func ConnectionsPidMaxWithContext(ctx context.Context, kind string, pid int32, maxConn int) ([]ConnectionStat, error) {
	return connectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, maxConn, false)
}

func ConnectionsPidMaxWithoutUidsWithContext(ctx context.Context, kind string, pid int32, maxConn int) ([]ConnectionStat, error) {
	return connectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, maxConn, true)
}

func connectionsPidMaxWithoutUidsWithContext(_ context.Context, _ string, _ int32, _ int, _ bool) ([]ConnectionStat, error) {
	return []ConnectionStat{}, common.ErrNotImplementedError
}
