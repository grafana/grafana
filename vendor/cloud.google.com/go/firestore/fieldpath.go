// Copyright 2017 Google Inc. All Rights Reserved.
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

package firestore

import (
	"bytes"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// A FieldPath is a non-empty sequence of non-empty fields that reference a value.
//
// A FieldPath value should only be necessary if one of the field names contains
// one of the runes ".˜*/[]". Most methods accept a simpler form of field path
// as a string in which the individual fields are separated by dots.
// For example,
//   []string{"a", "b"}
// is equivalent to the string form
//   "a.b"
// but
//   []string{"*"}
// has no equivalent string form.
type FieldPath []string

// parseDotSeparatedString constructs a FieldPath from a string that separates
// path components with dots. Other than splitting at dots and checking for invalid
// characters, it ignores everything else about the string,
// including attempts to quote field path compontents. So "a.`b.c`.d" is parsed into
// four parts, "a", "`b", "c`" and "d".
func parseDotSeparatedString(s string) (FieldPath, error) {
	const invalidRunes = "~*/[]"
	if strings.ContainsAny(s, invalidRunes) {
		return nil, fmt.Errorf("firestore: %q contains an invalid rune (one of %s)", s, invalidRunes)
	}
	fp := FieldPath(strings.Split(s, "."))
	if err := fp.validate(); err != nil {
		return nil, err
	}
	return fp, nil
}

func (fp1 FieldPath) equal(fp2 FieldPath) bool {
	if len(fp1) != len(fp2) {
		return false
	}
	for i, c1 := range fp1 {
		if c1 != fp2[i] {
			return false
		}
	}
	return true
}

func (fp1 FieldPath) prefixOf(fp2 FieldPath) bool {
	return len(fp1) <= len(fp2) && fp1.equal(fp2[:len(fp1)])
}

// Lexicographic ordering.
func (fp1 FieldPath) less(fp2 FieldPath) bool {
	for i := range fp1 {
		switch {
		case i >= len(fp2):
			return false
		case fp1[i] < fp2[i]:
			return true
		case fp1[i] > fp2[i]:
			return false
		}
	}
	// fp1 and fp2 are equal up to len(fp1).
	return len(fp1) < len(fp2)
}

// validate checks the validity of fp and returns an error if it is invalid.
func (fp FieldPath) validate() error {
	if len(fp) == 0 {
		return errors.New("firestore: empty field path")
	}
	for _, c := range fp {
		if len(c) == 0 {
			return errors.New("firestore: empty component in field path")
		}
	}
	return nil
}

// with creates a new FieldPath consisting of fp followed by k.
func (fp FieldPath) with(k string) FieldPath {
	r := make(FieldPath, len(fp), len(fp)+1)
	copy(r, fp)
	return append(r, k)
}

// in reports whether fp is equal to one of the fps.
func (fp FieldPath) in(fps []FieldPath) bool {
	for _, e := range fps {
		if fp.equal(e) {
			return true
		}
	}
	return false
}

// checkNoDupOrPrefix checks whether any FieldPath is a prefix of (or equal to)
// another.
// It modifies the order of FieldPaths in its argument (via sorting).
func checkNoDupOrPrefix(fps []FieldPath) error {
	// Sort fps lexicographically.
	sort.Sort(byPath(fps))
	// Check adjacent pairs for prefix.
	for i := 1; i < len(fps); i++ {
		if fps[i-1].prefixOf(fps[i]) {
			return fmt.Errorf("field path %v cannot be used in the same update as %v", fps[i-1], fps[i])
		}
	}
	return nil
}

type byPath []FieldPath

func (b byPath) Len() int           { return len(b) }
func (b byPath) Swap(i, j int)      { b[i], b[j] = b[j], b[i] }
func (b byPath) Less(i, j int) bool { return b[i].less(b[j]) }

// createMapFromUpdates uses a list of updates to construct a valid
// Firestore data value in the form of a map. It assumes the FieldPaths in the updates
// already been validated and checked for prefixes. If any field path is associated
// with the Delete value, it is not stored in the map.
func createMapFromUpdates(fpvs []fpv) map[string]interface{} {
	m := map[string]interface{}{}
	for _, v := range fpvs {
		if v.value != Delete {
			setAtPath(m, v.fieldPath, v.value)
		}
	}
	return m
}

// setAtPath sets val at the location in m specified by fp, creating sub-maps as
// needed. m must not be nil. fp is assumed to be valid.
func setAtPath(m map[string]interface{}, fp FieldPath, val interface{}) {
	if len(fp) == 1 {
		m[fp[0]] = val
	} else {
		v, ok := m[fp[0]]
		if !ok {
			v = map[string]interface{}{}
			m[fp[0]] = v
		}
		// The type assertion below cannot fail, because setAtPath is only called
		// with either an empty map or one filled by setAtPath itself, and the
		// set of FieldPaths it is called with has been checked to make sure that
		// no path is the prefix of any other.
		setAtPath(v.(map[string]interface{}), fp[1:], val)
	}
}

// toServiceFieldPath converts fp the form required by the Firestore service.
// It assumes fp has been validated.
func (fp FieldPath) toServiceFieldPath() string {
	cs := make([]string, len(fp))
	for i, c := range fp {
		cs[i] = toServiceFieldPathComponent(c)
	}
	return strings.Join(cs, ".")
}

func toServiceFieldPaths(fps []FieldPath) []string {
	var sfps []string
	for _, fp := range fps {
		sfps = append(sfps, fp.toServiceFieldPath())
	}
	return sfps
}

// Google SQL syntax for an unquoted field.
var unquotedFieldRegexp = regexp.MustCompile("^[A-Za-z_][A-Za-z_0-9]*$")

// toServiceFieldPathComponent returns a string that represents key and is a valid
// field path component.
func toServiceFieldPathComponent(key string) string {
	if unquotedFieldRegexp.MatchString(key) {
		return key
	}
	var buf bytes.Buffer
	buf.WriteRune('`')
	for _, r := range key {
		if r == '`' || r == '\\' {
			buf.WriteRune('\\')
		}
		buf.WriteRune(r)
	}
	buf.WriteRune('`')
	return buf.String()
}
