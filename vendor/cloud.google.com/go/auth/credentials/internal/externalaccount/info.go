// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package externalaccount

import (
	"runtime"
	"strings"
	"unicode"
)

var (
	// version is a package internal global variable for testing purposes.
	version = runtime.Version
)

// versionUnknown is only used when the runtime version cannot be determined.
const versionUnknown = "UNKNOWN"

// goVersion returns a Go runtime version derived from the runtime environment
// that is modified to be suitable for reporting in a header, meaning it has no
// whitespace. If it is unable to determine the Go runtime version, it returns
// versionUnknown.
func goVersion() string {
	const develPrefix = "devel +"

	s := version()
	if strings.HasPrefix(s, develPrefix) {
		s = s[len(develPrefix):]
		if p := strings.IndexFunc(s, unicode.IsSpace); p >= 0 {
			s = s[:p]
		}
		return s
	} else if p := strings.IndexFunc(s, unicode.IsSpace); p >= 0 {
		s = s[:p]
	}

	notSemverRune := func(r rune) bool {
		return !strings.ContainsRune("0123456789.", r)
	}

	if strings.HasPrefix(s, "go1") {
		s = s[2:]
		var prerelease string
		if p := strings.IndexFunc(s, notSemverRune); p >= 0 {
			s, prerelease = s[:p], s[p:]
		}
		if strings.HasSuffix(s, ".") {
			s += "0"
		} else if strings.Count(s, ".") < 2 {
			s += ".0"
		}
		if prerelease != "" {
			// Some release candidates already have a dash in them.
			if !strings.HasPrefix(prerelease, "-") {
				prerelease = "-" + prerelease
			}
			s += prerelease
		}
		return s
	}
	return versionUnknown
}
