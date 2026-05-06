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

package analysis

import (
	index "github.com/blevesearch/bleve_index_api"
)

func TokenFrequency(tokens TokenStream, arrayPositions []uint64, options index.FieldIndexingOptions) index.TokenFrequencies {
	rv := make(map[string]*index.TokenFreq, len(tokens))

	if options.IncludeTermVectors() {
		tls := make([]index.TokenLocation, len(tokens))
		tlNext := 0

		for _, token := range tokens {
			tls[tlNext] = index.TokenLocation{
				ArrayPositions: arrayPositions,
				Start:          token.Start,
				End:            token.End,
				Position:       token.Position,
			}

			curr, ok := rv[string(token.Term)]
			if ok {
				curr.Locations = append(curr.Locations, &tls[tlNext])
			} else {
				curr = &index.TokenFreq{
					Term:      token.Term,
					Locations: []*index.TokenLocation{&tls[tlNext]},
				}
				rv[string(token.Term)] = curr
			}

			if !options.SkipFreqNorm() {
				curr.SetFrequency(curr.Frequency() + 1)
			}

			tlNext++
		}
	} else {
		for _, token := range tokens {
			curr, exists := rv[string(token.Term)]
			if !exists {
				curr = &index.TokenFreq{
					Term: token.Term,
				}
				rv[string(token.Term)] = curr
			}

			if !options.SkipFreqNorm() {
				curr.SetFrequency(curr.Frequency() + 1)
			}
		}
	}

	return rv
}
