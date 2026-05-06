package template

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	gotemplate "text/template"

	"github.com/grafana/cog/internal/tools"
)

const recursionMaxNums = 1000

type FuncMap gotemplate.FuncMap

func (funcMap FuncMap) MergeWith(other FuncMap) FuncMap {
	for k, v := range other {
		funcMap[k] = v
	}

	return funcMap
}

type Option func(*Template) error

func Funcs(funcMap FuncMap) Option {
	return func(template *Template) error {
		template.Funcs(funcMap)
		return nil
	}
}

func Parse(payload string) Option {
	return func(template *Template) error {
		parsed, err := template.tmpl.Parse(payload)
		if err != nil {
			return err
		}

		template.tmpl = parsed

		return nil
	}
}

func ParseFS(vfs fs.FS, rootDir string) Option {
	return func(template *Template) error {
		err := fs.WalkDir(vfs, rootDir, func(path string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}

			if d.IsDir() {
				return nil
			}

			fileHandle, err := vfs.Open(path)
			if err != nil {
				return err
			}

			contents, err := io.ReadAll(fileHandle)
			if err != nil {
				return err
			}

			templateName := strings.TrimPrefix(strings.TrimPrefix(path, rootDir), "/")
			t := template.tmpl.New(templateName)
			_, err = t.Parse(string(contents))

			return err
		})

		return err
	}
}

func ParseDirectories(rootDirs ...string) Option {
	return func(template *Template) error {
		for _, rootDir := range rootDirs {
			err := filepath.WalkDir(rootDir, func(path string, d fs.DirEntry, err error) error {
				if err != nil {
					return err
				}

				if d.IsDir() {
					return nil
				}

				fileHandle, err := os.Open(path)
				if err != nil {
					return err
				}

				contents, err := io.ReadAll(fileHandle)
				if err != nil {
					return err
				}

				templateName := strings.TrimPrefix(strings.TrimPrefix(path, rootDir), "/")
				t := template.tmpl.New(templateName)
				_, err = t.Parse(string(contents))

				return err
			})
			if err != nil {
				return err
			}
		}

		return nil
	}
}

type Template struct {
	tmpl *gotemplate.Template
}

func New(name string, opts ...Option) (*Template, error) {
	template := &Template{
		tmpl: gotemplate.New(name).Option("missingkey=error"),
	}

	template.Funcs(template.builtins())

	for _, opt := range opts {
		if err := opt(template); err != nil {
			return nil, err
		}
	}

	return template, nil
}

func (template *Template) Funcs(funcs FuncMap) *Template {
	template.tmpl.Funcs(gotemplate.FuncMap(funcs))
	return template
}

func (template *Template) Exists(name string) bool {
	return template.tmpl.Lookup(name) != nil
}

func (template *Template) Render(file string, data any) (string, error) {
	buf := bytes.Buffer{}
	if err := template.tmpl.ExecuteTemplate(&buf, file, data); err != nil {
		return "", fmt.Errorf("failed executing template: %w", err)
	}

	return buf.String(), nil
}

func (template *Template) RenderInBuffer(buffer *strings.Builder, file string, data any) error {
	rendered, err := template.Render(file, data)
	if err != nil {
		return err
	}

	buffer.WriteString(rendered)

	return nil
}

func (template *Template) RenderAsBytes(file string, data any) ([]byte, error) {
	rendered, err := template.Render(file, data)
	if err != nil {
		return nil, err
	}

	return []byte(rendered), nil
}

func (template *Template) ExecuteAsBytes(data any) ([]byte, error) {
	buf := bytes.Buffer{}
	if err := template.tmpl.Execute(&buf, data); err != nil {
		return nil, fmt.Errorf("failed executing template: %w", err)
	}

	return buf.Bytes(), nil
}

func (template *Template) builtins() FuncMap {
	includedNames := make(map[string]int)
	include := func(name string, data interface{}) (string, error) {
		var buf strings.Builder
		if v, ok := includedNames[name]; ok {
			if v > recursionMaxNums {
				return "", fmt.Errorf("unable to execute template: rendering template has a nested reference name: %s", name)
			}
			includedNames[name]++
		} else {
			includedNames[name] = 1
		}
		err := template.tmpl.ExecuteTemplate(&buf, name, data)
		includedNames[name]--
		return buf.String(), err
	}

	return FuncMap{
		"add1": func(i int) int { return i + 1 },
		"sub1": func(i int) int { return i - 1 },
		// https://github.com/Masterminds/sprig/blob/581758eb7d96ae4d113649668fa96acc74d46e7f/dict.go#L76
		"dict": func(v ...any) map[string]any {
			dict := map[string]any{}
			lenv := len(v)
			for i := 0; i < lenv; i += 2 {
				key := v[i].(string)
				if i+1 >= lenv {
					dict[key] = ""
					continue
				}
				dict[key] = v[i+1]
			}
			return dict
		},
		"ternary": func(valTrue any, valFalse any, condition bool) any {
			if condition {
				return valTrue
			}

			return valFalse
		},
		"default": func(d any, given ...any) any {
			if empty(given) || empty(given[0]) {
				return d
			}
			return given[0]
		},
		"listStr": func(v ...string) []string {
			return v
		},
		"first": func(list any) any {
			tp := reflect.TypeOf(list).Kind()
			switch tp {
			case reflect.Slice, reflect.Array:
				l2 := reflect.ValueOf(list)
				if l2.Len() > 0 {
					return l2.Index(0).Interface() // this will *willingly* panic if the list is empty
				}
				return l2.Interface()
			default:
				panic(fmt.Sprintf("Cannot find first on type %s", tp))
			}
		},
		"last": func(list any) any {
			tp := reflect.TypeOf(list).Kind()
			switch tp {
			case reflect.Slice, reflect.Array:
				l2 := reflect.ValueOf(list)
				if l2.Len() > 0 {
					return l2.Index(l2.Len() - 1).Interface() // this will *willingly* panic if the list is empty
				}
				return l2.Interface()
			default:
				panic(fmt.Sprintf("Cannot find first on type %s", tp))
			}
		},

		"slice": func(arr interface{}, start int) interface{} {
			v := reflect.ValueOf(arr)
			if v.Kind() != reflect.Slice {
				panic("slice: input must be a slice")
			}
			if start >= v.Len() {
				return reflect.MakeSlice(v.Type(), 0, 0).Interface()
			}
			return v.Slice(start, v.Len()).Interface()
		},

		// ------- \\
		// Strings \\
		// ------- \\
		"indent": func(spaces int, input string) string {
			return tools.Indent(input, spaces)
		},
		// Parameter order is reversed to stay compatible with sprig: https://github.com/Masterminds/sprig/blob/581758eb7d96ae4d113649668fa96acc74d46e7f/strings.go#L199
		"join": func(separator string, input []string) string {
			return strings.Join(input, separator)
		},
		"split": func(separator string, input string) []string {
			return strings.Split(input, separator)
		},
		"replace": func(old string, replacement string, input string) string {
			return strings.ReplaceAll(input, old, replacement)
		},

		"lower":          strings.ToLower,
		"lowerCamelCase": tools.LowerCamelCase,
		// Parameter order is reversed to stay compatible with sprig: https://github.com/Masterminds/sprig/blob/581758eb7d96ae4d113649668fa96acc74d46e7f/functions.go#L135
		"trimPrefix":     func(a, b string) string { return strings.TrimPrefix(b, a) },
		"upper":          strings.ToUpper,
		"upperCamelCase": tools.UpperCamelCase,

		// --------- \\
		// Templates \\
		// --------- \\
		"include": include,
		"blockExists": func(name string) bool {
			return template.tmpl.Lookup(name) != nil
		},
		"includeIfExists": func(name string, data any) (string, error) {
			if tmpl := template.tmpl.Lookup(name); tmpl == nil {
				return "", nil
			}

			return include(name, data)
		},
	}
}

// empty returns true if the given value has the zero value for its type.
// see https://github.com/Masterminds/sprig/blob/e708470d529a10ac1a3f02ab6fdd339b65958372/defaults.go#L35
func empty(given interface{}) bool {
	g := reflect.ValueOf(given)
	if !g.IsValid() {
		return true
	}

	// Basically adapted from text/template.isTrue
	switch g.Kind() {
	default:
		return g.IsNil()
	case reflect.Array, reflect.Slice, reflect.Map, reflect.String:
		return g.Len() == 0
	case reflect.Bool:
		return !g.Bool()
	case reflect.Complex64, reflect.Complex128:
		return g.Complex() == 0
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return g.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return g.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return g.Float() == 0
	case reflect.Struct:
		return false
	}
}
