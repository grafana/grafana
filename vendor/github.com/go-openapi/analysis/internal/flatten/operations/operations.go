package operations

import (
	"path"
	"sort"
	"strings"

	"github.com/go-openapi/jsonpointer"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/swag"
)

// AllOpRefsByRef returns an index of sortable operations
func AllOpRefsByRef(specDoc Provider, operationIDs []string) map[string]OpRef {
	return OpRefsByRef(GatherOperations(specDoc, operationIDs))
}

// OpRefsByRef indexes a map of sortable operations
func OpRefsByRef(oprefs map[string]OpRef) map[string]OpRef {
	result := make(map[string]OpRef, len(oprefs))
	for _, v := range oprefs {
		result[v.Ref.String()] = v
	}

	return result
}

// OpRef is an indexable, sortable operation
type OpRef struct {
	Method string
	Path   string
	Key    string
	ID     string
	Op     *spec.Operation
	Ref    spec.Ref
}

// OpRefs is a sortable collection of operations
type OpRefs []OpRef

func (o OpRefs) Len() int           { return len(o) }
func (o OpRefs) Swap(i, j int)      { o[i], o[j] = o[j], o[i] }
func (o OpRefs) Less(i, j int) bool { return o[i].Key < o[j].Key }

// Provider knows how to collect operations from a spec
type Provider interface {
	Operations() map[string]map[string]*spec.Operation
}

// GatherOperations builds a map of sorted operations from a spec
func GatherOperations(specDoc Provider, operationIDs []string) map[string]OpRef {
	var oprefs OpRefs

	for method, pathItem := range specDoc.Operations() {
		for pth, operation := range pathItem {
			vv := *operation
			oprefs = append(oprefs, OpRef{
				Key:    swag.ToGoName(strings.ToLower(method) + " " + pth),
				Method: method,
				Path:   pth,
				ID:     vv.ID,
				Op:     &vv,
				Ref:    spec.MustCreateRef("#" + path.Join("/paths", jsonpointer.Escape(pth), method)),
			})
		}
	}

	sort.Sort(oprefs)

	operations := make(map[string]OpRef)
	for _, opr := range oprefs {
		nm := opr.ID
		if nm == "" {
			nm = opr.Key
		}

		oo, found := operations[nm]
		if found && oo.Method != opr.Method && oo.Path != opr.Path {
			nm = opr.Key
		}

		if len(operationIDs) == 0 || swag.ContainsStrings(operationIDs, opr.ID) || swag.ContainsStrings(operationIDs, nm) {
			opr.ID = nm
			opr.Op.ID = nm
			operations[nm] = opr
		}
	}

	return operations
}
