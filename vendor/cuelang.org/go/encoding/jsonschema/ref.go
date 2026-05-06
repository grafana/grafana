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

package jsonschema

import (
	"net/url"
	"path"
	"strconv"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
)

func (d *decoder) parseRef(p token.Pos, str string) []string {
	u, err := url.Parse(str)
	if err != nil {
		d.addErr(errors.Newf(p, "invalid JSON reference: %s", err))
		return nil
	}

	if u.Host != "" || u.Path != "" {
		d.addErr(errors.Newf(p, "external references (%s) not supported", str))
		// TODO: handle
		//    host:
		//      If the host corresponds to a package known to cue,
		//      load it from there. It would prefer schema converted to
		//      CUE, although we could consider loading raw JSON schema
		//      if present.
		//      If not present, advise the user to run cue get.
		//    path:
		//      Look up on file system or relatively to authority location.
		return nil
	}

	if !path.IsAbs(u.Fragment) {
		d.addErr(errors.Newf(p, "anchors (%s) not supported", u.Fragment))
		// TODO: support anchors
		return nil
	}

	// NOTE: Go bug?: url.URL has no raw representation of the fragment. This
	// means that %2F gets translated to `/` before it can be split. This, in
	// turn, means that field names cannot have a `/` as name.

	return splitFragment(u)
}

// resolveURI parses a URI from n and resolves it in the current context.
// To resolve it in the current context, it looks for the closest URI from
// an $id in the parent scopes and the uses the URI resolution to get the
// new URI.
//
// This method is used to resolve any URI, including those from $id and $ref.
func (s *state) resolveURI(n cue.Value) *url.URL {
	str, ok := s.strValue(n)
	if !ok {
		return nil
	}

	u, err := url.Parse(str)
	if err != nil {
		s.addErr(errors.Newf(n.Pos(), "invalid JSON reference: %s", err))
		return nil
	}

	for {
		if s.id != nil {
			u = s.id.ResolveReference(u)
			break
		}
		if s.up == nil {
			break
		}
		s = s.up
	}

	return u
}

const topSchema = "_schema"

// makeCUERef converts a URI into a CUE reference for the current location.
// The returned identifier (or first expression in a selection chain), is
// hardwired to point to the resolved value. This will allow astutil.Sanitize
// to automatically unshadow any shadowed variables.
func (s *state) makeCUERef(n cue.Value, u *url.URL) ast.Expr {
	a := splitFragment(u)

	switch fn := s.cfg.Map; {
	case fn != nil:
		// TODO: This block is only used in case s.cfg.Map is set, which is
		// currently only used for OpenAPI. Handling should be brought more in
		// line with JSON schema.
		a, err := fn(n.Pos(), a)
		if err != nil {
			s.addErr(errors.Newf(n.Pos(), "invalid reference %q: %v", u, err))
			return nil
		}
		if len(a) == 0 {
			// TODO: should we allow inserting at root level?
			s.addErr(errors.Newf(n.Pos(),
				"invalid empty reference returned by map for %q", u))
			return nil
		}
		sel, ok := a[0].(ast.Expr)
		if !ok {
			sel = &ast.BadExpr{}
		}
		for _, l := range a[1:] {
			switch x := l.(type) {
			case *ast.Ident:
				sel = &ast.SelectorExpr{X: sel, Sel: x}

			case *ast.BasicLit:
				sel = &ast.IndexExpr{X: sel, Index: x}
			}
		}
		return sel
	}

	var ident *ast.Ident

	for ; ; s = s.up {
		if s.up == nil {
			switch {
			case u.Host == "" && u.Path == "",
				s.id != nil && s.id.Host == u.Host && s.id.Path == u.Path:
				if len(a) == 0 {
					// refers to the top of the file. We will allow this by
					// creating a helper schema as such:
					//   _schema: {...}
					//   _schema
					// This is created at the finalization stage if
					// hasSelfReference is set.
					s.hasSelfReference = true

					ident = ast.NewIdent(topSchema)
					ident.Node = s.obj
					return ident
				}

				ident, a = s.getNextIdent(n, a)

			case u.Host != "":
				// Reference not found within scope. Create an import reference.

				// TODO: allow the configuration to specify a map from
				// URI domain+paths to CUE packages.

				// TODO: currently only $ids that are in scope can be
				// referenced. We could consider doing an extra pass to record
				// all '$id's in a file to be able to link to them even if they
				// are not in scope.
				p := u.Path

				base := path.Base(p)
				if !ast.IsValidIdent(base) {
					base = strings.TrimSuffix(base, ".json")
					if !ast.IsValidIdent(base) {
						// Find something more clever to do there. For now just
						// pick "schema" as the package name.
						base = "schema"
					}
					p += ":" + base
				}

				ident = ast.NewIdent(base)
				ident.Node = &ast.ImportSpec{Path: ast.NewString(u.Host + p)}

			default:
				// Just a path, not sure what that means.
				s.errf(n, "unknown domain for reference %q", u)
				return nil
			}
			break
		}

		if s.id == nil {
			continue
		}

		if s.id.Host == u.Host && s.id.Path == u.Path {
			if len(a) == 0 {
				if len(s.idRef) == 0 {
					// This is a reference to either root or a schema for which
					// we do not yet support references. See Issue #386.
					if s.up.up != nil {
						s.errf(n, "cannot refer to internal schema %q", u)
						return nil
					}

					// This is referring to the root scope. There is a dummy
					// state above the root state that we need to update.
					s = s.up

					// refers to the top of the file. We will allow this by
					// creating a helper schema as such:
					//   _schema: {...}
					//   _schema
					// This is created at the finalization stage if
					// hasSelfReference is set.
					s.hasSelfReference = true
					ident = ast.NewIdent(topSchema)
					ident.Node = s.obj
					return ident
				}

				x := s.idRef[0]
				if !x.isDef && !ast.IsValidIdent(x.name) {
					s.errf(n, "referring to field %q not supported", x.name)
					return nil
				}
				e := ast.NewIdent(x.name)
				if len(s.idRef) == 1 {
					return e
				}
				return newSel(e, s.idRef[1])
			}
			ident, a = s.getNextIdent(n, a)
			ident.Node = s.obj
			break
		}
	}

	return s.newSel(ident, n, a)
}

// getNextSelector translates a JSON Reference path into a CUE path by consuming
// the first path elements and returning the corresponding CUE label.
func (s *state) getNextSelector(v cue.Value, a []string) (l label, tail []string) {
	switch elem := a[0]; elem {
	case "$defs", "definitions":
		if len(a) == 1 {
			s.errf(v, "cannot refer to %s section: must refer to one of its elements", a[0])
			return label{}, nil
		}

		if name := "#" + a[1]; ast.IsValidIdent(name) {
			return label{name, true}, a[2:]
		}

		return label{"#", true}, a[1:]

	case "properties":
		if len(a) == 1 {
			s.errf(v, "cannot refer to %s section: must refer to one of its elements", a[0])
			return label{}, nil
		}

		return label{a[1], false}, a[2:]

	default:
		return label{elem, false}, a[1:]

	case "additionalProperties",
		"patternProperties",
		"items",
		"additionalItems":
		// TODO: as a temporary workaround, include the schema verbatim.
		// TODO: provide definitions for these in CUE.
		s.errf(v, "referring to field %q not yet supported", elem)

		// Other known fields cannot be supported.
		return label{}, nil
	}
}

// newSel converts a JSON Reference path and initial CUE identifier to
// a CUE selection path.
func (s *state) newSel(e ast.Expr, v cue.Value, a []string) ast.Expr {
	for len(a) > 0 {
		var label label
		label, a = s.getNextSelector(v, a)
		e = newSel(e, label)
	}
	return e
}

// newSel converts label to a CUE index and creates an expression to index
// into e.
func newSel(e ast.Expr, label label) ast.Expr {
	if label.isDef {
		return ast.NewSel(e, label.name)

	}
	if ast.IsValidIdent(label.name) && !internal.IsDefOrHidden(label.name) {
		return ast.NewSel(e, label.name)
	}
	return &ast.IndexExpr{X: e, Index: ast.NewString(label.name)}
}

func (s *state) setField(lab label, f *ast.Field) {
	x := s.getRef(lab)
	x.field = f
	s.setRef(lab, x)
	x = s.getRef(lab)
}

func (s *state) getRef(lab label) refs {
	if s.fieldRefs == nil {
		s.fieldRefs = make(map[label]refs)
	}
	x, ok := s.fieldRefs[lab]
	if !ok {
		if lab.isDef ||
			(ast.IsValidIdent(lab.name) && !internal.IsDefOrHidden(lab.name)) {
			x.ident = lab.name
		} else {
			x.ident = "_X" + strconv.Itoa(s.decoder.numID)
			s.decoder.numID++
		}
		s.fieldRefs[lab] = x
	}
	return x
}

func (s *state) setRef(lab label, r refs) {
	s.fieldRefs[lab] = r
}

// getNextIdent gets the first CUE reference from a JSON Reference path and
// converts it to a CUE identifier.
func (s *state) getNextIdent(v cue.Value, a []string) (resolved *ast.Ident, tail []string) {
	lab, a := s.getNextSelector(v, a)

	x := s.getRef(lab)
	ident := ast.NewIdent(x.ident)
	x.refs = append(x.refs, ident)
	s.setRef(lab, x)

	return ident, a
}

// linkReferences resolves identifiers to relevant nodes. This allows
// astutil.Sanitize to unshadow nodes if necessary.
func (s *state) linkReferences() {
	for _, r := range s.fieldRefs {
		if r.field == nil {
			// TODO: improve error message.
			s.errf(cue.Value{}, "reference to non-existing value %q", r.ident)
			continue
		}

		// link resembles the link value. See astutil.Resolve.
		var link ast.Node

		ident, ok := r.field.Label.(*ast.Ident)
		if ok && ident.Name == r.ident {
			link = r.field.Value
		} else if len(r.refs) > 0 {
			r.field.Label = &ast.Alias{
				Ident: ast.NewIdent(r.ident),
				Expr:  r.field.Label.(ast.Expr),
			}
			link = r.field
		}

		for _, i := range r.refs {
			i.Node = link
		}
	}
}

// splitFragment splits the fragment part of a URI into path components. The
// result may be an empty slice.
//
// TODO: this requires RawFragment introduced in go1.15 to function properly.
// As for now, CUE still uses go1.12.
func splitFragment(u *url.URL) []string {
	if u.Fragment == "" {
		return nil
	}
	s := strings.TrimRight(u.Fragment[1:], "/")
	if s == "" {
		return nil
	}
	return strings.Split(s, "/")
}

func (d *decoder) mapRef(p token.Pos, str string, ref []string) []ast.Label {
	fn := d.cfg.Map
	if fn == nil {
		fn = jsonSchemaRef
	}
	a, err := fn(p, ref)
	if err != nil {
		if str == "" {
			str = "#/" + strings.Join(ref, "/")
		}
		d.addErr(errors.Newf(p, "invalid reference %q: %v", str, err))
		return nil
	}
	if len(a) == 0 {
		// TODO: should we allow inserting at root level?
		if str == "" {
			str = "#/" + strings.Join(ref, "/")
		}
		d.addErr(errors.Newf(p,
			"invalid empty reference returned by map for %q", str))
		return nil
	}
	return a
}

func jsonSchemaRef(p token.Pos, a []string) ([]ast.Label, error) {
	// TODO: technically, references could reference a
	// non-definition. We disallow this case for the standard
	// JSON Schema interpretation. We could detect cases that
	// are not definitions and then resolve those as literal
	// values.
	if len(a) != 2 || (a[0] != "definitions" && a[0] != "$defs") {
		return nil, errors.Newf(p,
			// Don't mention the ability to use $defs, as this definition seems
			// to already have been withdrawn from the JSON Schema spec.
			"$ref must be of the form #/definitions/...")
	}
	name := a[1]
	if ast.IsValidIdent(name) &&
		name != rootDefs[1:] &&
		!internal.IsDefOrHidden(name) {
		return []ast.Label{ast.NewIdent("#" + name)}, nil
	}
	return []ast.Label{ast.NewIdent(rootDefs), ast.NewString(name)}, nil
}
