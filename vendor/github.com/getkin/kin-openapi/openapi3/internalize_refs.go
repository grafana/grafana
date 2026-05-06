package openapi3

import (
	"context"
	"path"
	"strings"
)

// RefNameResolver maps a component to an name that is used as it's internalized name.
//
// The function should avoid name collisions (i.e. be a injective mapping).
// It must only contain characters valid for fixed field names: [IdentifierRegExp].
type RefNameResolver func(*T, ComponentRef) string

// DefaultRefResolver is a default implementation of refNameResolver for the
// InternalizeRefs function.
//
// The external reference is internalized to (hopefully) a unique name. If
// the external reference matches (by path) to another reference in the root
// document then the name of that component is used.
//
// The transformation involves:
//   - Cutting the "#/components/<type>" part.
//   - Cutting the file extensions (.yaml/.json) from documents.
//   - Trimming the common directory with the root spec.
//   - Replace invalid characters with with underscores.
//
// This is an injective mapping over a "reasonable" amount of the possible openapi
// spec domain space but is not perfect. There might be edge cases.
func DefaultRefNameResolver(doc *T, ref ComponentRef) string {
	if ref.RefString() == "" || ref.RefPath() == nil {
		panic("unable to resolve reference to name")
	}

	name := ref.RefPath()

	// If refering to a component in the root spec, no need to internalize just use
	// the existing component.
	// XXX(percivalalb): since this function call is iterating over components behind the
	// scenes during an internalization call it actually starts interating over
	// new & replaced internalized components. This might caused some edge cases,
	// haven't found one yet but this might need to actually be used on a frozen copy
	// of doc.
	if nameInRoot, found := ReferencesComponentInRootDocument(doc, ref); found {
		nameInRoot = strings.TrimPrefix(nameInRoot, "#")

		rootCompURI := copyURI(doc.url)
		rootCompURI.Fragment = nameInRoot
		name = rootCompURI
	}

	filePath, componentPath := name.Path, name.Fragment

	// Cut out the "#/components/<type>" to make the names shorter.
	// XXX(percivalalb): This might cause collisions but is worth the brevity.
	if b, a, ok := strings.Cut(componentPath, path.Join("components", ref.CollectionName(), "")); ok {
		componentPath = path.Join(b, a)
	}

	if filePath != "" {
		// If the path is the same as the root doc, just remove.
		if doc.url != nil && filePath == doc.url.Path {
			filePath = ""
		}

		// Remove the path extentions to make this JSON/YAML agnostic.
		for ext := path.Ext(filePath); len(ext) > 0; ext = path.Ext(filePath) {
			filePath = strings.TrimSuffix(filePath, ext)
		}

		// Trim the common prefix with the root doc path.
		if doc.url != nil {
			commonDir := path.Dir(doc.url.Path)
			for {
				if commonDir == "." { // no common prefix
					break
				}

				if p, found := cutDirectories(filePath, commonDir); found {
					filePath = p
					break
				}

				commonDir = path.Dir(commonDir)
			}
		}
	}

	var internalizedName string

	// Trim .'s & slashes from start e.g. otherwise ./doc.yaml would end up as __doc
	if filePath != "" {
		internalizedName = strings.TrimLeft(filePath, "./")
	}

	if componentPath != "" {
		if internalizedName != "" {
			internalizedName += "_"
		}

		internalizedName += strings.TrimLeft(componentPath, "./")
	}

	// Replace invalid characters in component fixed field names.
	internalizedName = InvalidIdentifierCharRegExp.ReplaceAllString(internalizedName, "_")

	return internalizedName
}

// cutDirectories removes the given directories from the start of the path if
// the path is a child.
func cutDirectories(p, dirs string) (string, bool) {
	if dirs == "" || p == "" {
		return p, false
	}

	p = strings.TrimRight(p, "/")
	dirs = strings.TrimRight(dirs, "/")

	var sb strings.Builder
	sb.Grow(len(ParameterInHeader))
	for _, segments := range strings.Split(p, "/") {
		sb.WriteString(segments)

		if sb.String() == p {
			return strings.TrimPrefix(p, dirs), true
		}

		sb.WriteRune('/')
	}

	return p, false
}

func isExternalRef(ref string, parentIsExternal bool) bool {
	return ref != "" && (!strings.HasPrefix(ref, "#/components/") || parentIsExternal)
}

func (doc *T) addSchemaToSpec(s *SchemaRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if s == nil || !isExternalRef(s.Ref, parentIsExternal) {
		return false
	}

	name := refNameResolver(doc, s)
	if doc.Components != nil {
		if _, ok := doc.Components.Schemas[name]; ok {
			s.Ref = "#/components/schemas/" + name
			return true
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Schemas == nil {
		doc.Components.Schemas = make(Schemas)
	}
	doc.Components.Schemas[name] = s.Value.NewRef()
	s.Ref = "#/components/schemas/" + name
	return true
}

func (doc *T) addParameterToSpec(p *ParameterRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if p == nil || !isExternalRef(p.Ref, parentIsExternal) {
		return false
	}
	name := refNameResolver(doc, p)
	if doc.Components != nil {
		if _, ok := doc.Components.Parameters[name]; ok {
			p.Ref = "#/components/parameters/" + name
			return true
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Parameters == nil {
		doc.Components.Parameters = make(ParametersMap)
	}
	doc.Components.Parameters[name] = &ParameterRef{Value: p.Value}
	p.Ref = "#/components/parameters/" + name
	return true
}

func (doc *T) addHeaderToSpec(h *HeaderRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if h == nil || !isExternalRef(h.Ref, parentIsExternal) {
		return false
	}
	name := refNameResolver(doc, h)
	if doc.Components != nil {
		if _, ok := doc.Components.Headers[name]; ok {
			h.Ref = "#/components/headers/" + name
			return true
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Headers == nil {
		doc.Components.Headers = make(Headers)
	}
	doc.Components.Headers[name] = &HeaderRef{Value: h.Value}
	h.Ref = "#/components/headers/" + name
	return true
}

func (doc *T) addRequestBodyToSpec(r *RequestBodyRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if r == nil || !isExternalRef(r.Ref, parentIsExternal) {
		return false
	}
	name := refNameResolver(doc, r)
	if doc.Components != nil {
		if _, ok := doc.Components.RequestBodies[name]; ok {
			r.Ref = "#/components/requestBodies/" + name
			return true
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.RequestBodies == nil {
		doc.Components.RequestBodies = make(RequestBodies)
	}
	doc.Components.RequestBodies[name] = &RequestBodyRef{Value: r.Value}
	r.Ref = "#/components/requestBodies/" + name
	return true
}

func (doc *T) addResponseToSpec(r *ResponseRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if r == nil || !isExternalRef(r.Ref, parentIsExternal) {
		return false
	}
	name := refNameResolver(doc, r)
	if doc.Components != nil {
		if _, ok := doc.Components.Responses[name]; ok {
			r.Ref = "#/components/responses/" + name
			return true
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Responses == nil {
		doc.Components.Responses = make(ResponseBodies)
	}
	doc.Components.Responses[name] = &ResponseRef{Value: r.Value}
	r.Ref = "#/components/responses/" + name
	return true
}

func (doc *T) addSecuritySchemeToSpec(ss *SecuritySchemeRef, refNameResolver RefNameResolver, parentIsExternal bool) {
	if ss == nil || !isExternalRef(ss.Ref, parentIsExternal) {
		return
	}
	name := refNameResolver(doc, ss)
	if doc.Components != nil {
		if _, ok := doc.Components.SecuritySchemes[name]; ok {
			ss.Ref = "#/components/securitySchemes/" + name
			return
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.SecuritySchemes == nil {
		doc.Components.SecuritySchemes = make(SecuritySchemes)
	}
	doc.Components.SecuritySchemes[name] = &SecuritySchemeRef{Value: ss.Value}
	ss.Ref = "#/components/securitySchemes/" + name

}

func (doc *T) addExampleToSpec(e *ExampleRef, refNameResolver RefNameResolver, parentIsExternal bool) {
	if e == nil || !isExternalRef(e.Ref, parentIsExternal) {
		return
	}
	name := refNameResolver(doc, e)
	if doc.Components != nil {
		if _, ok := doc.Components.Examples[name]; ok {
			e.Ref = "#/components/examples/" + name
			return
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Examples == nil {
		doc.Components.Examples = make(Examples)
	}
	doc.Components.Examples[name] = &ExampleRef{Value: e.Value}
	e.Ref = "#/components/examples/" + name

}

func (doc *T) addLinkToSpec(l *LinkRef, refNameResolver RefNameResolver, parentIsExternal bool) {
	if l == nil || !isExternalRef(l.Ref, parentIsExternal) {
		return
	}
	name := refNameResolver(doc, l)
	if doc.Components != nil {
		if _, ok := doc.Components.Links[name]; ok {
			l.Ref = "#/components/links/" + name
			return
		}
	}

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Links == nil {
		doc.Components.Links = make(Links)
	}
	doc.Components.Links[name] = &LinkRef{Value: l.Value}
	l.Ref = "#/components/links/" + name

}

func (doc *T) addCallbackToSpec(c *CallbackRef, refNameResolver RefNameResolver, parentIsExternal bool) bool {
	if c == nil || !isExternalRef(c.Ref, parentIsExternal) {
		return false
	}
	name := refNameResolver(doc, c)

	if doc.Components == nil {
		doc.Components = &Components{}
	}
	if doc.Components.Callbacks == nil {
		doc.Components.Callbacks = make(Callbacks)
	}
	c.Ref = "#/components/callbacks/" + name
	doc.Components.Callbacks[name] = &CallbackRef{Value: c.Value}
	return true
}

func (doc *T) derefSchema(s *Schema, refNameResolver RefNameResolver, parentIsExternal bool) {
	if s == nil || doc.isVisitedSchema(s) {
		return
	}

	for _, list := range []SchemaRefs{s.AllOf, s.AnyOf, s.OneOf} {
		for _, s2 := range list {
			isExternal := doc.addSchemaToSpec(s2, refNameResolver, parentIsExternal)
			if s2 != nil {
				doc.derefSchema(s2.Value, refNameResolver, isExternal || parentIsExternal)
			}
		}
	}

	for _, name := range componentNames(s.Properties) {
		s2 := s.Properties[name]
		isExternal := doc.addSchemaToSpec(s2, refNameResolver, parentIsExternal)
		if s2 != nil {
			doc.derefSchema(s2.Value, refNameResolver, isExternal || parentIsExternal)
		}
	}
	for _, ref := range []*SchemaRef{s.Not, s.AdditionalProperties.Schema, s.Items} {
		isExternal := doc.addSchemaToSpec(ref, refNameResolver, parentIsExternal)
		if ref != nil {
			doc.derefSchema(ref.Value, refNameResolver, isExternal || parentIsExternal)
		}
	}
}

func (doc *T) derefHeaders(hs Headers, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(hs) {
		h := hs[name]
		isExternal := doc.addHeaderToSpec(h, refNameResolver, parentIsExternal)
		if doc.isVisitedHeader(h.Value) {
			continue
		}
		doc.derefParameter(h.Value.Parameter, refNameResolver, parentIsExternal || isExternal)
	}
}

func (doc *T) derefExamples(es Examples, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(es) {
		e := es[name]
		doc.addExampleToSpec(e, refNameResolver, parentIsExternal)
	}
}

func (doc *T) derefContent(c Content, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(c) {
		mediatype := c[name]
		isExternal := doc.addSchemaToSpec(mediatype.Schema, refNameResolver, parentIsExternal)
		if mediatype.Schema != nil {
			doc.derefSchema(mediatype.Schema.Value, refNameResolver, isExternal || parentIsExternal)
		}
		doc.derefExamples(mediatype.Examples, refNameResolver, parentIsExternal)
		for _, name := range componentNames(mediatype.Encoding) {
			e := mediatype.Encoding[name]
			doc.derefHeaders(e.Headers, refNameResolver, parentIsExternal)
		}
	}
}

func (doc *T) derefLinks(ls Links, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(ls) {
		l := ls[name]
		doc.addLinkToSpec(l, refNameResolver, parentIsExternal)
	}
}

func (doc *T) derefResponse(r *ResponseRef, refNameResolver RefNameResolver, parentIsExternal bool) {
	isExternal := doc.addResponseToSpec(r, refNameResolver, parentIsExternal)
	if v := r.Value; v != nil {
		doc.derefHeaders(v.Headers, refNameResolver, isExternal || parentIsExternal)
		doc.derefContent(v.Content, refNameResolver, isExternal || parentIsExternal)
		doc.derefLinks(v.Links, refNameResolver, isExternal || parentIsExternal)
	}
}

func (doc *T) derefResponses(rs *Responses, refNameResolver RefNameResolver, parentIsExternal bool) {
	doc.derefResponseBodies(rs.Map(), refNameResolver, parentIsExternal)
}

func (doc *T) derefResponseBodies(es ResponseBodies, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(es) {
		e := es[name]
		doc.derefResponse(e, refNameResolver, parentIsExternal)
	}
}

func (doc *T) derefParameter(p Parameter, refNameResolver RefNameResolver, parentIsExternal bool) {
	isExternal := doc.addSchemaToSpec(p.Schema, refNameResolver, parentIsExternal)
	doc.derefContent(p.Content, refNameResolver, parentIsExternal)
	if p.Schema != nil {
		doc.derefSchema(p.Schema.Value, refNameResolver, isExternal || parentIsExternal)
	}
}

func (doc *T) derefRequestBody(r RequestBody, refNameResolver RefNameResolver, parentIsExternal bool) {
	doc.derefContent(r.Content, refNameResolver, parentIsExternal)
}

func (doc *T) derefPaths(paths map[string]*PathItem, refNameResolver RefNameResolver, parentIsExternal bool) {
	for _, name := range componentNames(paths) {
		ops := paths[name]
		pathIsExternal := isExternalRef(ops.Ref, parentIsExternal)
		// inline full operations
		ops.Ref = ""

		for _, param := range ops.Parameters {
			isExternal := doc.addParameterToSpec(param, refNameResolver, pathIsExternal)
			if param.Value != nil {
				doc.derefParameter(*param.Value, refNameResolver, pathIsExternal || isExternal)
			}
		}

		opsWithMethod := ops.Operations()
		for _, name := range componentNames(opsWithMethod) {
			op := opsWithMethod[name]
			isExternal := doc.addRequestBodyToSpec(op.RequestBody, refNameResolver, pathIsExternal)
			if op.RequestBody != nil && op.RequestBody.Value != nil {
				doc.derefRequestBody(*op.RequestBody.Value, refNameResolver, pathIsExternal || isExternal)
			}
			for _, name := range componentNames(op.Callbacks) {
				cb := op.Callbacks[name]
				isExternal := doc.addCallbackToSpec(cb, refNameResolver, pathIsExternal)
				if cb.Value != nil {
					cbValue := (*cb.Value).Map()
					doc.derefPaths(cbValue, refNameResolver, pathIsExternal || isExternal)
				}
			}
			doc.derefResponses(op.Responses, refNameResolver, pathIsExternal)
			for _, param := range op.Parameters {
				isExternal := doc.addParameterToSpec(param, refNameResolver, pathIsExternal)
				if param.Value != nil {
					doc.derefParameter(*param.Value, refNameResolver, pathIsExternal || isExternal)
				}
			}
		}
	}
}

// InternalizeRefs removes all references to external files from the spec and moves them
// to the components section.
//
// refNameResolver takes in references to returns a name to store the reference under locally.
// It MUST return a unique name for each reference type.
// A default implementation is provided that will suffice for most use cases. See the function
// documentation for more details.
//
// Example:
//
//	doc.InternalizeRefs(context.Background(), nil)
func (doc *T) InternalizeRefs(ctx context.Context, refNameResolver func(*T, ComponentRef) string) {
	doc.resetVisited()

	if refNameResolver == nil {
		refNameResolver = DefaultRefNameResolver
	}

	if components := doc.Components; components != nil {
		for _, name := range componentNames(components.Schemas) {
			schema := components.Schemas[name]
			isExternal := doc.addSchemaToSpec(schema, refNameResolver, false)
			if schema != nil {
				schema.Ref = "" // always dereference the top level
				doc.derefSchema(schema.Value, refNameResolver, isExternal)
			}
		}
		for _, name := range componentNames(components.Parameters) {
			p := components.Parameters[name]
			isExternal := doc.addParameterToSpec(p, refNameResolver, false)
			if p != nil && p.Value != nil {
				p.Ref = "" // always dereference the top level
				doc.derefParameter(*p.Value, refNameResolver, isExternal)
			}
		}
		doc.derefHeaders(components.Headers, refNameResolver, false)
		for _, name := range componentNames(components.RequestBodies) {
			req := components.RequestBodies[name]
			isExternal := doc.addRequestBodyToSpec(req, refNameResolver, false)
			if req != nil && req.Value != nil {
				req.Ref = "" // always dereference the top level
				doc.derefRequestBody(*req.Value, refNameResolver, isExternal)
			}
		}
		doc.derefResponseBodies(components.Responses, refNameResolver, false)
		for _, name := range componentNames(components.SecuritySchemes) {
			ss := components.SecuritySchemes[name]
			doc.addSecuritySchemeToSpec(ss, refNameResolver, false)
		}
		doc.derefExamples(components.Examples, refNameResolver, false)
		doc.derefLinks(components.Links, refNameResolver, false)

		for _, name := range componentNames(components.Callbacks) {
			cb := components.Callbacks[name]
			isExternal := doc.addCallbackToSpec(cb, refNameResolver, false)
			if cb != nil && cb.Value != nil {
				cb.Ref = "" // always dereference the top level
				cbValue := (*cb.Value).Map()
				doc.derefPaths(cbValue, refNameResolver, isExternal)
			}
		}
	}

	doc.derefPaths(doc.Paths.Map(), refNameResolver, false)
}
