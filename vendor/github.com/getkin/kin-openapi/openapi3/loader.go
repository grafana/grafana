package openapi3

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
)

// IncludeOrigin specifies whether to include the origin of the OpenAPI elements
// Set this to true before loading a spec to include the origin of the OpenAPI elements
// Note it is global and affects all loaders
var IncludeOrigin = false

func foundUnresolvedRef(ref string) error {
	return fmt.Errorf("found unresolved ref: %q", ref)
}

func failedToResolveRefFragmentPart(value, what string) error {
	return fmt.Errorf("failed to resolve %q in fragment in URI: %q", what, value)
}

// Loader helps deserialize an OpenAPIv3 document
type Loader struct {
	// IsExternalRefsAllowed enables visiting other files
	IsExternalRefsAllowed bool

	// ReadFromURIFunc allows overriding the any file/URL reading func
	ReadFromURIFunc ReadFromURIFunc

	Context context.Context

	rootDir      string
	rootLocation string

	visitedPathItemRefs map[string]struct{}

	visitedDocuments map[string]*T

	visitedRefs map[string]struct{}
	visitedPath []string
	backtrack   map[string][]func(value any)
}

// NewLoader returns an empty Loader
func NewLoader() *Loader {
	return &Loader{
		Context: context.Background(),
	}
}

func (loader *Loader) resetVisitedPathItemRefs() {
	loader.visitedPathItemRefs = make(map[string]struct{})
	loader.visitedRefs = make(map[string]struct{})
	loader.visitedPath = nil
	loader.backtrack = make(map[string][]func(value any))
}

// LoadFromURI loads a spec from a remote URL
func (loader *Loader) LoadFromURI(location *url.URL) (*T, error) {
	loader.resetVisitedPathItemRefs()
	return loader.loadFromURIInternal(location)
}

// LoadFromFile loads a spec from a local file path
func (loader *Loader) LoadFromFile(location string) (*T, error) {
	loader.rootDir = path.Dir(location)
	return loader.LoadFromURI(&url.URL{Path: filepath.ToSlash(location)})
}

func (loader *Loader) loadFromURIInternal(location *url.URL) (*T, error) {
	data, err := loader.readURL(location)
	if err != nil {
		return nil, err
	}
	return loader.loadFromDataWithPathInternal(data, location)
}

func (loader *Loader) allowsExternalRefs(ref string) (err error) {
	if !loader.IsExternalRefsAllowed {
		err = fmt.Errorf("encountered disallowed external reference: %q", ref)
	}
	return
}

func (loader *Loader) loadSingleElementFromURI(ref string, rootPath *url.URL, element any) (*url.URL, error) {
	if err := loader.allowsExternalRefs(ref); err != nil {
		return nil, err
	}

	resolvedPath, err := resolvePathWithRef(ref, rootPath)
	if err != nil {
		return nil, err
	}
	if frag := resolvedPath.Fragment; frag != "" {
		return nil, fmt.Errorf("unexpected ref fragment %q", frag)
	}

	data, err := loader.readURL(resolvedPath)
	if err != nil {
		return nil, err
	}
	if err := unmarshal(data, element, IncludeOrigin); err != nil {
		return nil, err
	}

	return resolvedPath, nil
}

func (loader *Loader) readURL(location *url.URL) ([]byte, error) {
	if f := loader.ReadFromURIFunc; f != nil {
		return f(loader, location)
	}
	return DefaultReadFromURI(loader, location)
}

// LoadFromStdin loads a spec from stdin
func (loader *Loader) LoadFromStdin() (*T, error) {
	return loader.LoadFromIoReader(os.Stdin)
}

// LoadFromStdin loads a spec from io.Reader
func (loader *Loader) LoadFromIoReader(reader io.Reader) (*T, error) {
	if reader == nil {
		return nil, fmt.Errorf("invalid reader: %v", reader)
	}

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}
	return loader.LoadFromData(data)
}

// LoadFromData loads a spec from a byte array
func (loader *Loader) LoadFromData(data []byte) (*T, error) {
	loader.resetVisitedPathItemRefs()
	doc := &T{}
	if err := unmarshal(data, doc, IncludeOrigin); err != nil {
		return nil, err
	}
	if err := loader.ResolveRefsIn(doc, nil); err != nil {
		return nil, err
	}
	return doc, nil
}

// LoadFromDataWithPath takes the OpenAPI document data in bytes and a path where the resolver can find referred
// elements and returns a *T with all resolved data or an error if unable to load data or resolve refs.
func (loader *Loader) LoadFromDataWithPath(data []byte, location *url.URL) (*T, error) {
	loader.resetVisitedPathItemRefs()
	return loader.loadFromDataWithPathInternal(data, location)
}

func (loader *Loader) loadFromDataWithPathInternal(data []byte, location *url.URL) (*T, error) {
	if loader.visitedDocuments == nil {
		loader.visitedDocuments = make(map[string]*T)
		loader.rootLocation = location.Path
	}
	uri := location.String()
	if doc, ok := loader.visitedDocuments[uri]; ok {
		return doc, nil
	}

	doc := &T{}
	loader.visitedDocuments[uri] = doc

	if err := unmarshal(data, doc, IncludeOrigin); err != nil {
		return nil, err
	}

	doc.url = copyURI(location)

	if err := loader.ResolveRefsIn(doc, location); err != nil {
		return nil, err
	}

	return doc, nil
}

// ResolveRefsIn expands references if for instance spec was just unmarshaled
func (loader *Loader) ResolveRefsIn(doc *T, location *url.URL) (err error) {
	if loader.Context == nil {
		loader.Context = context.Background()
	}

	if loader.visitedPathItemRefs == nil {
		loader.resetVisitedPathItemRefs()
	}

	if components := doc.Components; components != nil {
		for _, name := range componentNames(components.Headers) {
			component := components.Headers[name]
			if err = loader.resolveHeaderRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.Parameters) {
			component := components.Parameters[name]
			if err = loader.resolveParameterRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.RequestBodies) {
			component := components.RequestBodies[name]
			if err = loader.resolveRequestBodyRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.Responses) {
			component := components.Responses[name]
			if err = loader.resolveResponseRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.Schemas) {
			component := components.Schemas[name]
			if err = loader.resolveSchemaRef(doc, component, location, []string{}); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.SecuritySchemes) {
			component := components.SecuritySchemes[name]
			if err = loader.resolveSecuritySchemeRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.Examples) {
			component := components.Examples[name]
			if err = loader.resolveExampleRef(doc, component, location); err != nil {
				return
			}
		}
		for _, name := range componentNames(components.Callbacks) {
			component := components.Callbacks[name]
			if err = loader.resolveCallbackRef(doc, component, location); err != nil {
				return
			}
		}
	}

	// Visit all operations
	pathItems := doc.Paths.Map()
	for _, name := range componentNames(pathItems) {
		pathItem := pathItems[name]
		if pathItem == nil {
			continue
		}
		if err = loader.resolvePathItemRef(doc, pathItem, location); err != nil {
			return
		}
	}

	return
}

func join(basePath *url.URL, relativePath *url.URL) *url.URL {
	if basePath == nil {
		return relativePath
	}
	newPath := *basePath
	newPath.Path = path.Join(path.Dir(newPath.Path), relativePath.Path)
	return &newPath
}

func resolvePath(basePath *url.URL, componentPath *url.URL) *url.URL {
	if is_file(componentPath) {
		// support absolute paths
		if filepath.IsAbs(componentPath.Path) {
			return componentPath
		}
		return join(basePath, componentPath)
	}
	return componentPath
}

func resolvePathWithRef(ref string, rootPath *url.URL) (*url.URL, error) {
	parsedURL, err := url.Parse(ref)
	if err != nil {
		return nil, fmt.Errorf("cannot parse reference: %q: %w", ref, err)
	}

	resolvedPath := resolvePath(rootPath, parsedURL)
	resolvedPath.Fragment = parsedURL.Fragment
	return resolvedPath, nil
}

func (loader *Loader) resolveRefPath(ref string, path *url.URL) (*url.URL, error) {
	if ref != "" && ref[0] == '#' {
		path = copyURI(path)
		// Resolving internal refs of a doc loaded from memory
		// has no path, so just set the Fragment.
		if path == nil {
			path = new(url.URL)
		}

		path.Fragment = ref
		return path, nil
	}

	if err := loader.allowsExternalRefs(ref); err != nil {
		return nil, err
	}

	resolvedPath, err := resolvePathWithRef(ref, path)
	if err != nil {
		return nil, err
	}

	return resolvedPath, nil
}

func isSingleRefElement(ref string) bool {
	return !strings.Contains(ref, "#")
}

func (loader *Loader) visitRef(ref string) {
	if loader.visitedRefs == nil {
		loader.visitedRefs = make(map[string]struct{})
		loader.backtrack = make(map[string][]func(value any))
	}
	loader.visitedPath = append(loader.visitedPath, ref)
	loader.visitedRefs[ref] = struct{}{}
}

func (loader *Loader) unvisitRef(ref string, value any) {
	if value != nil {
		for _, fn := range loader.backtrack[ref] {
			fn(value)
		}
	}
	delete(loader.visitedRefs, ref)
	delete(loader.backtrack, ref)
	loader.visitedPath = loader.visitedPath[:len(loader.visitedPath)-1]
}

func (loader *Loader) shouldVisitRef(ref string, fn func(value any)) bool {
	if _, ok := loader.visitedRefs[ref]; ok {
		loader.backtrack[ref] = append(loader.backtrack[ref], fn)
		return false
	}
	return true
}

func (loader *Loader) resolveComponent(doc *T, ref string, path *url.URL, resolved any) (
	componentDoc *T,
	componentPath *url.URL,
	err error,
) {
	if componentDoc, ref, componentPath, err = loader.resolveRefAndDocument(doc, ref, path); err != nil {
		return nil, nil, err
	}

	parsedURL, err := url.Parse(ref)
	if err != nil {
		return nil, nil, fmt.Errorf("cannot parse reference: %q: %v", ref, parsedURL)
	}
	fragment := parsedURL.Fragment
	if fragment == "" {
		fragment = "/"
	}
	if fragment[0] != '/' {
		return nil, nil, fmt.Errorf("expected fragment prefix '#/' in URI %q", ref)
	}

	drill := func(cursor any) (any, error) {
		for _, pathPart := range strings.Split(fragment[1:], "/") {
			pathPart = unescapeRefString(pathPart)
			attempted := false

			switch c := cursor.(type) {
			// Special case of T
			// See issue856: a ref to doc => we assume that doc is a T => things live in T.Extensions
			case *T:
				if pathPart == "" {
					cursor = c.Extensions
					attempted = true
				}

			// Special case due to multijson
			case *SchemaRef:
				if pathPart == "additionalProperties" {
					if ap := c.Value.AdditionalProperties.Has; ap != nil {
						cursor = *ap
					} else {
						cursor = c.Value.AdditionalProperties.Schema
					}
					attempted = true
				}

			case *Responses:
				cursor = c.m // m map[string]*ResponseRef
			case *Callback:
				cursor = c.m // m map[string]*PathItem
			case *Paths:
				cursor = c.m // m map[string]*PathItem
			}

			if !attempted {
				if cursor, err = drillIntoField(cursor, pathPart); err != nil {
					e := failedToResolveRefFragmentPart(ref, pathPart)
					return nil, fmt.Errorf("%s: %w", e, err)
				}
			}

			if cursor == nil {
				return nil, failedToResolveRefFragmentPart(ref, pathPart)
			}
		}
		return cursor, nil
	}
	var cursor any
	if cursor, err = drill(componentDoc); err != nil {
		if path == nil {
			return nil, nil, err
		}
		var err2 error
		data, err2 := loader.readURL(path)
		if err2 != nil {
			return nil, nil, err
		}
		if err2 = unmarshal(data, &cursor, IncludeOrigin); err2 != nil {
			return nil, nil, err
		}
		if cursor, err2 = drill(cursor); err2 != nil || cursor == nil {
			return nil, nil, err
		}
		err = nil
	}

	setPathRef := func(target any) {
		if i, ok := target.(interface {
			setRefPath(*url.URL)
		}); ok {
			pathRef := copyURI(componentPath)
			// Resolving internal refs of a doc loaded from memory
			// has no path, so just set the Fragment.
			if pathRef == nil {
				pathRef = new(url.URL)
			}
			pathRef.Fragment = fragment

			i.setRefPath(pathRef)
		}
	}

	switch {
	case reflect.TypeOf(cursor) == reflect.TypeOf(resolved):
		setPathRef(cursor)

		reflect.ValueOf(resolved).Elem().Set(reflect.ValueOf(cursor).Elem())
		return componentDoc, componentPath, nil

	case reflect.TypeOf(cursor) == reflect.TypeOf(map[string]any{}):
		codec := func(got, expect any) error {
			enc, err := json.Marshal(got)
			if err != nil {
				return err
			}
			if err = json.Unmarshal(enc, expect); err != nil {
				return err
			}

			setPathRef(expect)
			return nil
		}
		if err := codec(cursor, resolved); err != nil {
			return nil, nil, fmt.Errorf("bad data in %q (expecting %s)", ref, readableType(resolved))
		}
		return componentDoc, componentPath, nil

	default:
		return nil, nil, fmt.Errorf("bad data in %q (expecting %s)", ref, readableType(resolved))
	}
}

func readableType(x any) string {
	switch x.(type) {
	case *Callback:
		return "callback object"
	case *CallbackRef:
		return "ref to callback object"
	case *ExampleRef:
		return "ref to example object"
	case *HeaderRef:
		return "ref to header object"
	case *LinkRef:
		return "ref to link object"
	case *ParameterRef:
		return "ref to parameter object"
	case *PathItem:
		return "pathItem object"
	case *RequestBodyRef:
		return "ref to requestBody object"
	case *ResponseRef:
		return "ref to response object"
	case *SchemaRef:
		return "ref to schema object"
	case *SecuritySchemeRef:
		return "ref to securityScheme object"
	default:
		panic(fmt.Sprintf("unreachable %T", x))
	}
}

func drillIntoField(cursor any, fieldName string) (any, error) {
	switch val := reflect.Indirect(reflect.ValueOf(cursor)); val.Kind() {

	case reflect.Map:
		elementValue := val.MapIndex(reflect.ValueOf(fieldName))
		if !elementValue.IsValid() {
			return nil, fmt.Errorf("map key %q not found", fieldName)
		}
		return elementValue.Interface(), nil

	case reflect.Slice:
		i, err := strconv.ParseUint(fieldName, 10, 32)
		if err != nil {
			return nil, err
		}
		index := int(i)
		if 0 > index || index >= val.Len() {
			return nil, errors.New("slice index out of bounds")
		}
		return val.Index(index).Interface(), nil

	case reflect.Struct:
		hasFields := false
		for i := 0; i < val.NumField(); i++ {
			hasFields = true
			if yamlTag := val.Type().Field(i).Tag.Get("yaml"); yamlTag != "-" {
				if tagName := strings.Split(yamlTag, ",")[0]; tagName != "" {
					if fieldName == tagName {
						return val.Field(i).Interface(), nil
					}
				}
			}
		}

		// if cursor is a "ref wrapper" struct (e.g. RequestBodyRef),
		if _, ok := val.Type().FieldByName("Value"); ok {
			// try digging into its Value field
			return drillIntoField(val.FieldByName("Value").Interface(), fieldName)
		}
		if hasFields {
			if ff := val.Type().Field(0); ff.PkgPath == "" && ff.Name == "Extensions" {
				extensions := val.Field(0).Interface().(map[string]any)
				if enc, ok := extensions[fieldName]; ok {
					return enc, nil
				}
			}
		}
		return nil, fmt.Errorf("struct field %q not found", fieldName)

	default:
		return nil, errors.New("not a map, slice nor struct")
	}
}

func (loader *Loader) resolveRefAndDocument(doc *T, ref string, path *url.URL) (*T, string, *url.URL, error) {
	if ref != "" && ref[0] == '#' {
		return doc, ref, path, nil
	}

	fragment, resolvedPath, err := loader.resolveRef(ref, path)
	if err != nil {
		return nil, "", nil, err
	}

	if doc, err = loader.loadFromURIInternal(resolvedPath); err != nil {
		return nil, "", nil, fmt.Errorf("error resolving reference %q: %w", ref, err)
	}

	return doc, fragment, resolvedPath, nil
}

func (loader *Loader) resolveRef(ref string, path *url.URL) (string, *url.URL, error) {
	resolvedPathRef, err := loader.resolveRefPath(ref, path)
	if err != nil {
		return "", nil, err
	}

	fragment := "#" + resolvedPathRef.Fragment
	resolvedPathRef.Fragment = ""
	return fragment, resolvedPathRef, nil
}

var (
	errMUSTCallback       = errors.New("invalid callback: value MUST be an object")
	errMUSTExample        = errors.New("invalid example: value MUST be an object")
	errMUSTHeader         = errors.New("invalid header: value MUST be an object")
	errMUSTLink           = errors.New("invalid link: value MUST be an object")
	errMUSTParameter      = errors.New("invalid parameter: value MUST be an object")
	errMUSTPathItem       = errors.New("invalid path item: value MUST be an object")
	errMUSTRequestBody    = errors.New("invalid requestBody: value MUST be an object")
	errMUSTResponse       = errors.New("invalid response: value MUST be an object")
	errMUSTSchema         = errors.New("invalid schema: value MUST be an object")
	errMUSTSecurityScheme = errors.New("invalid securityScheme: value MUST be an object")
)

func (loader *Loader) resolveHeaderRef(doc *T, component *HeaderRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTHeader
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Header)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var header Header
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &header); err != nil {
				return err
			}
			component.Value = &header
			component.setRefPath(documentPath)
		} else {
			var resolved HeaderRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveHeaderRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTHeader {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	if schema := value.Schema; schema != nil {
		if err := loader.resolveSchemaRef(doc, schema, documentPath, []string{}); err != nil {
			return err
		}
	}
	return nil
}

func (loader *Loader) resolveParameterRef(doc *T, component *ParameterRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTParameter
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Parameter)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var param Parameter
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &param); err != nil {
				return err
			}
			component.Value = &param
			component.setRefPath(documentPath)
		} else {
			var resolved ParameterRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveParameterRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTParameter {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	if value.Content != nil && value.Schema != nil {
		return errors.New("cannot contain both schema and content in a parameter")
	}
	for _, name := range componentNames(value.Content) {
		contentType := value.Content[name]
		if schema := contentType.Schema; schema != nil {
			if err := loader.resolveSchemaRef(doc, schema, documentPath, []string{}); err != nil {
				return err
			}
		}
	}
	if schema := value.Schema; schema != nil {
		if err := loader.resolveSchemaRef(doc, schema, documentPath, []string{}); err != nil {
			return err
		}
	}
	return nil
}

func (loader *Loader) resolveRequestBodyRef(doc *T, component *RequestBodyRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTRequestBody
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*RequestBody)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var requestBody RequestBody
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &requestBody); err != nil {
				return err
			}
			component.Value = &requestBody
			component.setRefPath(documentPath)
		} else {
			var resolved RequestBodyRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err = loader.resolveRequestBodyRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTRequestBody {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	for _, name := range componentNames(value.Content) {
		contentType := value.Content[name]
		if contentType == nil {
			continue
		}
		for _, name := range componentNames(contentType.Examples) {
			example := contentType.Examples[name]
			if err := loader.resolveExampleRef(doc, example, documentPath); err != nil {
				return err
			}
			contentType.Examples[name] = example
		}
		if schema := contentType.Schema; schema != nil {
			if err := loader.resolveSchemaRef(doc, schema, documentPath, []string{}); err != nil {
				return err
			}
		}
	}
	return nil
}

func (loader *Loader) resolveResponseRef(doc *T, component *ResponseRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTResponse
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Response)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var resp Response
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &resp); err != nil {
				return err
			}
			component.Value = &resp
			component.setRefPath(documentPath)
		} else {
			var resolved ResponseRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveResponseRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTResponse {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	for _, name := range componentNames(value.Headers) {
		header := value.Headers[name]
		if err := loader.resolveHeaderRef(doc, header, documentPath); err != nil {
			return err
		}
	}
	for _, name := range componentNames(value.Content) {
		contentType := value.Content[name]
		if contentType == nil {
			continue
		}
		for _, name := range componentNames(contentType.Examples) {
			example := contentType.Examples[name]
			if err := loader.resolveExampleRef(doc, example, documentPath); err != nil {
				return err
			}
			contentType.Examples[name] = example
		}
		if schema := contentType.Schema; schema != nil {
			if err := loader.resolveSchemaRef(doc, schema, documentPath, []string{}); err != nil {
				return err
			}
			contentType.Schema = schema
		}
	}
	for _, name := range componentNames(value.Links) {
		link := value.Links[name]
		if err := loader.resolveLinkRef(doc, link, documentPath); err != nil {
			return err
		}
	}
	return nil
}

func (loader *Loader) resolveSchemaRef(doc *T, component *SchemaRef, documentPath *url.URL, visited []string) (err error) {
	if component.isEmpty() {
		return errMUSTSchema
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Schema)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var schema Schema
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &schema); err != nil {
				return err
			}
			component.Value = &schema
			component.setRefPath(documentPath)
		} else {
			var resolved SchemaRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveSchemaRef(doc, &resolved, componentPath, visited); err != nil {
				if err == errMUSTSchema {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	// ResolveRefs referred schemas
	if v := value.Items; v != nil {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	for _, name := range componentNames(value.Properties) {
		v := value.Properties[name]
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	if v := value.AdditionalProperties.Schema; v != nil {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	if v := value.Not; v != nil {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	for _, v := range value.AllOf {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	for _, v := range value.AnyOf {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	for _, v := range value.OneOf {
		if err := loader.resolveSchemaRef(doc, v, documentPath, visited); err != nil {
			return err
		}
	}
	return nil
}

func (loader *Loader) resolveSecuritySchemeRef(doc *T, component *SecuritySchemeRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTSecurityScheme
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*SecurityScheme)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var scheme SecurityScheme
			if _, err = loader.loadSingleElementFromURI(ref, documentPath, &scheme); err != nil {
				return err
			}
			component.Value = &scheme
			component.setRefPath(documentPath)
		} else {
			var resolved SecuritySchemeRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveSecuritySchemeRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTSecurityScheme {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	return nil
}

func (loader *Loader) resolveExampleRef(doc *T, component *ExampleRef, documentPath *url.URL) (err error) {
	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Example)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var example Example
			if _, err = loader.loadSingleElementFromURI(ref, documentPath, &example); err != nil {
				return err
			}
			component.Value = &example
			component.setRefPath(documentPath)
		} else {
			var resolved ExampleRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveExampleRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTExample {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	return nil
}

func (loader *Loader) resolveCallbackRef(doc *T, component *CallbackRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTCallback
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Callback)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var resolved Callback
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &resolved); err != nil {
				return err
			}
			component.Value = &resolved
			component.setRefPath(documentPath)
		} else {
			var resolved CallbackRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err = loader.resolveCallbackRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTCallback {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	value := component.Value
	if value == nil {
		return nil
	}

	pathItems := value.Map()
	for _, name := range componentNames(pathItems) {
		pathItem := pathItems[name]
		if err = loader.resolvePathItemRef(doc, pathItem, documentPath); err != nil {
			return err
		}
	}
	return nil
}

func (loader *Loader) resolveLinkRef(doc *T, component *LinkRef, documentPath *url.URL) (err error) {
	if component.isEmpty() {
		return errMUSTLink
	}

	if ref := component.Ref; ref != "" {
		if component.Value != nil {
			return nil
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			component.Value = value.(*Link)
			refPath, _ := loader.resolveRefPath(ref, documentPath)
			component.setRefPath(refPath)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var link Link
			if _, err = loader.loadSingleElementFromURI(ref, documentPath, &link); err != nil {
				return err
			}
			component.Value = &link
			component.setRefPath(documentPath)
		} else {
			var resolved LinkRef
			doc, componentPath, err := loader.resolveComponent(doc, ref, documentPath, &resolved)
			if err != nil {
				return err
			}
			if err := loader.resolveLinkRef(doc, &resolved, componentPath); err != nil {
				if err == errMUSTLink {
					return nil
				}
				return err
			}
			component.Value = resolved.Value
			component.setRefPath(resolved.RefPath())
		}
		defer loader.unvisitRef(ref, component.Value)
	}
	return nil
}

func (loader *Loader) resolvePathItemRef(doc *T, pathItem *PathItem, documentPath *url.URL) (err error) {
	if pathItem == nil {
		err = errMUSTPathItem
		return
	}

	if ref := pathItem.Ref; ref != "" {
		if !pathItem.isEmpty() {
			return
		}
		if !loader.shouldVisitRef(ref, func(value any) {
			*pathItem = *value.(*PathItem)
		}) {
			return nil
		}
		loader.visitRef(ref)
		if isSingleRefElement(ref) {
			var p PathItem
			if documentPath, err = loader.loadSingleElementFromURI(ref, documentPath, &p); err != nil {
				return
			}
			*pathItem = p
		} else {
			var resolved PathItem
			if doc, documentPath, err = loader.resolveComponent(doc, ref, documentPath, &resolved); err != nil {
				if err == errMUSTPathItem {
					return nil
				}
				return
			}
			*pathItem = resolved
		}
		pathItem.Ref = ref
		defer loader.unvisitRef(ref, pathItem)
	}

	for _, parameter := range pathItem.Parameters {
		if err = loader.resolveParameterRef(doc, parameter, documentPath); err != nil {
			return
		}
	}
	operations := pathItem.Operations()
	for _, name := range componentNames(operations) {
		operation := operations[name]
		for _, parameter := range operation.Parameters {
			if err = loader.resolveParameterRef(doc, parameter, documentPath); err != nil {
				return
			}
		}
		if requestBody := operation.RequestBody; requestBody != nil {
			if err = loader.resolveRequestBodyRef(doc, requestBody, documentPath); err != nil {
				return
			}
		}
		responses := operation.Responses.Map()
		for _, name := range componentNames(responses) {
			response := responses[name]
			if err = loader.resolveResponseRef(doc, response, documentPath); err != nil {
				return
			}
		}
		for _, name := range componentNames(operation.Callbacks) {
			callback := operation.Callbacks[name]
			if err = loader.resolveCallbackRef(doc, callback, documentPath); err != nil {
				return
			}
		}
	}
	return
}

func unescapeRefString(ref string) string {
	return strings.Replace(strings.Replace(ref, "~1", "/", -1), "~0", "~", -1)
}
