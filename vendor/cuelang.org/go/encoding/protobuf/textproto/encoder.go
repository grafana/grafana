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

package textproto

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/encoding/protobuf/pbinternal"

	pbast "github.com/protocolbuffers/txtpbfmt/ast"
	"github.com/protocolbuffers/txtpbfmt/parser"
)

// Encoder marshals CUE into text proto.
type Encoder struct {
	// Schema
}

// NewEncoder returns a new encoder, where the given options are default
// options.
func NewEncoder(options ...Option) *Encoder {
	return &Encoder{}
}

// Encode converts a CUE value to a text proto file.
//
// Fields do not need to have a @protobuf attribute except for in the following
// cases:
//
//   - it is explicitly required that only fields with an attribute are exported
//   - a struct represents a Protobuf map
//   - custom naming
func (e *Encoder) Encode(v cue.Value, options ...Option) ([]byte, error) {
	n := &pbast.Node{}
	enc := &encoder{}

	enc.encodeMsg(n, v)

	if enc.errs != nil {
		return nil, enc.errs
	}

	// Pretty printing does not do errors, and returns a string (why o why?).
	s := parser.Pretty(n.Children, 0)
	return []byte(s), nil
}

type encoder struct {
	errs errors.Error
}

func (e *encoder) addErr(err error) {
	e.errs = errors.Append(e.errs, errors.Promote(err, "textproto"))
}

func (e *encoder) encodeMsg(parent *pbast.Node, v cue.Value) {
	i, err := v.Fields()
	if err != nil {
		e.addErr(err)
		return
	}
	for i.Next() {
		v := i.Value()
		if !v.IsConcrete() {
			continue
		}

		info, err := pbinternal.FromIter(i)
		if err != nil {
			e.addErr(err)
		}

		switch info.CompositeType {
		case pbinternal.List:
			elems, err := v.List()
			if err != nil {
				e.addErr(err)
				return
			}
			for first := true; elems.Next(); first = false {
				n := &pbast.Node{Name: info.Name}
				if first {
					copyMeta(n, v)
				}
				elem := elems.Value()
				copyMeta(n, elem)
				parent.Children = append(parent.Children, n)
				e.encodeValue(n, elem)
			}

		case pbinternal.Map:
			i, err := v.Fields()
			if err != nil {
				e.addErr(err)
				return
			}
			for first := true; i.Next(); first = false {
				n := &pbast.Node{Name: info.Name}
				if first {
					copyMeta(n, v)
				}
				parent.Children = append(parent.Children, n)
				var key *pbast.Node
				switch info.KeyType {
				case pbinternal.String, pbinternal.Bytes:
					key = pbast.StringNode("key", i.Label())
				default:
					key = &pbast.Node{
						Name:   "key",
						Values: []*pbast.Value{{Value: i.Label()}},
					}
				}
				n.Children = append(n.Children, key)

				value := &pbast.Node{Name: "value"}
				e.encodeValue(value, i.Value())
				n.Children = append(n.Children, value)
			}

		default:
			n := &pbast.Node{Name: info.Name}
			copyMeta(n, v)
			e.encodeValue(n, v)
			// Don't add if there are no values or children.
			parent.Children = append(parent.Children, n)
		}
	}
}

// copyMeta copies metadata from nodes to values.
//
// TODO: also copy positions. The textproto API is rather messy and complex,
// though, and so far it seems to be quite buggy too. Not sure if it is worth
// the effort.
func copyMeta(x *pbast.Node, v cue.Value) {
	for _, doc := range v.Doc() {
		s := strings.TrimRight(doc.Text(), "\n")
		for _, c := range strings.Split(s, "\n") {
			x.PreComments = append(x.PreComments, "# "+c)
		}
	}
}

func (e *encoder) encodeValue(n *pbast.Node, v cue.Value) {
	var value string
	switch v.Kind() {
	case cue.StructKind:
		e.encodeMsg(n, v)

	case cue.StringKind:
		s, err := v.String()
		if err != nil {
			e.addErr(err)
		}
		sn := pbast.StringNode("foo", s)
		n.Values = append(n.Values, sn.Values...)

	case cue.BytesKind:
		b, err := v.Bytes()
		if err != nil {
			e.addErr(err)
		}
		sn := pbast.StringNode("foo", string(b))
		n.Values = append(n.Values, sn.Values...)

	case cue.BoolKind:
		value = fmt.Sprint(v)
		n.Values = append(n.Values, &pbast.Value{Value: value})

	case cue.IntKind, cue.FloatKind, cue.NumberKind:
		d, _ := v.Decimal()
		value := d.String()

		if info, _ := pbinternal.FromValue("", v); !info.IsEnum {
		} else if i, err := v.Int64(); err != nil {
		} else if s := pbinternal.MatchByInt(v, i); s != "" {
			value = s
		}

		n.Values = append(n.Values, &pbast.Value{Value: value})

	default:
		e.addErr(errors.Newf(v.Pos(), "textproto: unknown type %v", v.Kind()))
	}
}
