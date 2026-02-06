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
	"fmt"
	"os"
	"strings"
)

// Slice is a sortable slice of label sets.
type Slice []Labels

func (s Slice) Len() int           { return len(s) }
func (s Slice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s Slice) Less(i, j int) bool { return Compare(s[i], s[j]) < 0 }

// Selector holds constraints for matching against a label set.
type Selector []*Matcher

// Matches returns whether the labels satisfy all matchers.
func (s Selector) Matches(labels Labels) bool {
	for _, m := range s {
		if v := labels.Get(m.Name); !m.Matches(v) {
			return false
		}
	}
	return true
}

// ReadLabels reads up to n label sets in a JSON formatted file fn. It is mostly useful
// to load testing data.
func ReadLabels(fn string, n int) ([]Labels, error) {
	f, err := os.Open(fn)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	b := NewScratchBuilder(0)

	var mets []Labels
	hashes := map[uint64]struct{}{}
	i := 0

	for scanner.Scan() && i < n {
		b.Reset()

		r := strings.NewReplacer("\"", "", "{", "", "}", "")
		s := r.Replace(scanner.Text())

		labelChunks := strings.Split(s, ",")
		for _, labelChunk := range labelChunks {
			split := strings.Split(labelChunk, ":")
			b.Add(split[0], split[1])
		}
		// Order of the k/v labels matters, don't assume we'll always receive them already sorted.
		b.Sort()
		m := b.Labels()

		h := m.Hash()
		if _, ok := hashes[h]; ok {
			continue
		}
		mets = append(mets, m)
		hashes[h] = struct{}{}
		i++
	}

	if i != n {
		return mets, fmt.Errorf("requested %d metrics but found %d", n, i)
	}
	return mets, nil
}
