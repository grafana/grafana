// SPDX-License-Identifier: BSD-3-Clause
//go:build freebsd

package mem

import (
	"context"
	"errors"
	"unsafe"

	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/internal/common"
)

func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(_ context.Context) (*VirtualMemoryStat, error) {
	pageSize, err := common.SysctlUint("vm.stats.vm.v_page_size")
	if err != nil {
		return nil, err
	}
	physmem, err := common.SysctlUint("hw.physmem")
	if err != nil {
		return nil, err
	}

	free, err := common.SysctlUint("vm.stats.vm.v_free_count")
	if err != nil {
		return nil, err
	}
	active, err := common.SysctlUint("vm.stats.vm.v_active_count")
	if err != nil {
		return nil, err
	}
	inactive, err := common.SysctlUint("vm.stats.vm.v_inactive_count")
	if err != nil {
		return nil, err
	}
	buffers, err := common.SysctlUint("vfs.bufspace")
	if err != nil {
		return nil, err
	}
	wired, err := common.SysctlUint("vm.stats.vm.v_wire_count")
	if err != nil {
		return nil, err
	}
	var cached, laundry uint64
	osreldate, _ := common.SysctlUint("kern.osreldate")
	if osreldate < 1102000 {
		cached, err = common.SysctlUint("vm.stats.vm.v_cache_count")
		if err != nil {
			return nil, err
		}
	} else {
		laundry, err = common.SysctlUint("vm.stats.vm.v_laundry_count")
		if err != nil {
			return nil, err
		}
	}

	p := pageSize
	ret := &VirtualMemoryStat{
		Total:    physmem,
		Free:     free * p,
		Active:   active * p,
		Inactive: inactive * p,
		Cached:   cached * p,
		Buffers:  buffers,
		Wired:    wired * p,
		Laundry:  laundry * p,
	}

	ret.Available = ret.Inactive + ret.Cached + ret.Free + ret.Laundry
	ret.Used = ret.Total - ret.Available
	ret.UsedPercent = float64(ret.Used) / float64(ret.Total) * 100.0

	return ret, nil
}

// Return swapinfo
func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

// Constants from vm/vm_param.h
const (
	XSWDEV_VERSION11 = 1
	XSWDEV_VERSION   = 2
)

// Types from vm/vm_param.h
type xswdev struct {
	Version uint32 // Version is the version
	Dev     uint64 // Dev is the device identifier
	Flags   int32  // Flags is the swap flags applied to the device
	NBlks   int32  // NBlks is the total number of blocks
	Used    int32  // Used is the number of blocks used
}

// xswdev11 is a compatibility for under FreeBSD 11
// sys/vm/swap_pager.c
type xswdev11 struct {
	Version uint32 // Version is the version
	Dev     uint32 // Dev is the device identifier
	Flags   int32  // Flags is the swap flags applied to the device
	NBlks   int32  // NBlks is the total number of blocks
	Used    int32  // Used is the number of blocks used
}

func SwapMemoryWithContext(_ context.Context) (*SwapMemoryStat, error) {
	// FreeBSD can have multiple swap devices so we total them up
	i, err := common.SysctlUint("vm.nswapdev")
	if err != nil {
		return nil, err
	}

	if i == 0 {
		return nil, errors.New("no swap devices found")
	}

	c := int(i)

	i, err = common.SysctlUint("vm.stats.vm.v_page_size")
	if err != nil {
		return nil, err
	}
	pageSize := i

	var buf []byte
	s := &SwapMemoryStat{}
	for n := 0; n < c; n++ {
		buf, err = unix.SysctlRaw("vm.swap_info", n)
		if err != nil {
			return nil, err
		}

		// first, try to parse with version 2
		xsw := (*xswdev)(unsafe.Pointer(&buf[0]))
		switch {
		case xsw.Version == XSWDEV_VERSION11:
			// this is version 1, so try to parse again
			xsw := (*xswdev11)(unsafe.Pointer(&buf[0]))
			if xsw.Version != XSWDEV_VERSION11 {
				return nil, errors.New("xswdev version mismatch(11)")
			}
			s.Total += uint64(xsw.NBlks)
			s.Used += uint64(xsw.Used)
		case xsw.Version != XSWDEV_VERSION:
			return nil, errors.New("xswdev version mismatch")
		default:
			s.Total += uint64(xsw.NBlks)
			s.Used += uint64(xsw.Used)
		}

	}

	if s.Total != 0 {
		s.UsedPercent = float64(s.Used) / float64(s.Total) * 100
	}
	s.Total *= pageSize
	s.Used *= pageSize
	s.Free = s.Total - s.Used

	return s, nil
}
