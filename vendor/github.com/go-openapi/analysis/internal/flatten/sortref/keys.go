package sortref

import (
	"net/http"
	"path"
	"strconv"
	"strings"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/spec"
)

const (
	paths       = "paths"
	responses   = "responses"
	parameters  = "parameters"
	definitions = "definitions"
)

var (
	ignoredKeys  map[string]struct{}
	validMethods map[string]struct{}
)

func init() {
	ignoredKeys = map[string]struct{}{
		"schema":     {},
		"properties": {},
		"not":        {},
		"anyOf":      {},
		"oneOf":      {},
	}

	validMethods = map[string]struct{}{
		"GET":     {},
		"HEAD":    {},
		"OPTIONS": {},
		"PATCH":   {},
		"POST":    {},
		"PUT":     {},
		"DELETE":  {},
	}
}

// Key represent a key item constructed from /-separated segments
type Key struct {
	Segments int
	Key      string
}

// Keys is a sortable collable collection of Keys
type Keys []Key

func (k Keys) Len() int      { return len(k) }
func (k Keys) Swap(i, j int) { k[i], k[j] = k[j], k[i] }
func (k Keys) Less(i, j int) bool {
	return k[i].Segments > k[j].Segments || (k[i].Segments == k[j].Segments && k[i].Key < k[j].Key)
}

// KeyParts construct a SplitKey with all its /-separated segments decomposed. It is sortable.
func KeyParts(key string) SplitKey {
	var res []string
	for _, part := range strings.Split(key[1:], "/") {
		if part != "" {
			res = append(res, jsonpointer.Unescape(part))
		}
	}

	return res
}

// SplitKey holds of the parts of a /-separated key, so that their location may be determined.
type SplitKey []string

// IsDefinition is true when the split key is in the #/definitions section of a spec
func (s SplitKey) IsDefinition() bool {
	return len(s) > 1 && s[0] == definitions
}

// DefinitionName yields the name of the definition
func (s SplitKey) DefinitionName() string {
	if !s.IsDefinition() {
		return ""
	}

	return s[1]
}

func (s SplitKey) isKeyName(i int) bool {
	if i <= 0 {
		return false
	}

	count := 0
	for idx := i - 1; idx > 0; idx-- {
		if s[idx] != "properties" {
			break
		}
		count++
	}

	return count%2 != 0
}

// PartAdder know how to construct the components of a new name
type PartAdder func(string) []string

// BuildName builds a name from segments
func (s SplitKey) BuildName(segments []string, startIndex int, adder PartAdder) string {
	for i, part := range s[startIndex:] {
		if _, ignored := ignoredKeys[part]; !ignored || s.isKeyName(startIndex+i) {
			segments = append(segments, adder(part)...)
		}
	}

	return strings.Join(segments, " ")
}

// IsOperation is true when the split key is in the operations section
func (s SplitKey) IsOperation() bool {
	return len(s) > 1 && s[0] == paths
}

// IsSharedOperationParam is true when the split key is in the parameters section of a path
func (s SplitKey) IsSharedOperationParam() bool {
	return len(s) > 2 && s[0] == paths && s[2] == parameters
}

// IsSharedParam is true when the split key is in the #/parameters section of a spec
func (s SplitKey) IsSharedParam() bool {
	return len(s) > 1 && s[0] == parameters
}

// IsOperationParam is true when the split key is in the parameters section of an operation
func (s SplitKey) IsOperationParam() bool {
	return len(s) > 3 && s[0] == paths && s[3] == parameters
}

// IsOperationResponse is true when the split key is in the responses section of an operation
func (s SplitKey) IsOperationResponse() bool {
	return len(s) > 3 && s[0] == paths && s[3] == responses
}

// IsSharedResponse is true when the split key is in the #/responses section of a spec
func (s SplitKey) IsSharedResponse() bool {
	return len(s) > 1 && s[0] == responses
}

// IsDefaultResponse is true when the split key is the default response for an operation
func (s SplitKey) IsDefaultResponse() bool {
	return len(s) > 4 && s[0] == paths && s[3] == responses && s[4] == "default"
}

// IsStatusCodeResponse is true when the split key is an operation response with a status code
func (s SplitKey) IsStatusCodeResponse() bool {
	isInt := func() bool {
		_, err := strconv.Atoi(s[4])

		return err == nil
	}

	return len(s) > 4 && s[0] == paths && s[3] == responses && isInt()
}

// ResponseName yields either the status code or "Default" for a response
func (s SplitKey) ResponseName() string {
	if s.IsStatusCodeResponse() {
		code, _ := strconv.Atoi(s[4])

		return http.StatusText(code)
	}

	if s.IsDefaultResponse() {
		return "Default"
	}

	return ""
}

// PathItemRef constructs a $ref object from a split key of the form /{path}/{method}
func (s SplitKey) PathItemRef() spec.Ref {
	if len(s) < 3 {
		return spec.Ref{}
	}

	pth, method := s[1], s[2]
	if _, isValidMethod := validMethods[strings.ToUpper(method)]; !isValidMethod && !strings.HasPrefix(method, "x-") {
		return spec.Ref{}
	}

	return spec.MustCreateRef("#" + path.Join("/", paths, jsonpointer.Escape(pth), strings.ToUpper(method)))
}

// PathRef constructs a $ref object from a split key of the form /paths/{reference}
func (s SplitKey) PathRef() spec.Ref {
	if !s.IsOperation() {
		return spec.Ref{}
	}

	return spec.MustCreateRef("#" + path.Join("/", paths, jsonpointer.Escape(s[1])))
}
