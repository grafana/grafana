// SPDX-License-Identifier: BSD-3-Clause
//go:build freebsd || darwin

package net

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func ConnectionsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	return ConnectionsPidWithContext(ctx, kind, 0)
}

func ConnectionsMaxWithContext(_ context.Context, _ string, _ int) ([]ConnectionStat, error) {
	return []ConnectionStat{}, common.ErrNotImplementedError
}

func ConnectionsPidWithContext(ctx context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	var ret []ConnectionStat

	args := []string{"-i"}
	switch strings.ToLower(kind) {
	default:
		fallthrough
	case "":
		fallthrough
	case "all":
		fallthrough
	case "inet":
		args = append(args, "tcp", "-i", "udp")
	case "inet4":
		args = append(args, "4")
	case "inet6":
		args = append(args, "6")
	case "tcp":
		args = append(args, "tcp")
	case "tcp4":
		args = append(args, "4tcp")
	case "tcp6":
		args = append(args, "6tcp")
	case "udp":
		args = append(args, "udp")
	case "udp4":
		args = append(args, "4udp")
	case "udp6":
		args = append(args, "6udp")
	case "unix":
		args = []string{"-U"}
	}

	r, err := common.CallLsofWithContext(ctx, invoke, pid, args...)
	if err != nil {
		return nil, err
	}
	for _, rr := range r {
		if strings.HasPrefix(rr, "COMMAND") {
			continue
		}
		n, err := parseNetLine(rr)
		if err != nil {
			continue
		}

		ret = append(ret, n)
	}

	return ret, nil
}

var constMap = map[string]int{
	"unix": syscall.AF_UNIX,
	"TCP":  syscall.SOCK_STREAM,
	"UDP":  syscall.SOCK_DGRAM,
	"IPv4": syscall.AF_INET,
	"IPv6": syscall.AF_INET6,
}

func parseNetLine(line string) (ConnectionStat, error) {
	f := strings.Fields(line)
	if len(f) < 8 {
		return ConnectionStat{}, fmt.Errorf("wrong line,%s", line)
	}

	if len(f) == 8 {
		f = append(f, f[7])
		f[7] = "unix"
	}

	pid, err := strconv.ParseInt(f[1], 10, 32)
	if err != nil {
		return ConnectionStat{}, err
	}
	fd, err := strconv.ParseInt(strings.Trim(f[3], "u"), 10, 32)
	if err != nil {
		return ConnectionStat{}, fmt.Errorf("unknown fd, %s", f[3])
	}
	netFamily, ok := constMap[f[4]]
	if !ok {
		return ConnectionStat{}, fmt.Errorf("unknown family, %s", f[4])
	}
	netType, ok := constMap[f[7]]
	if !ok {
		return ConnectionStat{}, fmt.Errorf("unknown type, %s", f[7])
	}

	var laddr, raddr Addr
	if f[7] == "unix" {
		laddr.IP = f[8]
	} else {
		laddr, raddr, err = parseNetAddr(f[8])
		if err != nil {
			return ConnectionStat{}, fmt.Errorf("failed to parse netaddr, %s", f[8])
		}
	}

	n := ConnectionStat{
		Fd:     uint32(fd),
		Family: uint32(netFamily),
		Type:   uint32(netType),
		Laddr:  laddr,
		Raddr:  raddr,
		Pid:    int32(pid),
	}
	if len(f) == 10 {
		n.Status = strings.Trim(f[9], "()")
	}

	return n, nil
}

func parseNetAddr(line string) (laddr Addr, raddr Addr, err error) {
	parse := func(l string) (Addr, error) {
		host, port, err := net.SplitHostPort(l)
		if err != nil {
			return Addr{}, fmt.Errorf("wrong addr, %s", l)
		}
		lport, err := strconv.ParseInt(port, 10, 32)
		if err != nil {
			return Addr{}, err
		}
		return Addr{IP: host, Port: uint32(lport)}, nil
	}

	addrs := strings.Split(line, "->")
	if len(addrs) == 0 {
		return laddr, raddr, fmt.Errorf("wrong netaddr, %s", line)
	}
	laddr, err = parse(addrs[0])
	if len(addrs) == 2 { // remote addr exists
		raddr, err = parse(addrs[1])
		if err != nil {
			return laddr, raddr, err
		}
	}

	return laddr, raddr, err
}

func ConnectionsPidMaxWithContext(_ context.Context, _ string, _ int32, _ int) ([]ConnectionStat, error) {
	return []ConnectionStat{}, common.ErrNotImplementedError
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
	return []ConnectionStat{}, common.ErrNotImplementedError
}
