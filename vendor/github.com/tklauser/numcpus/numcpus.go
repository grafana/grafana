// Copyright 2018-2022 Tobias Klauser
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

// Package numcpus provides information about the number of CPUs in the system.
//
// It gets the number of CPUs (online, offline, present, possible or kernel
// maximum) on Linux, Darwin, FreeBSD, NetBSD, OpenBSD, DragonflyBSD,
// Solaris/Illumos or Windows systems.
//
// On Linux, the information is retrieved by reading the corresponding CPU
// topology files in /sys/devices/system/cpu.
//
// On BSD systems, the information is retrieved using the hw.ncpu and
// hw.ncpuonline sysctls, if supported.
//
// On Windows systems, the information is retrieved using the
// GetActiveProcessorCount and GetMaximumProcessorCount functions, respectively.
//
// Not all functions are supported on Darwin, FreeBSD, NetBSD, OpenBSD,
// DragonflyBSD, Solaris/Illumos and Windows. ErrNotSupported is returned in
// case a function is not supported on a particular platform.
package numcpus

import "errors"

// ErrNotSupported is the error returned when the function is not supported.
var ErrNotSupported = errors.New("function not supported")

// GetConfigured returns the number of CPUs configured on the system. This
// function should return the same value as `getconf _SC_NPROCESSORS_CONF` on a
// unix system.
func GetConfigured() (int, error) {
	return getConfigured()
}

// GetKernelMax returns the maximum number of CPUs allowed by the kernel
// configuration. This function is only supported on Linux and Windows systems.
func GetKernelMax() (int, error) {
	return getKernelMax()
}

// GetOffline returns the number of offline CPUs, i.e. CPUs that are not online
// because they have been hotplugged off or exceed the limit of CPUs allowed by
// the kernel configuration (see GetKernelMax). This function is only supported
// on Linux systems.
func GetOffline() (int, error) {
	return getOffline()
}

// GetOnline returns the number of CPUs that are online and being scheduled.
func GetOnline() (int, error) {
	return getOnline()
}

// GetPossible returns the number of possible CPUs, i.e. CPUs that
// have been allocated resources and can be brought online if they are present.
func GetPossible() (int, error) {
	return getPossible()
}

// GetPresent returns the number of CPUs present in the system.
func GetPresent() (int, error) {
	return getPresent()
}
