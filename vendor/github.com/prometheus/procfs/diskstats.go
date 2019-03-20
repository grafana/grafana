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

package procfs

import (
	"bufio"
	"fmt"
	"io"
	"os"

	"github.com/prometheus/procfs/iostats"
)

const (
	diskstatsFilename = "diskstats"
	statFormat        = "%d %d %s %d %d %d %d %d %d %d %d %d %d %d %d %d %d %d"
)

// NewDiskstats reads the diskstats file and returns
// an array of Diskstats (one per line/device)
func NewDiskstats() ([]iostats.IODeviceStats, error) {
	fs, err := NewFS(DefaultMountPoint)
	if err != nil {
		return nil, err
	}

	return fs.NewDiskstats()
}

// NewDiskstats reads the diskstats file and returns
// an array of Diskstats (one per line/device)
func (fs FS) NewDiskstats() ([]iostats.IODeviceStats, error) {
	file, err := os.Open(fs.Path(diskstatsFilename))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	diskstats := []iostats.IODeviceStats{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		d := &iostats.IODeviceStats{}
		count, err := fmt.Sscanf(scanner.Text(), statFormat,
			&d.MajorNumber,
			&d.MinorNumber,
			&d.DeviceName,
			&d.ReadIOs,
			&d.ReadMerges,
			&d.ReadSectors,
			&d.ReadTicks,
			&d.WriteIOs,
			&d.WriteMerges,
			&d.WriteSectors,
			&d.WriteTicks,
			&d.IOsInProgress,
			&d.IOsTotalTicks,
			&d.WeightedIOTicks,
			&d.DiscardIOs,
			&d.DiscardMerges,
			&d.DiscardSectors,
			&d.DiscardTicks)
		if err != nil && err != io.EOF {
			return diskstats, err
		}
		if count == 14 || count == 18 {
			diskstats = append(diskstats, *d)
		}
	}
	return diskstats, nil
}
