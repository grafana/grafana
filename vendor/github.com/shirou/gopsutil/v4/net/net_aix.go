// SPDX-License-Identifier: BSD-3-Clause
//go:build aix

package net

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/internal/common"
)

// Deprecated: use process.PidsWithContext instead
func PidsWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
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

func parseNetstatNetLine(line string) (ConnectionStat, error) {
	f := strings.Fields(line)
	if len(f) < 5 {
		return ConnectionStat{}, fmt.Errorf("wrong line,%s", line)
	}

	var netType, netFamily uint32
	switch f[0] {
	case "tcp", "tcp4":
		netType = syscall.SOCK_STREAM
		netFamily = syscall.AF_INET
	case "udp", "udp4":
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

var portMatch = regexp.MustCompile(`(.*)\.(\d+)$`)

// This function only works for netstat returning addresses with a "."
// before the port (0.0.0.0.22 instead of 0.0.0.0:22).
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

func parseNetstatUnixLine(f []string) (ConnectionStat, error) {
	if len(f) < 8 {
		return ConnectionStat{}, fmt.Errorf("wrong number of fields: expected >=8 got %d", len(f))
	}

	var netType uint32

	switch f[1] {
	case "dgram":
		netType = syscall.SOCK_DGRAM
	case "stream":
		netType = syscall.SOCK_STREAM
	default:
		return ConnectionStat{}, fmt.Errorf("unknown type: %s", f[1])
	}

	// Some Unix Socket don't have any address associated
	addr := ""
	if len(f) == 9 {
		addr = f[8]
	}

	c := ConnectionStat{
		Fd:     uint32(0), // not supported
		Family: uint32(syscall.AF_UNIX),
		Type:   uint32(netType),
		Laddr: Addr{
			IP: addr,
		},
		Status: "NONE",
		Pid:    int32(0), // not supported
	}

	return c, nil
}

// Return true if proto is the corresponding to the kind parameter
// Only for Inet lines
func hasCorrectInetProto(kind, proto string) bool {
	switch kind {
	case "all", "inet":
		return true
	case "unix":
		return false
	case "inet4":
		return !strings.HasSuffix(proto, "6")
	case "inet6":
		return strings.HasSuffix(proto, "6")
	case "tcp":
		return proto == "tcp" || proto == "tcp4" || proto == "tcp6"
	case "tcp4":
		return proto == "tcp" || proto == "tcp4"
	case "tcp6":
		return proto == "tcp6"
	case "udp":
		return proto == "udp" || proto == "udp4" || proto == "udp6"
	case "udp4":
		return proto == "udp" || proto == "udp4"
	case "udp6":
		return proto == "udp6"
	}
	return false
}

func parseNetstatA(output string, kind string) ([]ConnectionStat, error) {
	var ret []ConnectionStat
	lines := strings.Split(string(output), "\n")

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) < 1 {
			continue
		}

		switch {
		case strings.HasPrefix(fields[0], "f1"):
			// Unix lines
			if len(fields) < 2 {
				// every unix connections have two lines
				continue
			}

			c, err := parseNetstatUnixLine(fields)
			if err != nil {
				return nil, fmt.Errorf("failed to parse Unix Address (%s): %w", line, err)
			}

			ret = append(ret, c)

		case strings.HasPrefix(fields[0], "tcp") || strings.HasPrefix(fields[0], "udp"):
			// Inet lines
			if !hasCorrectInetProto(kind, fields[0]) {
				continue
			}

			// On AIX, netstat display some connections with "*.*" as local addresses
			// Skip them as they aren't real connections.
			if fields[3] == "*.*" {
				continue
			}

			c, err := parseNetstatNetLine(line)
			if err != nil {
				return nil, fmt.Errorf("failed to parse Inet Address (%s): %w", line, err)
			}

			ret = append(ret, c)
		default:
			// Header lines
			continue
		}
	}

	return ret, nil
}

func ConnectionsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	args := []string{"-na"}
	switch strings.ToLower(kind) {
	default:
		fallthrough
	case "":
		kind = "all"
	case "all":
		// nothing to add
	case "inet", "inet4", "inet6":
		args = append(args, "-finet")
	case "tcp", "tcp4", "tcp6":
		args = append(args, "-finet")
	case "udp", "udp4", "udp6":
		args = append(args, "-finet")
	case "unix":
		args = append(args, "-funix")
	}

	out, err := invoke.CommandWithContext(ctx, "netstat", args...)
	if err != nil {
		return nil, err
	}

	ret, err := parseNetstatA(string(out), kind)
	if err != nil {
		return nil, err
	}

	return ret, nil
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

func ConnectionsPidWithContext(ctx context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithContext(ctx, kind, pid, 0)
}

func ConnectionsPidWithoutUidsWithContext(ctx context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	return ConnectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, 0)
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
