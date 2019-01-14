// Copyright 2017 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package labels

import (
	"bufio"
	"bytes"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/cespare/xxhash"
	"github.com/pkg/errors"
)

const sep = '\xff'

// Label is a key/value pair of strings.
type Label struct {
	Name, Value string
}

// Labels is a sorted set of labels. Order has to be guaranteed upon
// instantiation.
type Labels []Label

func (ls Labels) Len() int           { return len(ls) }
func (ls Labels) Swap(i, j int)      { ls[i], ls[j] = ls[j], ls[i] }
func (ls Labels) Less(i, j int) bool { return ls[i].Name < ls[j].Name }

func (ls Labels) String() string {
	var b bytes.Buffer

	b.WriteByte('{')
	for i, l := range ls {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(l.Name)
		b.WriteByte('=')
		b.WriteString(strconv.Quote(l.Value))
	}
	b.WriteByte('}')

	return b.String()
}

// Hash returns a hash value for the label set.
func (ls Labels) Hash() uint64 {
	b := make([]byte, 0, 1024)

	for _, v := range ls {
		b = append(b, v.Name...)
		b = append(b, sep)
		b = append(b, v.Value...)
		b = append(b, sep)
	}
	return xxhash.Sum64(b)
}

// Get returns the value for the label with the given name.
// Returns an empty string if the label doesn't exist.
func (ls Labels) Get(name string) string {
	for _, l := range ls {
		if l.Name == name {
			return l.Value
		}
	}
	return ""
}

// Equals returns whether the two label sets are equal.
func (ls Labels) Equals(o Labels) bool {
	if len(ls) != len(o) {
		return false
	}
	for i, l := range ls {
		if o[i] != l {
			return false
		}
	}
	return true
}

// Map returns a string map of the labels.
func (ls Labels) Map() map[string]string {
	m := make(map[string]string, len(ls))
	for _, l := range ls {
		m[l.Name] = l.Value
	}
	return m
}

// New returns a sorted Labels from the given labels.
// The caller has to guarantee that all label names are unique.
func New(ls ...Label) Labels {
	set := make(Labels, 0, len(ls))
	for _, l := range ls {
		set = append(set, l)
	}
	sort.Sort(set)

	return set
}

// FromMap returns new sorted Labels from the given map.
func FromMap(m map[string]string) Labels {
	l := make(Labels, 0, len(m))
	for k, v := range m {
		l = append(l, Label{Name: k, Value: v})
	}
	sort.Sort(l)

	return l
}

// FromStrings creates new labels from pairs of strings.
func FromStrings(ss ...string) Labels {
	if len(ss)%2 != 0 {
		panic("invalid number of strings")
	}
	var res Labels
	for i := 0; i < len(ss); i += 2 {
		res = append(res, Label{Name: ss[i], Value: ss[i+1]})
	}

	sort.Sort(res)
	return res
}

// Compare compares the two label sets.
// The result will be 0 if a==b, <0 if a < b, and >0 if a > b.
func Compare(a, b Labels) int {
	l := len(a)
	if len(b) < l {
		l = len(b)
	}

	for i := 0; i < l; i++ {
		if d := strings.Compare(a[i].Name, b[i].Name); d != 0 {
			return d
		}
		if d := strings.Compare(a[i].Value, b[i].Value); d != 0 {
			return d
		}
	}
	// If all labels so far were in common, the set with fewer labels comes first.
	return len(a) - len(b)
}

// Slice is a sortable slice of label sets.
type Slice []Labels

func (s Slice) Len() int           { return len(s) }
func (s Slice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s Slice) Less(i, j int) bool { return Compare(s[i], s[j]) < 0 }

// ReadLabels reads up to n label sets in a JSON formatted file fn. It is mostly useful
// to load testing data.
func ReadLabels(fn string, n int) ([]Labels, error) {
	f, err := os.Open(fn)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)

	var mets []Labels
	hashes := map[uint64]struct{}{}
	i := 0

	for scanner.Scan() && i < n {
		m := make(Labels, 0, 10)

		r := strings.NewReplacer("\"", "", "{", "", "}", "")
		s := r.Replace(scanner.Text())

		labelChunks := strings.Split(s, ",")
		for _, labelChunk := range labelChunks {
			split := strings.Split(labelChunk, ":")
			m = append(m, Label{Name: split[0], Value: split[1]})
		}
		// Order of the k/v labels matters, don't assume we'll always receive them already sorted.
		sort.Sort(m)

		h := m.Hash()
		if _, ok := hashes[h]; ok {
			continue
		}
		mets = append(mets, m)
		hashes[h] = struct{}{}
		i++
	}
	if err != nil {
		return nil, err
	}
	if i != n {
		return mets, errors.Errorf("requested %d metrics but found %d", n, i)
	}
	return mets, nil
}
