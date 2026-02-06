// Copyright 2021 CUE Authors
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

package pbinternal

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"cuelang.org/go/cue"
)

type CompositeType int

const (
	Normal CompositeType = iota
	List
	Map
)

type ValueType int

const (
	Unknown ValueType = iota
	Message
	Int
	Float
	String
	Bytes
	Bool
)

type Info struct {
	Name    string
	CUEName string
	Attr    cue.Attribute
	Value   cue.Value

	CompositeType CompositeType
	ValueType     ValueType
	Type          string

	IsEnum bool

	// For maps only
	KeyType       ValueType // only for maps
	KeyTypeString string
}

func FromIter(i *cue.Iterator) (info Info, err error) {
	return FromValue(i.Label(), i.Value())
}

func FromValue(name string, v cue.Value) (info Info, err error) {
	a := v.Attribute("protobuf")

	info.Name = name
	info.CUEName = name

	if a.Err() == nil {
		info.Attr = a

		s, ok, err := a.Lookup(1, "name")
		if err != nil {
			return info, err
		}
		if ok {
			info.Name = strings.TrimSpace(s)
		}

		info.Type, err = a.String(1)
		if err != nil {
			return info, err
		}
	}

	switch v.IncompleteKind() {
	case cue.ListKind:
		info.CompositeType = List
		e, _ := v.Elem()
		if e.Exists() {
			v = e
		} else {
			for i, _ := v.List(); i.Next(); {
				v = i.Value()
				break
			}
		}

	case cue.StructKind:
		if strings.HasPrefix(info.Type, "map[") {
			a := strings.SplitN(info.Type[len("map["):], "]", 2)
			info.KeyTypeString = strings.TrimSpace(a[0])
			switch info.KeyTypeString {
			case "string":
				info.KeyType = String
			case "bytes":
				info.KeyType = Bytes
			case "double", "float":
				info.KeyType = Float
			case "bool":
				info.KeyType = Bool
			default:
				info.KeyType = Int // Assuming
			}
			info.CompositeType = Map
			v, _ = v.Elem()
		}
	}

	info.Value = v

	switch v.IncompleteKind() {
	case cue.StructKind:
		info.ValueType = Message

	case cue.StringKind:
		info.ValueType = String

	case cue.BytesKind:
		info.ValueType = Bytes

	case cue.BoolKind:
		info.ValueType = Bool

	case cue.IntKind:
		info.ValueType = Int
		r, _ := utf8.DecodeRuneInString(info.Type)
		info.IsEnum = unicode.In(r, unicode.Upper)

	case cue.FloatKind, cue.NumberKind:
		info.ValueType = Float
	}

	return info, nil
}
