// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package spec

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"reflect"
	"strings"

	"github.com/go-openapi/swag/jsonutils"
	"github.com/go-openapi/swag/loading"
	"github.com/go-openapi/swag/stringutils"
)

// PathLoader is a function to use when loading remote refs.
//
// This is a package level default. It may be overridden or bypassed by
// specifying the loader in ExpandOptions.
//
// NOTE: if you are using the go-openapi/loads package, it will override
// this value with its own default (a loader to retrieve YAML documents as
// well as JSON ones).
var PathLoader = func(pth string) (json.RawMessage, error) {
	data, err := loading.LoadFromFileOrHTTP(pth)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(data), nil
}

// resolverContext allows to share a context during spec processing.
// At the moment, it just holds the index of circular references found.
type resolverContext struct {
	// circulars holds all visited circular references, to shortcircuit $ref resolution.
	//
	// This structure is privately instantiated and needs not be locked against
	// concurrent access, unless we chose to implement a parallel spec walking.
	circulars map[string]bool
	basePath  string
	loadDoc   func(string) (json.RawMessage, error)
	rootID    string
}

func newResolverContext(options *ExpandOptions) *resolverContext {
	expandOptions := optionsOrDefault(options)

	// path loader may be overridden by options
	var loader func(string) (json.RawMessage, error)
	if expandOptions.PathLoader == nil {
		loader = PathLoader
	} else {
		loader = expandOptions.PathLoader
	}

	return &resolverContext{
		circulars: make(map[string]bool),
		basePath:  expandOptions.RelativeBase, // keep the root base path in context
		loadDoc:   loader,
	}
}

type schemaLoader struct {
	root    any
	options *ExpandOptions
	cache   ResolutionCache
	context *resolverContext
}

// Resolve resolves a reference against basePath and stores the result in target.
//
// Resolve is not in charge of following references: it only resolves ref by following its URL.
//
// If the schema the ref is referring to holds nested refs, Resolve doesn't resolve them.
//
// If basePath is an empty string, ref is resolved against the root schema stored in the schemaLoader struct
func (r *schemaLoader) Resolve(ref *Ref, target any, basePath string) error {
	return r.resolveRef(ref, target, basePath)
}

func (r *schemaLoader) transitiveResolver(basePath string, ref Ref) *schemaLoader {
	if ref.IsRoot() || ref.HasFragmentOnly {
		return r
	}

	baseRef := MustCreateRef(basePath)
	currentRef := normalizeRef(&ref, basePath)
	if strings.HasPrefix(currentRef.String(), baseRef.String()) {
		return r
	}

	// set a new root against which to resolve
	rootURL := currentRef.GetURL()
	rootURL.Fragment = ""
	root, _ := r.cache.Get(rootURL.String())

	// shallow copy of resolver options to set a new RelativeBase when
	// traversing multiple documents
	newOptions := r.options
	newOptions.RelativeBase = rootURL.String()

	return defaultSchemaLoader(root, newOptions, r.cache, r.context)
}

func (r *schemaLoader) updateBasePath(transitive *schemaLoader, basePath string) string {
	if transitive != r {
		if transitive.options != nil && transitive.options.RelativeBase != "" {
			return normalizeBase(transitive.options.RelativeBase)
		}
	}

	return basePath
}

func (r *schemaLoader) resolveRef(ref *Ref, target any, basePath string) error {
	tgt := reflect.ValueOf(target)
	if tgt.Kind() != reflect.Ptr {
		return ErrResolveRefNeedsAPointer
	}

	if ref.GetURL() == nil {
		return nil
	}

	var (
		res  any
		data any
		err  error
	)

	// Resolve against the root if it isn't nil, and if ref is pointing at the root, or has a fragment only which means
	// it is pointing somewhere in the root.
	root := r.root
	if (ref.IsRoot() || ref.HasFragmentOnly) && root == nil && basePath != "" {
		if baseRef, erb := NewRef(basePath); erb == nil {
			root, _, _, _ = r.load(baseRef.GetURL())
		}
	}

	if (ref.IsRoot() || ref.HasFragmentOnly) && root != nil {
		data = root
	} else {
		baseRef := normalizeRef(ref, basePath)
		data, _, _, err = r.load(baseRef.GetURL())
		if err != nil {
			return err
		}
	}

	res = data
	if ref.String() != "" {
		res, _, err = ref.GetPointer().Get(data)
		if err != nil {
			return err
		}
	}
	return jsonutils.FromDynamicJSON(res, target)
}

func (r *schemaLoader) load(refURL *url.URL) (any, url.URL, bool, error) {
	debugLog("loading schema from url: %s", refURL)
	toFetch := *refURL
	toFetch.Fragment = ""

	var err error
	pth := toFetch.String()
	normalized := normalizeBase(pth)
	debugLog("loading doc from: %s", normalized)

	data, fromCache := r.cache.Get(normalized)
	if fromCache {
		return data, toFetch, fromCache, nil
	}

	b, err := r.context.loadDoc(normalized)
	if err != nil {
		return nil, url.URL{}, false, err
	}

	var doc any
	if err := json.Unmarshal(b, &doc); err != nil {
		return nil, url.URL{}, false, err
	}
	r.cache.Set(normalized, doc)

	return doc, toFetch, fromCache, nil
}

// isCircular detects cycles in sequences of $ref.
//
// It relies on a private context (which needs not be locked).
func (r *schemaLoader) isCircular(ref *Ref, basePath string, parentRefs ...string) (foundCycle bool) {
	normalizedRef := normalizeURI(ref.String(), basePath)
	if _, ok := r.context.circulars[normalizedRef]; ok {
		// circular $ref has been already detected in another explored cycle
		foundCycle = true
		return
	}
	foundCycle = stringutils.ContainsStrings(parentRefs, normalizedRef) // normalized windows url's are lower cased
	if foundCycle {
		r.context.circulars[normalizedRef] = true
	}
	return
}

func (r *schemaLoader) deref(input any, parentRefs []string, basePath string) error {
	var ref *Ref
	switch refable := input.(type) {
	case *Schema:
		ref = &refable.Ref
	case *Parameter:
		ref = &refable.Ref
	case *Response:
		ref = &refable.Ref
	case *PathItem:
		ref = &refable.Ref
	default:
		return fmt.Errorf("unsupported type: %T: %w", input, ErrDerefUnsupportedType)
	}

	curRef := ref.String()
	if curRef == "" {
		return nil
	}

	normalizedRef := normalizeRef(ref, basePath)
	normalizedBasePath := normalizedRef.RemoteURI()

	if r.isCircular(normalizedRef, basePath, parentRefs...) {
		return nil
	}

	if err := r.resolveRef(ref, input, basePath); r.shouldStopOnError(err) {
		return err
	}

	if ref.String() == "" || ref.String() == curRef {
		// done with rereferencing
		return nil
	}

	parentRefs = append(parentRefs, normalizedRef.String())
	return r.deref(input, parentRefs, normalizedBasePath)
}

func (r *schemaLoader) shouldStopOnError(err error) bool {
	if err != nil && !r.options.ContinueOnError {
		return true
	}

	if err != nil {
		log.Println(err)
	}

	return false
}

func (r *schemaLoader) setSchemaID(target any, id, basePath string) (string, string) {
	debugLog("schema has ID: %s", id)

	// handling the case when id is a folder
	// remember that basePath has to point to a file
	var refPath string
	if strings.HasSuffix(id, "/") {
		// ensure this is detected as a file, not a folder
		refPath = fmt.Sprintf("%s%s", id, "placeholder.json")
	} else {
		refPath = id
	}

	// updates the current base path
	// * important: ID can be a relative path
	// * registers target to be fetchable from the new base proposed by this id
	newBasePath := normalizeURI(refPath, basePath)

	// store found IDs for possible future reuse in $ref
	r.cache.Set(newBasePath, target)

	// the root document has an ID: all $ref relative to that ID may
	// be rebased relative to the root document
	if basePath == r.context.basePath {
		debugLog("root document is a schema with ID: %s (normalized as:%s)", id, newBasePath)
		r.context.rootID = newBasePath
	}

	return newBasePath, refPath
}

func defaultSchemaLoader(
	root any,
	expandOptions *ExpandOptions,
	cache ResolutionCache,
	context *resolverContext) *schemaLoader {

	if expandOptions == nil {
		expandOptions = &ExpandOptions{}
	}

	cache = cacheOrDefault(cache)

	if expandOptions.RelativeBase == "" {
		// if no relative base is provided, assume the root document
		// contains all $ref, or at least, that the relative documents
		// may be resolved from the current working directory.
		expandOptions.RelativeBase = baseForRoot(root, cache)
	}
	debugLog("effective expander options: %#v", expandOptions)

	if context == nil {
		context = newResolverContext(expandOptions)
	}

	return &schemaLoader{
		root:    root,
		options: expandOptions,
		cache:   cache,
		context: context,
	}
}
