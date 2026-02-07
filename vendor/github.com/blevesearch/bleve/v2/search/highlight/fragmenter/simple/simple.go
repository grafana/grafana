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

package simple

import (
	"unicode/utf8"

	"github.com/blevesearch/bleve/v2/registry"
	"github.com/blevesearch/bleve/v2/search/highlight"
)

const Name = "simple"

const defaultFragmentSize = 200

type Fragmenter struct {
	fragmentSize int
}

func NewFragmenter(fragmentSize int) *Fragmenter {
	return &Fragmenter{
		fragmentSize: fragmentSize,
	}
}

func (s *Fragmenter) Fragment(orig []byte, ot highlight.TermLocations) []*highlight.Fragment {
	var rv []*highlight.Fragment
	maxbegin := 0
OUTER:
	for currTermIndex, termLocation := range ot {
		// start with this
		// it should be the highest scoring fragment with this term first
		start := termLocation.Start
		end := start
		used := 0
		for end < len(orig) && used < s.fragmentSize {
			r, size := utf8.DecodeRune(orig[end:])
			if r == utf8.RuneError {
				continue OUTER // bail
			}
			end += size
			used++
		}

		// if we still have more characters available to us
		// push back towards beginning
		// without cross maxbegin
		for start > 0 && used < s.fragmentSize {
			if start > len(orig) {
				// bail if out of bounds, possibly due to token replacement
				// e.g with a regexp replacement
				continue OUTER
			}
			r, size := utf8.DecodeLastRune(orig[0:start])
			if r == utf8.RuneError {
				continue OUTER // bail
			}
			if start-size >= maxbegin {
				start -= size
				used++
			} else {
				break
			}
		}

		// however, we'd rather have the tokens centered more in the frag
		// lets try to do that as best we can, without affecting the score
		// find the end of the last term in this fragment
		minend := end
		for _, innerTermLocation := range ot[currTermIndex:] {
			if innerTermLocation.End > end {
				break
			}
			minend = innerTermLocation.End
		}

		// find the smaller of the two rooms to move
		roomToMove := utf8.RuneCount(orig[minend:end])
		roomToMoveStart := 0
		if start >= maxbegin {
			roomToMoveStart = utf8.RuneCount(orig[maxbegin:start])
		}
		if roomToMoveStart < roomToMove {
			roomToMove = roomToMoveStart
		}

		offset := roomToMove / 2

		for offset > 0 {
			r, size := utf8.DecodeLastRune(orig[0:start])
			if r == utf8.RuneError {
				continue OUTER // bail
			}
			start -= size

			r, size = utf8.DecodeLastRune(orig[0:end])
			if r == utf8.RuneError {
				continue OUTER // bail
			}
			end -= size
			offset--
		}

		rv = append(rv, &highlight.Fragment{Orig: orig, Start: start - offset, End: end - offset})
		// set maxbegin to the end of the current term location
		// so that next one won't back up to include it
		maxbegin = termLocation.End

	}
	if len(ot) == 0 {
		// if there were no terms to highlight
		// produce a single fragment from the beginning
		start := 0
		end := start
		used := 0
		for end < len(orig) && used < s.fragmentSize {
			r, size := utf8.DecodeRune(orig[end:])
			if r == utf8.RuneError {
				break
			}
			end += size
			used++
		}
		rv = append(rv, &highlight.Fragment{Orig: orig, Start: start, End: end})
	}

	return rv
}

func Constructor(config map[string]interface{}, cache *registry.Cache) (highlight.Fragmenter, error) {
	size := defaultFragmentSize
	sizeVal, ok := config["size"].(float64)
	if ok {
		size = int(sizeVal)
	}
	return NewFragmenter(size), nil
}

func init() {
	err := registry.RegisterFragmenter(Name, Constructor)
	if err != nil {
		panic(err)
	}
}
