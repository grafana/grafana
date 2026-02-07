// SPDX-License-Identifier: BSD-3-Clause
//go:build freebsd || openbsd || netbsd

package mem

import (
	"context"
	"fmt"
	"strconv"
	"strings"
)

const swapCommand = "swapctl"

// swapctl column indexes
const (
	nameCol     = 0
	totalKiBCol = 1
	usedKiBCol  = 2
)

func SwapDevices() ([]*SwapDevice, error) {
	return SwapDevicesWithContext(context.Background())
}

func SwapDevicesWithContext(ctx context.Context) ([]*SwapDevice, error) {
	output, err := invoke.CommandWithContext(ctx, swapCommand, "-lk")
	if err != nil {
		return nil, fmt.Errorf("could not execute %q: %w", swapCommand, err)
	}

	return parseSwapctlOutput(string(output))
}

func parseSwapctlOutput(output string) ([]*SwapDevice, error) {
	lines := strings.Split(output, "\n")
	if len(lines) == 0 {
		return nil, fmt.Errorf("could not parse output of %q: no lines in %q", swapCommand, output)
	}

	// Check header headerFields are as expected.
	header := lines[0]
	header = strings.ToLower(header)
	header = strings.ReplaceAll(header, ":", "")
	headerFields := strings.Fields(header)
	if len(headerFields) < usedKiBCol {
		return nil, fmt.Errorf("couldn't parse %q: too few fields in header %q", swapCommand, header)
	}
	if headerFields[nameCol] != "device" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[nameCol], "device")
	}
	if headerFields[totalKiBCol] != "1kb-blocks" && headerFields[totalKiBCol] != "1k-blocks" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[totalKiBCol], "1kb-blocks")
	}
	if headerFields[usedKiBCol] != "used" {
		return nil, fmt.Errorf("couldn't parse %q: expected %q to be %q", swapCommand, headerFields[usedKiBCol], "used")
	}

	var swapDevices []*SwapDevice
	for _, line := range lines[1:] {
		if line == "" {
			continue // the terminal line is typically empty
		}
		fields := strings.Fields(line)
		if len(fields) < usedKiBCol {
			return nil, fmt.Errorf("couldn't parse %q: too few fields", swapCommand)
		}

		totalKiB, err := strconv.ParseUint(fields[totalKiBCol], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't parse 'Size' column in %q: %w", swapCommand, err)
		}

		usedKiB, err := strconv.ParseUint(fields[usedKiBCol], 10, 64)
		if err != nil {
			return nil, fmt.Errorf("couldn't parse 'Used' column in %q: %w", swapCommand, err)
		}

		swapDevices = append(swapDevices, &SwapDevice{
			Name:      fields[nameCol],
			UsedBytes: usedKiB * 1024,
			FreeBytes: (totalKiB - usedKiB) * 1024,
		})
	}

	return swapDevices, nil
}
