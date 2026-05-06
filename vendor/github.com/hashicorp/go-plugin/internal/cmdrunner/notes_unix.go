// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

//go:build !windows
// +build !windows

package cmdrunner

import (
	"debug/elf"
	"debug/macho"
	"debug/pe"
	"fmt"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"syscall"
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
	statT, ok := stat.Sys().(*syscall.Stat_t)
	if ok {
		currentUsername := "?"
		if u, err := user.LookupId(strconv.FormatUint(uint64(os.Getuid()), 10)); err == nil {
			currentUsername = u.Username
		}
		currentGroup := "?"
		if g, err := user.LookupGroupId(strconv.FormatUint(uint64(os.Getgid()), 10)); err == nil {
			currentGroup = g.Name
		}
		username := "?"
		if u, err := user.LookupId(strconv.FormatUint(uint64(statT.Uid), 10)); err == nil {
			username = u.Username
		}
		group := "?"
		if g, err := user.LookupGroupId(strconv.FormatUint(uint64(statT.Gid), 10)); err == nil {
			group = g.Name
		}
		notes += fmt.Sprintf("  Owner: %d [%s] (current: %d [%s])\n", statT.Uid, username, os.Getuid(), currentUsername)
		notes += fmt.Sprintf("  Group: %d [%s] (current: %d [%s])\n", statT.Gid, group, os.Getgid(), currentGroup)
	}

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
