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

// Copyright 2009 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package filepath implements utility routines for manipulating filename paths
// in a way compatible with the target operating system-defined file paths.
//
// The filepath package uses either forward slashes or backslashes,
// depending on the operating system. To process paths such as URLs
// that always use forward slashes regardless of the operating
// system, see the path package.
package path

import (
	"errors"
	"strings"
)

// A lazybuf is a lazily constructed path buffer.
// It supports append, reading previously appended bytes,
// and retrieving the final string. It does not allocate a buffer
// to hold the output until that output diverges.
type lazybuf struct {
	path       string
	buf        []byte
	w          int
	volAndPath string
	volLen     int
}

func (b *lazybuf) index(i int) byte {
	if b.buf != nil {
		return b.buf[i]
	}
	return b.path[i]
}

func (b *lazybuf) append(c byte) {
	if b.buf == nil {
		if b.w < len(b.path) && b.path[b.w] == c {
			b.w++
			return
		}
		b.buf = make([]byte, len(b.path))
		copy(b.buf, b.path[:b.w])
	}
	b.buf[b.w] = c
	b.w++
}

func (b *lazybuf) string() string {
	if b.buf == nil {
		return b.volAndPath[:b.volLen+b.w]
	}
	return b.volAndPath[:b.volLen] + string(b.buf[:b.w])
}

// Clean returns the shortest path name equivalent to path
// by purely lexical processing. The default value for os is Unix.
// It applies the following rules
// iteratively until no further processing can be done:
//
//  1. Replace multiple Separator elements with a single one.
//  2. Eliminate each . path name element (the current directory).
//  3. Eliminate each inner .. path name element (the parent directory)
//     along with the non-.. element that precedes it.
//  4. Eliminate .. elements that begin a rooted path:
//     that is, replace "/.." by "/" at the beginning of a path,
//     assuming Separator is '/'.
//
// The returned path ends in a slash only if it represents a root directory,
// such as "/" on Unix or `C:\` on Windows.
//
// Finally, any occurrences of slash are replaced by Separator.
//
// If the result of this process is an empty string, Clean
// returns the string ".".
//
// See also Rob Pike, “Lexical File Names in Plan 9 or
// Getting Dot-Dot Right,”
// https://9p.io/sys/doc/lexnames.html
func Clean(path string, os OS) string {
	return clean(path, getOS(os))
}

func clean(path string, os os) string {
	originalPath := path
	volLen := os.volumeNameLen(path)
	path = path[volLen:]
	if path == "" {
		if volLen > 1 && originalPath[1] != ':' {
			// should be UNC
			return fromSlash(originalPath, os)
		}
		return originalPath + "."
	}
	rooted := os.IsPathSeparator(path[0])

	// Invariants:
	//	reading from path; r is index of next byte to process.
	//	writing to buf; w is index of next byte to write.
	//	dotdot is index in buf where .. must stop, either because
	//		it is the leading slash or it is a leading ../../.. prefix.
	n := len(path)
	out := lazybuf{path: path, volAndPath: originalPath, volLen: volLen}
	r, dotdot := 0, 0
	if rooted {
		out.append(os.Separator)
		r, dotdot = 1, 1
	}

	for r < n {
		switch {
		case os.IsPathSeparator(path[r]):
			// empty path element
			r++
		case path[r] == '.' && (r+1 == n || os.IsPathSeparator(path[r+1])):
			// . element
			r++
		case path[r] == '.' && path[r+1] == '.' && (r+2 == n || os.IsPathSeparator(path[r+2])):
			// .. element: remove to last separator
			r += 2
			switch {
			case out.w > dotdot:
				// can backtrack
				out.w--
				for out.w > dotdot && !os.IsPathSeparator(out.index(out.w)) {
					out.w--
				}
			case !rooted:
				// cannot backtrack, but not rooted, so append .. element.
				if out.w > 0 {
					out.append(os.Separator)
				}
				out.append('.')
				out.append('.')
				dotdot = out.w
			}
		default:
			// real path element.
			// add slash if needed
			if rooted && out.w != 1 || !rooted && out.w != 0 {
				out.append(os.Separator)
			}
			// copy element
			for ; r < n && !os.IsPathSeparator(path[r]); r++ {
				out.append(path[r])
			}
		}
	}

	// Turn empty string into "."
	if out.w == 0 {
		out.append('.')
	}

	return fromSlash(out.string(), os)
}

// ToSlash returns the result of replacing each separator character
// in path with a slash ('/') character. Multiple separators are
// replaced by multiple slashes.
func ToSlash(path string, os OS) string {
	return toSlash(path, getOS(os))
}

func toSlash(path string, os os) string {
	if os.Separator == '/' {
		return path
	}
	return strings.ReplaceAll(path, string(os.Separator), "/")
}

// FromSlash returns the result of replacing each slash ('/') character
// in path with a separator character. Multiple slashes are replaced
// by multiple separators.
func FromSlash(path string, os OS) string {
	return fromSlash(path, getOS(os))
}

func fromSlash(path string, os os) string {
	if os.Separator == '/' {
		return path
	}
	return strings.ReplaceAll(path, "/", string(os.Separator))
}

// SplitList splits a list of paths joined by the OS-specific ListSeparator,
// usually found in PATH or GOPATH environment variables.
// Unlike strings.Split, SplitList returns an empty slice when passed an empty
// string.
func SplitList(path string, os OS) []string {
	return getOS(os).splitList(path)
}

// Split splits path immediately following the final slash and returns them as
// the list [dir, file], separating it into a directory and file name component.
// If there is no slash in path, Split returns an empty dir and file set to
// path. The returned values have the property that path = dir+file.
// The default value for os is Unix.
func Split(path string, os OS) []string {
	x := getOS(os)
	vol := volumeName(path, x)
	i := len(path) - 1
	for i >= len(vol) && !x.IsPathSeparator(path[i]) {
		i--
	}
	return []string{path[:i+1], path[i+1:]}
}

// Join joins any number of path elements into a single path,
// separating them with an OS specific Separator. Empty elements
// are ignored. The result is Cleaned. However, if the argument
// list is empty or all its elements are empty, Join returns
// an empty string.
// On Windows, the result will only be a UNC path if the first
// non-empty element is a UNC path.
// The default value for os is Unix.
func Join(elem []string, os OS) string {
	return getOS(os).join(elem)
}

// Ext returns the file name extension used by path.
// The extension is the suffix beginning at the final dot
// in the final element of path; it is empty if there is
// no dot. The default value for os is Unix.
func Ext(path string, os OS) string {
	x := getOS(os)
	for i := len(path) - 1; i >= 0 && !x.IsPathSeparator(path[i]); i-- {
		if path[i] == '.' {
			return path[i:]
		}
	}
	return ""
}

// Resolve reports the path of sub relative to dir. If sub is an absolute path,
// or if dir is empty, it will return sub. If sub is empty, it will return dir.
// Resolve calls Clean on the result. The default value for os is Unix.
func Resolve(dir, sub string, os OS) string {
	x := getOS(os)
	if x.IsAbs(sub) {
		return clean(sub, x)
	}
	dir = clean(dir, x)
	return x.join([]string{dir, sub})
}

// Rel returns a relative path that is lexically equivalent to targpath when
// joined to basepath with an intervening separator. That is,
// Join(basepath, Rel(basepath, targpath)) is equivalent to targpath itself.
// On success, the returned path will always be relative to basepath,
// even if basepath and targpath share no elements.
// An error is returned if targpath can't be made relative to basepath or if
// knowing the current working directory would be necessary to compute it.
// Rel calls Clean on the result. The default value for os is Unix.
func Rel(basepath, targpath string, os OS) (string, error) {
	x := getOS(os)
	baseVol := volumeName(basepath, x)
	targVol := volumeName(targpath, x)
	base := clean(basepath, x)
	targ := clean(targpath, x)
	if x.sameWord(targ, base) {
		return ".", nil
	}
	base = base[len(baseVol):]
	targ = targ[len(targVol):]
	if base == "." {
		base = ""
	}
	// Can't use IsAbs - `\a` and `a` are both relative in Windows.
	baseSlashed := len(base) > 0 && base[0] == x.Separator
	targSlashed := len(targ) > 0 && targ[0] == x.Separator
	if baseSlashed != targSlashed || !x.sameWord(baseVol, targVol) {
		return "", errors.New("Rel: can't make " + targpath + " relative to " + basepath)
	}
	// Position base[b0:bi] and targ[t0:ti] at the first differing elements.
	bl := len(base)
	tl := len(targ)
	var b0, bi, t0, ti int
	for {
		for bi < bl && base[bi] != x.Separator {
			bi++
		}
		for ti < tl && targ[ti] != x.Separator {
			ti++
		}
		if !x.sameWord(targ[t0:ti], base[b0:bi]) {
			break
		}
		if bi < bl {
			bi++
		}
		if ti < tl {
			ti++
		}
		b0 = bi
		t0 = ti
	}
	if base[b0:bi] == ".." {
		return "", errors.New("Rel: can't make " + targpath + " relative to " + basepath)
	}
	if b0 != bl {
		// Base elements left. Must go up before going down.
		seps := strings.Count(base[b0:bl], string(x.Separator))
		size := 2 + seps*3
		if tl != t0 {
			size += 1 + tl - t0
		}
		buf := make([]byte, size)
		n := copy(buf, "..")
		for i := 0; i < seps; i++ {
			buf[n] = x.Separator
			copy(buf[n+1:], "..")
			n += 3
		}
		if t0 != tl {
			buf[n] = x.Separator
			copy(buf[n+1:], targ[t0:])
		}
		return string(buf), nil
	}
	return targ[t0:], nil
}

// Base returns the last element of path.
// Trailing path separators are removed before extracting the last element.
// If the path is empty, Base returns ".".
// If the path consists entirely of separators, Base returns a single separator.
// The default value for os is Unix.
func Base(path string, os OS) string {
	x := getOS(os)
	if path == "" {
		return "."
	}
	// Strip trailing slashes.
	for len(path) > 0 && x.IsPathSeparator(path[len(path)-1]) {
		path = path[0 : len(path)-1]
	}
	// Throw away volume name
	path = path[x.volumeNameLen(path):]
	// Find the last element
	i := len(path) - 1
	for i >= 0 && !x.IsPathSeparator(path[i]) {
		i--
	}
	if i >= 0 {
		path = path[i+1:]
	}
	// If empty now, it had only slashes.
	if path == "" {
		return string(x.Separator)
	}
	return path
}

// Dir returns all but the last element of path, typically the path's directory.
// After dropping the final element, Dir calls Clean on the path and trailing
// slashes are removed.
// If the path is empty, Dir returns ".".
// If the path consists entirely of separators, Dir returns a single separator.
// The returned path does not end in a separator unless it is the root directory.
// The default value for os is Unix.
func Dir(path string, os OS) string {
	x := getOS(os)
	vol := volumeName(path, x)
	i := len(path) - 1
	for i >= len(vol) && !x.IsPathSeparator(path[i]) {
		i--
	}
	dir := clean(path[len(vol):i+1], x)
	if dir == "." && len(vol) > 2 {
		// must be UNC
		return vol
	}
	return vol + dir
}

// IsAbs reports whether the path is absolute. The default value for os is Unix.
// Note that because IsAbs has a default value, it cannot be used as
// a validator.
func IsAbs(path string, os OS) bool {
	return getOS(os).IsAbs(path)
}

// VolumeName returns leading volume name.
// Given "C:\foo\bar" it returns "C:" on Windows.
// Given "\\host\share\foo" it returns "\\host\share".
// On other platforms it returns "".
// The default value for os is Windows.
func VolumeName(path string, os OS) string {
	return volumeName(path, getOS(os))
}

func volumeName(path string, os os) string {
	return path[:os.volumeNameLen(path)]
}
