// SPDX-License-Identifier: BSD-3-Clause
//go:build linux

package process

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/tklauser/go-sysconf"
	"golang.org/x/sys/unix"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/net"
)

var pageSize = uint64(os.Getpagesize())

const prioProcess = 0 // linux/resource.h

var clockTicks = 100 // default value

func init() {
	clkTck, err := sysconf.Sysconf(sysconf.SC_CLK_TCK)
	// ignore errors
	if err == nil {
		clockTicks = int(clkTck)
	}
}

// MemoryInfoExStat is different between OSes
type MemoryInfoExStat struct {
	RSS    uint64 `json:"rss"`    // bytes
	VMS    uint64 `json:"vms"`    // bytes
	Shared uint64 `json:"shared"` // bytes
	Text   uint64 `json:"text"`   // bytes
	Lib    uint64 `json:"lib"`    // bytes
	Data   uint64 `json:"data"`   // bytes
	Dirty  uint64 `json:"dirty"`  // bytes
}

func (m MemoryInfoExStat) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}

type MemoryMapsStat struct {
	Path         string `json:"path"`
	Rss          uint64 `json:"rss"`
	Size         uint64 `json:"size"`
	Pss          uint64 `json:"pss"`
	SharedClean  uint64 `json:"sharedClean"`
	SharedDirty  uint64 `json:"sharedDirty"`
	PrivateClean uint64 `json:"privateClean"`
	PrivateDirty uint64 `json:"privateDirty"`
	Referenced   uint64 `json:"referenced"`
	Anonymous    uint64 `json:"anonymous"`
	Swap         uint64 `json:"swap"`
}

// String returns JSON value of the process.
func (m MemoryMapsStat) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}

func (p *Process) PpidWithContext(ctx context.Context) (int32, error) {
	_, ppid, _, _, _, _, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return -1, err
	}
	return ppid, nil
}

func (p *Process) NameWithContext(ctx context.Context) (string, error) {
	if p.name == "" {
		if err := p.fillNameWithContext(ctx); err != nil {
			return "", err
		}
	}
	return p.name, nil
}

func (p *Process) TgidWithContext(ctx context.Context) (int32, error) {
	if p.tgid == 0 {
		if err := p.fillFromStatusWithContext(ctx); err != nil {
			return 0, err
		}
	}
	return p.tgid, nil
}

func (p *Process) ExeWithContext(ctx context.Context) (string, error) {
	return p.fillFromExeWithContext(ctx)
}

func (p *Process) CmdlineWithContext(ctx context.Context) (string, error) {
	return p.fillFromCmdlineWithContext(ctx)
}

func (p *Process) CmdlineSliceWithContext(ctx context.Context) ([]string, error) {
	return p.fillSliceFromCmdlineWithContext(ctx)
}

func (p *Process) createTimeWithContext(ctx context.Context) (int64, error) {
	_, _, _, createTime, _, _, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return 0, err
	}
	return createTime, nil
}

func (p *Process) CwdWithContext(ctx context.Context) (string, error) {
	return p.fillFromCwdWithContext(ctx)
}

func (p *Process) StatusWithContext(ctx context.Context) ([]string, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return []string{""}, err
	}
	return []string{p.status}, nil
}

func (p *Process) ForegroundWithContext(ctx context.Context) (bool, error) {
	// see https://github.com/shirou/gopsutil/issues/596#issuecomment-432707831 for implementation details
	pid := p.Pid
	statPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "stat")
	contents, err := os.ReadFile(statPath)
	if err != nil {
		return false, err
	}
	fields := strings.Fields(string(contents))
	if len(fields) < 8 {
		return false, fmt.Errorf("insufficient data in %s", statPath)
	}
	pgid := fields[4]
	tpgid := fields[7]
	return pgid == tpgid, nil
}

func (p *Process) UidsWithContext(ctx context.Context) ([]uint32, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return []uint32{}, err
	}
	return p.uids, nil
}

func (p *Process) GidsWithContext(ctx context.Context) ([]uint32, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return []uint32{}, err
	}
	return p.gids, nil
}

func (p *Process) GroupsWithContext(ctx context.Context) ([]uint32, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return []uint32{}, err
	}
	return p.groups, nil
}

func (p *Process) TerminalWithContext(ctx context.Context) (string, error) {
	t, _, _, _, _, _, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return "", err
	}
	termmap, err := getTerminalMap()
	if err != nil {
		return "", err
	}
	terminal := termmap[t]
	return terminal, nil
}

func (p *Process) NiceWithContext(ctx context.Context) (int32, error) {
	_, _, _, _, _, nice, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return 0, err
	}
	return nice, nil
}

func (p *Process) IOniceWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) RlimitWithContext(ctx context.Context) ([]RlimitStat, error) {
	return p.RlimitUsageWithContext(ctx, false)
}

func (p *Process) RlimitUsageWithContext(ctx context.Context, gatherUsed bool) ([]RlimitStat, error) {
	rlimits, err := p.fillFromLimitsWithContext(ctx)
	if !gatherUsed || err != nil {
		return rlimits, err
	}

	_, _, _, _, rtprio, nice, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return nil, err
	}
	if err := p.fillFromStatusWithContext(ctx); err != nil {
		return nil, err
	}

	for i := range rlimits {
		rs := &rlimits[i]
		switch rs.Resource {
		case RLIMIT_CPU:
			times, err := p.TimesWithContext(ctx)
			if err != nil {
				return nil, err
			}
			rs.Used = uint64(times.User + times.System)
		case RLIMIT_DATA:
			rs.Used = uint64(p.memInfo.Data)
		case RLIMIT_STACK:
			rs.Used = uint64(p.memInfo.Stack)
		case RLIMIT_RSS:
			rs.Used = uint64(p.memInfo.RSS)
		case RLIMIT_NOFILE:
			n, err := p.NumFDsWithContext(ctx)
			if err != nil {
				return nil, err
			}
			rs.Used = uint64(n)
		case RLIMIT_MEMLOCK:
			rs.Used = uint64(p.memInfo.Locked)
		case RLIMIT_AS:
			rs.Used = uint64(p.memInfo.VMS)
		case RLIMIT_LOCKS:
			// TODO we can get the used value from /proc/$pid/locks. But linux doesn't enforce it, so not a high priority.
		case RLIMIT_SIGPENDING:
			rs.Used = p.sigInfo.PendingProcess
		case RLIMIT_NICE:
			// The rlimit for nice is a little unusual, in that 0 means the niceness cannot be decreased beyond the current value, but it can be increased.
			// So effectively: if rs.Soft == 0 { rs.Soft = rs.Used }
			rs.Used = uint64(nice)
		case RLIMIT_RTPRIO:
			rs.Used = uint64(rtprio)
		}
	}

	return rlimits, err
}

func (p *Process) IOCountersWithContext(ctx context.Context) (*IOCountersStat, error) {
	return p.fillFromIOWithContext(ctx)
}

func (p *Process) NumCtxSwitchesWithContext(ctx context.Context) (*NumCtxSwitchesStat, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return p.numCtxSwitches, nil
}

func (p *Process) NumFDsWithContext(ctx context.Context) (int32, error) {
	_, fnames, err := p.fillFromfdListWithContext(ctx)
	return int32(len(fnames)), err
}

func (p *Process) NumThreadsWithContext(ctx context.Context) (int32, error) {
	err := p.fillFromStatusWithContext(ctx)
	if err != nil {
		return 0, err
	}
	return p.numThreads, nil
}

func (p *Process) ThreadsWithContext(ctx context.Context) (map[int32]*cpu.TimesStat, error) {
	ret := make(map[int32]*cpu.TimesStat)
	taskPath := common.HostProcWithContext(ctx, strconv.Itoa(int(p.Pid)), "task")

	tids, err := readPidsFromDir(taskPath)
	if err != nil {
		return nil, err
	}

	for _, tid := range tids {
		_, _, cpuTimes, _, _, _, _, err := p.fillFromTIDStatWithContext(ctx, tid)
		if err != nil {
			return nil, err
		}
		ret[tid] = cpuTimes
	}

	return ret, nil
}

func (p *Process) TimesWithContext(ctx context.Context) (*cpu.TimesStat, error) {
	_, _, cpuTimes, _, _, _, _, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return cpuTimes, nil
}

func (p *Process) CPUAffinityWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryInfoWithContext(ctx context.Context) (*MemoryInfoStat, error) {
	meminfo, _, err := p.fillFromStatmWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return meminfo, nil
}

func (p *Process) MemoryInfoExWithContext(ctx context.Context) (*MemoryInfoExStat, error) {
	_, memInfoEx, err := p.fillFromStatmWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return memInfoEx, nil
}

func (p *Process) PageFaultsWithContext(ctx context.Context) (*PageFaultsStat, error) {
	_, _, _, _, _, _, pageFaults, err := p.fillFromStatWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return pageFaults, nil
}

func (p *Process) ChildrenWithContext(ctx context.Context) ([]*Process, error) {
	statFiles, err := filepath.Glob(common.HostProcWithContext(ctx, "[0-9]*/stat"))
	if err != nil {
		return nil, err
	}
	ret := make([]*Process, 0, len(statFiles))
	for _, statFile := range statFiles {
		statContents, err := os.ReadFile(statFile)
		if err != nil {
			continue
		}
		fields := splitProcStat(statContents)
		pid, err := strconv.ParseInt(fields[1], 10, 32)
		if err != nil {
			continue
		}
		ppid, err := strconv.ParseInt(fields[4], 10, 32)
		if err != nil {
			continue
		}
		if int32(ppid) == p.Pid {
			np, err := NewProcessWithContext(ctx, int32(pid))
			if err != nil {
				continue
			}
			ret = append(ret, np)
		}
	}
	sort.Slice(ret, func(i, j int) bool { return ret[i].Pid < ret[j].Pid })
	return ret, nil
}

func (p *Process) OpenFilesWithContext(ctx context.Context) ([]OpenFilesStat, error) {
	_, ofs, err := p.fillFromfdWithContext(ctx)
	if err != nil {
		return nil, err
	}
	ret := make([]OpenFilesStat, len(ofs))
	for i, o := range ofs {
		ret[i] = *o
	}

	return ret, nil
}

func (p *Process) ConnectionsWithContext(ctx context.Context) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidWithContext(ctx, "all", p.Pid)
}

func (p *Process) ConnectionsMaxWithContext(ctx context.Context, maxConn int) ([]net.ConnectionStat, error) {
	return net.ConnectionsPidMaxWithContext(ctx, "all", p.Pid, maxConn)
}

func (p *Process) MemoryMapsWithContext(ctx context.Context, grouped bool) (*[]MemoryMapsStat, error) {
	pid := p.Pid
	var ret []MemoryMapsStat
	smapsPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "smaps")
	if grouped {
		ret = make([]MemoryMapsStat, 1)
		// If smaps_rollup exists (require kernel >= 4.15), then we will use it
		// for pre-summed memory information for a process.
		smapsRollupPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "smaps_rollup")
		if _, err := os.Stat(smapsRollupPath); !os.IsNotExist(err) {
			smapsPath = smapsRollupPath
		}
	}
	contents, err := os.ReadFile(smapsPath)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(contents), "\n")

	// function of parsing a block
	getBlock := func(firstLine []string, block []string) (MemoryMapsStat, error) {
		m := MemoryMapsStat{}
		if len(firstLine) >= 6 {
			m.Path = strings.Join(firstLine[5:], " ")
		}

		for _, line := range block {
			if strings.Contains(line, "VmFlags") {
				continue
			}
			field := strings.Split(line, ":")
			if len(field) < 2 {
				continue
			}
			v := strings.Trim(field[1], "kB") // remove last "kB"
			v = strings.TrimSpace(v)
			t, err := strconv.ParseUint(v, 10, 64)
			if err != nil {
				return m, err
			}

			switch field[0] {
			case "Size":
				m.Size = t
			case "Rss":
				m.Rss = t
			case "Pss":
				m.Pss = t
			case "Shared_Clean":
				m.SharedClean = t
			case "Shared_Dirty":
				m.SharedDirty = t
			case "Private_Clean":
				m.PrivateClean = t
			case "Private_Dirty":
				m.PrivateDirty = t
			case "Referenced":
				m.Referenced = t
			case "Anonymous":
				m.Anonymous = t
			case "Swap":
				m.Swap = t
			}
		}
		return m, nil
	}

	var firstLine []string
	blocks := make([]string, 0, 16)

	for i, line := range lines {
		fields := strings.Fields(line)
		if (len(fields) > 0 && !strings.HasSuffix(fields[0], ":")) || i == len(lines)-1 {
			// new block section
			if len(firstLine) > 0 && len(blocks) > 0 {
				g, err := getBlock(firstLine, blocks)
				if err != nil {
					return &ret, err
				}
				if grouped {
					ret[0].Size += g.Size
					ret[0].Rss += g.Rss
					ret[0].Pss += g.Pss
					ret[0].SharedClean += g.SharedClean
					ret[0].SharedDirty += g.SharedDirty
					ret[0].PrivateClean += g.PrivateClean
					ret[0].PrivateDirty += g.PrivateDirty
					ret[0].Referenced += g.Referenced
					ret[0].Anonymous += g.Anonymous
					ret[0].Swap += g.Swap
				} else {
					ret = append(ret, g)
				}
			}
			// starts new block
			blocks = make([]string, 0, 16)
			firstLine = fields
		} else {
			blocks = append(blocks, line)
		}
	}

	return &ret, nil
}

func (p *Process) EnvironWithContext(ctx context.Context) ([]string, error) {
	environPath := common.HostProcWithContext(ctx, strconv.Itoa(int(p.Pid)), "environ")

	environContent, err := os.ReadFile(environPath)
	if err != nil {
		return nil, err
	}

	return strings.Split(string(environContent), "\000"), nil
}

/**
** Internal functions
**/

func limitToUint(val string) (uint64, error) {
	if val == "unlimited" {
		return math.MaxUint64, nil
	}
	res, err := strconv.ParseUint(val, 10, 64)
	if err != nil {
		return 0, err
	}
	return res, nil
}

// Get num_fds from /proc/(pid)/limits
func (p *Process) fillFromLimitsWithContext(ctx context.Context) ([]RlimitStat, error) {
	pid := p.Pid
	limitsFile := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "limits")
	d, err := os.Open(limitsFile)
	if err != nil {
		return nil, err
	}
	defer d.Close()

	var limitStats []RlimitStat

	limitsScanner := bufio.NewScanner(d)
	for limitsScanner.Scan() {
		var statItem RlimitStat

		str := strings.Fields(limitsScanner.Text())

		// Remove the header line
		if strings.Contains(str[len(str)-1], "Units") {
			continue
		}

		// Assert that last item is a Hard limit
		statItem.Hard, err = limitToUint(str[len(str)-1])
		if err != nil {
			// On error remove last item and try once again since it can be unit or header line
			str = str[:len(str)-1]
			statItem.Hard, err = limitToUint(str[len(str)-1])
			if err != nil {
				return nil, err
			}
		}
		// Remove last item from string
		str = str[:len(str)-1]

		// Now last item is a Soft limit
		statItem.Soft, err = limitToUint(str[len(str)-1])
		if err != nil {
			return nil, err
		}
		// Remove last item from string
		str = str[:len(str)-1]

		// The rest is a stats name
		resourceName := strings.Join(str, " ")
		switch resourceName {
		case "Max cpu time":
			statItem.Resource = RLIMIT_CPU
		case "Max file size":
			statItem.Resource = RLIMIT_FSIZE
		case "Max data size":
			statItem.Resource = RLIMIT_DATA
		case "Max stack size":
			statItem.Resource = RLIMIT_STACK
		case "Max core file size":
			statItem.Resource = RLIMIT_CORE
		case "Max resident set":
			statItem.Resource = RLIMIT_RSS
		case "Max processes":
			statItem.Resource = RLIMIT_NPROC
		case "Max open files":
			statItem.Resource = RLIMIT_NOFILE
		case "Max locked memory":
			statItem.Resource = RLIMIT_MEMLOCK
		case "Max address space":
			statItem.Resource = RLIMIT_AS
		case "Max file locks":
			statItem.Resource = RLIMIT_LOCKS
		case "Max pending signals":
			statItem.Resource = RLIMIT_SIGPENDING
		case "Max msgqueue size":
			statItem.Resource = RLIMIT_MSGQUEUE
		case "Max nice priority":
			statItem.Resource = RLIMIT_NICE
		case "Max realtime priority":
			statItem.Resource = RLIMIT_RTPRIO
		case "Max realtime timeout":
			statItem.Resource = RLIMIT_RTTIME
		default:
			continue
		}

		limitStats = append(limitStats, statItem)
	}

	if err := limitsScanner.Err(); err != nil {
		return nil, err
	}

	return limitStats, nil
}

// Get list of /proc/(pid)/fd files
func (p *Process) fillFromfdListWithContext(ctx context.Context) (string, []string, error) {
	pid := p.Pid
	statPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "fd")
	d, err := os.Open(statPath)
	if err != nil {
		return statPath, []string{}, err
	}
	defer d.Close()
	fnames, err := d.Readdirnames(-1)
	return statPath, fnames, err
}

// Get num_fds from /proc/(pid)/fd
func (p *Process) fillFromfdWithContext(ctx context.Context) (int32, []*OpenFilesStat, error) {
	statPath, fnames, err := p.fillFromfdListWithContext(ctx)
	if err != nil {
		return 0, nil, err
	}
	numFDs := int32(len(fnames))

	var openfiles []*OpenFilesStat
	for _, fd := range fnames {
		fpath := filepath.Join(statPath, fd)
		filepath, err := os.Readlink(fpath)
		if err != nil {
			continue
		}
		t, err := strconv.ParseUint(fd, 10, 64)
		if err != nil {
			return numFDs, openfiles, err
		}
		o := &OpenFilesStat{
			Path: filepath,
			Fd:   t,
		}
		openfiles = append(openfiles, o)
	}

	return numFDs, openfiles, nil
}

// Get cwd from /proc/(pid)/cwd
func (p *Process) fillFromCwdWithContext(ctx context.Context) (string, error) {
	pid := p.Pid
	cwdPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "cwd")
	cwd, err := os.Readlink(cwdPath)
	if err != nil {
		return "", err
	}
	return string(cwd), nil
}

// Get exe from /proc/(pid)/exe
func (p *Process) fillFromExeWithContext(ctx context.Context) (string, error) {
	pid := p.Pid
	exePath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "exe")
	exe, err := os.Readlink(exePath)
	if err != nil {
		return "", err
	}
	return string(exe), nil
}

// Get cmdline from /proc/(pid)/cmdline
func (p *Process) fillFromCmdlineWithContext(ctx context.Context) (string, error) {
	pid := p.Pid
	cmdPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "cmdline")
	cmdline, err := os.ReadFile(cmdPath)
	if err != nil {
		return "", err
	}
	ret := strings.FieldsFunc(string(cmdline), func(r rune) bool {
		return r == '\u0000'
	})

	return strings.Join(ret, " "), nil
}

func (p *Process) fillSliceFromCmdlineWithContext(ctx context.Context) ([]string, error) {
	pid := p.Pid
	cmdPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "cmdline")
	cmdline, err := os.ReadFile(cmdPath)
	if err != nil {
		return nil, err
	}
	if len(cmdline) == 0 {
		return nil, nil
	}

	cmdline = bytes.TrimRight(cmdline, "\x00")

	parts := bytes.Split(cmdline, []byte{0})
	var strParts []string
	for _, p := range parts {
		strParts = append(strParts, string(p))
	}

	return strParts, nil
}

// Get IO status from /proc/(pid)/io
func (p *Process) fillFromIOWithContext(ctx context.Context) (*IOCountersStat, error) {
	pid := p.Pid
	ioPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "io")
	ioline, err := os.ReadFile(ioPath)
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(ioline), "\n")
	ret := &IOCountersStat{}

	for _, line := range lines {
		field := strings.Fields(line)
		if len(field) < 2 {
			continue
		}
		t, err := strconv.ParseUint(field[1], 10, 64)
		if err != nil {
			return nil, err
		}
		param := strings.TrimSuffix(field[0], ":")
		switch param {
		case "syscr":
			ret.ReadCount = t
		case "syscw":
			ret.WriteCount = t
		case "read_bytes":
			ret.DiskReadBytes = t
		case "write_bytes":
			ret.DiskWriteBytes = t
		case "rchar":
			ret.ReadBytes = t
		case "wchar":
			ret.WriteBytes = t
		}
	}

	return ret, nil
}

// Get memory info from /proc/(pid)/statm
func (p *Process) fillFromStatmWithContext(ctx context.Context) (*MemoryInfoStat, *MemoryInfoExStat, error) {
	pid := p.Pid
	memPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "statm")
	contents, err := os.ReadFile(memPath)
	if err != nil {
		return nil, nil, err
	}
	fields := strings.Split(string(contents), " ")

	vms, err := strconv.ParseUint(fields[0], 10, 64)
	if err != nil {
		return nil, nil, err
	}
	rss, err := strconv.ParseUint(fields[1], 10, 64)
	if err != nil {
		return nil, nil, err
	}
	memInfo := &MemoryInfoStat{
		RSS: rss * pageSize,
		VMS: vms * pageSize,
	}

	shared, err := strconv.ParseUint(fields[2], 10, 64)
	if err != nil {
		return nil, nil, err
	}
	text, err := strconv.ParseUint(fields[3], 10, 64)
	if err != nil {
		return nil, nil, err
	}
	lib, err := strconv.ParseUint(fields[4], 10, 64)
	if err != nil {
		return nil, nil, err
	}
	dirty, err := strconv.ParseUint(fields[5], 10, 64)
	if err != nil {
		return nil, nil, err
	}

	memInfoEx := &MemoryInfoExStat{
		RSS:    rss * pageSize,
		VMS:    vms * pageSize,
		Shared: shared * pageSize,
		Text:   text * pageSize,
		Lib:    lib * pageSize,
		Dirty:  dirty * pageSize,
	}

	return memInfo, memInfoEx, nil
}

// Get name from /proc/(pid)/comm or /proc/(pid)/status
func (p *Process) fillNameWithContext(ctx context.Context) error {
	err := p.fillFromCommWithContext(ctx)
	if err == nil && p.name != "" && len(p.name) < 15 {
		return nil
	}
	return p.fillFromStatusWithContext(ctx)
}

// Get name from /proc/(pid)/comm
func (p *Process) fillFromCommWithContext(ctx context.Context) error {
	pid := p.Pid
	statPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "comm")
	contents, err := os.ReadFile(statPath)
	if err != nil {
		return err
	}

	p.name = strings.TrimSuffix(string(contents), "\n")
	return nil
}

// Get various status from /proc/(pid)/status
func (p *Process) fillFromStatus() error {
	return p.fillFromStatusWithContext(context.Background())
}

func (p *Process) fillFromStatusWithContext(ctx context.Context) error {
	pid := p.Pid
	statPath := common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "status")
	contents, err := os.ReadFile(statPath)
	if err != nil {
		return err
	}
	lines := strings.Split(string(contents), "\n")
	p.numCtxSwitches = &NumCtxSwitchesStat{}
	p.memInfo = &MemoryInfoStat{}
	p.sigInfo = &SignalInfoStat{}
	for _, line := range lines {
		tabParts := strings.SplitN(line, "\t", 2)
		if len(tabParts) < 2 {
			continue
		}
		value := tabParts[1]
		switch strings.TrimRight(tabParts[0], ":") {
		case "Name":
			p.name = strings.Trim(value, " \t")
			if len(p.name) >= 15 {
				cmdlineSlice, err := p.CmdlineSliceWithContext(ctx)
				if err != nil {
					return err
				}
				if len(cmdlineSlice) > 0 {
					extendedName := filepath.Base(cmdlineSlice[0])
					if strings.HasPrefix(extendedName, p.name) {
						p.name = extendedName
					}
				}
			}
			// Ensure we have a copy and not reference into slice
			p.name = string([]byte(p.name))
		case "State":
			p.status = convertStatusChar(value[0:1])
			// Ensure we have a copy and not reference into slice
			p.status = string([]byte(p.status))
		case "PPid", "Ppid":
			pval, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				return err
			}
			p.parent = int32(pval)
		case "Tgid":
			pval, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				return err
			}
			p.tgid = int32(pval)
		case "Uid":
			p.uids = make([]uint32, 0, 4)
			for _, i := range strings.Split(value, "\t") {
				v, err := strconv.ParseInt(i, 10, 32)
				if err != nil {
					return err
				}
				p.uids = append(p.uids, uint32(v))
			}
		case "Gid":
			p.gids = make([]uint32, 0, 4)
			for _, i := range strings.Split(value, "\t") {
				v, err := strconv.ParseInt(i, 10, 32)
				if err != nil {
					return err
				}
				p.gids = append(p.gids, uint32(v))
			}
		case "Groups":
			groups := strings.Fields(value)
			p.groups = make([]uint32, 0, len(groups))
			for _, i := range groups {
				v, err := strconv.ParseUint(i, 10, 32)
				if err != nil {
					return err
				}
				p.groups = append(p.groups, uint32(v))
			}
		case "Threads":
			v, err := strconv.ParseInt(value, 10, 32)
			if err != nil {
				return err
			}
			p.numThreads = int32(v)
		case "voluntary_ctxt_switches":
			v, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return err
			}
			p.numCtxSwitches.Voluntary = v
		case "nonvoluntary_ctxt_switches":
			v, err := strconv.ParseInt(value, 10, 64)
			if err != nil {
				return err
			}
			p.numCtxSwitches.Involuntary = v
		case "VmRSS":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.RSS = v * 1024
		case "VmSize":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.VMS = v * 1024
		case "VmSwap":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.Swap = v * 1024
		case "VmHWM":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.HWM = v * 1024
		case "VmData":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.Data = v * 1024
		case "VmStk":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.Stack = v * 1024
		case "VmLck":
			value := strings.Trim(value, " kB") // remove last "kB"
			v, err := strconv.ParseUint(value, 10, 64)
			if err != nil {
				return err
			}
			p.memInfo.Locked = v * 1024
		case "SigPnd":
			if len(value) > 16 {
				value = value[len(value)-16:]
			}
			v, err := strconv.ParseUint(value, 16, 64)
			if err != nil {
				return err
			}
			p.sigInfo.PendingThread = v
		case "ShdPnd":
			if len(value) > 16 {
				value = value[len(value)-16:]
			}
			v, err := strconv.ParseUint(value, 16, 64)
			if err != nil {
				return err
			}
			p.sigInfo.PendingProcess = v
		case "SigBlk":
			if len(value) > 16 {
				value = value[len(value)-16:]
			}
			v, err := strconv.ParseUint(value, 16, 64)
			if err != nil {
				return err
			}
			p.sigInfo.Blocked = v
		case "SigIgn":
			if len(value) > 16 {
				value = value[len(value)-16:]
			}
			v, err := strconv.ParseUint(value, 16, 64)
			if err != nil {
				return err
			}
			p.sigInfo.Ignored = v
		case "SigCgt":
			if len(value) > 16 {
				value = value[len(value)-16:]
			}
			v, err := strconv.ParseUint(value, 16, 64)
			if err != nil {
				return err
			}
			p.sigInfo.Caught = v
		}

	}
	return nil
}

func (p *Process) fillFromTIDStat(tid int32) (uint64, int32, *cpu.TimesStat, int64, uint32, int32, *PageFaultsStat, error) {
	return p.fillFromTIDStatWithContext(context.Background(), tid)
}

func (p *Process) fillFromTIDStatWithContext(ctx context.Context, tid int32) (uint64, int32, *cpu.TimesStat, int64, uint32, int32, *PageFaultsStat, error) {
	pid := p.Pid
	var statPath string

	if tid == -1 {
		statPath = common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "stat")
	} else {
		statPath = common.HostProcWithContext(ctx, strconv.Itoa(int(pid)), "task", strconv.Itoa(int(tid)), "stat")
	}

	contents, err := os.ReadFile(statPath)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	// Indexing from one, as described in `man proc` about the file /proc/[pid]/stat
	fields := splitProcStat(contents)

	terminal, err := strconv.ParseUint(fields[7], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}

	ppid, err := strconv.ParseInt(fields[4], 10, 32)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	utime, err := strconv.ParseFloat(fields[14], 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}

	stime, err := strconv.ParseFloat(fields[15], 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}

	// There is no such thing as iotime in stat file.  As an approximation, we
	// will use delayacct_blkio_ticks (aggregated block I/O delays, as per Linux
	// docs).  Note: I am assuming at least Linux 2.6.18
	var iotime float64
	if len(fields) > 42 {
		iotime, err = strconv.ParseFloat(fields[42], 64)
		if err != nil {
			iotime = 0 // Ancient linux version, most likely
		}
	} else {
		iotime = 0 // e.g. SmartOS containers
	}

	cpuTimes := &cpu.TimesStat{
		CPU:    "cpu",
		User:   utime / float64(clockTicks),
		System: stime / float64(clockTicks),
		Iowait: iotime / float64(clockTicks),
	}

	bootTime, _ := common.BootTimeWithContext(ctx, enableBootTimeCache)
	t, err := strconv.ParseUint(fields[22], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	createTime := int64((t * 1000 / uint64(clockTicks)) + uint64(bootTime*1000))

	rtpriority, err := strconv.ParseInt(fields[18], 10, 32)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	if rtpriority < 0 {
		rtpriority = rtpriority*-1 - 1
	} else {
		rtpriority = 0
	}

	//	p.Nice = mustParseInt32(fields[18])
	// use syscall instead of parse Stat file
	snice, _ := unix.Getpriority(prioProcess, int(pid))
	nice := int32(snice) // FIXME: is this true?

	minFault, err := strconv.ParseUint(fields[10], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	cMinFault, err := strconv.ParseUint(fields[11], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	majFault, err := strconv.ParseUint(fields[12], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}
	cMajFault, err := strconv.ParseUint(fields[13], 10, 64)
	if err != nil {
		return 0, 0, nil, 0, 0, 0, nil, err
	}

	faults := &PageFaultsStat{
		MinorFaults:      minFault,
		MajorFaults:      majFault,
		ChildMinorFaults: cMinFault,
		ChildMajorFaults: cMajFault,
	}

	return terminal, int32(ppid), cpuTimes, createTime, uint32(rtpriority), nice, faults, nil
}

func (p *Process) fillFromStatWithContext(ctx context.Context) (uint64, int32, *cpu.TimesStat, int64, uint32, int32, *PageFaultsStat, error) {
	return p.fillFromTIDStatWithContext(ctx, -1)
}

func pidsWithContext(ctx context.Context) ([]int32, error) {
	return readPidsFromDir(common.HostProcWithContext(ctx))
}

func ProcessesWithContext(ctx context.Context) ([]*Process, error) {
	out := []*Process{}

	pids, err := PidsWithContext(ctx)
	if err != nil {
		return out, err
	}

	for _, pid := range pids {
		p, err := NewProcessWithContext(ctx, pid)
		if err != nil {
			continue
		}
		out = append(out, p)
	}

	return out, nil
}

func readPidsFromDir(path string) ([]int32, error) {
	var ret []int32

	d, err := os.Open(path)
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

func splitProcStat(content []byte) []string {
	nameStart := bytes.IndexByte(content, '(')
	nameEnd := bytes.LastIndexByte(content, ')')
	restFields := strings.Fields(string(content[nameEnd+2:])) // +2 skip ') '
	name := content[nameStart+1 : nameEnd]
	pid := strings.TrimSpace(string(content[:nameStart]))
	fields := make([]string, 3, len(restFields)+3)
	fields[1] = string(pid)
	fields[2] = string(name)
	fields = append(fields, restFields...)
	return fields
}
