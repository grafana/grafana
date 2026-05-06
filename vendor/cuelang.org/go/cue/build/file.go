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

package build

import "cuelang.org/go/cue/errors"

// A File represents a file that is part of the build process.
type File struct {
	Filename string `json:"filename"`

	Encoding       Encoding          `json:"encoding,omitempty"`
	Interpretation Interpretation    `json:"interpretation,omitempty"`
	Form           Form              `json:"form,omitempty"`
	Tags           map[string]string `json:"tags,omitempty"` // code=go

	ExcludeReason errors.Error `json:"-"`
	Source        interface{}  `json:"-"` // TODO: swap out with concrete type.
}

// A Encoding indicates a file format for representing a program.
type Encoding string

const (
	CUE         Encoding = "cue"
	JSON        Encoding = "json"
	YAML        Encoding = "yaml"
	JSONL       Encoding = "jsonl"
	Text        Encoding = "text"
	Binary      Encoding = "binary"
	Protobuf    Encoding = "proto"
	TextProto   Encoding = "textproto"
	BinaryProto Encoding = "pb"

	// TODO:
	// TOML

	Code Encoding = "code" // Programming languages
)

// An Interpretation determines how a certain program should be interpreted.
// For instance, data may be interpreted as describing a schema, which itself
// can be converted to a CUE schema.
type Interpretation string

const (
	// Auto interprets the underlying data file as data, JSON Schema or OpenAPI,
	// depending on the existence of certain marker fields.
	//
	// JSON Schema is identified by a top-level "$schema" field with a URL
	// of the form "https?://json-schema.org/.*schema#?".
	//
	// OpenAPI is identified by the existence of a top-level field "openapi"
	// with a major semantic version of 3, as well as the existence of
	// the info.title and info.version fields.
	//
	// In all other cases, the underlying data is interpreted as is.
	Auto         Interpretation = "auto"
	JSONSchema   Interpretation = "jsonschema"
	OpenAPI      Interpretation = "openapi"
	ProtobufJSON Interpretation = "pb"
)

// A Form specifies the form in which a program should be represented.
type Form string

const (
	Full   Form = "full"
	Schema Form = "schema"
	Struct Form = "struct"
	Final  Form = "final" // picking default values, may be non-concrete
	Graph  Form = "graph" // Data only, but allow references
	DAG    Form = "dag"   // Like graph, but don't allow cycles
	Data   Form = "data"  // always final
)
