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

package export

import (
	"crypto/md5"
	"fmt"
	"io"
	"strconv"
	"strings"

	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/literal"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal/core/adt"
)

func (e *exporter) stringLabel(f adt.Feature) ast.Label {
	x := f.Index()
	switch f.Typ() {
	case adt.IntLabel:
		return ast.NewLit(token.INT, strconv.Itoa(int(x)))

	case adt.DefinitionLabel, adt.HiddenLabel, adt.HiddenDefinitionLabel:
		s := e.identString(f)
		return ast.NewIdent(s)

	case adt.StringLabel:
		s := e.ctx.IndexToString(int64(x))
		if f == 0 || !ast.IsValidIdent(s) ||
			strings.HasPrefix(s, "#") || strings.HasPrefix(s, "_") {
			return ast.NewLit(token.STRING, literal.Label.Quote(s))
		}
		fallthrough

	default:
		return ast.NewIdent(e.ctx.IndexToString(int64(x)))
	}
}

// identString converts the given Feature f to an identifier string.
//
// Hidden field mangling:
//
// If f is a hidden field that comes from an expanded package, it will mangle
// the name by expending it with the MD5 hash of the package name. This is to
// avoid collissions of the hidden identifiers when namespaces are merged.
// It uses the MD5 hash to allow hidden fields from the same package to
// still match across inlining and unifications.
//
// TODO: Alternatives approaches to consider:
//  1. Rewrite to unique hidden field names. This means, though, that hidden
//     fields may not match across unifications. That may be okay.
//  2. Force inline hidden fields from such packages, or translate them to let
//     expressions when necessary. This should generally preserve semantics
//     quite well.
//  3. Allow addressing hidden fields across packages, for instance by allowing
//     `_(hiddenField, pkg: "import/path")`. This kind of defeats the purpose
//     of hidden fields, though.
//
// Option 2 seems the best long-term solution. It should be possible to
// piggyback on the self containment algorithm for this: basically, whenever
// we see a hidden reference of an inlined package, we treat it as an
// external reference itself.
//
// For now, as this only can occur when the InlineImports feature is used,
// we use this simpler approach.
func (e *exporter) identString(f adt.Feature) string {
	s := f.IdentString(e.ctx)

	if !f.IsHidden() || !e.cfg.InlineImports {
		return s
	}

	pkg := f.PkgID(e.ctx)
	if pkg == "" || pkg == "_" || pkg == e.pkgID {
		return s
	}

	if e.pkgHash == nil {
		e.pkgHash = map[string]string{}
	}
	id, ok := e.pkgHash[pkg]
	if !ok {
		h := md5.New()
		io.WriteString(h, pkg)
		b := h.Sum(nil)
		id = fmt.Sprintf("_%8X", b[:4])
		e.pkgHash[pkg] = id
	}
	s += id

	return s
}
