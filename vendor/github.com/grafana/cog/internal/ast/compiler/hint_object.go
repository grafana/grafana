package compiler

import (
	"fmt"
	"sort"
	"strings"

	"github.com/grafana/cog/internal/ast"
)

var _ Pass = (*HintObject)(nil)

type HintObject struct {
	Object ObjectReference
	Hints  ast.JenniesHints
}

func (pass *HintObject) Process(schemas []*ast.Schema) ([]*ast.Schema, error) {
	visitor := &Visitor{
		OnObject: pass.processObject,
	}

	return visitor.VisitSchemas(schemas)
}

func (pass *HintObject) processObject(_ *Visitor, _ *ast.Schema, object ast.Object) (ast.Object, error) {
	if !pass.Object.Matches(object) {
		return object, nil
	}

	hintsTrail := make([]string, 0, len(pass.Hints))
	for hint, val := range pass.Hints {
		object.Type.Hints[hint] = val
		hintsTrail = append(hintsTrail, fmt.Sprintf("%s=%v", hint, val))
	}

	// to ensure a consistent trail
	sort.Strings(hintsTrail)

	object.AddToPassesTrail(fmt.Sprintf("HintObject[%s]", strings.Join(hintsTrail, ", ")))

	return object, nil
}
