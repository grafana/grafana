// SPDX-License-Identifier: BSD-3-Clause
//go:build linux

package net

import (
	"bytes"
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"strconv"
	"strings"
	"syscall"

	"github.com/shirou/gopsutil/v4/internal/common"
)

const ( // Conntrack Column numbers
	ctENTRIES = iota
	ctSEARCHED
	ctFOUND
	ctNEW
	ctINVALID
	ctIGNORE
	ctDELETE
	ctDELETE_LIST //nolint:revive //FIXME
	ctINSERT
	ctINSERT_FAILED //nolint:revive //FIXME
	ctDROP
	ctEARLY_DROP     //nolint:revive //FIXME
	ctICMP_ERROR     //nolint:revive //FIXME
	CT_EXPEctNEW     //nolint:revive //FIXME
	ctEXPECT_CREATE  //nolint:revive //FIXME
	CT_EXPEctDELETE  //nolint:revive //FIXME
	ctSEARCH_RESTART //nolint:revive //FIXME
)

func IOCountersWithContext(ctx context.Context, pernic bool) ([]IOCountersStat, error) {
	filename := common.HostProcWithContext(ctx, "net/dev")
	return IOCountersByFileWithContext(ctx, pernic, filename)
}

func IOCountersByFileWithContext(_ context.Context, pernic bool, filename string) ([]IOCountersStat, error) {
	lines, err := common.ReadLines(filename)
	if err != nil {
		return nil, err
	}

	parts := make([]string, 2)

	statlen := len(lines) - 1

	ret := make([]IOCountersStat, 0, statlen)

	for _, line := range lines[2:] {
		separatorPos := strings.LastIndex(line, ":")
		if separatorPos == -1 {
			continue
		}
		parts[0] = line[0:separatorPos]
		parts[1] = line[separatorPos+1:]

		interfaceName := strings.TrimSpace(parts[0])
		if interfaceName == "" {
			continue
		}

		fields := strings.Fields(strings.TrimSpace(parts[1]))
		bytesRecv, err := strconv.ParseUint(fields[0], 10, 64)
		if err != nil {
			return ret, err
		}
		packetsRecv, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			return ret, err
		}
		errIn, err := strconv.ParseUint(fields[2], 10, 64)
		if err != nil {
			return ret, err
		}
		dropIn, err := strconv.ParseUint(fields[3], 10, 64)
		if err != nil {
			return ret, err
		}
		fifoIn, err := strconv.ParseUint(fields[4], 10, 64)
		if err != nil {
			return ret, err
		}
		bytesSent, err := strconv.ParseUint(fields[8], 10, 64)
		if err != nil {
			return ret, err
		}
		packetsSent, err := strconv.ParseUint(fields[9], 10, 64)
		if err != nil {
			return ret, err
		}
		errOut, err := strconv.ParseUint(fields[10], 10, 64)
		if err != nil {
			return ret, err
		}
		dropOut, err := strconv.ParseUint(fields[11], 10, 64)
		if err != nil {
			return ret, err
		}
		fifoOut, err := strconv.ParseUint(fields[12], 10, 64)
		if err != nil {
			return ret, err
		}

		nic := IOCountersStat{
			Name:        interfaceName,
			BytesRecv:   bytesRecv,
			PacketsRecv: packetsRecv,
			Errin:       errIn,
			Dropin:      dropIn,
			Fifoin:      fifoIn,
			BytesSent:   bytesSent,
			PacketsSent: packetsSent,
			Errout:      errOut,
			Dropout:     dropOut,
			Fifoout:     fifoOut,
		}
		ret = append(ret, nic)
	}

	if !pernic {
		return getIOCountersAll(ret), nil
	}

	return ret, nil
}

var netProtocols = []string{
	"ip",
	"icmp",
	"icmpmsg",
	"tcp",
	"udp",
	"udplite",
}

func ProtoCountersWithContext(ctx context.Context, protocols []string) ([]ProtoCountersStat, error) {
	if len(protocols) == 0 {
		protocols = netProtocols
	}

	stats := make([]ProtoCountersStat, 0, len(protocols))
	protos := make(map[string]bool, len(protocols))
	for _, p := range protocols {
		protos[p] = true
	}

	filename := common.HostProcWithContext(ctx, "net/snmp")
	lines, err := common.ReadLines(filename)
	if err != nil {
		return nil, err
	}

	linecount := len(lines)
	for i := 0; i < linecount; i++ {
		line := lines[i]
		r := strings.IndexRune(line, ':')
		if r == -1 {
			return nil, errors.New(filename + " is not formatted correctly, expected ':'.")
		}
		proto := strings.ToLower(line[:r])
		if !protos[proto] {
			// skip protocol and data line
			i++
			continue
		}

		// Read header line
		statNames := strings.Split(line[r+2:], " ")

		// Read data line
		i++
		statValues := strings.Split(lines[i][r+2:], " ")
		if len(statNames) != len(statValues) {
			return nil, errors.New(filename + " is not formatted correctly, expected same number of columns.")
		}
		stat := ProtoCountersStat{
			Protocol: proto,
			Stats:    make(map[string]int64, len(statNames)),
		}
		for j := range statNames {
			value, err := strconv.ParseInt(statValues[j], 10, 64)
			if err != nil {
				return nil, err
			}
			stat.Stats[statNames[j]] = value
		}
		stats = append(stats, stat)
	}
	return stats, nil
}

func FilterCountersWithContext(ctx context.Context) ([]FilterStat, error) {
	countfile := common.HostProcWithContext(ctx, "sys/net/netfilter/nf_conntrack_count")
	maxfile := common.HostProcWithContext(ctx, "sys/net/netfilter/nf_conntrack_max")

	count, err := common.ReadInts(countfile)
	if err != nil {
		return nil, err
	}
	stats := make([]FilterStat, 0, 1)

	maxConn, err := common.ReadInts(maxfile)
	if err != nil {
		return nil, err
	}

	payload := FilterStat{
		ConnTrackCount: count[0],
		ConnTrackMax:   maxConn[0],
	}

	stats = append(stats, payload)
	return stats, nil
}

// ConntrackStatsWithContext returns more detailed info about the conntrack table
func ConntrackStatsWithContext(ctx context.Context, percpu bool) ([]ConntrackStat, error) {
	return conntrackStatsFromFile(common.HostProcWithContext(ctx, "net/stat/nf_conntrack"), percpu)
}

// conntrackStatsFromFile returns more detailed info about the conntrack table
// from `filename`
// If 'percpu' is false, the result will contain exactly one item with totals/summary
func conntrackStatsFromFile(filename string, percpu bool) ([]ConntrackStat, error) {
	lines, err := common.ReadLines(filename)
	if err != nil {
		return nil, err
	}

	statlist := NewConntrackStatList()

	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) == 17 && fields[0] != "entries" {
			statlist.Append(NewConntrackStat(
				common.HexToUint32(fields[ctENTRIES]),
				common.HexToUint32(fields[ctSEARCHED]),
				common.HexToUint32(fields[ctFOUND]),
				common.HexToUint32(fields[ctNEW]),
				common.HexToUint32(fields[ctINVALID]),
				common.HexToUint32(fields[ctIGNORE]),
				common.HexToUint32(fields[ctDELETE]),
				common.HexToUint32(fields[ctDELETE_LIST]),
				common.HexToUint32(fields[ctINSERT]),
				common.HexToUint32(fields[ctINSERT_FAILED]),
				common.HexToUint32(fields[ctDROP]),
				common.HexToUint32(fields[ctEARLY_DROP]),
				common.HexToUint32(fields[ctICMP_ERROR]),
				common.HexToUint32(fields[CT_EXPEctNEW]),
				common.HexToUint32(fields[ctEXPECT_CREATE]),
				common.HexToUint32(fields[CT_EXPEctDELETE]),
				common.HexToUint32(fields[ctSEARCH_RESTART]),
			))
		}
	}

	if percpu {
		return statlist.Items(), nil
	}
	return statlist.Summary(), nil
}

// http://students.mimuw.edu.pl/lxr/source/include/net/tcp_states.h
var tcpStatuses = map[string]string{
	"01": "ESTABLISHED",
	"02": "SYN_SENT",
	"03": "SYN_RECV",
	"04": "FIN_WAIT1",
	"05": "FIN_WAIT2",
	"06": "TIME_WAIT",
	"07": "CLOSE",
	"08": "CLOSE_WAIT",
	"09": "LAST_ACK",
	"0A": "LISTEN",
	"0B": "CLOSING",
}

type netConnectionKindType struct {
	family   uint32
	sockType uint32
	filename string
}

var kindTCP4 = netConnectionKindType{
	family:   syscall.AF_INET,
	sockType: syscall.SOCK_STREAM,
	filename: "tcp",
}

var kindTCP6 = netConnectionKindType{
	family:   syscall.AF_INET6,
	sockType: syscall.SOCK_STREAM,
	filename: "tcp6",
}

var kindUDP4 = netConnectionKindType{
	family:   syscall.AF_INET,
	sockType: syscall.SOCK_DGRAM,
	filename: "udp",
}

var kindUDP6 = netConnectionKindType{
	family:   syscall.AF_INET6,
	sockType: syscall.SOCK_DGRAM,
	filename: "udp6",
}

var kindUNIX = netConnectionKindType{
	family:   syscall.AF_UNIX,
	filename: "unix",
}

var netConnectionKindMap = map[string][]netConnectionKindType{
	"all":   {kindTCP4, kindTCP6, kindUDP4, kindUDP6, kindUNIX},
	"tcp":   {kindTCP4, kindTCP6},
	"tcp4":  {kindTCP4},
	"tcp6":  {kindTCP6},
	"udp":   {kindUDP4, kindUDP6},
	"udp4":  {kindUDP4},
	"udp6":  {kindUDP6},
	"unix":  {kindUNIX},
	"inet":  {kindTCP4, kindTCP6, kindUDP4, kindUDP6},
	"inet4": {kindTCP4, kindUDP4},
	"inet6": {kindTCP6, kindUDP6},
}

type inodeMap struct {
	pid int32
	fd  uint32
}

type connTmp struct {
	fd       uint32
	family   uint32
	sockType uint32
	laddr    Addr
	raddr    Addr
	status   string
	pid      int32
	boundPid int32
	path     string
}

func ConnectionsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	return ConnectionsPidWithContext(ctx, kind, 0)
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

func connectionsPidMaxWithoutUidsWithContext(ctx context.Context, kind string, pid int32, maxConn int, skipUids bool) ([]ConnectionStat, error) {
	tmap, ok := netConnectionKindMap[kind]
	if !ok {
		return nil, fmt.Errorf("invalid kind, %s", kind)
	}
	root := common.HostProcWithContext(ctx)
	var err error
	var inodes map[string][]inodeMap
	if pid == 0 {
		inodes, err = getProcInodesAllWithContext(ctx, root, maxConn)
	} else {
		inodes, err = getProcInodes(root, pid, maxConn)
		if len(inodes) == 0 {
			// no connection for the pid
			return []ConnectionStat{}, nil
		}
	}
	if err != nil {
		return nil, fmt.Errorf("could not get pid(s), %d: %w", pid, err)
	}
	return statsFromInodesWithContext(ctx, root, pid, tmap, inodes, skipUids)
}

func statsFromInodesWithContext(ctx context.Context, root string, pid int32, tmap []netConnectionKindType, inodes map[string][]inodeMap, skipUids bool) ([]ConnectionStat, error) {
	dupCheckMap := make(map[string]struct{})
	var ret []ConnectionStat

	var err error
	for _, t := range tmap {
		var path string
		var connKey string
		var ls []connTmp
		if pid == 0 {
			path = fmt.Sprintf("%s/net/%s", root, t.filename)
		} else {
			path = fmt.Sprintf("%s/%d/net/%s", root, pid, t.filename)
		}
		switch t.family {
		case syscall.AF_INET, syscall.AF_INET6:
			ls, err = processInet(path, t, inodes, pid)
		case syscall.AF_UNIX:
			ls, err = processUnix(path, t, inodes, pid)
		}
		if err != nil {
			return nil, err
		}
		for _, c := range ls {
			// Build TCP key to id the connection uniquely
			// socket type, src ip, src port, dst ip, dst port and state should be enough
			// to prevent duplications.
			connKey = fmt.Sprintf("%d-%s:%d-%s:%d-%s", c.sockType, c.laddr.IP, c.laddr.Port, c.raddr.IP, c.raddr.Port, c.status)
			if _, ok := dupCheckMap[connKey]; ok {
				continue
			}

			conn := ConnectionStat{
				Fd:     c.fd,
				Family: c.family,
				Type:   c.sockType,
				Laddr:  c.laddr,
				Raddr:  c.raddr,
				Status: c.status,
				Pid:    c.pid,
			}
			if c.pid == 0 {
				conn.Pid = c.boundPid
			} else {
				conn.Pid = c.pid
			}

			if !skipUids {
				// fetch process owner Real, effective, saved set, and filesystem UIDs
				proc := process{Pid: conn.Pid}
				conn.Uids, _ = proc.getUids(ctx)
			}

			ret = append(ret, conn)
			dupCheckMap[connKey] = struct{}{}
		}

	}

	return ret, nil
}

// getProcInodes returns fd of the pid.
func getProcInodes(root string, pid int32, maxConn int) (map[string][]inodeMap, error) {
	ret := make(map[string][]inodeMap)

	dir := fmt.Sprintf("%s/%d/fd", root, pid)
	f, err := os.Open(dir)
	if err != nil {
		return ret, err
	}
	defer f.Close()
	dirEntries, err := f.ReadDir(maxConn)
	if err != nil {
		return ret, err
	}
	for _, dirEntry := range dirEntries {
		inodePath := fmt.Sprintf("%s/%d/fd/%s", root, pid, dirEntry.Name())

		inode, err := os.Readlink(inodePath)
		if err != nil {
			continue
		}
		if !strings.HasPrefix(inode, "socket:[") {
			continue
		}
		// the process is using a socket
		l := len(inode)
		inode = inode[8 : l-1]
		_, ok := ret[inode]
		if !ok {
			ret[inode] = make([]inodeMap, 0)
		}
		fd, err := strconv.ParseInt(dirEntry.Name(), 10, 32)
		if err != nil {
			continue
		}

		i := inodeMap{
			pid: pid,
			fd:  uint32(fd),
		}
		ret[inode] = append(ret[inode], i)
	}
	return ret, nil
}

func PidsWithContext(ctx context.Context) ([]int32, error) {
	var ret []int32

	d, err := os.Open(common.HostProcWithContext(ctx))
	if err != nil {
		return nil, err
	}
	defer d.Close()

	fnames, err := d.Readdirnames(-1)
	if err != nil {
		return nil, err
	}
	for _, fname := range fnames {
		pid, err := strconv.ParseInt(fname, 10, 32)
		if err != nil {
			// if not numeric name, just skip
			continue
		}
		ret = append(ret, int32(pid))
	}

	return ret, nil
}

// Note: the following is based off process_linux structs and methods
// we need these to fetch the owner of a process ID
// FIXME: Import process occures import cycle.
// see remarks on pids()
type process struct {
	Pid  int32 `json:"pid"`
	uids []int32
}

// Uids returns user ids of the process as a slice of the int
func (p *process) getUids(ctx context.Context) ([]int32, error) {
	err := p.fillFromStatus(ctx)
	if err != nil {
		return []int32{}, err
	}
	return p.uids, nil
}

// Get status from /proc/(pid)/status
func (p *process) fillFromStatus(ctx context.Context) error {
	pid := p.Pid
	statPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "status")
	contents, err := os.ReadFile(statPath)
	if err != nil {
		return err
	}
	lines := strings.Split(string(contents), "\n")
	for _, line := range lines {
		tabParts := strings.SplitN(line, "\t", 2)
		if len(tabParts) < 2 {
			continue
		}
		value := tabParts[1]
		if strings.TrimRight(tabParts[0], ":") == "Uid" {
			p.uids = make([]int32, 0, 4)
			for _, i := range strings.Split(value, "\t") {
				v, err := strconv.ParseInt(i, 10, 32)
				if err != nil {
					return err
				}
				p.uids = append(p.uids, int32(v))
			}
		}
	}
	return nil
}

func getProcInodesAllWithContext(ctx context.Context, root string, maxConn int) (map[string][]inodeMap, error) {
	pids, err := PidsWithContext(ctx)
	if err != nil {
		return nil, err
	}
	ret := make(map[string][]inodeMap)

	for _, pid := range pids {
		t, err := getProcInodes(root, pid, maxConn)
		if err != nil {
			// skip if permission error or no longer exists
			if os.IsPermission(err) || os.IsNotExist(err) || errors.Is(err, io.EOF) {
				continue
			}
			return ret, err
		}
		if len(t) == 0 {
			continue
		}
		// TODO: update ret.
		ret = updateMap(ret, t)
	}
	return ret, nil
}

// decodeAddress decode addresse represents addr in proc/net/*
// ex:
// "0500000A:0016" -> "10.0.0.5", 22
// "0085002452100113070057A13F025401:0035" -> "2400:8500:1301:1052:a157:7:154:23f", 53
func decodeAddress(family uint32, src string) (Addr, error) {
	t := strings.Split(src, ":")
	if len(t) != 2 {
		return Addr{}, fmt.Errorf("does not contain port, %s", src)
	}
	addr := t[0]
	port, err := strconv.ParseUint(t[1], 16, 16)
	if err != nil {
		return Addr{}, fmt.Errorf("invalid port, %s", src)
	}
	decoded, err := hex.DecodeString(addr)
	if err != nil {
		return Addr{}, fmt.Errorf("decode error, %w", err)
	}
	var ip net.IP

	if family == syscall.AF_INET {
		if common.IsLittleEndian() {
			ip = net.IP(Reverse(decoded))
		} else {
			ip = net.IP(decoded)
		}
	} else { // IPv6
		ip, err = parseIPv6HexString(decoded)
		if err != nil {
			return Addr{}, err
		}
	}
	return Addr{
		IP:   ip.String(),
		Port: uint32(port),
	}, nil
}

func Reverse(s []byte) []byte {
	for i, j := 0, len(s)-1; i < j; i, j = i+1, j-1 {
		s[i], s[j] = s[j], s[i]
	}
	return s
}

// parseIPv6HexString parse array of bytes to IPv6 string
func parseIPv6HexString(src []byte) (net.IP, error) {
	if len(src) != 16 {
		return nil, errors.New("invalid IPv6 string")
	}

	buf := make([]byte, 0, 16)
	for i := 0; i < len(src); i += 4 {
		r := Reverse(src[i : i+4])
		buf = append(buf, r...)
	}
	return net.IP(buf), nil
}

func processInet(file string, kind netConnectionKindType, inodes map[string][]inodeMap, filterPid int32) ([]connTmp, error) {
	if strings.HasSuffix(file, "6") && !common.PathExists(file) {
		// IPv6 not supported, return empty.
		return []connTmp{}, nil
	}

	// Read the contents of the /proc file with a single read sys call.
	// This minimizes duplicates in the returned connections
	// For more info:
	// https://github.com/shirou/gopsutil/pull/361
	contents, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}

	lines := bytes.Split(contents, []byte("\n"))

	var ret []connTmp
	// skip first line
	for _, line := range lines[1:] {
		l := strings.Fields(string(line))
		if len(l) < 10 {
			continue
		}
		laddr := l[1]
		raddr := l[2]
		status := l[3]
		inode := l[9]
		pid := int32(0)
		fd := uint32(0)
		i, exists := inodes[inode]
		if exists {
			pid = i[0].pid
			fd = i[0].fd
		}
		if filterPid > 0 && filterPid != pid {
			continue
		}
		if kind.sockType == syscall.SOCK_STREAM {
			status = tcpStatuses[status]
		} else {
			status = "NONE"
		}
		la, err := decodeAddress(kind.family, laddr)
		if err != nil {
			continue
		}
		ra, err := decodeAddress(kind.family, raddr)
		if err != nil {
			continue
		}

		ret = append(ret, connTmp{
			fd:       fd,
			family:   kind.family,
			sockType: kind.sockType,
			laddr:    la,
			raddr:    ra,
			status:   status,
			pid:      pid,
		})
	}

	return ret, nil
}

func processUnix(file string, kind netConnectionKindType, inodes map[string][]inodeMap, filterPid int32) ([]connTmp, error) {
	// Read the contents of the /proc file with a single read sys call.
	// This minimizes duplicates in the returned connections
	// For more info:
	// https://github.com/shirou/gopsutil/pull/361
	contents, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}

	lines := bytes.Split(contents, []byte("\n"))

	var ret []connTmp
	// skip first line
	for _, line := range lines[1:] {
		tokens := strings.Fields(string(line))
		if len(tokens) < 6 {
			continue
		}
		st, err := strconv.ParseInt(tokens[4], 10, 32)
		if err != nil {
			return nil, err
		}

		inode := tokens[6]

		var pairs []inodeMap
		pairs, exists := inodes[inode]
		if !exists {
			pairs = []inodeMap{
				{},
			}
		}
		for _, pair := range pairs {
			if filterPid > 0 && filterPid != pair.pid {
				continue
			}
			var path string
			if len(tokens) == 8 {
				path = tokens[len(tokens)-1]
			}
			ret = append(ret, connTmp{
				fd:       pair.fd,
				family:   kind.family,
				sockType: uint32(st),
				laddr: Addr{
					IP: path,
				},
				pid:    pair.pid,
				status: "NONE",
				path:   path,
			})
		}
	}

	return ret, nil
}

func updateMap(src map[string][]inodeMap, add map[string][]inodeMap) map[string][]inodeMap {
	for key, value := range add {
		a, exists := src[key]
		if !exists {
			src[key] = value
			continue
		}
		src[key] = append(a, value...)
	}
	return src
}
