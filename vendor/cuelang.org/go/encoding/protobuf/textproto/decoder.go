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
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/encoding/protobuf/pbinternal"
	"cuelang.org/go/internal/core/adt"
	"cuelang.org/go/internal/value"

	pbast "github.com/protocolbuffers/txtpbfmt/ast"
	"github.com/protocolbuffers/txtpbfmt/parser"
	"github.com/protocolbuffers/txtpbfmt/unquote"
)

// Option defines options for the decoder.
// There are currently no options.
type Option func(*options)

type options struct {
}

// NewDecoder returns a new Decoder
func NewDecoder(option ...Option) *Decoder {
	d := &Decoder{}
	_ = d.m // work around linter bug.
	return d
}

// A Decoder caches conversions of cue.Value between calls to its methods.
type Decoder struct {
	m map[*adt.Vertex]*mapping
}

type decoder struct {
	*Decoder

	// Reset on each call
	errs errors.Error
	file *token.File
}

// Parse parses the given textproto bytes and converts them to a CUE expression,
// using schema as the guideline for conversion using the following rules:
//
//   - the @protobuf attribute is optional, but is necessary for:
//   - interpreting protobuf maps
//   - using a name different from the CUE name
//   - fields in the textproto that have no corresponding field in
//     schema are ignored
//
// NOTE: the filename is used for associating position information. However,
// currently no position information is associated with the text proto because
// the position information of github.com/protocolbuffers/txtpbfmt is too
// unreliable to be useful.
func (d *Decoder) Parse(schema cue.Value, filename string, b []byte) (ast.Expr, error) {
	dec := decoder{Decoder: d}

	// dec.errs = nil

	f := token.NewFile(filename, 0, len(b))
	f.SetLinesForContent(b)
	dec.file = f

	cfg := parser.Config{}
	nodes, err := parser.ParseWithConfig(b, cfg)
	if err != nil {
		return nil, errors.Newf(token.NoPos, "textproto: %v", err)
	}

	m := dec.parseSchema(schema)
	if dec.errs != nil {
		return nil, dec.errs
	}

	n := dec.decodeMsg(m, nodes)
	if dec.errs != nil {
		return nil, dec.errs
	}

	return n, nil
}

// Don't expose until the protobuf APIs settle down.
// func (d *decoder) Decode(schema cue.Value, textpbfmt) (cue.Value, error) {
// }

type mapping struct {
	children map[string]*fieldInfo
}

type fieldInfo struct {
	pbinternal.Info
	msg *mapping
	// keytype, for now
}

func (d *decoder) addErr(err error) {
	d.errs = errors.Append(d.errs, errors.Promote(err, "textproto"))
}

func (d *decoder) addErrf(pos pbast.Position, format string, args ...interface{}) {
	err := errors.Newf(d.protoPos(pos), "textproto: "+format, args...)
	d.errs = errors.Append(d.errs, err)
}

func (d *decoder) protoPos(p pbast.Position) token.Pos {
	return d.file.Pos(int(p.Byte), token.NoRelPos)
}

// parseSchema walks over a CUE "type", converts it to an internal data
// structure that is used for parsing text proto, and writes it to
func (d *decoder) parseSchema(schema cue.Value) *mapping {
	_, v := value.ToInternal(schema)
	if v == nil {
		return nil
	}

	if d.m == nil {
		d.m = map[*adt.Vertex]*mapping{}
	} else if m := d.m[v]; m != nil {
		return m
	}

	m := &mapping{children: map[string]*fieldInfo{}}

	i, err := schema.Fields()
	if err != nil {
		d.addErr(err)
		return nil
	}

	for i.Next() {
		info, err := pbinternal.FromIter(i)
		if err != nil {
			d.addErr(err)
			continue
		}

		var msg *mapping

		switch info.CompositeType {
		case pbinternal.Normal:
			switch info.ValueType {
			case pbinternal.Message:
				msg = d.parseSchema(i.Value())
			}

		case pbinternal.List, pbinternal.Map:
			e, _ := i.Value().Elem()
			if e.IncompleteKind() == cue.StructKind {
				msg = d.parseSchema(e)
			}
		}

		m.children[info.Name] = &fieldInfo{
			Info: info,
			msg:  msg,
		}
	}

	d.m[v] = m
	return m
}

func (d *decoder) decodeMsg(m *mapping, n []*pbast.Node) ast.Expr {
	st := &ast.StructLit{}

	var listMap map[string]*ast.ListLit

	for _, x := range n {
		if x.Values == nil && x.Children == nil {
			if cg := addComments(x.PreComments...); cg != nil {
				ast.SetRelPos(cg, token.NewSection)
				st.Elts = append(st.Elts, cg)
				continue
			}
		}
		if m == nil {
			continue
		}
		f, ok := m.children[x.Name]
		if !ok {
			continue // ignore unknown fields
		}

		var value ast.Expr

		switch f.CompositeType {
		default:
			value = d.decodeValue(f, x)

		case pbinternal.List:
			if listMap == nil {
				listMap = make(map[string]*ast.ListLit)
			}

			list := listMap[f.CUEName]
			if list == nil {
				list = &ast.ListLit{}
				listMap[f.CUEName] = list
				value = list
			}

			if len(x.Values) == 1 || f.ValueType == pbinternal.Message {
				v := d.decodeValue(f, x)
				if value == nil {
					if cg := addComments(x.PreComments...); cg != nil {
						cg.Doc = true
						ast.AddComment(v, cg)
					}
				}
				if cg := addComments(x.PostValuesComments...); cg != nil {
					cg.Position = 4
					ast.AddComment(v, cg)
				}
				list.Elts = append(list.Elts, v)
				break
			}

			var last ast.Expr
			// Handle [1, 2, 3]
			for _, v := range x.Values {
				if v.Value == "" {
					if cg := addComments(v.PreComments...); cg != nil {
						if last != nil {
							cg.Position = 4
							ast.AddComment(last, cg)
						} else {
							cg.Position = 1
							ast.AddComment(list, cg)
						}
					}
					continue
				}
				y := *x
				y.Values = []*pbast.Value{v}
				last = d.decodeValue(f, &y)
				list.Elts = append(list.Elts, last)
			}
			if cg := addComments(x.PostValuesComments...); cg != nil {
				if last != nil {
					cg.Position = 4
					ast.AddComment(last, cg)
				} else {
					cg.Position = 1
					ast.AddComment(list, cg)
				}
			}
			if cg := addComments(x.ClosingBraceComment); cg != nil {
				cg.Position = 4
				ast.AddComment(list, cg)
			}

		case pbinternal.Map:
			// mapValue: {
			//     key: 123
			//     value: "string"
			// }
			if k := len(x.Values); k > 0 {
				d.addErrf(x.Start, "values not allowed for Message type; found %d", k)
			}

			var (
				key ast.Label
				val ast.Expr
			)

			for _, c := range x.Children {
				if len(c.Values) != 1 {
					d.addErrf(x.Start, "expected 1 value, found %d", len(c.Values))
					continue
				}
				s := c.Values[0].Value

				switch c.Name {
				case "key":
					if strings.HasPrefix(s, `"`) {
						key = &ast.BasicLit{Kind: token.STRING, Value: s}
					} else {
						key = ast.NewString(s)
					}

				case "value":
					val = d.decodeValue(f, c)

					if cg := addComments(x.ClosingBraceComment); cg != nil {
						cg.Line = true
						ast.AddComment(val, cg)
					}

				default:
					d.addErrf(c.Start, "unsupported key name %q in map", c.Name)
					continue
				}
			}

			if key != nil && val != nil {
				value = ast.NewStruct(key, val)
			}
		}

		if value != nil {
			var label ast.Label
			if s := f.CUEName; ast.IsValidIdent(s) {
				label = ast.NewIdent(s)
			} else {
				label = ast.NewString(s)

			}
			// TODO: convert line number information. However, position
			// information in textpbfmt packages is too wonky to be useful
			f := &ast.Field{
				Label: label,
				Value: value,
				// Attrs: []*ast.Attribute{{Text: f.attr.}},
			}
			if cg := addComments(x.PreComments...); cg != nil {
				cg.Doc = true
				ast.AddComment(f, cg)
			}
			st.Elts = append(st.Elts, f)
		}
	}

	return st
}

func addComments(lines ...string) (cg *ast.CommentGroup) {
	var a []*ast.Comment
	for _, c := range lines {
		if !strings.HasPrefix(c, "#") {
			continue
		}
		a = append(a, &ast.Comment{Text: "//" + c[1:]})
	}
	if a != nil {
		cg = &ast.CommentGroup{List: a}
	}
	return cg
}

func (d *decoder) decodeValue(f *fieldInfo, n *pbast.Node) (x ast.Expr) {
	if f.ValueType == pbinternal.Message {
		if k := len(n.Values); k > 0 {
			d.addErrf(n.Start, "values not allowed for Message type; found %d", k)
		}
		x = d.decodeMsg(f.msg, n.Children)
		if cg := addComments(n.ClosingBraceComment); cg != nil {
			cg.Line = true
			cg.Position = 4
			ast.AddComment(x, cg)
		}
		return x
	}

	if len(n.Values) != 1 {
		d.addErrf(n.Start, "expected 1 value, found %d", len(n.Values))
		return nil
	}
	v := n.Values[0]

	defer func() {
		if cg := addComments(v.PreComments...); cg != nil {
			cg.Doc = true
			ast.AddComment(x, cg)
		}
		if cg := addComments(v.InlineComment); cg != nil {
			cg.Line = true
			cg.Position = 2
			ast.AddComment(x, cg)
		}
	}()

	switch f.ValueType {
	case pbinternal.String, pbinternal.Bytes:
		s, err := unquote.Unquote(n)
		if err != nil {
			d.addErrf(n.Start, "invalid string or bytes: %v", err)
		}
		if f.ValueType == pbinternal.String {
			s = literal.String.Quote(s)
		} else {
			s = literal.Bytes.Quote(s)
		}
		return &ast.BasicLit{Kind: token.STRING, Value: s}

	case pbinternal.Bool:
		switch v.Value {
		case "true":
			return ast.NewBool(true)

		case "false":
		default:
			d.addErrf(n.Start, "invalid bool %s", v.Value)
		}
		return ast.NewBool(false)

	case pbinternal.Int, pbinternal.Float:
		s := v.Value
		switch s {
		case "inf", "nan":
			// TODO: include message.
			return &ast.BottomLit{}
		}

		var info literal.NumInfo
		if err := literal.ParseNum(s, &info); err != nil {
			var x ast.BasicLit
			if pbinternal.MatchBySymbol(f.Value, s, &x) {
				return &x
			}
			d.addErrf(n.Start, "invalid number %s", s)
		}
		if !info.IsInt() {
			return &ast.BasicLit{Kind: token.FLOAT, Value: s}
		}
		return &ast.BasicLit{Kind: token.INT, Value: info.String()}

	default:
		panic(fmt.Sprintf("unexpected type %v", f.ValueType))
	}
}
