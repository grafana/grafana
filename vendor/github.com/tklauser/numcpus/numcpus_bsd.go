// Copyright 2018 Tobias Klauser
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

//go:build darwin || dragonfly || freebsd || netbsd || openbsd

package numcpus

import (
	"runtime"

	"golang.org/x/sys/unix"
)

func getConfigured() (int, error) {
	n, err := unix.SysctlUint32("hw.ncpu")
	return int(n), err
}

func getKernelMax() (int, error) {
	if runtime.GOOS == "freebsd" {
		n, err := unix.SysctlUint32("kern.smp.maxcpus")
		return int(n), err
	}
	return 0, ErrNotSupported
}

func getOffline() (int, error) {
	return 0, ErrNotSupported
}

func getOnline() (int, error) {
	var n uint32
	var err error
	switch runtime.GOOS {
	case "netbsd", "openbsd":
		n, err = unix.SysctlUint32("hw.ncpuonline")
		if err != nil {
			n, err = unix.SysctlUint32("hw.ncpu")
		}
	default:
		n, err = unix.SysctlUint32("hw.ncpu")
	}
	return int(n), err
}

func getPossible() (int, error) {
	n, err := unix.SysctlUint32("hw.ncpu")
	return int(n), err
}

func getPresent() (int, error) {
	n, err := unix.SysctlUint32("hw.ncpu")
	return int(n), err
}
