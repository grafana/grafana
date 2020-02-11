// Copyright (c) 2017 Uber Technologies, Inc.
//
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

package rpcmetrics

// NameNormalizer is used to convert the endpoint names to strings
// that can be safely used as tags in the metrics.
type NameNormalizer interface {
	Normalize(name string) string
}

// DefaultNameNormalizer converts endpoint names so that they contain only characters
// from the safe charset [a-zA-Z0-9-./_]. All other characters are replaced with '-'.
var DefaultNameNormalizer = &SimpleNameNormalizer{
	SafeSets: []SafeCharacterSet{
		&Range{From: 'a', To: 'z'},
		&Range{From: 'A', To: 'Z'},
		&Range{From: '0', To: '9'},
		&Char{'-'},
		&Char{'_'},
		&Char{'/'},
		&Char{'.'},
	},
	Replacement: '-',
}

// SimpleNameNormalizer uses a set of safe character sets.
type SimpleNameNormalizer struct {
	SafeSets    []SafeCharacterSet
	Replacement byte
}

// SafeCharacterSet determines if the given character is "safe"
type SafeCharacterSet interface {
	IsSafe(c byte) bool
}

// Range implements SafeCharacterSet
type Range struct {
	From, To byte
}

// IsSafe implements SafeCharacterSet
func (r *Range) IsSafe(c byte) bool {
	return c >= r.From && c <= r.To
}

// Char implements SafeCharacterSet
type Char struct {
	Val byte
}

// IsSafe implements SafeCharacterSet
func (ch *Char) IsSafe(c byte) bool {
	return c == ch.Val
}

// Normalize checks each character in the string against SafeSets,
// and if it's not safe substitutes it with Replacement.
func (n *SimpleNameNormalizer) Normalize(name string) string {
	var retMe []byte
	nameBytes := []byte(name)
	for i, b := range nameBytes {
		if n.safeByte(b) {
			if retMe != nil {
				retMe[i] = b
			}
		} else {
			if retMe == nil {
				retMe = make([]byte, len(nameBytes))
				copy(retMe[0:i], nameBytes[0:i])
			}
			retMe[i] = n.Replacement
		}
	}
	if retMe == nil {
		return name
	}
	return string(retMe)
}

// safeByte checks if b against all safe charsets.
func (n *SimpleNameNormalizer) safeByte(b byte) bool {
	for i := range n.SafeSets {
		if n.SafeSets[i].IsSafe(b) {
			return true
		}
	}
	return false
}
