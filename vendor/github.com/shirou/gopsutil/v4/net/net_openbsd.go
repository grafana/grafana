// SPDX-License-Identifier: BSD-3-Clause
//go:build openbsd

package net

import (
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/internal/common"
)

var portMatch = regexp.MustCompile(`(.*)\.(\d+)$`)

func ParseNetstat(output string, mode string,
	iocs map[string]IOCountersStat,
) error {
	lines := strings.Split(output, "\n")

	exists := make([]string, 0, len(lines)-1)

	columns := 9
	if mode == "inb" {
		columns = 6
	}
	for _, line := range lines {
		values := strings.Fields(line)
		if len(values) < 1 || values[0] == "Name" {
			continue
		}
		if common.StringsHas(exists, values[0]) {
			// skip if already get
			continue
		}

		if len(values) < columns {
			continue
		}
		base := 1
		// sometimes Address is omitted
		if len(values) < columns {
			base = 0
		}

		parsed := make([]uint64, 0, 8)
		var vv []string
		switch mode {
		case "inb":
			vv = []string{
				values[base+3], // BytesRecv
				values[base+4], // BytesSent
			}
		case "ind":
			vv = []string{
				values[base+3], // Ipkts
				values[base+4], // Idrop
				values[base+5], // Opkts
				values[base+6], // Odrops
			}
		case "ine":
			vv = []string{
				values[base+4], // Ierrs
				values[base+6], // Oerrs
			}
		}
		for _, target := range vv {
			if target == "-" {
				parsed = append(parsed, 0)
				continue
			}

			t, err := strconv.ParseUint(target, 10, 64)
			if err != nil {
				return err
			}
			parsed = append(parsed, t)
		}
		exists = append(exists, values[0])

		n, present := iocs[values[0]]
		if !present {
			n = IOCountersStat{Name: values[0]}
		}

		switch mode {
		case "inb":
			n.BytesRecv = parsed[0]
			n.BytesSent = parsed[1]
		case "ind":
			n.PacketsRecv = parsed[0]
			n.Dropin = parsed[1]
			n.PacketsSent = parsed[2]
			n.Dropout = parsed[3]
		case "ine":
			n.Errin = parsed[0]
			n.Errout = parsed[1]
		}

		iocs[n.Name] = n
	}
	return nil
}

// Deprecated: use process.PidsWithContext instead
func PidsWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func IOCountersWithContext(ctx context.Context, pernic bool) ([]IOCountersStat, error) {
	netstat, err := exec.LookPath("netstat")
	if err != nil {
		return nil, err
	}
	out, err := invoke.CommandWithContext(ctx, netstat, "-inb")
	if err != nil {
		return nil, err
	}
	out2, err := invoke.CommandWithContext(ctx, netstat, "-ind")
	if err != nil {
		return nil, err
	}
	out3, err := invoke.CommandWithContext(ctx, netstat, "-ine")
	if err != nil {
		return nil, err
	}
	iocs := make(map[string]IOCountersStat)

	lines := strings.Split(string(out), "\n")
	ret := make([]IOCountersStat, 0, len(lines)-1)

	err = ParseNetstat(string(out), "inb", iocs)
	if err != nil {
		return nil, err
	}
	err = ParseNetstat(string(out2), "ind", iocs)
	if err != nil {
		return nil, err
	}
	err = ParseNetstat(string(out3), "ine", iocs)
	if err != nil {
		return nil, err
	}

	for _, ioc := range iocs {
		ret = append(ret, ioc)
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

func parseNetstatLine(line string) (ConnectionStat, error) {
	f := strings.Fields(line)
	if len(f) < 5 {
		return ConnectionStat{}, fmt.Errorf("wrong line,%s", line)
	}

	var netType, netFamily uint32
	switch f[0] {
	case "tcp":
		netType = syscall.SOCK_STREAM
		netFamily = syscall.AF_INET
	case "udp":
		netType = syscall.SOCK_DGRAM
		netFamily = syscall.AF_INET
	case "tcp6":
		netType = syscall.SOCK_STREAM
		netFamily = syscall.AF_INET6
	case "udp6":
		netType = syscall.SOCK_DGRAM
		netFamily = syscall.AF_INET6
	default:
		return ConnectionStat{}, fmt.Errorf("unknown type, %s", f[0])
	}

	laddr, raddr, err := parseNetstatAddr(f[3], f[4], netFamily)
	if err != nil {
		return ConnectionStat{}, fmt.Errorf("failed to parse netaddr, %s %s", f[3], f[4])
	}

	n := ConnectionStat{
		Fd:     uint32(0), // not supported
		Family: uint32(netFamily),
		Type:   uint32(netType),
		Laddr:  laddr,
		Raddr:  raddr,
		Pid:    int32(0), // not supported
	}
	if len(f) == 6 {
		n.Status = f[5]
	}

	return n, nil
}

func parseNetstatAddr(local string, remote string, family uint32) (laddr Addr, raddr Addr, err error) {
	parse := func(l string) (Addr, error) {
		matches := portMatch.FindStringSubmatch(l)
		if matches == nil {
			return Addr{}, fmt.Errorf("wrong addr, %s", l)
		}
		host := matches[1]
		port := matches[2]
		if host == "*" {
			switch family {
			case syscall.AF_INET:
				host = "0.0.0.0"
			case syscall.AF_INET6:
				host = "::"
			default:
				return Addr{}, fmt.Errorf("unknown family, %d", family)
			}
		}
		lport, err := strconv.ParseInt(port, 10, 32)
		if err != nil {
			return Addr{}, err
		}
		return Addr{IP: host, Port: uint32(lport)}, nil
	}

	laddr, err = parse(local)
	if remote != "*.*" { // remote addr exists
		raddr, err = parse(remote)
		if err != nil {
			return laddr, raddr, err
		}
	}

	return laddr, raddr, err
}

func ConnectionsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	var ret []ConnectionStat

	args := []string{"-na"}
	switch strings.ToLower(kind) {
	default:
		fallthrough
	case "":
		fallthrough
	case "all":
		fallthrough
	case "inet":
		// nothing to add
	case "inet4":
		args = append(args, "-finet")
	case "inet6":
		args = append(args, "-finet6")
	case "tcp":
		args = append(args, "-ptcp")
	case "tcp4":
		args = append(args, "-ptcp", "-finet")
	case "tcp6":
		args = append(args, "-ptcp", "-finet6")
	case "udp":
		args = append(args, "-pudp")
	case "udp4":
		args = append(args, "-pudp", "-finet")
	case "udp6":
		args = append(args, "-pudp", "-finet6")
	case "unix":
		return ret, common.ErrNotImplementedError
	}

	netstat, err := exec.LookPath("netstat")
	if err != nil {
		return nil, err
	}
	out, err := invoke.CommandWithContext(ctx, netstat, args...)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		if !(strings.HasPrefix(line, "tcp") || strings.HasPrefix(line, "udp")) {
			continue
		}
		n, err := parseNetstatLine(line)
		if err != nil {
			continue
		}

		ret = append(ret, n)
	}

	return ret, nil
}

func ConnectionsPidWithContext(_ context.Context, _ string, _ int32) ([]ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}

func ConnectionsMaxWithContext(_ context.Context, _ string, _ int) ([]ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}

func ConnectionsPidMaxWithContext(_ context.Context, _ string, _ int32, _ int) ([]ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
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

func ConnectionsPidMaxWithoutUidsWithContext(ctx context.Context, kind string, pid int32, maxConn int) ([]ConnectionStat, error) {
	return connectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, maxConn)
}

func connectionsPidMaxWithoutUidsWithContext(_ context.Context, _ string, _ int32, _ int) ([]ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}
