// Copyright 2015 go-swagger maintainers
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package loads

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"fmt"

	"github.com/go-openapi/analysis"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/swag"
)

func init() {
	gob.Register(map[string]interface{}{})
	gob.Register([]interface{}{})
}

// Document represents a swagger spec document
type Document struct {
	// specAnalyzer
	Analyzer     *analysis.Spec
	spec         *spec.Swagger
	specFilePath string
	origSpec     *spec.Swagger
	schema       *spec.Schema
	pathLoader   *loader
	raw          json.RawMessage
}

// JSONSpec loads a spec from a json document
func JSONSpec(path string, options ...LoaderOption) (*Document, error) {
	data, err := JSONDoc(path)
	if err != nil {
		return nil, err
	}
	// convert to json
	doc, err := Analyzed(data, "", options...)
	if err != nil {
		return nil, err
	}

	doc.specFilePath = path

	return doc, nil
}

// Embedded returns a Document based on embedded specs. No analysis is required
func Embedded(orig, flat json.RawMessage, options ...LoaderOption) (*Document, error) {
	var origSpec, flatSpec spec.Swagger
	if err := json.Unmarshal(orig, &origSpec); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(flat, &flatSpec); err != nil {
		return nil, err
	}
	return &Document{
		raw:        orig,
		origSpec:   &origSpec,
		spec:       &flatSpec,
		pathLoader: loaderFromOptions(options),
	}, nil
}

// Spec loads a new spec document from a local or remote path
func Spec(path string, options ...LoaderOption) (*Document, error) {
	ldr := loaderFromOptions(options)

	b, err := ldr.Load(path)
	if err != nil {
		return nil, err
	}

	document, err := Analyzed(b, "", options...)
	if err != nil {
		return nil, err
	}

	document.specFilePath = path
	document.pathLoader = ldr

	return document, nil
}

// Analyzed creates a new analyzed spec document for a root json.RawMessage.
func Analyzed(data json.RawMessage, version string, options ...LoaderOption) (*Document, error) {
	if version == "" {
		version = "2.0"
	}
	if version != "2.0" {
		return nil, fmt.Errorf("spec version %q is not supported", version)
	}

	raw, err := trimData(data) // trim blanks, then convert yaml docs into json
	if err != nil {
		return nil, err
	}

	swspec := new(spec.Swagger)
	if err = json.Unmarshal(raw, swspec); err != nil {
		return nil, err
	}

	origsqspec, err := cloneSpec(swspec)
	if err != nil {
		return nil, err
	}

	d := &Document{
		Analyzer:   analysis.New(swspec), // NOTE: at this moment, analysis does not follow $refs to documents outside the root doc
		schema:     spec.MustLoadSwagger20Schema(),
		spec:       swspec,
		raw:        raw,
		origSpec:   origsqspec,
		pathLoader: loaderFromOptions(options),
	}

	return d, nil
}

func trimData(in json.RawMessage) (json.RawMessage, error) {
	trimmed := bytes.TrimSpace(in)
	if len(trimmed) == 0 {
		return in, nil
	}

	if trimmed[0] == '{' || trimmed[0] == '[' {
		return trimmed, nil
	}

	// assume yaml doc: convert it to json
	yml, err := swag.BytesToYAMLDoc(trimmed)
	if err != nil {
		return nil, fmt.Errorf("analyzed: %v", err)
	}

	d, err := swag.YAMLToJSON(yml)
	if err != nil {
		return nil, fmt.Errorf("analyzed: %v", err)
	}

	return d, nil
}

// Expanded expands the $ref fields in the spec document and returns a new spec document
func (d *Document) Expanded(options ...*spec.ExpandOptions) (*Document, error) {
	swspec := new(spec.Swagger)
	if err := json.Unmarshal(d.raw, swspec); err != nil {
		return nil, err
	}

	var expandOptions *spec.ExpandOptions
	if len(options) > 0 {
		expandOptions = options[0]
		if expandOptions.RelativeBase == "" {
			expandOptions.RelativeBase = d.specFilePath
		}
	} else {
		expandOptions = &spec.ExpandOptions{
			RelativeBase: d.specFilePath,
		}
	}

	if expandOptions.PathLoader == nil {
		if d.pathLoader != nil {
			// use loader from Document options
			expandOptions.PathLoader = d.pathLoader.Load
		} else {
			// use package level loader
			expandOptions.PathLoader = loaders.Load
		}
	}

	if err := spec.ExpandSpec(swspec, expandOptions); err != nil {
		return nil, err
	}

	dd := &Document{
		Analyzer:     analysis.New(swspec),
		spec:         swspec,
		specFilePath: d.specFilePath,
		schema:       spec.MustLoadSwagger20Schema(),
		raw:          d.raw,
		origSpec:     d.origSpec,
	}
	return dd, nil
}

// BasePath the base path for the API specified by this spec
func (d *Document) BasePath() string {
	return d.spec.BasePath
}

// Version returns the version of this spec
func (d *Document) Version() string {
	return d.spec.Swagger
}

// Schema returns the swagger 2.0 schema
func (d *Document) Schema() *spec.Schema {
	return d.schema
}

// Spec returns the swagger spec object model
func (d *Document) Spec() *spec.Swagger {
	return d.spec
}

// Host returns the host for the API
func (d *Document) Host() string {
	return d.spec.Host
}

// Raw returns the raw swagger spec as json bytes
func (d *Document) Raw() json.RawMessage {
	return d.raw
}

// OrigSpec yields the original spec
func (d *Document) OrigSpec() *spec.Swagger {
	return d.origSpec
}

// ResetDefinitions gives a shallow copy with the models reset to the original spec
func (d *Document) ResetDefinitions() *Document {
	defs := make(map[string]spec.Schema, len(d.origSpec.Definitions))
	for k, v := range d.origSpec.Definitions {
		defs[k] = v
	}

	d.spec.Definitions = defs
	return d
}

// Pristine creates a new pristine document instance based on the input data
func (d *Document) Pristine() *Document {
	raw, _ := json.Marshal(d.Spec())
	dd, _ := Analyzed(raw, d.Version())
	dd.pathLoader = d.pathLoader
	dd.specFilePath = d.specFilePath

	return dd
}

// SpecFilePath returns the file path of the spec if one is defined
func (d *Document) SpecFilePath() string {
	return d.specFilePath
}

func cloneSpec(src *spec.Swagger) (*spec.Swagger, error) {
	var b bytes.Buffer
	if err := gob.NewEncoder(&b).Encode(src); err != nil {
		return nil, err
	}

	var dst spec.Swagger
	if err := gob.NewDecoder(&b).Decode(&dst); err != nil {
		return nil, err
	}
	return &dst, nil
}
