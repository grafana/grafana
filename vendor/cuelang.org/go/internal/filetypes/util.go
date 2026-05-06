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

package filetypes

import (
	"strings"

	"cuelang.org/go/cue/ast"
)

// IsPackage reports whether a command-line argument is a package based on its
// lexical representation alone.
func IsPackage(s string) bool {
	if s == "." || s == ".." {
		return true
	}
	if s == "-" {
		return false
	}

	// This goes of the assumption that file names may not have a `:` in their
	// name in cue.
	// A filename must have an extension or be preceded by a qualifier argument.
	// So strings of the form foo/bar:baz, where bar is a valid identifier and
	// absolute package
	if p := strings.LastIndexByte(s, ':'); p > 0 {
		if !ast.IsValidIdent(s[p+1:]) {
			return false
		}
		// For a non-pkg, the part before : may only be lowercase and '+'.
		// In addition, a package necessarily must have a slash of some form.
		return strings.ContainsAny(s[:p], `/.\`)
	}

	// Assuming we terminate search for packages once a scoped qualifier is
	// found, we know that any file without an extension (except maybe '-')
	// is invalid. We can therefore assume it is a package.
	// The section may still contain a dot, for instance ./foo/., ./.foo/, or ./foo/...
	return strings.TrimLeft(fileExt(s), ".") == ""

	// NOTE/TODO: we have not needed to check whether it is an absolute package
	// or whether the package starts with a dot. Potentially we could thus relax
	// the requirement that packages be dots if it is clear that the package
	// name will not interfere with command names in all circumstances.
}
