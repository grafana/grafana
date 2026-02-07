// SPDX-License-Identifier: BSD-3-Clause
//go:build windows

package net

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/shirou/gopsutil/v4/internal/common"
)

var (
	modiphlpapi             = windows.NewLazySystemDLL("iphlpapi.dll")
	procGetExtendedTCPTable = modiphlpapi.NewProc("GetExtendedTcpTable")
	procGetExtendedUDPTable = modiphlpapi.NewProc("GetExtendedUdpTable")
	procGetIfEntry2         = modiphlpapi.NewProc("GetIfEntry2")
)

const (
	TCPTableBasicListener = iota
	TCPTableBasicConnections
	TCPTableBasicAll
	TCPTableOwnerPIDListener
	TCPTableOwnerPIDConnections
	TCPTableOwnerPIDAll
	TCPTableOwnerModuleListener
	TCPTableOwnerModuleConnections
	TCPTableOwnerModuleAll
)

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

var netConnectionKindMap = map[string][]netConnectionKindType{
	"all":   {kindTCP4, kindTCP6, kindUDP4, kindUDP6},
	"tcp":   {kindTCP4, kindTCP6},
	"tcp4":  {kindTCP4},
	"tcp6":  {kindTCP6},
	"udp":   {kindUDP4, kindUDP6},
	"udp4":  {kindUDP4},
	"udp6":  {kindUDP6},
	"inet":  {kindTCP4, kindTCP6, kindUDP4, kindUDP6},
	"inet4": {kindTCP4, kindUDP4},
	"inet6": {kindTCP6, kindUDP6},
}

// https://github.com/microsoft/ethr/blob/aecdaf923970e5a9b4c461b4e2e3963d781ad2cc/plt_windows.go#L114-L170
type guid struct {
	Data1 uint32
	Data2 uint16
	Data3 uint16
	Data4 [8]byte
}

const (
	maxStringSize        = 256
	maxPhysAddressLength = 32
	pad0for64_4for32     = 0
)

type mibIfRow2 struct {
	InterfaceLuid               uint64
	InterfaceIndex              uint32
	InterfaceGuid               guid //nolint:revive //FIXME
	Alias                       [maxStringSize + 1]uint16
	Description                 [maxStringSize + 1]uint16
	PhysicalAddressLength       uint32
	PhysicalAddress             [maxPhysAddressLength]uint8
	PermanentPhysicalAddress    [maxPhysAddressLength]uint8
	Mtu                         uint32
	Type                        uint32
	TunnelType                  uint32
	MediaType                   uint32
	PhysicalMediumType          uint32
	AccessType                  uint32
	DirectionType               uint32
	InterfaceAndOperStatusFlags uint32
	OperStatus                  uint32
	AdminStatus                 uint32
	MediaConnectState           uint32
	NetworkGuid                 guid //nolint:revive //FIXME
	ConnectionType              uint32
	padding1                    [pad0for64_4for32]byte
	TransmitLinkSpeed           uint64
	ReceiveLinkSpeed            uint64
	InOctets                    uint64
	InUcastPkts                 uint64
	InNUcastPkts                uint64
	InDiscards                  uint64
	InErrors                    uint64
	InUnknownProtos             uint64
	InUcastOctets               uint64
	InMulticastOctets           uint64
	InBroadcastOctets           uint64
	OutOctets                   uint64
	OutUcastPkts                uint64
	OutNUcastPkts               uint64
	OutDiscards                 uint64
	OutErrors                   uint64
	OutUcastOctets              uint64
	OutMulticastOctets          uint64
	OutBroadcastOctets          uint64
	OutQLen                     uint64
}

func IOCountersWithContext(_ context.Context, pernic bool) ([]IOCountersStat, error) {
	ifs, err := net.Interfaces()
	if err != nil {
		return nil, err
	}
	var counters []IOCountersStat

	err = procGetIfEntry2.Find()
	if err == nil { // Vista+, uint64 values (issue#693)
		for _, ifi := range ifs {
			c := IOCountersStat{
				Name: ifi.Name,
			}

			row := mibIfRow2{InterfaceIndex: uint32(ifi.Index)}
			ret, _, err := procGetIfEntry2.Call(uintptr(unsafe.Pointer(&row)))
			if ret != 0 {
				return nil, os.NewSyscallError("GetIfEntry2", err)
			}
			c.BytesSent = uint64(row.OutOctets)
			c.BytesRecv = uint64(row.InOctets)
			c.PacketsSent = uint64(row.OutUcastPkts)
			c.PacketsRecv = uint64(row.InUcastPkts)
			c.Errin = uint64(row.InErrors)
			c.Errout = uint64(row.OutErrors)
			c.Dropin = uint64(row.InDiscards)
			c.Dropout = uint64(row.OutDiscards)

			counters = append(counters, c)
		}
	} else { // WinXP fallback, uint32 values
		for _, ifi := range ifs {
			c := IOCountersStat{
				Name: ifi.Name,
			}

			row := windows.MibIfRow{Index: uint32(ifi.Index)}
			err = windows.GetIfEntry(&row)
			if err != nil {
				return nil, os.NewSyscallError("GetIfEntry", err)
			}
			c.BytesSent = uint64(row.OutOctets)
			c.BytesRecv = uint64(row.InOctets)
			c.PacketsSent = uint64(row.OutUcastPkts)
			c.PacketsRecv = uint64(row.InUcastPkts)
			c.Errin = uint64(row.InErrors)
			c.Errout = uint64(row.OutErrors)
			c.Dropin = uint64(row.InDiscards)
			c.Dropout = uint64(row.OutDiscards)

			counters = append(counters, c)
		}
	}

	if !pernic {
		return getIOCountersAll(counters), nil
	}
	return counters, nil
}

func IOCountersByFileWithContext(ctx context.Context, pernic bool, _ string) ([]IOCountersStat, error) {
	return IOCountersWithContext(ctx, pernic)
}

func ConnectionsWithContext(ctx context.Context, kind string) ([]ConnectionStat, error) {
	return ConnectionsPidWithContext(ctx, kind, 0)
}

func ConnectionsPidWithContext(_ context.Context, kind string, pid int32) ([]ConnectionStat, error) {
	tmap, ok := netConnectionKindMap[kind]
	if !ok {
		return nil, fmt.Errorf("invalid kind, %s", kind)
	}
	return getProcInet(tmap, pid)
}

func getProcInet(kinds []netConnectionKindType, pid int32) ([]ConnectionStat, error) {
	stats := make([]ConnectionStat, 0)

	for _, kind := range kinds {
		s, err := getNetStatWithKind(kind)
		if err != nil {
			continue
		}

		if pid == 0 {
			stats = append(stats, s...)
		} else {
			for _, ns := range s {
				if ns.Pid != pid {
					continue
				}
				stats = append(stats, ns)
			}
		}
	}

	return stats, nil
}

func getNetStatWithKind(kindType netConnectionKindType) ([]ConnectionStat, error) {
	if kindType.filename == "" {
		return nil, errors.New("kind filename must be required")
	}

	switch kindType.filename {
	case kindTCP4.filename:
		return getTCPConnections(kindTCP4.family)
	case kindTCP6.filename:
		return getTCPConnections(kindTCP6.family)
	case kindUDP4.filename:
		return getUDPConnections(kindUDP4.family)
	case kindUDP6.filename:
		return getUDPConnections(kindUDP6.family)
	}

	return nil, fmt.Errorf("invalid kind filename, %s", kindType.filename)
}

// Deprecated: use process.PidsWithContext instead
func PidsWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
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

func ConnectionsPidMaxWithContext(ctx context.Context, kind string, pid int32, maxConn int) ([]ConnectionStat, error) {
	return connectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, maxConn, false)
}

func ConnectionsPidMaxWithoutUidsWithContext(ctx context.Context, kind string, pid int32, maxConn int) ([]ConnectionStat, error) {
	return connectionsPidMaxWithoutUidsWithContext(ctx, kind, pid, maxConn, true)
}

func connectionsPidMaxWithoutUidsWithContext(_ context.Context, _ string, _ int32, _ int, _ bool) ([]ConnectionStat, error) {
	return []ConnectionStat{}, common.ErrNotImplementedError
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

func getTableUintptr(family uint32, buf []byte) uintptr {
	var (
		pmibTCPTable  pmibTCPTableOwnerPidAll
		pmibTCP6Table pmibTCP6TableOwnerPidAll

		p uintptr
	)
	switch family {
	case kindTCP4.family:
		if len(buf) > 0 {
			pmibTCPTable = (*mibTCPTableOwnerPid)(unsafe.Pointer(&buf[0]))
			p = uintptr(unsafe.Pointer(pmibTCPTable))
		} else {
			p = uintptr(unsafe.Pointer(pmibTCPTable))
		}
	case kindTCP6.family:
		if len(buf) > 0 {
			pmibTCP6Table = (*mibTCP6TableOwnerPid)(unsafe.Pointer(&buf[0]))
			p = uintptr(unsafe.Pointer(pmibTCP6Table))
		} else {
			p = uintptr(unsafe.Pointer(pmibTCP6Table))
		}
	}
	return p
}

func getTableInfo(filename string, table any) (index, step, length int) {
	switch filename {
	case kindTCP4.filename:
		index = int(unsafe.Sizeof(table.(pmibTCPTableOwnerPidAll).DwNumEntries))
		step = int(unsafe.Sizeof(table.(pmibTCPTableOwnerPidAll).Table))
		length = int(table.(pmibTCPTableOwnerPidAll).DwNumEntries)
	case kindTCP6.filename:
		index = int(unsafe.Sizeof(table.(pmibTCP6TableOwnerPidAll).DwNumEntries))
		step = int(unsafe.Sizeof(table.(pmibTCP6TableOwnerPidAll).Table))
		length = int(table.(pmibTCP6TableOwnerPidAll).DwNumEntries)
	case kindUDP4.filename:
		index = int(unsafe.Sizeof(table.(pmibUDPTableOwnerPid).DwNumEntries))
		step = int(unsafe.Sizeof(table.(pmibUDPTableOwnerPid).Table))
		length = int(table.(pmibUDPTableOwnerPid).DwNumEntries)
	case kindUDP6.filename:
		index = int(unsafe.Sizeof(table.(pmibUDP6TableOwnerPid).DwNumEntries))
		step = int(unsafe.Sizeof(table.(pmibUDP6TableOwnerPid).Table))
		length = int(table.(pmibUDP6TableOwnerPid).DwNumEntries)
	}

	return
}

func getTCPConnections(family uint32) ([]ConnectionStat, error) {
	var (
		p    uintptr
		buf  []byte
		size uint32

		pmibTCPTable  pmibTCPTableOwnerPidAll
		pmibTCP6Table pmibTCP6TableOwnerPidAll
	)

	if family == 0 {
		return nil, errors.New("faimly must be required")
	}

	for {
		switch family {
		case kindTCP4.family:
			if len(buf) > 0 {
				pmibTCPTable = (*mibTCPTableOwnerPid)(unsafe.Pointer(&buf[0]))
				p = uintptr(unsafe.Pointer(pmibTCPTable))
			} else {
				p = uintptr(unsafe.Pointer(pmibTCPTable))
			}
		case kindTCP6.family:
			if len(buf) > 0 {
				pmibTCP6Table = (*mibTCP6TableOwnerPid)(unsafe.Pointer(&buf[0]))
				p = uintptr(unsafe.Pointer(pmibTCP6Table))
			} else {
				p = uintptr(unsafe.Pointer(pmibTCP6Table))
			}
		}

		err := getExtendedTCPTable(p,
			&size,
			true,
			family,
			tcpTableOwnerPidAll,
			0)
		if err == nil {
			break
		}
		if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) {
			return nil, err
		}
		buf = make([]byte, size)
	}

	var (
		index, step int
		length      int
	)

	stats := make([]ConnectionStat, 0)
	switch family {
	case kindTCP4.family:
		index, step, length = getTableInfo(kindTCP4.filename, pmibTCPTable)
	case kindTCP6.family:
		index, step, length = getTableInfo(kindTCP6.filename, pmibTCP6Table)
	}

	if length == 0 {
		return nil, nil
	}

	for i := 0; i < length; i++ {
		switch family {
		case kindTCP4.family:
			mibs := (*mibTCPRowOwnerPid)(unsafe.Pointer(&buf[index]))
			ns := mibs.convertToConnectionStat()
			stats = append(stats, ns)
		case kindTCP6.family:
			mibs := (*mibTCP6RowOwnerPid)(unsafe.Pointer(&buf[index]))
			ns := mibs.convertToConnectionStat()
			stats = append(stats, ns)
		}

		index += step
	}
	return stats, nil
}

func getUDPConnections(family uint32) ([]ConnectionStat, error) {
	var (
		p    uintptr
		buf  []byte
		size uint32

		pmibUDPTable  pmibUDPTableOwnerPid
		pmibUDP6Table pmibUDP6TableOwnerPid
	)

	if family == 0 {
		return nil, errors.New("faimly must be required")
	}

	for {
		switch family {
		case kindUDP4.family:
			if len(buf) > 0 {
				pmibUDPTable = (*mibUDPTableOwnerPid)(unsafe.Pointer(&buf[0]))
				p = uintptr(unsafe.Pointer(pmibUDPTable))
			} else {
				p = uintptr(unsafe.Pointer(pmibUDPTable))
			}
		case kindUDP6.family:
			if len(buf) > 0 {
				pmibUDP6Table = (*mibUDP6TableOwnerPid)(unsafe.Pointer(&buf[0]))
				p = uintptr(unsafe.Pointer(pmibUDP6Table))
			} else {
				p = uintptr(unsafe.Pointer(pmibUDP6Table))
			}
		}

		err := getExtendedUDPTable(
			p,
			&size,
			true,
			family,
			udpTableOwnerPid,
			0,
		)
		if err == nil {
			break
		}
		if !errors.Is(err, windows.ERROR_INSUFFICIENT_BUFFER) {
			return nil, err
		}
		buf = make([]byte, size)
	}

	var index, step, length int

	stats := make([]ConnectionStat, 0)
	switch family {
	case kindUDP4.family:
		index, step, length = getTableInfo(kindUDP4.filename, pmibUDPTable)
	case kindUDP6.family:
		index, step, length = getTableInfo(kindUDP6.filename, pmibUDP6Table)
	}

	if length == 0 {
		return nil, nil
	}

	for i := 0; i < length; i++ {
		switch family {
		case kindUDP4.family:
			mibs := (*mibUDPRowOwnerPid)(unsafe.Pointer(&buf[index]))
			ns := mibs.convertToConnectionStat()
			stats = append(stats, ns)
		case kindUDP6.family:
			mibs := (*mibUDP6RowOwnerPid)(unsafe.Pointer(&buf[index]))
			ns := mibs.convertToConnectionStat()
			stats = append(stats, ns)
		}

		index += step
	}
	return stats, nil
}

// tcpStatuses https://msdn.microsoft.com/en-us/library/windows/desktop/bb485761(v=vs.85).aspx
var tcpStatuses = map[mibTCPState]string{
	1:  "CLOSED",
	2:  "LISTEN",
	3:  "SYN_SENT",
	4:  "SYN_RECEIVED",
	5:  "ESTABLISHED",
	6:  "FIN_WAIT_1",
	7:  "FIN_WAIT_2",
	8:  "CLOSE_WAIT",
	9:  "CLOSING",
	10: "LAST_ACK",
	11: "TIME_WAIT",
	12: "DELETE",
}

func getExtendedTCPTable(pTCPTable uintptr, pdwSize *uint32, bOrder bool, ulAf uint32, tableClass tcpTableClass, reserved uint32) (errcode error) {
	r1, _, _ := syscall.Syscall6(procGetExtendedTCPTable.Addr(), 6, pTCPTable, uintptr(unsafe.Pointer(pdwSize)), getUintptrFromBool(bOrder), uintptr(ulAf), uintptr(tableClass), uintptr(reserved))
	if r1 != 0 {
		errcode = syscall.Errno(r1)
	}
	return
}

func getExtendedUDPTable(pUDPTable uintptr, pdwSize *uint32, bOrder bool, ulAf uint32, tableClass udpTableClass, reserved uint32) (errcode error) {
	r1, _, _ := syscall.Syscall6(procGetExtendedUDPTable.Addr(), 6, pUDPTable, uintptr(unsafe.Pointer(pdwSize)), getUintptrFromBool(bOrder), uintptr(ulAf), uintptr(tableClass), uintptr(reserved))
	if r1 != 0 {
		errcode = syscall.Errno(r1)
	}
	return
}

func getUintptrFromBool(b bool) uintptr {
	if b {
		return 1
	}
	return 0
}

const anySize = 1

// type MIB_TCP_STATE int32
type mibTCPState int32

type tcpTableClass int32

const (
	tcpTableBasicListener tcpTableClass = iota
	tcpTableBasicConnections
	tcpTableBasicAll
	tcpTableOwnerPidListener
	tcpTableOwnerPidConnections
	tcpTableOwnerPidAll
	tcpTableOwnerModuleListener
	tcpTableOwnerModuleConnections
	tcpTableOwnerModuleAll
)

type udpTableClass int32

const (
	udpTableBasic udpTableClass = iota
	udpTableOwnerPid
	udpTableOwnerModule
)

// TCP

type mibTCPRowOwnerPid struct {
	DwState      uint32
	DwLocalAddr  uint32
	DwLocalPort  uint32
	DwRemoteAddr uint32
	DwRemotePort uint32
	DwOwningPid  uint32
}

func (m *mibTCPRowOwnerPid) convertToConnectionStat() ConnectionStat {
	ns := ConnectionStat{
		Family: kindTCP4.family,
		Type:   kindTCP4.sockType,
		Laddr: Addr{
			IP:   parseIPv4HexString(m.DwLocalAddr),
			Port: uint32(decodePort(m.DwLocalPort)),
		},
		Raddr: Addr{
			IP:   parseIPv4HexString(m.DwRemoteAddr),
			Port: uint32(decodePort(m.DwRemotePort)),
		},
		Pid:    int32(m.DwOwningPid),
		Status: tcpStatuses[mibTCPState(m.DwState)],
	}

	return ns
}

type mibTCPTableOwnerPid struct {
	DwNumEntries uint32
	Table        [anySize]mibTCPRowOwnerPid
}

type mibTCP6RowOwnerPid struct {
	UcLocalAddr     [16]byte
	DwLocalScopeId  uint32
	DwLocalPort     uint32
	UcRemoteAddr    [16]byte
	DwRemoteScopeId uint32
	DwRemotePort    uint32
	DwState         uint32
	DwOwningPid     uint32
}

func (m *mibTCP6RowOwnerPid) convertToConnectionStat() ConnectionStat {
	ns := ConnectionStat{
		Family: kindTCP6.family,
		Type:   kindTCP6.sockType,
		Laddr: Addr{
			IP:   parseIPv6HexString(m.UcLocalAddr),
			Port: uint32(decodePort(m.DwLocalPort)),
		},
		Raddr: Addr{
			IP:   parseIPv6HexString(m.UcRemoteAddr),
			Port: uint32(decodePort(m.DwRemotePort)),
		},
		Pid:    int32(m.DwOwningPid),
		Status: tcpStatuses[mibTCPState(m.DwState)],
	}

	return ns
}

type mibTCP6TableOwnerPid struct {
	DwNumEntries uint32
	Table        [anySize]mibTCP6RowOwnerPid
}

type (
	pmibTCPTableOwnerPidAll  *mibTCPTableOwnerPid
	pmibTCP6TableOwnerPidAll *mibTCP6TableOwnerPid
)

// UDP

type mibUDPRowOwnerPid struct {
	DwLocalAddr uint32
	DwLocalPort uint32
	DwOwningPid uint32
}

func (m *mibUDPRowOwnerPid) convertToConnectionStat() ConnectionStat {
	ns := ConnectionStat{
		Family: kindUDP4.family,
		Type:   kindUDP4.sockType,
		Laddr: Addr{
			IP:   parseIPv4HexString(m.DwLocalAddr),
			Port: uint32(decodePort(m.DwLocalPort)),
		},
		Pid: int32(m.DwOwningPid),
	}

	return ns
}

type mibUDPTableOwnerPid struct {
	DwNumEntries uint32
	Table        [anySize]mibUDPRowOwnerPid
}

type mibUDP6RowOwnerPid struct {
	UcLocalAddr    [16]byte
	DwLocalScopeId uint32
	DwLocalPort    uint32
	DwOwningPid    uint32
}

func (m *mibUDP6RowOwnerPid) convertToConnectionStat() ConnectionStat {
	ns := ConnectionStat{
		Family: kindUDP6.family,
		Type:   kindUDP6.sockType,
		Laddr: Addr{
			IP:   parseIPv6HexString(m.UcLocalAddr),
			Port: uint32(decodePort(m.DwLocalPort)),
		},
		Pid: int32(m.DwOwningPid),
	}

	return ns
}

type mibUDP6TableOwnerPid struct {
	DwNumEntries uint32
	Table        [anySize]mibUDP6RowOwnerPid
}

type (
	pmibUDPTableOwnerPid  *mibUDPTableOwnerPid
	pmibUDP6TableOwnerPid *mibUDP6TableOwnerPid
)

func decodePort(port uint32) uint16 {
	return syscall.Ntohs(uint16(port))
}

func parseIPv4HexString(addr uint32) string {
	return fmt.Sprintf("%d.%d.%d.%d", addr&255, addr>>8&255, addr>>16&255, addr>>24&255)
}

func parseIPv6HexString(addr [16]byte) string {
	var ret [16]byte
	for i := 0; i < 16; i++ {
		ret[i] = uint8(addr[i])
	}

	// convert []byte to net.IP
	ip := net.IP(ret[:])
	return ip.String()
}
