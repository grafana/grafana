// SPDX-License-Identifier: BSD-3-Clause
package mem

import (
	"encoding/json"

	"github.com/shirou/gopsutil/v4/internal/common"
)

var invoke common.Invoker = common.Invoke{}

// Memory usage statistics. Total, Available and Used contain numbers of bytes
// for human consumption.
//
// The other fields in this struct contain kernel specific values.
type VirtualMemoryStat struct {
	// Total amount of RAM on this system
	Total uint64 `json:"total"`

	// RAM available for programs to allocate
	//
	// This value is computed from the kernel specific values.
	Available uint64 `json:"available"`

	// RAM used by programs
	//
	// This value is computed from the kernel specific values.
	Used uint64 `json:"used"`

	// Percentage of RAM used by programs
	//
	// This value is computed from the kernel specific values.
	UsedPercent float64 `json:"usedPercent"`

	// This is the kernel's notion of free memory; RAM chips whose bits nobody
	// cares about the value of right now. For a human consumable number,
	// Available is what you really want.
	Free uint64 `json:"free"`

	// OS X / BSD specific numbers:
	// http://www.macyourself.com/2010/02/17/what-is-free-wired-active-and-inactive-system-memory-ram/
	Active   uint64 `json:"active"`
	Inactive uint64 `json:"inactive"`
	Wired    uint64 `json:"wired"`

	// FreeBSD specific numbers:
	// https://reviews.freebsd.org/D8467
	Laundry uint64 `json:"laundry"`

	// Linux specific numbers
	// https://www.centos.org/docs/5/html/5.1/Deployment_Guide/s2-proc-meminfo.html
	// https://www.kernel.org/doc/Documentation/filesystems/proc.txt
	// https://www.kernel.org/doc/Documentation/vm/overcommit-accounting
	// https://www.kernel.org/doc/Documentation/vm/transhuge.txt
	Buffers        uint64 `json:"buffers"`
	Cached         uint64 `json:"cached"`
	WriteBack      uint64 `json:"writeBack"`
	Dirty          uint64 `json:"dirty"`
	WriteBackTmp   uint64 `json:"writeBackTmp"`
	Shared         uint64 `json:"shared"`
	Slab           uint64 `json:"slab"`
	Sreclaimable   uint64 `json:"sreclaimable"`
	Sunreclaim     uint64 `json:"sunreclaim"`
	PageTables     uint64 `json:"pageTables"`
	SwapCached     uint64 `json:"swapCached"`
	CommitLimit    uint64 `json:"commitLimit"`
	CommittedAS    uint64 `json:"committedAS"`
	HighTotal      uint64 `json:"highTotal"`
	HighFree       uint64 `json:"highFree"`
	LowTotal       uint64 `json:"lowTotal"`
	LowFree        uint64 `json:"lowFree"`
	SwapTotal      uint64 `json:"swapTotal"`
	SwapFree       uint64 `json:"swapFree"`
	Mapped         uint64 `json:"mapped"`
	VmallocTotal   uint64 `json:"vmallocTotal"`
	VmallocUsed    uint64 `json:"vmallocUsed"`
	VmallocChunk   uint64 `json:"vmallocChunk"`
	HugePagesTotal uint64 `json:"hugePagesTotal"`
	HugePagesFree  uint64 `json:"hugePagesFree"`
	HugePagesRsvd  uint64 `json:"hugePagesRsvd"`
	HugePagesSurp  uint64 `json:"hugePagesSurp"`
	HugePageSize   uint64 `json:"hugePageSize"`
	AnonHugePages  uint64 `json:"anonHugePages"`
}

type SwapMemoryStat struct {
	Total       uint64  `json:"total"`
	Used        uint64  `json:"used"`
	Free        uint64  `json:"free"`
	UsedPercent float64 `json:"usedPercent"`
	Sin         uint64  `json:"sin"`
	Sout        uint64  `json:"sout"`
	PgIn        uint64  `json:"pgIn"`
	PgOut       uint64  `json:"pgOut"`
	PgFault     uint64  `json:"pgFault"`

	// Linux specific numbers
	// https://www.kernel.org/doc/Documentation/cgroup-v2.txt
	PgMajFault uint64 `json:"pgMajFault"`
}

func (m VirtualMemoryStat) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}

func (m SwapMemoryStat) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}

type SwapDevice struct {
	Name      string `json:"name"`
	UsedBytes uint64 `json:"usedBytes"`
	FreeBytes uint64 `json:"freeBytes"`
}

func (m SwapDevice) String() string {
	s, _ := json.Marshal(m)
	return string(s)
}
