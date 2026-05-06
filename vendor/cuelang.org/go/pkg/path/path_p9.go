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

// Copyright 2010 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package path

import "strings"

const plan9Separator = '/'
const plan9ListSeparator = '\000'

type plan9Info struct{}

var _ osInfo = plan9Info{}

func (o plan9Info) IsPathSeparator(b byte) bool {
	return b == plan9Separator
}

// IsAbs reports whether the path is absolute.
func (o plan9Info) IsAbs(path string) bool {
	return strings.HasPrefix(path, "/") || strings.HasPrefix(path, "#")
}

// volumeNameLen returns length of the leading volume name on Windows.
// It returns 0 elsewhere.
func (o plan9Info) volumeNameLen(path string) int {
	return 0
}

// HasPrefix exists for historical compatibility and should not be used.
//
// Deprecated: HasPrefix does not respect path boundaries and
// does not ignore case when required.
func (o plan9Info) HasPrefix(p, prefix string) bool {
	return strings.HasPrefix(p, prefix)
}

func (o plan9Info) splitList(path string) []string {
	if path == "" {
		return []string{}
	}
	return strings.Split(path, string(plan9ListSeparator))
}

func (o plan9Info) join(elem []string) string {
	// If there's a bug here, fix the logic in ./path_unix.go too.
	for i, e := range elem {
		if e != "" {
			return clean(strings.Join(elem[i:], string(plan9Separator)), plan9)
		}
	}
	return ""
}

func (o plan9Info) sameWord(a, b string) bool {
	return a == b
}
