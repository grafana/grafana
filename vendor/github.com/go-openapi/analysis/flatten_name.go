package analysis

import (
	"fmt"
	"path"
	"sort"
	"strings"

	"github.com/go-openapi/analysis/internal/flatten/operations"
	"github.com/go-openapi/analysis/internal/flatten/replace"
	"github.com/go-openapi/analysis/internal/flatten/schutils"
	"github.com/go-openapi/analysis/internal/flatten/sortref"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/swag"
)

// InlineSchemaNamer finds a new name for an inlined type
type InlineSchemaNamer struct {
	Spec           *spec.Swagger
	Operations     map[string]operations.OpRef
	flattenContext *context
	opts           *FlattenOpts
}

// Name yields a new name for the inline schema
func (isn *InlineSchemaNamer) Name(key string, schema *spec.Schema, aschema *AnalyzedSchema) error {
	debugLog("naming inlined schema at %s", key)

	parts := sortref.KeyParts(key)
	for _, name := range namesFromKey(parts, aschema, isn.Operations) {
		if name == "" {
			continue
		}

		// create unique name
		mangle := mangler(isn.opts)
		newName, isOAIGen := uniqifyName(isn.Spec.Definitions, mangle(name))

		// clone schema
		sch := schutils.Clone(schema)

		// replace values on schema
		debugLog("rewriting schema to ref: key=%s with new name: %s", key, newName)
		if err := replace.RewriteSchemaToRef(isn.Spec, key,
			spec.MustCreateRef(path.Join(definitionsPath, newName))); err != nil {
			return fmt.Errorf("error while creating definition %q from inline schema: %w", newName, err)
		}

		// rewrite any dependent $ref pointing to this place,
		// when not already pointing to a top-level definition.
		//
		// NOTE: this is important if such referers use arbitrary JSON pointers.
		an := New(isn.Spec)
		for k, v := range an.references.allRefs {
			r, erd := replace.DeepestRef(isn.opts.Swagger(), isn.opts.ExpandOpts(false), v)
			if erd != nil {
				return fmt.Errorf("at %s, %w", k, erd)
			}

			if isn.opts.flattenContext != nil {
				isn.opts.flattenContext.warnings = append(isn.opts.flattenContext.warnings, r.Warnings...)
			}

			if r.Ref.String() != key && (r.Ref.String() != path.Join(definitionsPath, newName) || path.Dir(v.String()) == definitionsPath) {
				continue
			}

			debugLog("found a $ref to a rewritten schema: %s points to %s", k, v.String())

			// rewrite $ref to the new target
			if err := replace.UpdateRef(isn.Spec, k,
				spec.MustCreateRef(path.Join(definitionsPath, newName))); err != nil {
				return err
			}
		}

		// NOTE: this extension is currently not used by go-swagger (provided for information only)
		sch.AddExtension("x-go-gen-location", GenLocation(parts))

		// save cloned schema to definitions
		schutils.Save(isn.Spec, newName, sch)

		// keep track of created refs
		if isn.flattenContext == nil {
			continue
		}

		debugLog("track created ref: key=%s, newName=%s, isOAIGen=%t", key, newName, isOAIGen)
		resolved := false

		if _, ok := isn.flattenContext.newRefs[key]; ok {
			resolved = isn.flattenContext.newRefs[key].resolved
		}

		isn.flattenContext.newRefs[key] = &newRef{
			key:      key,
			newName:  newName,
			path:     path.Join(definitionsPath, newName),
			isOAIGen: isOAIGen,
			resolved: resolved,
			schema:   sch,
		}
	}

	return nil
}

// uniqifyName yields a unique name for a definition
func uniqifyName(definitions spec.Definitions, name string) (string, bool) {
	isOAIGen := false
	if name == "" {
		name = "oaiGen"
		isOAIGen = true
	}

	if len(definitions) == 0 {
		return name, isOAIGen
	}

	unq := true
	for k := range definitions {
		if strings.EqualFold(k, name) {
			unq = false

			break
		}
	}

	if unq {
		return name, isOAIGen
	}

	name += "OAIGen"
	isOAIGen = true
	var idx int
	unique := name
	_, known := definitions[unique]

	for known {
		idx++
		unique = fmt.Sprintf("%s%d", name, idx)
		_, known = definitions[unique]
	}

	return unique, isOAIGen
}

func namesFromKey(parts sortref.SplitKey, aschema *AnalyzedSchema, operations map[string]operations.OpRef) []string {
	var (
		baseNames  [][]string
		startIndex int
	)

	switch {
	case parts.IsOperation():
		baseNames, startIndex = namesForOperation(parts, operations)
	case parts.IsDefinition():
		baseNames, startIndex = namesForDefinition(parts)
	default:
		// this a non-standard pointer: build a name by concatenating its parts
		baseNames = [][]string{parts}
		startIndex = len(baseNames) + 1
	}

	result := make([]string, 0, len(baseNames))
	for _, segments := range baseNames {
		nm := parts.BuildName(segments, startIndex, partAdder(aschema))
		if nm == "" {
			continue
		}

		result = append(result, nm)
	}
	sort.Strings(result)

	debugLog("names from parts: %v => %v", parts, result)
	return result
}

func namesForParam(parts sortref.SplitKey, operations map[string]operations.OpRef) ([][]string, int) {
	var (
		baseNames  [][]string
		startIndex int
	)

	piref := parts.PathItemRef()
	if piref.String() != "" && parts.IsOperationParam() {
		if op, ok := operations[piref.String()]; ok {
			startIndex = 5
			baseNames = append(baseNames, []string{op.ID, "params", "body"})
		}
	} else if parts.IsSharedOperationParam() {
		pref := parts.PathRef()
		for k, v := range operations {
			if strings.HasPrefix(k, pref.String()) {
				startIndex = 4
				baseNames = append(baseNames, []string{v.ID, "params", "body"})
			}
		}
	}

	return baseNames, startIndex
}

func namesForOperation(parts sortref.SplitKey, operations map[string]operations.OpRef) ([][]string, int) {
	var (
		baseNames  [][]string
		startIndex int
	)

	// params
	if parts.IsOperationParam() || parts.IsSharedOperationParam() {
		baseNames, startIndex = namesForParam(parts, operations)
	}

	// responses
	if parts.IsOperationResponse() {
		piref := parts.PathItemRef()
		if piref.String() != "" {
			if op, ok := operations[piref.String()]; ok {
				startIndex = 6
				baseNames = append(baseNames, []string{op.ID, parts.ResponseName(), "body"})
			}
		}
	}

	return baseNames, startIndex
}

func namesForDefinition(parts sortref.SplitKey) ([][]string, int) {
	nm := parts.DefinitionName()
	if nm != "" {
		return [][]string{{parts.DefinitionName()}}, 2
	}

	return [][]string{}, 0
}

// partAdder knows how to interpret a schema when it comes to build a name from parts
func partAdder(aschema *AnalyzedSchema) sortref.PartAdder {
	return func(part string) []string {
		segments := make([]string, 0, 2)

		if part == "items" || part == "additionalItems" {
			if aschema.IsTuple || aschema.IsTupleWithExtra {
				segments = append(segments, "tuple")
			} else {
				segments = append(segments, "items")
			}

			if part == "additionalItems" {
				segments = append(segments, part)
			}

			return segments
		}

		segments = append(segments, part)

		return segments
	}
}

func mangler(o *FlattenOpts) func(string) string {
	if o.KeepNames {
		return func(in string) string { return in }
	}

	return swag.ToJSONName
}

func nameFromRef(ref spec.Ref, o *FlattenOpts) string {
	mangle := mangler(o)

	u := ref.GetURL()
	if u.Fragment != "" {
		return mangle(path.Base(u.Fragment))
	}

	if u.Path != "" {
		bn := path.Base(u.Path)
		if bn != "" && bn != "/" {
			ext := path.Ext(bn)
			if ext != "" {
				return mangle(bn[:len(bn)-len(ext)])
			}

			return mangle(bn)
		}
	}

	return mangle(strings.ReplaceAll(u.Host, ".", " "))
}

// GenLocation indicates from which section of the specification (models or operations) a definition has been created.
//
// This is reflected in the output spec with a "x-go-gen-location" extension. At the moment, this is provided
// for information only.
func GenLocation(parts sortref.SplitKey) string {
	switch {
	case parts.IsOperation():
		return "operations"
	case parts.IsDefinition():
		return "models"
	default:
		return ""
	}
}
