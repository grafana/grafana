// Copyright 2020 CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package encoding

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/build"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/format"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/encoding/openapi"
	"cuelang.org/go/encoding/protobuf/jsonpb"
	"cuelang.org/go/encoding/protobuf/textproto"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/filetypes"
	"cuelang.org/go/pkg/encoding/yaml"
)

// An Encoder converts CUE to various file formats, including CUE itself.
// An Encoder allows
type Encoder struct {
	cfg          *Config
	close        func() error
	interpret    func(cue.Value) (*ast.File, error)
	encFile      func(*ast.File) error
	encValue     func(cue.Value) error
	autoSimplify bool
	concrete     bool
	instance     *cue.Instance
}

// IsConcrete reports whether the output is required to be concrete.
//
// INTERNAL ONLY: this is just to work around a problem related to issue #553
// of catching errors ony after syntax generation, dropping line number
// information.
func (e *Encoder) IsConcrete() bool {
	return e.concrete
}

func (e Encoder) Close() error {
	if e.close == nil {
		return nil
	}
	return e.close()
}

// NewEncoder writes content to the file with the given specification.
func NewEncoder(f *build.File, cfg *Config) (*Encoder, error) {
	w, close, err := writer(f, cfg)
	if err != nil {
		return nil, err
	}
	e := &Encoder{
		cfg:   cfg,
		close: close,
	}

	switch f.Interpretation {
	case "":
	case build.OpenAPI:
		// TODO: get encoding options
		cfg := &openapi.Config{}
		e.interpret = func(v cue.Value) (*ast.File, error) {
			i := e.instance
			if i == nil {
				i = internal.MakeInstance(v).(*cue.Instance)
			}
			return openapi.Generate(i, cfg)
		}
	case build.ProtobufJSON:
		e.interpret = func(v cue.Value) (*ast.File, error) {
			f := valueToFile(v)
			return f, jsonpb.NewEncoder(v).RewriteFile(f)
		}

	// case build.JSONSchema:
	// 	// TODO: get encoding options
	// 	cfg := openapi.Config{}
	// 	i.interpret = func(inst *cue.Instance) (*ast.File, error) {
	// 		return jsonschmea.Generate(inst, cfg)
	// 	}
	default:
		return nil, fmt.Errorf("unsupported interpretation %q", f.Interpretation)
	}

	switch f.Encoding {
	case build.CUE:
		fi, err := filetypes.FromFile(f, cfg.Mode)
		if err != nil {
			return nil, err
		}
		e.concrete = !fi.Incomplete

		synOpts := []cue.Option{}
		if !fi.KeepDefaults || !fi.Incomplete {
			synOpts = append(synOpts, cue.Final())
		}

		synOpts = append(synOpts,
			cue.Docs(fi.Docs),
			cue.Attributes(fi.Attributes),
			cue.Optional(fi.Optional),
			cue.Concrete(!fi.Incomplete),
			cue.Definitions(fi.Definitions),
			cue.ResolveReferences(!fi.References),
			cue.DisallowCycles(!fi.Cycles),
			cue.InlineImports(cfg.InlineImports),
		)

		opts := []format.Option{}
		opts = append(opts, cfg.Format...)

		useSep := false
		format := func(name string, n ast.Node) error {
			if name != "" && cfg.Stream {
				// TODO: make this relative to DIR
				fmt.Fprintf(w, "// %s\n", filepath.Base(name))
			} else if useSep {
				fmt.Println("// ---")
			}
			useSep = true

			opts := opts
			if e.autoSimplify {
				opts = append(opts, format.Simplify())
			}

			// Casting an ast.Expr to an ast.File ensures that it always ends
			// with a newline.
			b, err := format.Node(internal.ToFile(n), opts...)
			if err != nil {
				return err
			}
			_, err = w.Write(b)
			return err
		}
		e.encValue = func(v cue.Value) error {
			return format("", v.Syntax(synOpts...))
		}
		e.encFile = func(f *ast.File) error { return format(f.Filename, f) }

	case build.JSON, build.JSONL:
		e.concrete = true
		d := json.NewEncoder(w)
		d.SetIndent("", "    ")
		d.SetEscapeHTML(cfg.EscapeHTML)
		e.encValue = func(v cue.Value) error {
			err := d.Encode(v)
			if x, ok := err.(*json.MarshalerError); ok {
				err = x.Err
			}
			return err
		}

	case build.YAML:
		e.concrete = true
		streamed := false
		e.encValue = func(v cue.Value) error {
			if streamed {
				fmt.Fprintln(w, "---")
			}
			streamed = true

			str, err := yaml.Marshal(v)
			if err != nil {
				return err
			}
			_, err = fmt.Fprint(w, str)
			return err
		}

	case build.TextProto:
		// TODO: verify that the schema is given. Otherwise err out.
		e.concrete = true
		e.encValue = func(v cue.Value) error {
			v = v.Unify(cfg.Schema)
			b, err := textproto.NewEncoder().Encode(v)
			if err != nil {
				return err
			}

			_, err = w.Write(b)
			return err
		}

	case build.Text:
		e.concrete = true
		e.encValue = func(v cue.Value) error {
			s, err := v.String()
			if err != nil {
				return err
			}
			_, err = fmt.Fprint(w, s)
			if err != nil {
				return err
			}
			_, err = fmt.Fprintln(w)
			return err
		}

	case build.Binary:
		e.concrete = true
		e.encValue = func(v cue.Value) error {
			b, err := v.Bytes()
			if err != nil {
				return err
			}
			_, err = w.Write(b)
			return err
		}

	default:
		return nil, fmt.Errorf("unsupported encoding %q", f.Encoding)
	}

	return e, nil
}

func (e *Encoder) EncodeFile(f *ast.File) error {
	e.autoSimplify = false
	return e.encodeFile(f, e.interpret)
}

// EncodeInstance is as Encode, but stores instance information. This should
// all be retrievable from the value itself.
func (e *Encoder) EncodeInstance(v *cue.Instance) error {
	e.instance = v
	err := e.Encode(v.Value())
	e.instance = nil
	return err
}

func (e *Encoder) Encode(v cue.Value) error {
	e.autoSimplify = true
	if err := v.Validate(cue.Concrete(e.concrete)); err != nil {
		return err
	}
	if e.interpret != nil {
		f, err := e.interpret(v)
		if err != nil {
			return err
		}
		return e.encodeFile(f, nil)
	}
	if e.encValue != nil {
		return e.encValue(v)
	}
	return e.encFile(valueToFile(v))
}

func (e *Encoder) encodeFile(f *ast.File, interpret func(cue.Value) (*ast.File, error)) error {
	if interpret == nil && e.encFile != nil {
		return e.encFile(f)
	}
	e.autoSimplify = true
	var r cue.Runtime
	inst, err := r.CompileFile(f)
	if err != nil {
		return err
	}
	if interpret != nil {
		return e.Encode(inst.Value())
	}
	v := inst.Value()
	if err := v.Validate(cue.Concrete(e.concrete)); err != nil {
		return err
	}
	return e.encValue(v)
}

func writer(f *build.File, cfg *Config) (_ io.Writer, close func() error, err error) {
	if cfg.Out != nil {
		return cfg.Out, nil, nil
	}
	path := f.Filename
	if path == "-" {
		if cfg.Stdout == nil {
			return os.Stdout, nil, nil
		}
		return cfg.Stdout, nil, nil
	}
	if !cfg.Force {
		if _, err := os.Stat(path); err == nil {
			return nil, nil, errors.Wrapf(os.ErrExist, token.NoPos,
				"error writing %q", path)
		}
	}
	// Delay opening the file until we can write it to completion. This will
	// prevent clobbering the file in case of a crash.
	b := &bytes.Buffer{}
	fn := func() error {
		return ioutil.WriteFile(path, b.Bytes(), 0644)
	}
	return b, fn, nil
}
