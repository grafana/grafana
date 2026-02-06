package stats

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// CPUType represents /dev/cputype.
type CPUType struct {
	Name  string
	Clock int // clock rate in MHz
}

func ReadCPUType(ctx context.Context, opts ...Option) (*CPUType, error) {
	cfg := newConfig(opts...)
	var c CPUType
	if err := readCPUType(cfg.rootdir, &c); err != nil {
		return nil, err
	}
	return &c, nil
}

type SysStats struct {
	ID           int
	NumCtxSwitch int64
	NumInterrupt int64
	NumSyscall   int64
	NumFault     int64
	NumTLBFault  int64
	NumTLBPurge  int64
	LoadAvg      int64 // in units of milli-CPUs and is decayed over time
	Idle         int   // percentage
	Interrupt    int   // percentage
}

// ReadSysStats reads system statistics from /dev/sysstat.
func ReadSysStats(ctx context.Context, opts ...Option) ([]*SysStats, error) {
	cfg := newConfig(opts...)
	file := filepath.Join(cfg.rootdir, "/dev/sysstat")
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	var stats []*SysStats
	for scanner.Scan() {
		a := strings.Fields(scanner.Text())
		if len(a) != 10 {
			continue
		}
		var (
			p    intParser
			stat SysStats
		)
		stat.ID = p.ParseInt(a[0], 10)
		stat.NumCtxSwitch = p.ParseInt64(a[1], 10)
		stat.NumInterrupt = p.ParseInt64(a[2], 10)
		stat.NumSyscall = p.ParseInt64(a[3], 10)
		stat.NumFault = p.ParseInt64(a[4], 10)
		stat.NumTLBFault = p.ParseInt64(a[5], 10)
		stat.NumTLBPurge = p.ParseInt64(a[6], 10)
		stat.LoadAvg = p.ParseInt64(a[7], 10)
		stat.Idle = p.ParseInt(a[8], 10)
		stat.Interrupt = p.ParseInt(a[9], 10)
		if err := p.Err(); err != nil {
			return nil, err
		}
		stats = append(stats, &stat)
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	return stats, nil
}

func readCPUType(rootdir string, c *CPUType) error {
	file := filepath.Join(rootdir, "/dev/cputype")
	b, err := ioutil.ReadFile(file)
	if err != nil {
		return err
	}
	b = bytes.TrimSpace(b)
	i := bytes.LastIndexByte(b, ' ')
	if i < 0 {
		return fmt.Errorf("%s: invalid format", file)
	}
	clock, err := strconv.Atoi(string(b[i+1:]))
	if err != nil {
		return err
	}
	c.Name = string(b[:i])
	c.Clock = clock
	return nil
}

// Time represents /dev/time.
type Time struct {
	Unix     time.Duration
	UnixNano time.Duration
	Ticks    int64 // clock ticks
	Freq     int64 //cloc frequency
}

// Uptime returns uptime.
func (t *Time) Uptime() time.Duration {
	v := float64(t.Ticks) / float64(t.Freq)
	return time.Duration(v*1000_000_000) * time.Nanosecond
}

func ReadTime(ctx context.Context, opts ...Option) (*Time, error) {
	cfg := newConfig(opts...)
	file := filepath.Join(cfg.rootdir, "/dev/time")
	var t Time
	if err := readTime(file, &t); err != nil {
		return nil, err
	}
	return &t, nil
}

// ProcStatus represents a /proc/n/status.
type ProcStatus struct {
	Name         string
	User         string
	State        string
	Times        CPUTime
	MemUsed      int64  // in units of 1024 bytes
	BasePriority uint32 // 0(low) to 19(high)
	Priority     uint32 // 0(low) to 19(high)
}

// CPUTime represents /dev/cputime or a part of /proc/n/status.
type CPUTime struct {
	User      time.Duration // the time in user mode (millisecconds)
	Sys       time.Duration
	Real      time.Duration
	ChildUser time.Duration // exited children and descendants time in user mode
	ChildSys  time.Duration
	ChildReal time.Duration
}

// CPUStats emulates Linux's /proc/stat.
type CPUStats struct {
	User time.Duration
	Sys  time.Duration
	Idle time.Duration
}

func ReadCPUStats(ctx context.Context, opts ...Option) (*CPUStats, error) {
	cfg := newConfig(opts...)
	a, err := ReadSysStats(ctx, opts...)
	if err != nil {
		return nil, err
	}

	dir := filepath.Join(cfg.rootdir, "/proc")
	d, err := os.Open(dir)
	if err != nil {
		return nil, err
	}
	defer d.Close()

	names, err := d.Readdirnames(0)
	if err != nil {
		return nil, err
	}
	var up uint32parser
	pids := make([]uint32, len(names))
	for i, s := range names {
		if s == "trace" {
			continue
		}
		pids[i] = up.Parse(s)
	}
	if err := up.err; err != nil {
		return nil, err
	}
	sort.Slice(pids, func(i, j int) bool {
		return pids[i] < pids[j]
	})

	var stat CPUStats
	for _, pid := range pids {
		s := strconv.FormatUint(uint64(pid), 10)
		file := filepath.Join(dir, s, "status")
		var p ProcStatus
		if err := readProcStatus(file, &p); err != nil {
			return nil, err
		}
		stat.User += p.Times.User
		stat.Sys += p.Times.Sys
	}

	var t Time
	file := filepath.Join(cfg.rootdir, "/dev/time")
	if err := readTime(file, &t); err != nil {
		return nil, err
	}
	// In multi-processor host, Idle should multiple by number of cores.
	u := t.Uptime() * time.Duration(len(a))
	stat.Idle = u - stat.User - stat.Sys
	return &stat, nil
}

func readProcStatus(file string, p *ProcStatus) error {
	b, err := ioutil.ReadFile(file)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	fields := strings.Fields(string(b))
	if len(fields) != 12 {
		return errors.New("invalid format")
	}
	p.Name = string(fields[0])
	p.User = string(fields[1])
	p.State = string(fields[2])
	var up uint32parser
	p.Times.User = time.Duration(up.Parse(fields[3])) * time.Millisecond
	p.Times.Sys = time.Duration(up.Parse(fields[4])) * time.Millisecond
	p.Times.Real = time.Duration(up.Parse(fields[5])) * time.Millisecond
	p.Times.ChildUser = time.Duration(up.Parse(fields[6])) * time.Millisecond
	p.Times.ChildSys = time.Duration(up.Parse(fields[7])) * time.Millisecond
	p.Times.ChildReal = time.Duration(up.Parse(fields[8])) * time.Millisecond
	p.MemUsed, err = strconv.ParseInt(fields[9], 10, 64)
	if err != nil {
		return err
	}
	p.BasePriority = up.Parse(fields[10])
	p.Priority = up.Parse(fields[11])
	return up.err
}

func readTime(file string, t *Time) error {
	b, err := ioutil.ReadFile(file)
	if err != nil {
		return err
	}
	fields := strings.Fields(string(b))
	if len(fields) != 4 {
		return errors.New("invalid format")
	}
	n, err := strconv.ParseInt(fields[0], 10, 32)
	if err != nil {
		return err
	}
	t.Unix = time.Duration(n) * time.Second
	v, err := strconv.ParseInt(fields[1], 10, 64)
	if err != nil {
		return err
	}
	t.UnixNano = time.Duration(v) * time.Nanosecond
	t.Ticks, err = strconv.ParseInt(fields[2], 10, 64)
	if err != nil {
		return err
	}
	t.Freq, err = strconv.ParseInt(fields[3], 10, 64)
	if err != nil {
		return err
	}
	return nil
}

type uint32parser struct {
	err error
}

func (p *uint32parser) Parse(s string) uint32 {
	if p.err != nil {
		return 0
	}
	n, err := strconv.ParseUint(s, 10, 32)
	if err != nil {
		p.err = err
		return 0
	}
	return uint32(n)
}
