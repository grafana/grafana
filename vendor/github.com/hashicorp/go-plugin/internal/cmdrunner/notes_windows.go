// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build windows
// +build windows

package cmdrunner

import (
	"debug/elf"
	"debug/macho"
	"debug/pe"
	"fmt"
	"os"
	"runtime"
)

// additionalNotesAboutCommand tries to get additional information about a command that might help diagnose
// why it won't run correctly. It runs as a best effort only.
func additionalNotesAboutCommand(path string) string {
	notes := ""
	stat, err := os.Stat(path)
	if err != nil {
		return notes
	}

	notes += "\nAdditional notes about plugin:\n"
	notes += fmt.Sprintf("  Path: %s\n", path)
	notes += fmt.Sprintf("  Mode: %s\n", stat.Mode())

	if elfFile, err := elf.Open(path); err == nil {
		defer elfFile.Close()
		notes += fmt.Sprintf("  ELF architecture: %s (current architecture: %s)\n", elfFile.Machine, runtime.GOARCH)
	} else if machoFile, err := macho.Open(path); err == nil {
		defer machoFile.Close()
		notes += fmt.Sprintf("  MachO architecture: %s (current architecture: %s)\n", machoFile.Cpu, runtime.GOARCH)
	} else if peFile, err := pe.Open(path); err == nil {
		defer peFile.Close()
		machine, ok := peTypes[peFile.Machine]
		if !ok {
			machine = "unknown"
		}
		notes += fmt.Sprintf("  PE architecture: %s (current architecture: %s)\n", machine, runtime.GOARCH)
	}
	return notes
}
