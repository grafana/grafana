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

package analysis

import (
	"reflect"

	segment "github.com/blugelabs/bluge_segment_api"
)

var reflectStaticSizeTokenLocation int
var reflectStaticSizeTokenFreq int

func init() {
	var tl TokenLocation
	reflectStaticSizeTokenLocation = int(reflect.TypeOf(tl).Size())
	var tf TokenFreq
	reflectStaticSizeTokenFreq = int(reflect.TypeOf(tf).Size())
}

// TokenLocation represents one occurrence of a term at a particular location in
// a field. Start, End and Position have the same meaning as in analysis.Token.
// Field and ArrayPositions identify the field value in the source document.
// See document.Field for details.
type TokenLocation struct {
	FieldVal    string
	StartVal    int
	EndVal      int
	PositionVal int
}

func (tl *TokenLocation) Field() string {
	return tl.FieldVal
}

func (tl *TokenLocation) Pos() int {
	return tl.PositionVal
}

func (tl *TokenLocation) Start() int {
	return tl.StartVal
}

func (tl *TokenLocation) End() int {
	return tl.EndVal
}

func (tl *TokenLocation) Size() int {
	return reflectStaticSizeTokenLocation
}

// TokenFreq represents all the occurrences of a term in all fields of a
// document.
type TokenFreq struct {
	TermVal   []byte
	Locations []*TokenLocation
	frequency int
}

func (tf *TokenFreq) Size() int {
	rv := reflectStaticSizeTokenFreq
	rv += len(tf.TermVal)
	for _, loc := range tf.Locations {
		rv += loc.Size()
	}
	return rv
}

func (tf *TokenFreq) Term() []byte {
	return tf.TermVal
}

func (tf *TokenFreq) Frequency() int {
	return tf.frequency
}

func (tf *TokenFreq) EachLocation(location segment.VisitLocation) {
	for _, tl := range tf.Locations {
		location(tl)
	}
}

// TokenFrequencies maps document terms to their combined frequencies from all
// fields.
type TokenFrequencies map[string]*TokenFreq

func (tfs TokenFrequencies) Size() int {
	rv := sizeOfMap
	rv += len(tfs) * (sizeOfString + sizeOfPtr)
	for k, v := range tfs {
		rv += len(k)
		rv += v.Size()
	}
	return rv
}

func (tfs TokenFrequencies) MergeAll(remoteField string, other TokenFrequencies) {
	// walk the new token frequencies
	for tfk, tf := range other {
		tfs.mergeOne(remoteField, tfk, tf)
	}
}

func (tfs TokenFrequencies) mergeOne(remoteField, tfk string, tf *TokenFreq) {
	// set the remoteField value in incoming token freqs
	for _, l := range tf.Locations {
		l.FieldVal = remoteField
	}
	existingTf, exists := tfs[tfk]
	if exists {
		existingTf.Locations = append(existingTf.Locations, tf.Locations...)
		existingTf.frequency += tf.frequency
	} else {
		tfs[tfk] = &TokenFreq{
			TermVal:   tf.TermVal,
			frequency: tf.frequency,
			Locations: make([]*TokenLocation, len(tf.Locations)),
		}
		copy(tfs[tfk].Locations, tf.Locations)
	}
}

func (tfs TokenFrequencies) MergeOneBytes(remoteField string, tfk []byte, tf *TokenFreq) {
	// set the remoteField value in incoming token freqs
	for _, l := range tf.Locations {
		l.FieldVal = remoteField
	}
	existingTf, exists := tfs[string(tfk)]
	if exists {
		existingTf.Locations = append(existingTf.Locations, tf.Locations...)
		existingTf.frequency += tf.frequency
	} else {
		tfs[string(tfk)] = &TokenFreq{
			TermVal:   tf.TermVal,
			frequency: tf.frequency,
			Locations: make([]*TokenLocation, len(tf.Locations)),
		}
		copy(tfs[string(tfk)].Locations, tf.Locations)
	}
}

func TokenFrequency(tokens TokenStream, includeTermVectors bool, startOffset int) (
	tokenFreqs TokenFrequencies, position int) {
	tokenFreqs = make(map[string]*TokenFreq, len(tokens))

	if includeTermVectors {
		tls := make([]TokenLocation, len(tokens))
		tlNext := 0

		position = startOffset
		for _, token := range tokens {
			position += token.PositionIncr
			tls[tlNext] = TokenLocation{
				StartVal:    token.Start,
				EndVal:      token.End,
				PositionVal: position,
			}

			curr, ok := tokenFreqs[string(token.Term)]
			if ok {
				curr.Locations = append(curr.Locations, &tls[tlNext])
				curr.frequency++
			} else {
				tokenFreqs[string(token.Term)] = &TokenFreq{
					TermVal:   token.Term,
					Locations: []*TokenLocation{&tls[tlNext]},
					frequency: 1,
				}
			}

			tlNext++
		}
	} else {
		for _, token := range tokens {
			curr, exists := tokenFreqs[string(token.Term)]
			if exists {
				curr.frequency++
			} else {
				tokenFreqs[string(token.Term)] = &TokenFreq{
					TermVal:   token.Term,
					frequency: 1,
				}
			}
		}
	}

	return tokenFreqs, position
}
