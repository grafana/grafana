// SPDX-License-Identifier: BSD-3-Clause
//go:build darwin || freebsd || openbsd

package process

import (
	"bytes"
	"context"
	"encoding/binary"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/internal/common"
)

type MemoryInfoExStat struct{}

type MemoryMapsStat struct{}

func (p *Process) TgidWithContext(_ context.Context) (int32, error) {
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

func (p *Process) NumCtxSwitchesWithContext(_ context.Context) (*NumCtxSwitchesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) NumFDsWithContext(_ context.Context) (int32, error) {
	return 0, common.ErrNotImplementedError
}

func (p *Process) CPUAffinityWithContext(_ context.Context) ([]int32, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryInfoExWithContext(_ context.Context) (*MemoryInfoExStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) PageFaultsWithContext(_ context.Context) (*PageFaultsStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) OpenFilesWithContext(_ context.Context) ([]OpenFilesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) MemoryMapsWithContext(_ context.Context, _ bool) (*[]MemoryMapsStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) ThreadsWithContext(_ context.Context) (map[int32]*cpu.TimesStat, error) {
	return nil, common.ErrNotImplementedError
}

func (p *Process) EnvironWithContext(_ context.Context) ([]string, error) {
	return nil, common.ErrNotImplementedError
}

func parseKinfoProc(buf []byte) (KinfoProc, error) {
	var k KinfoProc
	br := bytes.NewReader(buf)
	err := common.Read(br, binary.LittleEndian, &k)
	return k, err
}
