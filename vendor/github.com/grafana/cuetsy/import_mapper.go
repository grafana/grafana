package cuetsy

import (
	"fmt"
	"strings"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	tsast "github.com/grafana/cuetsy/ts/ast"
)

// An ImportMapper takes a string containing a CUE import path (e.g.
// "github.com/grafana/cuetsy") and returns a string indicating the import path
// that should be used in the corresponding generated typescript, or an error if
// no mapping can be made.
//
// An empty string return indicates no TS import statements
// should be generated for that CUE import path.
type ImportMapper func(string) (string, error)

func nilImportMapper(path string) (string, error) {
	return "", fmt.Errorf("a corresponding typescript import is not available for %q", path)
}

// IgnoreImportMapper ignores all import paths cuetsy encounters, resulting in no
// import statements in generated TS output.
func IgnoreImportMapper(path string) (string, error) {
	return "", nil
}

// mapImports converts CUE import statements, represented in their AST form,
// to the corresponding TS import, if the CUE import is allowed.
//
// Some CUE imports are allowed but have no corresponding TS import - the CUE
// types from that package are expected to be inlined.
func mapImports(raw cue.Value, fn ImportMapper) ([]tsast.ImportSpec, error) {
	bi := findInstance(raw)
	if bi == nil {
		return nil, nil
	}

	var ims []*ast.ImportSpec
	for _, src := range bi.Files {
		ims = append(ims, src.Imports...)
	}

	var specs []tsast.ImportSpec
	for _, im := range ims {
		pkg, err := fn(strings.Trim(im.Path.Value, "\""))
		if err != nil || pkg == "" {
			// Empty string mapping means skip it
			return nil, err
		}

		tsim := tsast.ImportSpec{
			From: tsast.Str{Value: pkg},
		}

		if im.Name != nil && im.Name.String() != "" {
			tsim.AsName = im.Name.String()
		} else {
			sl := strings.Split(strings.Trim(im.Path.Value, "\""), "/")
			final := sl[len(sl)-1]
			if idx := strings.Index(final, ":"); idx != -1 {
				tsim.AsName = final[idx:]
			} else {
				tsim.AsName = final
			}
		}
		specs = append(specs, tsim)
	}
	return specs, nil
}
