package openapi3

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// Paths is specified by OpenAPI/Swagger standard version 3.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#paths-object
type Paths struct {
	Extensions map[string]any `json:"-" yaml:"-"`
	Origin     *Origin        `json:"__origin__,omitempty" yaml:"__origin__,omitempty"`

	m map[string]*PathItem
}

// NewPaths builds a paths object with path items in insertion order.
func NewPaths(opts ...NewPathsOption) *Paths {
	paths := NewPathsWithCapacity(len(opts))
	for _, opt := range opts {
		opt(paths)
	}
	return paths
}

// NewPathsOption describes options to NewPaths func
type NewPathsOption func(*Paths)

// WithPath adds a named path item
func WithPath(path string, pathItem *PathItem) NewPathsOption {
	return func(paths *Paths) {
		if p := pathItem; p != nil && path != "" {
			paths.Set(path, p)
		}
	}
}

// Validate returns an error if Paths does not comply with the OpenAPI spec.
func (paths *Paths) Validate(ctx context.Context, opts ...ValidationOption) error {
	ctx = WithValidationOptions(ctx, opts...)

	normalizedPaths := make(map[string]string, paths.Len())

	keys := make([]string, 0, paths.Len())
	for key := range paths.Map() {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, path := range keys {
		pathItem := paths.Value(path)
		if path == "" || path[0] != '/' {
			return fmt.Errorf("path %q does not start with a forward slash (/)", path)
		}

		if pathItem == nil {
			pathItem = &PathItem{}
			paths.Set(path, pathItem)
		}

		normalizedPath, _, varsInPath := normalizeTemplatedPath(path)
		if oldPath, ok := normalizedPaths[normalizedPath]; ok {
			return fmt.Errorf("conflicting paths %q and %q", path, oldPath)
		}
		normalizedPaths[path] = path

		var commonParams []string
		for _, parameterRef := range pathItem.Parameters {
			if parameterRef != nil {
				if parameter := parameterRef.Value; parameter != nil && parameter.In == ParameterInPath {
					commonParams = append(commonParams, parameter.Name)
				}
			}
		}
		operations := pathItem.Operations()
		methods := make([]string, 0, len(operations))
		for method := range operations {
			methods = append(methods, method)
		}
		sort.Strings(methods)
		for _, method := range methods {
			operation := operations[method]
			var setParams []string
			for _, parameterRef := range operation.Parameters {
				if parameterRef != nil {
					if parameter := parameterRef.Value; parameter != nil && parameter.In == ParameterInPath {
						setParams = append(setParams, parameter.Name)
					}
				}
			}
			if expected := len(setParams) + len(commonParams); expected != len(varsInPath) {
				expected -= len(varsInPath)
				if expected < 0 {
					expected *= -1
				}
				missing := make(map[string]struct{}, expected)
				definedParams := append(setParams, commonParams...)
				for _, name := range definedParams {
					if _, ok := varsInPath[name]; !ok {
						missing[name] = struct{}{}
					}
				}
				for name := range varsInPath {
					got := false
					for _, othername := range definedParams {
						if othername == name {
							got = true
							break
						}
					}
					if !got {
						missing[name] = struct{}{}
					}
				}
				if len(missing) != 0 {
					missings := make([]string, 0, len(missing))
					for name := range missing {
						missings = append(missings, name)
					}
					return fmt.Errorf("operation %s %s must define exactly all path parameters (missing: %v)", method, path, missings)
				}
			}
		}

		if err := pathItem.Validate(ctx); err != nil {
			return fmt.Errorf("invalid path %s: %v", path, err)
		}
	}

	if err := paths.validateUniqueOperationIDs(); err != nil {
		return err
	}

	return validateExtensions(ctx, paths.Extensions)
}

// InMatchingOrder returns paths in the order they are matched against URLs.
// See https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#paths-object
// When matching URLs, concrete (non-templated) paths would be matched
// before their templated counterparts.
func (paths *Paths) InMatchingOrder() []string {
	// NOTE: sorting by number of variables ASC then by descending lexicographical
	// order seems to be a good heuristic.
	if paths.Len() == 0 {
		return nil
	}

	vars := make(map[int][]string)
	max := 0
	for path := range paths.Map() {
		count := strings.Count(path, "}")
		vars[count] = append(vars[count], path)
		if count > max {
			max = count
		}
	}

	ordered := make([]string, 0, paths.Len())
	for c := 0; c <= max; c++ {
		if ps, ok := vars[c]; ok {
			sort.Sort(sort.Reverse(sort.StringSlice(ps)))
			ordered = append(ordered, ps...)
		}
	}
	return ordered
}

// Find returns a path that matches the key.
//
// The method ignores differences in template variable names (except possible "*" suffix).
//
// For example:
//
//	paths := openapi3.Paths {
//	  "/person/{personName}": &openapi3.PathItem{},
//	}
//	pathItem := path.Find("/person/{name}")
//
// would return the correct path item.
func (paths *Paths) Find(key string) *PathItem {
	// Try directly access the map
	pathItem := paths.Value(key)
	if pathItem != nil {
		return pathItem
	}

	normalizedPath, expected, _ := normalizeTemplatedPath(key)
	for path, pathItem := range paths.Map() {
		pathNormalized, got, _ := normalizeTemplatedPath(path)
		if got == expected && pathNormalized == normalizedPath {
			return pathItem
		}
	}
	return nil
}

func (paths *Paths) validateUniqueOperationIDs() error {
	operationIDs := make(map[string]string)
	for urlPath, pathItem := range paths.Map() {
		if pathItem == nil {
			continue
		}
		for httpMethod, operation := range pathItem.Operations() {
			if operation == nil || operation.OperationID == "" {
				continue
			}
			endpoint := httpMethod + " " + urlPath
			if endpointDup, ok := operationIDs[operation.OperationID]; ok {
				if endpoint > endpointDup { // For make error message a bit more deterministic. May be useful for tests.
					endpoint, endpointDup = endpointDup, endpoint
				}
				return fmt.Errorf("operations %q and %q have the same operation id %q",
					endpoint, endpointDup, operation.OperationID)
			}
			operationIDs[operation.OperationID] = endpoint
		}
	}
	return nil
}

func normalizeTemplatedPath(path string) (string, uint, map[string]struct{}) {
	if strings.IndexByte(path, '{') < 0 {
		return path, 0, nil
	}

	var buffTpl strings.Builder
	buffTpl.Grow(len(path))

	var (
		cc         rune
		count      uint
		isVariable bool
		vars       = make(map[string]struct{})
		buffVar    strings.Builder
	)
	for i, c := range path {
		if isVariable {
			if c == '}' {
				// End path variable
				isVariable = false

				vars[buffVar.String()] = struct{}{}
				buffVar = strings.Builder{}

				// First append possible '*' before this character
				// The character '}' will be appended
				if i > 0 && cc == '*' {
					buffTpl.WriteRune(cc)
				}
			} else {
				buffVar.WriteRune(c)
				continue
			}

		} else if c == '{' {
			// Begin path variable
			isVariable = true

			// The character '{' will be appended
			count++
		}

		// Append the character
		buffTpl.WriteRune(c)
		cc = c
	}
	return buffTpl.String(), count, vars
}
