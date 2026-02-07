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

//go:build !darwin && !dragonfly && !freebsd && !linux && !netbsd && !openbsd && !solaris && !windows

package numcpus

func getConfigured() (int, error) {
	return 0, ErrNotSupported
}

func getKernelMax() (int, error) {
	return 0, ErrNotSupported
}

func getOffline() (int, error) {
	return 0, ErrNotSupported
}

func getOnline() (int, error) {
	return 0, ErrNotSupported
}

func getPossible() (int, error) {
	return 0, ErrNotSupported
}

func getPresent() (int, error) {
	return 0, ErrNotSupported
}
