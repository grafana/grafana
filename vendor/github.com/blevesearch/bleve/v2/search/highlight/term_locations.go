//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package highlight

import (
	"reflect"
	"sort"

	"github.com/blevesearch/bleve/v2/search"
)

type TermLocation struct {
	Term           string
	ArrayPositions search.ArrayPositions
	Pos            int
	Start          int
	End            int
}

func (tl *TermLocation) Overlaps(other *TermLocation) bool {
	if reflect.DeepEqual(tl.ArrayPositions, other.ArrayPositions) {
		if other.Start >= tl.Start && other.Start < tl.End {
			return true
		} else if tl.Start >= other.Start && tl.Start < other.End {
			return true
		}
	}
	return false
}

type TermLocations []*TermLocation

func (t TermLocations) Len() int      { return len(t) }
func (t TermLocations) Swap(i, j int) { t[i], t[j] = t[j], t[i] }
func (t TermLocations) Less(i, j int) bool {

	shortestArrayPositions := len(t[i].ArrayPositions)
	if len(t[j].ArrayPositions) < shortestArrayPositions {
		shortestArrayPositions = len(t[j].ArrayPositions)
	}

	// compare all the common array positions
	for api := 0; api < shortestArrayPositions; api++ {
		if t[i].ArrayPositions[api] < t[j].ArrayPositions[api] {
			return true
		}
		if t[i].ArrayPositions[api] > t[j].ArrayPositions[api] {
			return false
		}
	}
	// all the common array positions are the same
	if len(t[i].ArrayPositions) < len(t[j].ArrayPositions) {
		return true // j array positions, longer so greater
	} else if len(t[i].ArrayPositions) > len(t[j].ArrayPositions) {
		return false // j array positions, shorter so less
	}

	// array positions the same, compare starts
	return t[i].Start < t[j].Start
}

func (t TermLocations) MergeOverlapping() {
	var lastTl *TermLocation
	for i, tl := range t {
		if lastTl == nil && tl != nil {
			lastTl = tl
		} else if lastTl != nil && tl != nil {
			if lastTl.Overlaps(tl) {
				// ok merge this with previous
				lastTl.End = tl.End
				t[i] = nil
			}
		}
	}
}

func OrderTermLocations(tlm search.TermLocationMap) TermLocations {
	rv := make(TermLocations, 0)
	for term, locations := range tlm {
		for _, location := range locations {
			tl := TermLocation{
				Term:           term,
				ArrayPositions: location.ArrayPositions,
				Pos:            int(location.Pos),
				Start:          int(location.Start),
				End:            int(location.End),
			}
			rv = append(rv, &tl)
		}
	}
	sort.Sort(rv)
	return rv
}
