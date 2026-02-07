// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package replace

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"strconv"

	"github.com/go-openapi/analysis/internal/debug"
	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/spec"
)

const (
	definitionsPath = "#/definitions"
	allocMediumMap  = 64
)

var debugLog = debug.GetLogger("analysis/flatten/replace", os.Getenv("SWAGGER_DEBUG") != "")

// RewriteSchemaToRef replaces a schema with a Ref
func RewriteSchemaToRef(sp *spec.Swagger, key string, ref spec.Ref) error {
	debugLog("rewriting schema to ref for %s with %s", key, ref.String())
	_, value, err := getPointerFromKey(sp, key)
	if err != nil {
		return err
	}

	switch refable := value.(type) {
	case *spec.Schema:
		return rewriteParentRef(sp, key, ref)

	case spec.Schema:
		return rewriteParentRef(sp, key, ref)

	case *spec.SchemaOrArray:
		if refable.Schema != nil {
			refable.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		}

	case *spec.SchemaOrBool:
		if refable.Schema != nil {
			refable.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		}
	case map[string]any: // this happens e.g. if a schema points to an extension unmarshaled as map[string]interface{}
		return rewriteParentRef(sp, key, ref)
	default:
		return ErrNoSchemaWithRef(key, value)
	}

	return nil
}

func rewriteParentRef(sp *spec.Swagger, key string, ref spec.Ref) error {
	parent, entry, pvalue, err := getParentFromKey(sp, key)
	if err != nil {
		return err
	}

	debugLog("rewriting holder for %T", pvalue)
	switch container := pvalue.(type) {
	case spec.Response:
		if err := rewriteParentRef(sp, "#"+parent, ref); err != nil {
			return err
		}

	case *spec.Response:
		container.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case *spec.Responses:
		statusCode, err := strconv.Atoi(entry)
		if err != nil {
			return ErrNotANumber(key[1:], err)
		}
		resp := container.StatusCodeResponses[statusCode]
		resp.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		container.StatusCodeResponses[statusCode] = resp

	case map[string]spec.Response:
		resp := container[entry]
		resp.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		container[entry] = resp

	case spec.Parameter:
		if err := rewriteParentRef(sp, "#"+parent, ref); err != nil {
			return err
		}

	case map[string]spec.Parameter:
		param := container[entry]
		param.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		container[entry] = param

	case []spec.Parameter:
		idx, err := strconv.Atoi(entry)
		if err != nil {
			return ErrNotANumber(key[1:], err)
		}
		param := container[idx]
		param.Schema = &spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}
		container[idx] = param

	case spec.Definitions:
		container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case map[string]spec.Schema:
		container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case []spec.Schema:
		idx, err := strconv.Atoi(entry)
		if err != nil {
			return ErrNotANumber(key[1:], err)
		}
		container[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case *spec.SchemaOrArray:
		// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
		idx, err := strconv.Atoi(entry)
		if err != nil {
			return ErrNotANumber(key[1:], err)
		}
		container.Schemas[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case spec.SchemaProperties:
		container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case *any:
		*container = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

	default:
		return ErrUnhandledParentRewrite(key, pvalue)
	}

	return nil
}

// getPointerFromKey retrieves the content of the JSON pointer "key"
func getPointerFromKey(sp any, key string) (string, any, error) {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic(ErrUnexpectedType)
	}
	if key == "#/" {
		return "", sp, nil
	}
	// unescape chars in key, e.g. "{}" from path params
	pth, _ := url.PathUnescape(key[1:])
	ptr, err := jsonpointer.New(pth)
	if err != nil {
		return "", nil, errors.Join(err, ErrReplace)
	}

	value, _, err := ptr.Get(sp)
	if err != nil {
		debugLog("error when getting key: %s with path: %s", key, pth)

		return "", nil, errors.Join(err, ErrReplace)
	}

	return pth, value, nil
}

// getParentFromKey retrieves the container of the JSON pointer "key"
func getParentFromKey(sp any, key string) (string, string, any, error) {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic(ErrUnexpectedType)
	}
	// unescape chars in key, e.g. "{}" from path params
	pth, _ := url.PathUnescape(key[1:])

	parent, entry := path.Dir(pth), path.Base(pth)
	debugLog("getting schema holder at: %s, with entry: %s", parent, entry)

	pptr, err := jsonpointer.New(parent)
	if err != nil {
		return "", "", nil, errors.Join(err, ErrReplace)
	}
	pvalue, _, err := pptr.Get(sp)
	if err != nil {
		return "", "", nil, ErrNoParent(parent, err)
	}

	return parent, entry, pvalue, nil
}

// UpdateRef replaces a ref by another one
func UpdateRef(sp any, key string, ref spec.Ref) error {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic(ErrUnexpectedType)
	}
	debugLog("updating ref for %s with %s", key, ref.String())
	pth, value, err := getPointerFromKey(sp, key)
	if err != nil {
		return err
	}

	switch refable := value.(type) {
	case *spec.Schema:
		refable.Ref = ref
	case *spec.SchemaOrArray:
		if refable.Schema != nil {
			refable.Schema.Ref = ref
		}
	case *spec.SchemaOrBool:
		if refable.Schema != nil {
			refable.Schema.Ref = ref
		}
	case spec.Schema:
		debugLog("rewriting holder for %T", refable)
		_, entry, pvalue, erp := getParentFromKey(sp, key)
		if erp != nil {
			return erp
		}
		switch container := pvalue.(type) {
		case spec.Definitions:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case map[string]spec.Schema:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case []spec.Schema:
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return ErrNotANumber(pth, err)
			}
			container[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case *spec.SchemaOrArray:
			// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return ErrNotANumber(pth, err)
			}
			container.Schemas[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case spec.SchemaProperties:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

		default:
			return ErrUnhandledContainerType(key, value)
		}

	default:
		return ErrNoSchemaWithRef(key, value)
	}

	return nil
}

// UpdateRefWithSchema replaces a ref with a schema (i.e. re-inline schema)
func UpdateRefWithSchema(sp *spec.Swagger, key string, sch *spec.Schema) error {
	debugLog("updating ref for %s with schema", key)
	pth, value, err := getPointerFromKey(sp, key)
	if err != nil {
		return err
	}

	switch refable := value.(type) {
	case *spec.Schema:
		*refable = *sch
	case spec.Schema:
		_, entry, pvalue, erp := getParentFromKey(sp, key)
		if erp != nil {
			return erp
		}

		switch container := pvalue.(type) {
		case spec.Definitions:
			container[entry] = *sch

		case map[string]spec.Schema:
			container[entry] = *sch

		case []spec.Schema:
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return ErrNotANumber(pth, err)
			}
			container[idx] = *sch

		case *spec.SchemaOrArray:
			// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return ErrNotANumber(pth, err)
			}
			container.Schemas[idx] = *sch

		case spec.SchemaProperties:
			container[entry] = *sch

		// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

		default:
			return ErrUnhandledParentType(key, value)
		}
	case *spec.SchemaOrArray:
		*refable.Schema = *sch
	// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema
	case *spec.SchemaOrBool:
		*refable.Schema = *sch
	default:
		return ErrNoSchemaWithRef(key, value)
	}

	return nil
}

// DeepestRefResult holds the results from DeepestRef analysis
type DeepestRefResult struct {
	Ref      spec.Ref
	Schema   *spec.Schema
	Warnings []string
}

// DeepestRef finds the first definition ref, from a cascade of nested refs which are not definitions.
//   - if no definition is found, returns the deepest ref.
//   - pointers to external files are expanded
//
// NOTE: all external $ref's are assumed to be already expanded at this stage.
func DeepestRef(sp *spec.Swagger, opts *spec.ExpandOptions, ref spec.Ref) (*DeepestRefResult, error) {
	if !ref.HasFragmentOnly {
		// we found an external $ref, which is odd at this stage:
		// do nothing on external $refs
		return &DeepestRefResult{Ref: ref}, nil
	}

	currentRef := ref
	visited := make(map[string]bool, allocMediumMap)
	warnings := make([]string, 0)

DOWNREF:
	for currentRef.String() != "" {
		if path.Dir(currentRef.String()) == definitionsPath {
			// this is a top-level definition: stop here and return this ref
			return &DeepestRefResult{Ref: currentRef}, nil
		}

		if _, beenThere := visited[currentRef.String()]; beenThere {
			return nil, ErrCyclicChain(currentRef.String())
		}

		visited[currentRef.String()] = true
		value, _, err := currentRef.GetPointer().Get(sp)
		if err != nil {
			return nil, err
		}

		switch refable := value.(type) {
		case *spec.Schema:
			if refable.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = refable.Ref

		case spec.Schema:
			if refable.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = refable.Ref

		case *spec.SchemaOrArray:
			if refable.Schema == nil || refable.Schema != nil && refable.Schema.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = refable.Schema.Ref

		case *spec.SchemaOrBool:
			if refable.Schema == nil || refable.Schema != nil && refable.Schema.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = refable.Schema.Ref

		case spec.Response:
			// a pointer points to a schema initially marshalled in responses section...
			// Attempt to convert this to a schema. If this fails, the spec is invalid
			asJSON, _ := refable.MarshalJSON()
			var asSchema spec.Schema

			err := asSchema.UnmarshalJSON(asJSON)
			if err != nil {
				return nil, ErrInvalidPointerType(currentRef.String(), value, err)
			}
			warnings = append(warnings, fmt.Sprintf("found $ref %q (response) interpreted as schema", currentRef.String()))

			if asSchema.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = asSchema.Ref

		case spec.Parameter:
			// a pointer points to a schema initially marshalled in parameters section...
			// Attempt to convert this to a schema. If this fails, the spec is invalid
			asJSON, _ := refable.MarshalJSON()
			var asSchema spec.Schema
			if err := asSchema.UnmarshalJSON(asJSON); err != nil {
				return nil, ErrInvalidPointerType(currentRef.String(), value, err)
			}

			warnings = append(warnings, fmt.Sprintf("found $ref %q (parameter) interpreted as schema", currentRef.String()))

			if asSchema.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = asSchema.Ref

		default:
			// fallback: attempts to resolve the pointer as a schema
			if refable == nil {
				break DOWNREF
			}

			asJSON, _ := json.Marshal(refable)
			var asSchema spec.Schema
			if err := asSchema.UnmarshalJSON(asJSON); err != nil {
				return nil, ErrInvalidPointerType(currentRef.String(), value, err)
			}
			warnings = append(warnings, fmt.Sprintf("found $ref %q (%T) interpreted as schema", currentRef.String(), refable))

			if asSchema.Ref.String() == "" {
				break DOWNREF
			}
			currentRef = asSchema.Ref
		}
	}

	// assess what schema we're ending with
	sch, erv := spec.ResolveRefWithBase(sp, &currentRef, opts)
	if erv != nil {
		return nil, erv
	}

	if sch == nil {
		return nil, ErrNoSchema(currentRef.String())
	}

	return &DeepestRefResult{Ref: currentRef, Schema: sch, Warnings: warnings}, nil
}
