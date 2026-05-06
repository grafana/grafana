//  Copyright (c) 2020 Couchbase, Inc.
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

package search

func MergeLocations(locations []FieldTermLocationMap) FieldTermLocationMap {
	rv := locations[0]

	for i := 1; i < len(locations); i++ {
		nextLocations := locations[i]
		for field, termLocationMap := range nextLocations {
			rvTermLocationMap, rvHasField := rv[field]
			if rvHasField {
				rv[field] = MergeTermLocationMaps(rvTermLocationMap, termLocationMap)
			} else {
				rv[field] = termLocationMap
			}
		}
	}

	return rv
}

func MergeTermLocationMaps(rv, other TermLocationMap) TermLocationMap {
	for term, locationMap := range other {
		// for a given term/document there cannot be different locations
		// if they came back from different clauses, overwrite is ok
		rv[term] = locationMap
	}
	return rv
}

func MergeFieldTermLocations(dest []FieldTermLocation, matches []*DocumentMatch) []FieldTermLocation {
	n := len(dest)
	for _, dm := range matches {
		n += len(dm.FieldTermLocations)
	}
	if cap(dest) < n {
		dest = append(make([]FieldTermLocation, 0, n), dest...)
	}

	for _, dm := range matches {
		for _, ftl := range dm.FieldTermLocations {
			dest = append(dest, FieldTermLocation{
				Field: ftl.Field,
				Term:  ftl.Term,
				Location: Location{
					Pos:   ftl.Location.Pos,
					Start: ftl.Location.Start,
					End:   ftl.Location.End,
				},
			})
		}
	}

	return dest
}
