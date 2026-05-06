package schemabuilder

import (
	"fmt"
	"io/fs"
	gopath "path"
	"path/filepath"
	"regexp"
	"strings"

	"go/ast"
	"go/doc"
	"go/parser"
	"go/token"

	"github.com/invopop/jsonschema"
)

type EnumValue struct {
	Value   string
	Comment string
}

type EnumField struct {
	Package string
	Name    string
	Comment string
	Values  []EnumValue
}

func findEnumFields(base, startpath string) ([]EnumField, error) {
	fset := token.NewFileSet()
	dict := make(map[string][]*ast.Package)
	err := filepath.Walk(startpath, func(path string, info fs.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			d, err := parser.ParseDir(fset, path, nil, parser.ParseComments)
			if err != nil {
				return err
			}
			for _, v := range d {
				// paths may have multiple packages, like for tests
				k := gopath.Join(base, strings.TrimPrefix(path, startpath))
				dict[k] = append(dict[k], v)
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	fields := make([]EnumField, 0)
	field := &EnumField{}
	dp := &doc.Package{}

	for pkg, p := range dict {
		for _, f := range p {
			gtxt := ""
			typ := ""
			ast.Inspect(f, func(n ast.Node) bool {
				switch x := n.(type) {
				case *ast.TypeSpec:
					typ = x.Name.String()
					if !ast.IsExported(typ) {
						typ = ""
					} else {
						txt := x.Doc.Text()
						if txt == "" && gtxt != "" {
							txt = gtxt
							gtxt = ""
						}
						txt = strings.TrimSpace(txt)
						if strings.HasSuffix(txt, "+enum") {
							txt = dp.Synopsis(txt)
							fields = append(fields, EnumField{
								Package: pkg,
								Name:    typ,
								Comment: strings.TrimSpace(strings.TrimSuffix(txt, "+enum")),
							})
							field = &fields[len(fields)-1]
						}
					}
				case *ast.ValueSpec:
					txt := x.Doc.Text()
					if txt == "" {
						txt = x.Comment.Text()
					}
					typ = fmt.Sprintf("%v", x.Type)
					if typ == field.Name && len(x.Values) > 0 {
						for _, n := range x.Names {
							if ast.IsExported(n.String()) {
								v, ok := x.Values[0].(*ast.BasicLit)
								if ok {
									val := strings.TrimPrefix(v.Value, `"`)
									val = strings.TrimSuffix(val, `"`)
									txt = strings.TrimSpace(txt)
									field.Values = append(field.Values, EnumValue{
										Value:   val,
										Comment: txt,
									})
								}
							}
						}
					}
				case *ast.GenDecl:
					// remember for the next type
					gtxt = x.Doc.Text()
				}
				return true
			})
		}
	}

	return fields, nil
}

// whitespaceRegex is the regex for consecutive whitespaces.
var whitespaceRegex = regexp.MustCompile(`\s+`)

func updateEnumDescriptions(s *jsonschema.Schema) {
	if len(s.Enum) > 0 && s.Extras != nil {
		extra, ok := s.Extras["x-enum-description"]
		if !ok {
			return
		}

		lookup, ok := extra.(map[string]string)
		if !ok {
			return
		}

		lines := []string{}
		if s.Description != "" {
			lines = append(lines, s.Description, "\n")
		}
		lines = append(lines, "Possible enum values:")
		for _, v := range s.Enum {
			c := lookup[v.(string)]
			c = whitespaceRegex.ReplaceAllString(c, " ")
			lines = append(lines, fmt.Sprintf(" - `%q` %s", v, c))
		}

		s.Description = strings.Join(lines, "\n")
		return
	}

	for pair := s.Properties.Oldest(); pair != nil; pair = pair.Next() {
		updateEnumDescriptions(pair.Value)
	}
}
