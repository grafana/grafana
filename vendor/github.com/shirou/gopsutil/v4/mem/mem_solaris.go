// SPDX-License-Identifier: BSD-3-Clause
//go:build solaris

package mem

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/tklauser/go-sysconf"

	"github.com/shirou/gopsutil/v4/internal/common"
)

// VirtualMemory for Solaris is a minimal implementation which only returns
// what Nomad needs. It does take into account global vs zone, however.
func VirtualMemory() (*VirtualMemoryStat, error) {
	return VirtualMemoryWithContext(context.Background())
}

func VirtualMemoryWithContext(ctx context.Context) (*VirtualMemoryStat, error) {
	result := &VirtualMemoryStat{}

	zoneName, err := zoneName(ctx)
	if err != nil {
		return nil, err
	}

	if zoneName == "global" {
		capacity, err := globalZoneMemoryCapacity(ctx)
		if err != nil {
			return nil, err
		}
		result.Total = capacity
		freemem, err := globalZoneFreeMemory(ctx)
		if err != nil {
			return nil, err
		}
		result.Available = freemem
		result.Free = freemem
		result.Used = result.Total - result.Free
	} else {
		capacity, err := nonGlobalZoneMemoryCapacity(ctx)
		if err != nil {
			return nil, err
		}
		result.Total = capacity
	}

	return result, nil
}

func SwapMemory() (*SwapMemoryStat, error) {
	return SwapMemoryWithContext(context.Background())
}

func SwapMemoryWithContext(_ context.Context) (*SwapMemoryStat, error) {
	return nil, common.ErrNotImplementedError
}

func zoneName(ctx context.Context) (string, error) {
	out, err := invoke.CommandWithContext(ctx, "zonename")
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(out)), nil
}

var globalZoneMemoryCapacityMatch = regexp.MustCompile(`[Mm]emory size: (\d+) Megabytes`)

func globalZoneMemoryCapacity(ctx context.Context) (uint64, error) {
	out, err := invoke.CommandWithContext(ctx, "prtconf")
	if err != nil {
		return 0, err
	}

	match := globalZoneMemoryCapacityMatch.FindAllStringSubmatch(string(out), -1)
	if len(match) != 1 {
		return 0, errors.New("memory size not contained in output of prtconf")
	}

	totalMB, err := strconv.ParseUint(match[0][1], 10, 64)
	if err != nil {
		return 0, err
	}

	return totalMB * 1024 * 1024, nil
}

func globalZoneFreeMemory(ctx context.Context) (uint64, error) {
	output, err := invoke.CommandWithContext(ctx, "pagesize")
	if err != nil {
		return 0, err
	}

	pagesize, err := strconv.ParseUint(strings.TrimSpace(string(output)), 10, 64)
	if err != nil {
		return 0, err
	}

	free, err := sysconf.Sysconf(sysconf.SC_AVPHYS_PAGES)
	if err != nil {
		return 0, err
	}

	return uint64(free) * pagesize, nil
}

var kstatMatch = regexp.MustCompile(`(\S+)\s+(\S*)`)

func nonGlobalZoneMemoryCapacity(ctx context.Context) (uint64, error) {
	out, err := invoke.CommandWithContext(ctx, "kstat", "-p", "-c", "zone_memory_cap", "memory_cap:*:*:physcap")
	if err != nil {
		return 0, err
	}

	kstats := kstatMatch.FindAllStringSubmatch(string(out), -1)
	if len(kstats) != 1 {
		return 0, fmt.Errorf("expected 1 kstat, found %d", len(kstats))
	}

	memSizeBytes, err := strconv.ParseUint(kstats[0][2], 10, 64)
	if err != nil {
		return 0, err
	}

	return memSizeBytes, nil
}

const swapCommand = "swap"

// The blockSize as reported by `swap -l`. See https://docs.oracle.com/cd/E23824_01/html/821-1459/fsswap-52195.html
const blockSize = 512

// swapctl column indexes
const (
	nameCol = 0
	// devCol = 1
	// swaploCol = 2
	totalBlocksCol = 3
	freeBlocksCol  = 4
)

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(ctx context.Context) ([]*SwapDevice, error) {
	output, err := invoke.CommandWithContext(ctx, swapCommand, "-l")
	if err != nil {
		return nil, fmt.Errorf("could not execute %q: %w", swapCommand, err)
	}

	return parseSwapsCommandOutput(string(output))
}

func parseSwapsCommandOutput(output string) ([]*SwapDevice, error) {
	lines := strings.Split(output, "\n")
	if len(lines) == 0 {
		return nil, fmt.Errorf("could not parse output of %q: no lines in %q", swapCommand, output)
	}

	// Check header headerFields are as expected.
	headerFields := strings.Fields(lines[0])
	if len(headerFields) < freeBlocksCol {
		return nil, fmt.Errorf("couldn't parse %q: too few fields in header %q", swapCommand, lines[0])
	}
	if headerFields[nameCol] != "swapfile" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[nameCol], "swapfile")
	}
	if headerFields[totalBlocksCol] != "blocks" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[totalBlocksCol], "blocks")
	}
	if headerFields[freeBlocksCol] != "free" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[freeBlocksCol], "free")
	}

	var swapDevices []*SwapDevice
	for _, line := range lines[1:] {
		if line == "" {
			continue // the terminal line is typically empty
		}
		fields := strings.Fields(line)
		if len(fields) < freeBlocksCol {
			return nil, fmt.Errorf("couldn't parse %q: too few fields", swapCommand)
		}

		totalBlocks, err := strconv.ParseUint(fields[totalBlocksCol], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't parse 'Size' column in %q: %w", swapCommand, err)
		}

		freeBlocks, err := strconv.ParseUint(fields[freeBlocksCol], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't parse 'Used' column in %q: %w", swapCommand, err)
		}

		swapDevices = append(swapDevices, &SwapDevice{
			Name:      fields[nameCol],
			UsedBytes: (totalBlocks - freeBlocks) * blockSize,
			FreeBytes: freeBlocks * blockSize,
		})
	}

	return swapDevices, nil
}
