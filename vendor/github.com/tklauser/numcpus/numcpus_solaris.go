// Copyright 2021 Tobias Klauser
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

//go:build solaris

package numcpus

import "golang.org/x/sys/unix"

// taken from /usr/include/sys/unistd.h
const (
	_SC_NPROCESSORS_CONF = 14
	_SC_NPROCESSORS_ONLN = 15
	_SC_NPROCESSORS_MAX  = 516
)

func getConfigured() (int, error) {
	n, err := unix.Sysconf(_SC_NPROCESSORS_CONF)
	return int(n), err
}

func getKernelMax() (int, error) {
	n, err := unix.Sysconf(_SC_NPROCESSORS_MAX)
	return int(n), err
}

func getOffline() (int, error) {
	return 0, ErrNotSupported
}

func getOnline() (int, error) {
	n, err := unix.Sysconf(_SC_NPROCESSORS_ONLN)
	return int(n), err
}

func getPossible() (int, error) {
	n, err := unix.Sysconf(_SC_NPROCESSORS_CONF)
	return int(n), err
}

func getPresent() (int, error) {
	n, err := unix.Sysconf(_SC_NPROCESSORS_CONF)
	return int(n), err
}
