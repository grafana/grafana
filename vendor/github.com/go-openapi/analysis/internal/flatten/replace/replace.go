package replace

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path"
	"strconv"

	"github.com/go-openapi/analysis/internal/debug"
	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/spec"
)

const definitionsPath = "#/definitions"

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
	case map[string]interface{}: // this happens e.g. if a schema points to an extension unmarshaled as map[string]interface{}
		return rewriteParentRef(sp, key, ref)
	default:
		return fmt.Errorf("no schema with ref found at %s for %T", key, value)
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
			return fmt.Errorf("%s not a number: %w", key[1:], err)
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
			return fmt.Errorf("%s not a number: %w", key[1:], err)
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
			return fmt.Errorf("%s not a number: %w", key[1:], err)
		}
		container[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case *spec.SchemaOrArray:
		// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
		idx, err := strconv.Atoi(entry)
		if err != nil {
			return fmt.Errorf("%s not a number: %w", key[1:], err)
		}
		container.Schemas[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case spec.SchemaProperties:
		container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	case *interface{}:
		*container = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

	// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

	default:
		return fmt.Errorf("unhandled parent schema rewrite %s (%T)", key, pvalue)
	}

	return nil
}

// getPointerFromKey retrieves the content of the JSON pointer "key"
func getPointerFromKey(sp interface{}, key string) (string, interface{}, error) {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic("unexpected type used in getPointerFromKey")
	}
	if key == "#/" {
		return "", sp, nil
	}
	// unescape chars in key, e.g. "{}" from path params
	pth, _ := url.PathUnescape(key[1:])
	ptr, err := jsonpointer.New(pth)
	if err != nil {
		return "", nil, err
	}

	value, _, err := ptr.Get(sp)
	if err != nil {
		debugLog("error when getting key: %s with path: %s", key, pth)

		return "", nil, err
	}

	return pth, value, nil
}

// getParentFromKey retrieves the container of the JSON pointer "key"
func getParentFromKey(sp interface{}, key string) (string, string, interface{}, error) {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic("unexpected type used in getPointerFromKey")
	}
	// unescape chars in key, e.g. "{}" from path params
	pth, _ := url.PathUnescape(key[1:])

	parent, entry := path.Dir(pth), path.Base(pth)
	debugLog("getting schema holder at: %s, with entry: %s", parent, entry)

	pptr, err := jsonpointer.New(parent)
	if err != nil {
		return "", "", nil, err
	}
	pvalue, _, err := pptr.Get(sp)
	if err != nil {
		return "", "", nil, fmt.Errorf("can't get parent for %s: %w", parent, err)
	}

	return parent, entry, pvalue, nil
}

// UpdateRef replaces a ref by another one
func UpdateRef(sp interface{}, key string, ref spec.Ref) error {
	switch sp.(type) {
	case *spec.Schema:
	case *spec.Swagger:
	default:
		panic("unexpected type used in getPointerFromKey")
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
			return err
		}
		switch container := pvalue.(type) {
		case spec.Definitions:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case map[string]spec.Schema:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case []spec.Schema:
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return fmt.Errorf("%s not a number: %w", pth, err)
			}
			container[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case *spec.SchemaOrArray:
			// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return fmt.Errorf("%s not a number: %w", pth, err)
			}
			container.Schemas[idx] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		case spec.SchemaProperties:
			container[entry] = spec.Schema{SchemaProps: spec.SchemaProps{Ref: ref}}

		// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

		default:
			return fmt.Errorf("unhandled container type at %s: %T", key, value)
		}

	default:
		return fmt.Errorf("no schema with ref found at %s for %T", key, value)
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
			return err
		}
		switch container := pvalue.(type) {
		case spec.Definitions:
			container[entry] = *sch

		case map[string]spec.Schema:
			container[entry] = *sch

		case []spec.Schema:
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return fmt.Errorf("%s not a number: %w", pth, err)
			}
			container[idx] = *sch

		case *spec.SchemaOrArray:
			// NOTE: this is necessarily an array - otherwise, the parent would be *Schema
			idx, err := strconv.Atoi(entry)
			if err != nil {
				return fmt.Errorf("%s not a number: %w", pth, err)
			}
			container.Schemas[idx] = *sch

		case spec.SchemaProperties:
			container[entry] = *sch

		// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema

		default:
			return fmt.Errorf("unhandled type for parent of [%s]: %T", key, value)
		}
	case *spec.SchemaOrArray:
		*refable.Schema = *sch
	// NOTE: can't have case *spec.SchemaOrBool = parent in this case is *Schema
	case *spec.SchemaOrBool:
		*refable.Schema = *sch
	default:
		return fmt.Errorf("no schema with ref found at %s for %T", key, value)
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
	visited := make(map[string]bool, 64)
	warnings := make([]string, 0, 2)

DOWNREF:
	for currentRef.String() != "" {
		if path.Dir(currentRef.String()) == definitionsPath {
			// this is a top-level definition: stop here and return this ref
			return &DeepestRefResult{Ref: currentRef}, nil
		}

		if _, beenThere := visited[currentRef.String()]; beenThere {
			return nil,
				fmt.Errorf("cannot resolve cyclic chain of pointers under %s", currentRef.String())
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
				return nil,
					fmt.Errorf("invalid type for resolved JSON pointer %s. Expected a schema a, got: %T (%v)",
						currentRef.String(), value, err,
					)
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
				return nil,
					fmt.Errorf("invalid type for resolved JSON pointer %s. Expected a schema a, got: %T (%v)",
						currentRef.String(), value, err,
					)
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
				return nil,
					fmt.Errorf("unhandled type to resolve JSON pointer %s. Expected a Schema, got: %T (%v)",
						currentRef.String(), value, err,
					)
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
		return nil, fmt.Errorf("no schema found at %s", currentRef.String())
	}

	return &DeepestRefResult{Ref: currentRef, Schema: sch, Warnings: warnings}, nil
}
