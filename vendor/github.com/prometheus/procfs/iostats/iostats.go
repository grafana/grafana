// Copyright 2018 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package iostats

// IODevice contains identifying information for an I/O device
type IODevice struct {
	MajorNumber uint32
	MinorNumber uint32
	DeviceName  string
}

// IOStats models the iostats data described in the kernel documentation
// https://www.kernel.org/doc/Documentation/iostats.txt,
// https://www.kernel.org/doc/Documentation/block/stat.txt,
// and https://www.kernel.org/doc/Documentation/ABI/testing/procfs-diskstats
type IOStats struct {
	// ReadIOs is the number of reads completed successfully.
	ReadIOs uint64
	// ReadMerges is the number of reads merged.  Reads and writes
	// which are adjacent to each other may be merged for efficiency.
	ReadMerges uint64
	// ReadSectors is the total number of sectors read successfully.
	ReadSectors uint64
	// ReadTicks is the total number of milliseconds spent by all reads.
	ReadTicks uint64
	// WriteIOs is the total number of writes completed successfully.
	WriteIOs uint64
	// WriteMerges is the number of reads merged.
	WriteMerges uint64
	// WriteSectors is the total number of sectors written successfully.
	WriteSectors uint64
	// WriteTicks is the total number of milliseconds spent by all writes.
	WriteTicks uint64
	// IOsInProgress is number of I/Os currently in progress.
	IOsInProgress uint64
	// IOsTotalTicks is the number of milliseconds spent doing I/Os.
	// This field increases so long as IosInProgress is nonzero.
	IOsTotalTicks uint64
	// WeightedIOTicks is the weighted number of milliseconds spent doing I/Os.
	// This can also be used to estimate average queue wait time for requests.
	WeightedIOTicks uint64
	// DiscardIOs is the total number of discards completed successfully.
	DiscardIOs uint64
	// DiscardMerges is the number of discards merged.
	DiscardMerges uint64
	// DiscardSectors is the total number of sectors discarded successfully.
	DiscardSectors uint64
	// DiscardTicks is the total number of milliseconds spent by all discards.
	DiscardTicks uint64
}

// IODeviceStats combines IODevice and IOStats
type IODeviceStats struct {
	IODevice
	IOStats
}
