// SPDX-License-Identifier: BSD-3-Clause
//go:build freebsd

package process

import (
	"bytes"
	"context"
	"encoding/binary"
	"errors"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/net"
)

func pidsWithContext(ctx context.Context) ([]int32, error) {
	var ret []int32
	procs, err := ProcessesWithContext(ctx)
	if err != nil {
		return ret, nil
	}

	for _, p := range procs {
		ret = append(ret, p.Pid)
	}

	return ret, nil
}

func (p *Process) PpidWithContext(_ context.Context) (int32, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}

	return k.Ppid, nil
}

func (p *Process) NameWithContext(ctx context.Context) (string, error) {
	k, err := p.getKProc()
	if err != nil {
		return "", err
	}
	name := common.IntToString(k.Comm[:])

	if len(name) >= 15 {
		cmdlineSlice, err := p.CmdlineSliceWithContext(ctx)
		if err != nil {
			return "", err
		}
		if len(cmdlineSlice) > 0 {
			extendedName := filepath.Base(cmdlineSlice[0])
			if strings.HasPrefix(extendedName, p.name) {
				name = extendedName
			}
		}
	}

	return name, nil
}

func (p *Process) CwdWithContext(_ context.Context) (string, error) {
	mib := []int32{CTLKern, KernProc, KernProcCwd, p.Pid}
	buf, length, err := common.CallSyscall(mib)
	if err != nil {
		return "", err
	}

	if length != sizeOfKinfoFile {
		return "", errors.New("unexpected size of KinfoFile")
	}

	var k kinfoFile
	br := bytes.NewReader(buf)
	if err := common.Read(br, binary.LittleEndian, &k); err != nil {
		return "", err
	}
	cwd := common.IntToString(k.Path[:])

	return cwd, nil
}

func (p *Process) ExeWithContext(_ context.Context) (string, error) {
	mib := []int32{CTLKern, KernProc, KernProcPathname, p.Pid}
	buf, _, err := common.CallSyscall(mib)
	if err != nil {
		return "", err
	}

	return strings.Trim(string(buf), "\x00"), nil
}

func (p *Process) CmdlineWithContext(_ context.Context) (string, error) {
	mib := []int32{CTLKern, KernProc, KernProcArgs, p.Pid}
	buf, _, err := common.CallSyscall(mib)
	if err != nil {
		return "", err
	}
	ret := strings.FieldsFunc(string(buf), func(r rune) bool {
		return r == '\u0000'
	})

	return strings.Join(ret, " "), nil
}

func (p *Process) CmdlineSliceWithContext(_ context.Context) ([]string, error) {
	mib := []int32{CTLKern, KernProc, KernProcArgs, p.Pid}
	buf, _, err := common.CallSyscall(mib)
	if err != nil {
		return nil, err
	}
	if len(buf) == 0 {
		return nil, nil
	}
	if buf[len(buf)-1] == 0 {
		buf = buf[:len(buf)-1]
	}
	parts := bytes.Split(buf, []byte{0})
	var strParts []string
	for _, p := range parts {
		strParts = append(strParts, string(p))
	}

	return strParts, nil
}

func (p *Process) createTimeWithContext(_ context.Context) (int64, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}
	return int64(k.Start.Sec)*1000 + int64(k.Start.Usec)/1000, nil
}

func (p *Process) StatusWithContext(_ context.Context) ([]string, error) {
	k, err := p.getKProc()
	if err != nil {
		return []string{""}, err
	}
	var s string
	switch k.Stat {
	case SIDL:
		s = Idle
	case SRUN:
		s = Running
	case SSLEEP:
		s = Sleep
	case SSTOP:
		s = Stop
	case SZOMB:
		s = Zombie
	case SWAIT:
		s = Wait
	case SLOCK:
		s = Lock
	}

	return []string{s}, nil
}

func (p *Process) ForegroundWithContext(ctx context.Context) (bool, error) {
	// see https://github.com/shirou/gopsutil/issues/596#issuecomment-432707831 for implementation details
	pid := p.Pid
	out, err := invoke.CommandWithContext(ctx, "ps", "-o", "stat=", "-p", strconv.Itoa(int(pid)))
	if err != nil {
		return false, err
	}
	return strings.IndexByte(string(out), '+') != -1, nil
}

func (p *Process) UidsWithContext(_ context.Context) ([]uint32, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}

	uids := make([]uint32, 0, 3)

	uids = append(uids, uint32(k.Ruid), uint32(k.Uid), uint32(k.Svuid))

	return uids, nil
}

func (p *Process) GidsWithContext(_ context.Context) ([]uint32, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}

	gids := make([]uint32, 0, 3)
	gids = append(gids, uint32(k.Rgid), uint32(k.Ngroups), uint32(k.Svgid))

	return gids, nil
}

func (p *Process) GroupsWithContext(_ context.Context) ([]uint32, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}

	groups := make([]uint32, k.Ngroups)
	for i := int16(0); i < k.Ngroups; i++ {
		groups[i] = uint32(k.Groups[i])
	}

	return groups, nil
}

func (p *Process) TerminalWithContext(_ context.Context) (string, error) {
	k, err := p.getKProc()
	if err != nil {
		return "", err
	}

	ttyNr := uint64(k.Tdev)

	termmap, err := getTerminalMap()
	if err != nil {
		return "", err
	}

	return termmap[ttyNr], nil
}

func (p *Process) NiceWithContext(_ context.Context) (int32, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}
	return int32(k.Nice), nil
}

func (p *Process) IOCountersWithContext(_ context.Context) (*IOCountersStat, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}
	return &IOCountersStat{
		ReadCount:  uint64(k.Rusage.Inblock),
		WriteCount: uint64(k.Rusage.Oublock),
	}, nil
}

func (p *Process) NumThreadsWithContext(_ context.Context) (int32, error) {
	k, err := p.getKProc()
	if err != nil {
		return 0, err
	}

	return k.Numthreads, nil
}

func (p *Process) TimesWithContext(_ context.Context) (*cpu.TimesStat, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}
	return &cpu.TimesStat{
		CPU:    "cpu",
		User:   float64(k.Rusage.Utime.Sec) + float64(k.Rusage.Utime.Usec)/1000000,
		System: float64(k.Rusage.Stime.Sec) + float64(k.Rusage.Stime.Usec)/1000000,
	}, nil
}

func (p *Process) MemoryInfoWithContext(_ context.Context) (*MemoryInfoStat, error) {
	k, err := p.getKProc()
	if err != nil {
		return nil, err
	}
	v, err := unix.Sysctl("vm.stats.vm.v_page_size")
	if err != nil {
		return nil, err
	}
	pageSize := common.LittleEndian.Uint16([]byte(v))

	return &MemoryInfoStat{
		RSS: uint64(k.Rssize) * uint64(pageSize),
		VMS: uint64(k.Size),
	}, nil
}

func (p *Process) ChildrenWithContext(ctx context.Context) ([]*Process, error) {
	procs, err := ProcessesWithContext(ctx)
	if err != nil {
		return nil, nil
	}
	ret := make([]*Process, 0, len(procs))
	for _, proc := range procs {
		ppid, err := proc.PpidWithContext(ctx)
		if err != nil {
			continue
		}
		if ppid == p.Pid {
			ret = append(ret, proc)
		}
	}
	sort.Slice(ret, func(i, j int) bool { return ret[i].Pid < ret[j].Pid })
	return ret, nil
}

func (p *Process) ConnectionsWithContext(ctx context.Context) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidWithContext(ctx, "all", p.Pid)
}

func (p *Process) ConnectionsMaxWithContext(ctx context.Context, maxConn int) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidMaxWithContext(ctx, "all", p.Pid, maxConn)
}

func ProcessesWithContext(ctx context.Context) ([]*Process, error) {
	results := []*Process{}

	mib := []int32{CTLKern, KernProc, KernProcProc, 0}
	buf, length, err := common.CallSyscall(mib)
	if err != nil {
		return results, err
	}

	// get kinfo_proc size
	count := int(length / uint64(sizeOfKinfoProc))

	// parse buf to procs
	for i := 0; i < count; i++ {
		b := buf[i*sizeOfKinfoProc : (i+1)*sizeOfKinfoProc]
		k, err := parseKinfoProc(b)
		if err != nil {
			continue
		}
		p, err := NewProcessWithContext(ctx, int32(k.Pid))
		if err != nil {
			continue
		}

		results = append(results, p)
	}

	return results, nil
}

func (p *Process) getKProc() (*KinfoProc, error) {
	mib := []int32{CTLKern, KernProc, KernProcPID, p.Pid}

	buf, length, err := common.CallSyscall(mib)
	if err != nil {
		return nil, err
	}
	if length != sizeOfKinfoProc {
		return nil, errors.New("unexpected size of KinfoProc")
	}

	k, err := parseKinfoProc(buf)
	if err != nil {
		return nil, err
	}
	return &k, nil
}
