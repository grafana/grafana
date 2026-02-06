// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package internal

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"

	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
)

// AttrKind indicates the location of an attribute within CUE source.
type AttrKind uint8

const (
	// FieldAttr indicates an attribute is a field attribute.
	// foo: bar @attr()
	FieldAttr AttrKind = 1 << iota

	// DeclAttr indicates an attribute was specified at a declaration position.
	// foo: {
	//     @attr()
	// }
	DeclAttr

	// TODO: Possible future attr kinds
	// ElemAttr
	// FileAttr
	// ValueAttr = FieldAttr|DeclAttr|ElemAttr
)

// Attr holds positional information for a single Attr.
type Attr struct {
	Name   string // e.g. "json" or "protobuf"
	Body   string
	Kind   AttrKind
	Fields []KeyValue
	Err    errors.Error
}

// NewNonExisting creates a non-existing attribute.
func NewNonExisting(key string) Attr {
	const msgNotExist = "attribute %q does not exist"
	return Attr{Err: errors.Newf(token.NoPos, msgNotExist, key)}
}

type KeyValue struct {
	data  string
	equal int // index of equal sign or 0 if non-existing
}

func (kv *KeyValue) Text() string { return kv.data }
func (kv *KeyValue) Key() string {
	if kv.equal == 0 {
		return kv.data
	}
	s := kv.data[:kv.equal]
	s = strings.TrimSpace(s)
	return s
}
func (kv *KeyValue) Value() string {
	if kv.equal == 0 {
		return ""
	}
	return strings.TrimSpace(kv.data[kv.equal+1:])
}

func (a *Attr) hasPos(p int) error {
	if a.Err != nil {
		return a.Err
	}
	if p >= len(a.Fields) {
		return fmt.Errorf("field does not exist")
	}
	return nil
}

// String reports the possibly empty string value at the given position or
// an error the attribute is invalid or if the position does not exist.
func (a *Attr) String(pos int) (string, error) {
	if err := a.hasPos(pos); err != nil {
		return "", err
	}
	return a.Fields[pos].Text(), nil
}

// Int reports the integer at the given position or an error if the attribute is
// invalid, the position does not exist, or the value at the given position is
// not an integer.
func (a *Attr) Int(pos int) (int64, error) {
	if err := a.hasPos(pos); err != nil {
		return 0, err
	}
	// TODO: use CUE's literal parser once it exists, allowing any of CUE's
	// number types.
	return strconv.ParseInt(a.Fields[pos].Text(), 10, 64)
}

// Flag reports whether an entry with the given name exists at position pos or
// onwards or an error if the attribute is invalid or if the first pos-1 entries
// are not defined.
func (a *Attr) Flag(pos int, key string) (bool, error) {
	if err := a.hasPos(pos - 1); err != nil {
		return false, err
	}
	for _, kv := range a.Fields[pos:] {
		if kv.Text() == key {
			return true, nil
		}
	}
	return false, nil
}

// Lookup searches for an entry of the form key=value from position pos onwards
// and reports the value if found. It reports an error if the attribute is
// invalid or if the first pos-1 entries are not defined.
func (a *Attr) Lookup(pos int, key string) (val string, found bool, err error) {
	if err := a.hasPos(pos - 1); err != nil {
		return "", false, err
	}
	for _, kv := range a.Fields[pos:] {
		if kv.Key() == key {
			return kv.Value(), true, nil
		}
	}
	return "", false, nil
}

func ParseAttrBody(pos token.Pos, s string) (a Attr) {
	a.Body = s
	i := 0
	for {
		i += skipSpace(s[i:])
		// always scan at least one, possibly empty element.
		n, err := scanAttributeElem(pos, s[i:], &a)
		if err != nil {
			return Attr{Err: err}
		}
		if i += n; i >= len(s) {
			break
		}
		i += skipSpace(s[i:])
		if s[i] != ',' {
			return Attr{Err: errors.Newf(pos, "invalid attribute: expected comma")}
		}
		i++
	}
	return a
}

func skipSpace(s string) int {
	for n, r := range s {
		if !unicode.IsSpace(r) {
			return n
		}
	}
	return 0
}

func scanAttributeElem(pos token.Pos, s string, a *Attr) (n int, err errors.Error) {
	// try CUE string
	kv := KeyValue{}
	if n, kv.data, err = scanAttributeString(pos, s); n == 0 {
		// try key-value pair
		p := strings.IndexAny(s, ",=") // ) is assumed to be stripped.
		switch {
		case p < 0:
			kv.data = strings.TrimSpace(s)
			n = len(s)

		default: // ','
			n = p
			kv.data = strings.TrimSpace(s[:n])

		case s[p] == '=':
			kv.equal = p
			offset := p + 1
			offset += skipSpace(s[offset:])
			var str string
			if p, str, err = scanAttributeString(pos, s[offset:]); p > 0 {
				n = offset + p
				kv.data = s[:offset] + str
			} else {
				n = len(s)
				if p = strings.IndexByte(s[offset:], ','); p >= 0 {
					n = offset + p
				}
				kv.data = strings.TrimSpace(s[:n])
			}
		}
	}
	if a != nil {
		a.Fields = append(a.Fields, kv)
	}
	return n, err
}

func scanAttributeString(pos token.Pos, s string) (n int, str string, err errors.Error) {
	if s == "" || (s[0] != '#' && s[0] != '"' && s[0] != '\'') {
		return 0, "", nil
	}

	nHash := 0
	for {
		if nHash < len(s) {
			if s[nHash] == '#' {
				nHash++
				continue
			}
			if s[nHash] == '\'' || s[nHash] == '"' {
				break
			}
		}
		return nHash, s[:nHash], errors.Newf(pos, "invalid attribute string")
	}

	// Determine closing quote.
	nQuote := 1
	if c := s[nHash]; nHash+6 < len(s) && s[nHash+1] == c && s[nHash+2] == c {
		nQuote = 3
	}
	close := s[nHash:nHash+nQuote] + s[:nHash]

	// Search for closing quote.
	index := strings.Index(s[len(close):], close)
	if index == -1 {
		return len(s), "", errors.Newf(pos, "attribute string not terminated")
	}

	index += 2 * len(close)
	s, err2 := literal.Unquote(s[:index])
	if err2 != nil {
		return index, "", errors.Newf(pos, "invalid attribute string: %v", err2)
	}
	return index, s, nil
}
