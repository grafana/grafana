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

type unixInfo struct{}

var _ osInfo = unixInfo{}

const (
	unixListSeparator = ':'
	unixSeparator     = '/'
)

func (o unixInfo) IsPathSeparator(b byte) bool {
	return b == unixSeparator
}

// IsAbs reports whether the path is absolute.
func (o unixInfo) IsAbs(path string) bool {
	return strings.HasPrefix(path, "/")
}

// volumeNameLen returns length of the leading volume name on Windows.
// It returns 0 elsewhere.
func (o unixInfo) volumeNameLen(path string) int {
	return 0
}

// HasPrefix exists for historical compatibility and should not be used.
//
// Deprecated: HasPrefix does not respect path boundaries and
// does not ignore case when required.
func (o unixInfo) HasPrefix(p, prefix string) bool {
	return strings.HasPrefix(p, prefix)
}

func (o unixInfo) splitList(path string) []string {
	if path == "" {
		return []string{}
	}
	return strings.Split(path, string(unixListSeparator))
}

func (o unixInfo) join(elem []string) string {
	// If there's a bug here, fix the logic in ./path_plan9.go too.
	for i, e := range elem {
		if e != "" {
			return clean(strings.Join(elem[i:], string(unixSeparator)), unix)
		}
	}
	return ""
}

func (o unixInfo) sameWord(a, b string) bool {
	return a == b
}
