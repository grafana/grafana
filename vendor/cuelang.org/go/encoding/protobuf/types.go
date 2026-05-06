// Copyright 2019 CUE Authors
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

package protobuf

import (
	"fmt"
	"text/scanner"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
	"github.com/emicklei/proto"
)

func protoToCUE(typ string, options []*proto.Option) ast.Expr {
	t, ok := scalars[typ]
	if !ok {
		return nil
	}
	return predeclared(t)
}

var scalars = map[string]string{
	// Differing
	"sint32":   "int32",
	"sint64":   "int64",
	"fixed32":  "uint32",
	"fixed64":  "uint64",
	"sfixed32": "int32",
	"sfixed64": "int64",

	// Identical to CUE
	"int32":  "int32",
	"int64":  "int64",
	"uint32": "uint32",
	"uint64": "uint64",

	"double": "float64",
	"float":  "float32",

	"bool":   "bool",
	"string": "string",
	"bytes":  "bytes",
}

func predeclared(s string) ast.Expr {
	return &ast.Ident{
		Name: s,
		Node: ast.NewIdent("__" + s),
	}
}

func (p *protoConverter) setBuiltin(from string, to func() ast.Expr, pkg *protoConverter) {
	p.scope[0][from] = mapping{to, pkg}
}

func (p *protoConverter) setBuiltinParse(from, to string, pkg *protoConverter) {
	f := func() ast.Expr {
		expr, err := parser.ParseExpr("", to, parser.ParseComments)
		if err != nil {
			panic(fmt.Sprintf("error parsing name %q: %v", to, err))
		}
		return expr
	}
	p.scope[0][from] = mapping{f, pkg}
}

var (
	pkgTime      = &protoConverter{cuePkgPath: "time"}
	pkgStruct    = &protoConverter{cuePkgPath: "struct"}
	importTime   = ast.NewImport(nil, "time")
	importStruct = ast.NewImport(nil, "struct")
)

func (p *protoConverter) mapBuiltinPackage(pos scanner.Position, file string, required bool) (generate bool) {
	// Map some builtin types to their JSON/CUE mappings.
	switch file {
	case "gogoproto/gogo.proto":

	case "google/protobuf/struct.proto":
		p.setBuiltin("google.protobuf.Struct", func() ast.Expr {
			return ast.NewStruct()
		}, nil)

		p.setBuiltin("google.protobuf.Value", func() ast.Expr {
			return ast.NewIdent("_")
		}, nil)

		p.setBuiltin("google.protobuf.NullValue", func() ast.Expr {
			return ast.NewNull()
		}, nil)

		p.setBuiltin("google.protobuf.ListValue", func() ast.Expr {
			return ast.NewList(&ast.Ellipsis{})
		}, nil)

		p.setBuiltin("google.protobuf.StringValue", func() ast.Expr {
			return predeclared("string")
		}, nil)

		p.setBuiltin("google.protobuf.BoolValue", func() ast.Expr {
			return predeclared("bool")
		}, nil)

		p.setBuiltin("google.protobuf.NumberValue", func() ast.Expr {
			return predeclared("number")
		}, nil)

		return false

	case "google/protobuf/empty.proto":
		f := func() ast.Expr {
			time := &ast.Ident{Name: "struct", Node: importStruct}
			return ast.NewCall(
				ast.NewSel(time, "MaxFields"),
				ast.NewLit(token.INT, "0"),
			)
		}
		p.setBuiltin("google.protobuf.Empty", f, pkgStruct)
		return false

	case "google/protobuf/duration.proto":
		f := func() ast.Expr {
			time := &ast.Ident{Name: "time", Node: importTime}
			return ast.NewSel(time, "Duration")
		}
		p.setBuiltin("google.protobuf.Duration", f, pkgTime)
		return false

	case "google/protobuf/timestamp.proto":
		f := func() ast.Expr {
			time := &ast.Ident{Name: "time", Node: importTime}
			return ast.NewSel(time, "Time")
		}
		p.setBuiltin("google.protobuf.Timestamp", f, pkgTime)
		return false

	case "google/protobuf/any.proto":
		// TODO: technically, the value should be `_` (anything), but that
		// will not convert to a valid OpenAPI value. In practice, all
		// "well-known" types except wrapper types (which will likely not
		// be used here) are represented as strings.
		//
		// In Structural OpenAPI this type cannot be represented.
		p.setBuiltinParse("google.protobuf.Any", `{
	// A URL/resource name that uniquely identifies the type of the serialized protocol buffer message. This string must contain at least one "/" character. The last segment of the URL's path must represent the fully qualified name of the type (as in `+
			"`type.googleapis.com/google.protobuf.Duration`"+`). The name should be in a canonical form (e.g., leading "." is not accepted).
	// The remaining fields of this object correspond to fields of the proto messsage. If the embedded message is well-known and has a custom JSON representation, that representation is assigned to the 'value' field.
	"@type": string,
}`, nil)
		return false

	case "google/protobuf/wrappers.proto":
		p.setBuiltinParse("google.protobuf.DoubleValue", `null | float`, nil)
		p.setBuiltinParse("google.protobuf.FloatValue", `null | float`, nil)
		p.setBuiltinParse("google.protobuf.Int64Value", `null | int64`, nil)
		p.setBuiltinParse("google.protobuf.UInt64Value", `null | uint64`, nil)
		p.setBuiltinParse("google.protobuf.Int32Value", `null | int32`, nil)
		p.setBuiltinParse("google.protobuf.UInt32Value", `null | uint32`, nil)
		p.setBuiltinParse("google.protobuf.BoolValue", `null | bool`, nil)
		p.setBuiltinParse("google.protobuf.StringValue", `null | string`, nil)
		p.setBuiltinParse("google.protobuf.BytesValue", `null | bytes`, nil)
		return false

	// case "google/protobuf/field_mask.proto":
	// 	p.setBuiltin("google.protobuf.FieldMask", "protobuf.FieldMask", nil)

	// 	protobuf.Any

	default:
		if required {
			failf(pos, "import %q not found", file)
		}
	}
	return true
}
