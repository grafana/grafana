// Copyright 2020 CUE Authors
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

package path

// OS must be a valid runtime.GOOS value or "unix".
type OS string

const (
	Unix    OS = "unix"
	Windows OS = "windows"
	Plan9   OS = "plan9"
)

// These types have been designed to minimize the diffs with the original Go
// code, thereby minimizing potential toil in keeping them up to date.

type os struct {
	osInfo
	Separator     byte
	ListSeparator byte
}

func (o os) isWindows() bool {
	return o.Separator == '\\'
}

type osInfo interface {
	IsPathSeparator(b byte) bool
	splitList(path string) []string
	volumeNameLen(path string) int
	IsAbs(path string) (b bool)
	HasPrefix(p, prefix string) bool
	join(elem []string) string
	sameWord(a, b string) bool
}

func getOS(o OS) os {
	switch o {
	case Windows:
		return windows
	case Plan9:
		return plan9
	default:
		return unix
	}
}

var (
	plan9 = os{
		osInfo:        &plan9Info{},
		Separator:     plan9Separator,
		ListSeparator: plan9ListSeparator,
	}
	unix = os{
		osInfo:        &unixInfo{},
		Separator:     unixSeparator,
		ListSeparator: unixListSeparator,
	}
	windows = os{
		osInfo:        &windowsInfo{},
		Separator:     windowsSeparator,
		ListSeparator: windowsListSeparator,
	}
)
