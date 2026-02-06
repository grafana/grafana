// SPDX-License-Identifier: BSD-3-Clause
//go:build !darwin && !linux && !freebsd && !openbsd && !windows && !solaris && !plan9

package process

import (
	"context"
	"syscall"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
	"github.com/shirou/gopsutil/v4/net"
)

type Signal = syscall.Signal

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

type MemoryInfoExStat struct{}

func pidsWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func ProcessesWithContext(_ context.Context) ([]*Process, error) {
	return nil, common.ErrNotImplementedError
}

func PidExistsWithContext(_ context.Context, _ int32) (bool, error) {
	return false, common.ErrNotImplementedError
}

func (p *Process) PpidWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) NameWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) TgidWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) ExeWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) CmdlineWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) CmdlineSliceWithContext(_ context.Context) ([]string, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) createTimeWithContext(_ context.Context) (int64, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) CwdWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) StatusWithContext(_ context.Context) ([]string, error) {
	return []string{""}, common.ErrNotImplementedError
}

func (p *Process) ForegroundWithContext(_ context.Context) (bool, error) {
	return false, common.ErrNotImplementedError
}

func (p *Process) UidsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) GidsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) GroupsWithContext(_ context.Context) ([]uint32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) TerminalWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) NiceWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) IOniceWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) RlimitWithContext(_ context.Context) ([]RlimitStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) RlimitUsageWithContext(_ context.Context, _ bool) ([]RlimitStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) IOCountersWithContext(_ context.Context) (*IOCountersStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) NumCtxSwitchesWithContext(_ context.Context) (*NumCtxSwitchesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) NumFDsWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) NumThreadsWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) ThreadsWithContext(_ context.Context) (map[int32]*cpu.TimesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) TimesWithContext(_ context.Context) (*cpu.TimesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) CPUAffinityWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryInfoWithContext(_ context.Context) (*MemoryInfoStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryInfoExWithContext(_ context.Context) (*MemoryInfoExStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) PageFaultsWithContext(_ context.Context) (*PageFaultsStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) ChildrenWithContext(_ context.Context) ([]*Process, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) OpenFilesWithContext(_ context.Context) ([]OpenFilesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) ConnectionsWithContext(_ context.Context) ([]net.ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) ConnectionsMaxWithContext(_ context.Context, _ int) ([]net.ConnectionStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryMapsWithContext(_ context.Context, _ bool) (*[]MemoryMapsStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) SendSignalWithContext(_ context.Context, _ Signal) error {
	return common.ErrNotImplementedError
}

func (p *Process) SuspendWithContext(_ context.Context) error {
	return common.ErrNotImplementedError
}

func (p *Process) ResumeWithContext(_ context.Context) error {
	return common.ErrNotImplementedError
}

func (p *Process) TerminateWithContext(_ context.Context) error {
	return common.ErrNotImplementedError
}

func (p *Process) KillWithContext(_ context.Context) error {
	return common.ErrNotImplementedError
}

func (p *Process) UsernameWithContext(_ context.Context) (string, error) {
	return "", common.ErrNotImplementedError
}

func (p *Process) EnvironWithContext(_ context.Context) ([]string, error) {
	return nil, common.ErrNotImplementedError
}
