// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package loads

import (
	"bytes"
	"encoding/gob"
	"encoding/json"
	"errors"
	"fmt"
	"maps"

	"github.com/go-openapi/analysis"
	"github.com/go-openapi/spec"
	"github.com/go-openapi/swag/yamlutils"
)

func init() {
	gob.Register(map[string]any{})
	gob.Register([]any{})
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

// JSONSpec loads a spec from a json document, using the [JSONDoc] loader.
//
// A set of [loading.Option] may be passed to this loader using [WithLoadingOptions].
func JSONSpec(path string, opts ...LoaderOption) (*Document, error) {
	var o options
	for _, apply := range opts {
		apply(&o)
	}

	data, err := JSONDoc(path, o.loadingOptions...)
	if err != nil {
		return nil, err
	}
	// convert to json
	doc, err := Analyzed(data, "", opts...)
	if err != nil {
		return nil, err
	}

	doc.specFilePath = path

	return doc, nil
}

// Embedded returns a Document based on embedded specs (i.e. as a raw [json.RawMessage]). No analysis is required
func Embedded(orig, flat json.RawMessage, opts ...LoaderOption) (*Document, error) {
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
		pathLoader: loaderFromOptions(opts),
	}, nil
}

// Spec loads a new spec document from a local or remote path.
//
// By default it uses a JSON or YAML loader, with auto-detection based on the resource extension.
func Spec(path string, opts ...LoaderOption) (*Document, error) {
	ldr := loaderFromOptions(opts)

	b, err := ldr.Load(path)
	if err != nil {
		return nil, err
	}

	document, err := Analyzed(b, "", opts...)
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
		return nil, fmt.Errorf("spec version %q is not supported: %w", version, ErrLoads)
	}

	raw, err := trimData(data) // trim blanks, then convert yaml docs into json
	if err != nil {
		return nil, err
	}

	swspec := new(spec.Swagger)
	if err = json.Unmarshal(raw, swspec); err != nil {
		return nil, errors.Join(err, ErrLoads)
	}

	origsqspec, err := cloneSpec(swspec)
	if err != nil {
		return nil, errors.Join(err, ErrLoads)
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
	yml, err := yamlutils.BytesToYAMLDoc(trimmed)
	if err != nil {
		return nil, fmt.Errorf("analyzed: %v: %w", err, ErrLoads)
	}

	d, err := yamlutils.YAMLToJSON(yml)
	if err != nil {
		return nil, fmt.Errorf("analyzed: %v: %w", err, ErrLoads)
	}

	return d, nil
}

// Expanded expands the $ref fields in the spec [Document] and returns a new expanded [Document]
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
	if d.spec == nil {
		return ""
	}
	return d.spec.BasePath
}

// Version returns the OpenAPI version of this spec (e.g. 2.0)
func (d *Document) Version() string {
	return d.spec.Swagger
}

// Schema returns the swagger 2.0 meta-schema
func (d *Document) Schema() *spec.Schema {
	return d.schema
}

// Spec returns the swagger object model for this API specification
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

// ResetDefinitions yields a shallow copy with the models reset to the original spec
func (d *Document) ResetDefinitions() *Document {
	d.spec.Definitions = make(map[string]spec.Schema, len(d.origSpec.Definitions))
	maps.Copy(d.spec.Definitions, d.origSpec.Definitions)

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
