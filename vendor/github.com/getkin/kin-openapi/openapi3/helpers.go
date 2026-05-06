package openapi3

import (
	"fmt"
	"net/url"
	"path"
	"reflect"
	"regexp"
	"sort"
	"strings"

	"github.com/go-openapi/jsonpointer"
)

const identifierChars = `a-zA-Z0-9._-`

// IdentifierRegExp verifies whether Component object key matches contains just 'identifierChars', according to OpenAPI v3.x.
// InvalidIdentifierCharRegExp matches all characters not contained in 'identifierChars'.
// However, to be able supporting legacy OpenAPI v2.x, there is a need to customize above pattern in order not to fail
// converted v2-v3 validation
var (
	IdentifierRegExp            = regexp.MustCompile(`^[` + identifierChars + `]+$`)
	InvalidIdentifierCharRegExp = regexp.MustCompile(`[^` + identifierChars + `]`)
)

// ValidateIdentifier returns an error if the given component name does not match [IdentifierRegExp].
func ValidateIdentifier(value string) error {
	if IdentifierRegExp.MatchString(value) {
		return nil
	}
	return fmt.Errorf("identifier %q is not supported by OpenAPIv3 standard (charset: [%q])", value, identifierChars)
}

// Float64Ptr is a helper for defining OpenAPI schemas.
func Float64Ptr(value float64) *float64 {
	return &value
}

// BoolPtr is a helper for defining OpenAPI schemas.
func BoolPtr(value bool) *bool {
	return &value
}

// Int64Ptr is a helper for defining OpenAPI schemas.
func Int64Ptr(value int64) *int64 {
	return &value
}

// Uint64Ptr is a helper for defining OpenAPI schemas.
func Uint64Ptr(value uint64) *uint64 {
	return &value
}

// componentNames returns the map keys in a sorted slice.
func componentNames[E any](s map[string]E) []string {
	out := make([]string, 0, len(s))
	for i := range s {
		out = append(out, i)
	}
	sort.Strings(out)
	return out
}

// copyURI makes a copy of the pointer.
func copyURI(u *url.URL) *url.URL {
	if u == nil {
		return nil
	}

	c := *u // shallow-copy
	return &c
}

type ComponentRef interface {
	RefString() string
	RefPath() *url.URL
	CollectionName() string
}

// refersToSameDocument returns if the $ref refers to the same document.
//
// Documents in different directories will have distinct $ref values that resolve to
// the same document.
// For example, consider the 3 files:
//
//	/records.yaml
//	/root.yaml         $ref: records.yaml
//	/schema/other.yaml $ref: ../records.yaml
//
// The records.yaml reference in the 2 latter refers to the same document.
func refersToSameDocument(o1 ComponentRef, o2 ComponentRef) bool {
	if o1 == nil || o2 == nil {
		return false
	}

	r1 := o1.RefPath()
	r2 := o2.RefPath()

	if r1 == nil || r2 == nil {
		return false
	}

	// refURL is relative to the working directory & base spec file.
	return referenceURIMatch(r1, r2)
}

// referencesRootDocument returns if the $ref points to the root document of the OpenAPI spec.
//
// If the document has no location, perhaps loaded from data in memory, it always returns false.
func referencesRootDocument(doc *T, ref ComponentRef) bool {
	if doc.url == nil || ref == nil || ref.RefPath() == nil {
		return false
	}

	refURL := *ref.RefPath()
	refURL.Fragment = ""

	// Check referenced element was in the root document.
	return referenceURIMatch(doc.url, &refURL)
}

func referenceURIMatch(u1 *url.URL, u2 *url.URL) bool {
	s1, s2 := *u1, *u2
	if s1.Scheme == "" {
		s1.Scheme = "file"
	}
	if s2.Scheme == "" {
		s2.Scheme = "file"
	}

	return s1.String() == s2.String()
}

// ReferencesComponentInRootDocument returns if the given component reference references
// the same document or element as another component reference in the root document's
// '#/components/<type>'. If it does, it returns the name of it in the form
// '#/components/<type>/NameXXX'
//
// Of course given a component from the root document will always match itself.
//
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#reference-object
// https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#relative-references-in-urls
//
// Example. Take the spec with directory structure:
//
//	openapi.yaml
//	schemas/
//	├─ record.yaml
//	├─ records.yaml
//
// In openapi.yaml we have:
//
//	components:
//	  schemas:
//	    Record:
//	      $ref: schemas/record.yaml
//
// Case 1: records.yml references a component in the root document
//
//	$ref: ../openapi.yaml#/components/schemas/Record
//
// This would return...
//
//	#/components/schemas/Record
//
// Case 2: records.yml indirectly refers to the same schema
// as a schema the root document's '#/components/schemas'.
//
//	$ref: ./record.yaml
//
// This would also return...
//
//	#/components/schemas/Record
func ReferencesComponentInRootDocument(doc *T, ref ComponentRef) (string, bool) {
	if ref == nil || ref.RefString() == "" {
		return "", false
	}

	// Case 1:
	// Something like: ../another-folder/document.json#/myElement
	if isRemoteReference(ref.RefString()) && isRootComponentReference(ref.RefString(), ref.CollectionName()) {
		// Determine if it is *this* root doc.
		if referencesRootDocument(doc, ref) {
			_, name, _ := strings.Cut(ref.RefString(), path.Join("#/components/", ref.CollectionName()))

			return path.Join("#/components/", ref.CollectionName(), name), true
		}
	}

	// If there are no schemas defined in the root document return early.
	if doc.Components == nil {
		return "", false
	}

	collection, _, err := jsonpointer.GetForToken(doc.Components, ref.CollectionName())
	if err != nil {
		panic(err) // unreachable
	}

	var components map[string]ComponentRef

	componentRefType := reflect.TypeOf(new(ComponentRef)).Elem()
	if t := reflect.TypeOf(collection); t.Kind() == reflect.Map &&
		t.Key().Kind() == reflect.String &&
		t.Elem().AssignableTo(componentRefType) {
		v := reflect.ValueOf(collection)

		components = make(map[string]ComponentRef, v.Len())
		for _, key := range v.MapKeys() {
			strct := v.MapIndex(key)
			// Type assertion safe, already checked via reflection above.
			components[key.Interface().(string)] = strct.Interface().(ComponentRef)
		}
	} else {
		return "", false
	}

	// Case 2:
	// Something like: ../openapi.yaml#/components/schemas/myElement
	for name, s := range components {
		// Must be a reference to a YAML file.
		if !isWholeDocumentReference(s.RefString()) {
			continue
		}

		// Is the schema a ref to the same resource.
		if !refersToSameDocument(s, ref) {
			continue
		}

		// Transform the remote ref to the equivalent schema in the root document.
		return path.Join("#/components/", ref.CollectionName(), name), true
	}

	return "", false
}

// isElementReference takes a $ref value and checks if it references a specific element.
func isElementReference(ref string) bool {
	return ref != "" && !isWholeDocumentReference(ref)
}

// isSchemaReference takes a $ref value and checks if it references a schema element.
func isRootComponentReference(ref string, compType string) bool {
	return isElementReference(ref) && strings.Contains(ref, path.Join("#/components/", compType))
}

// isWholeDocumentReference takes a $ref value and checks if it is whole document reference.
func isWholeDocumentReference(ref string) bool {
	return ref != "" && !strings.ContainsAny(ref, "#")
}

// isRemoteReference takes a $ref value and checks if it is remote reference.
func isRemoteReference(ref string) bool {
	return ref != "" && !strings.HasPrefix(ref, "#") && !isURLReference(ref)
}

// isURLReference takes a $ref value and checks if it is URL reference.
func isURLReference(ref string) bool {
	return strings.HasPrefix(ref, "http://") || strings.HasPrefix(ref, "https://") || strings.HasPrefix(ref, "//")
}
