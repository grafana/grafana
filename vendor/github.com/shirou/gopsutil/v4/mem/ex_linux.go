// SPDX-License-Identifier: BSD-3-Clause
//go:build linux

package mem

import (
	"context"
	"encoding/json"
)

type ExVirtualMemory struct {
	ActiveFile   uint64 `json:"activefile"`
	InactiveFile uint64 `json:"inactivefile"`
	ActiveAnon   uint64 `json:"activeanon"`
	InactiveAnon uint64 `json:"inactiveanon"`
	Unevictable  uint64 `json:"unevictable"`
}

func (v ExVirtualMemory) String() string {
	s, _ := json.Marshal(v)
	return string(s)
}

type ExLinux struct{}

func NewExLinux() *ExLinux {
	return &ExLinux{}
}

func (ex *ExLinux) VirtualMemory() (*ExVirtualMemory, error) {
	return ex.VirtualMemoryWithContext(context.Background())
}

func (ex *ExLinux) VirtualMemoryWithContext(ctx context.Context) (*ExVirtualMemory, error) {
	_, vmEx, err := fillFromMeminfoWithContext(ctx)
	if err != nil {
		return nil, err
	}
	return vmEx, nil
}
