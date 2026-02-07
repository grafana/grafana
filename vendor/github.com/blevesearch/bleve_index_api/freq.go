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

package index

import "reflect"

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
	Field          string
	ArrayPositions []uint64
	Start          int
	End            int
	Position       int
}

func (tl *TokenLocation) Size() int {
	rv := reflectStaticSizeTokenLocation
	rv += len(tl.ArrayPositions) * sizeOfUint64
	return rv
}

// TokenFreq represents all the occurrences of a term in all fields of a
// document.
type TokenFreq struct {
	Term      []byte
	Locations []*TokenLocation
	frequency int
}

func (tf *TokenFreq) Size() int {
	rv := reflectStaticSizeTokenFreq
	rv += len(tf.Term)
	for _, loc := range tf.Locations {
		rv += loc.Size()
	}
	return rv
}

func (tf *TokenFreq) Frequency() int {
	return tf.frequency
}

func (tf *TokenFreq) SetFrequency(frequency int) {
	tf.frequency = frequency
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
		// set the remoteField value in incoming token freqs
		for _, l := range tf.Locations {
			l.Field = remoteField
		}
		existingTf, exists := tfs[tfk]
		if exists {
			existingTf.Locations = append(existingTf.Locations, tf.Locations...)
			existingTf.frequency += tf.frequency
		} else {
			tfs[tfk] = &TokenFreq{
				Term:      tf.Term,
				frequency: tf.frequency,
				Locations: make([]*TokenLocation, len(tf.Locations)),
			}
			copy(tfs[tfk].Locations, tf.Locations)
		}
	}
}
