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

package cli

import (
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/parser"
	"cuelang.org/go/cue/token"
)

func ParseValue(pos token.Pos, name, str string, k cue.Kind) (x ast.Expr, errs errors.Error) {
	var expr ast.Expr

	if k&cue.NumberKind != 0 {
		var err error
		expr, err = parser.ParseExpr(name, str)
		if err != nil {
			errs = errors.Wrapf(err, pos,
				"invalid number for environment variable %s", name)
		}
	}

	if k&cue.BoolKind != 0 {
		str = strings.TrimSpace(str)
		b, ok := boolValues[str]
		if !ok {
			errs = errors.Append(errs, errors.Newf(pos,
				"invalid boolean value %q for environment variable %s", str, name))
		} else if expr != nil || k&cue.StringKind != 0 {
			// Convert into an expression
			bl := ast.NewBool(b)
			if expr != nil {
				expr = &ast.BinaryExpr{Op: token.OR, X: expr, Y: bl}
			} else {
				expr = bl
			}
		} else {
			x = ast.NewBool(b)
		}
	}

	if k&cue.StringKind != 0 {
		if expr != nil {
			expr = &ast.BinaryExpr{Op: token.OR, X: expr, Y: ast.NewString(str)}
		} else {
			x = ast.NewString(str)
		}
	}

	switch {
	case expr != nil:
		return expr, nil
	case x != nil:
		return x, nil
	case errs == nil:
		return nil, errors.Newf(pos,
			"invalid type for environment variable %s", name)
	}
	return nil, errs
}

var boolValues = map[string]bool{
	"1":     true,
	"0":     false,
	"t":     true,
	"f":     false,
	"T":     true,
	"F":     false,
	"true":  true,
	"false": false,
	"TRUE":  true,
	"FALSE": false,
	"True":  true,
	"False": false,
}
