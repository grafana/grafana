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

// This file describes how various cross-cutting modes influence default
// settings.
//
// It is used by gen.go to compile the instance into Go data, which is then
// used by the rest of the package to determine settings.
//
// There

// A File corresponds to a Go build.File.
#File: {
	filename:        string
	encoding:        #Encoding
	interpretation?: #Interpretation
	form?:           #Form
	tags?: [string]: string
}

// Default is the file used for stdin and stdout. The settings depend
// on the file mode.
#Default: #File & {
	filename: *"-" | string
}

// A FileInfo defines how a file is encoded and interpreted.
#FileInfo: {
	#File

	// For each of these fields it is explained what a true value means
	// for encoding/decoding.

	data:         *true | false // include/allow regular fields
	references:   *true | false // don't resolve/allow references
	cycles:       *true | false // cycles are permitted
	definitions:  bool          // include/allow definition fields
	optional:     bool          // include/allow definition fields
	constraints:  bool          // include/allow constraints
	keepDefaults: bool          // select/allow default values
	incomplete:   bool          // permit incomplete values
	imports:      bool          // don't expand/allow imports
	stream:       bool          // permit streaming
	docs:         bool          // show/allow docs
	attributes:   bool          // include/allow attributes
}

// modes sets defaults for different operational modes.
//
// These templates are intended to be unified in at the root of this
// configuration.
modes: _

// input defines modes for input, such as import, eval, vet or def.
// In input mode, settings flags are interpreted as what is allowed to occur
// in the input. The default settings, therefore, tend to be permissive.
modes: input: {
	#Default: {
		encoding: *"cue" | _
		...
	}
	#FileInfo: x, let x = {
		docs:       *true | false
		attributes: *true | false
	}
	encodings: cue: {
		*forms.schema | _
	}
	extensions: ".json": interpretation: *"auto" | _
	extensions: ".yaml": interpretation: *"auto" | _
	extensions: ".yml": interpretation:  *"auto" | _
}

modes: export: {
	#Default: {
		encoding: *"json" | _
		...
	}
	#FileInfo: x, let x = {
		docs:       true | *false
		attributes: true | *false
	}
	encodings: cue: {
		*forms.data | _
	}
}

modes: ouptut: {
	#FileInfo: x, let x = {
		docs:       true | *false
		attributes: true | *false
	}
	encodings: cue: {
		*forms.data | _
	}
}

// eval is a legacy mode
modes: eval: {
	#Default: {
		encoding: *"cue" | _
		...
	}
	#FileInfo: x, let x = {
		docs:       true | *false
		attributes: true | *false
	}
	encodings: cue: {
		*forms.final | _
	}
}

modes: def: {
	#Default: {
		encoding: *"cue" | _
		...
	}
	#FileInfo: x, let x = {
		docs:       *true | false
		attributes: *true | false
	}
	encodings: cue: {
		*forms.schema | _
	}
}

// Extension maps file extensions to default file properties.
extensions: {
	"":           _
	".cue":       tags.cue
	".json":      tags.json
	".jsonl":     tags.jsonl
	".ldjson":    tags.jsonl
	".ndjson":    tags.jsonl
	".yaml":      tags.yaml
	".yml":       tags.yaml
	".txt":       tags.text
	".go":        tags.go
	".proto":     tags.proto
	".textproto": tags.textproto
	".textpb":    tags.textproto // perhaps also pbtxt

	// TODO: jsonseq,
	// ".pb":        tags.binpb // binarypb
}

// A Encoding indicates a file format for representing a program.
#Encoding: !="" // | error("no encoding specified")

// An Interpretation determines how a certain program should be interpreted.
// For instance, data may be interpreted as describing a schema, which itself
// can be converted to a CUE schema.
#Interpretation: string
#Form:           string

file: #FileInfo & {

	filename: "foo.json"
	form:     "schema"
}

// tags maps command line tags to file properties.
tags: {
	schema: form: "schema"
	graph: form:  "graph"
	dag: form:    "dag"
	data: form:   "data"

	cue: encoding: "cue"

	json: encoding:      "json"
	jsonl: encoding:     "jsonl"
	yaml: encoding:      "yaml"
	proto: encoding:     "proto"
	textproto: encoding: "textproto"
	// "binpb":  encodings.binproto

	// pb is used either to indicate binary encoding, or to indicate
	pb: *{
		encoding:       "binarypb"
		interpretation: ""
	} | {
		encoding:       !="binarypb"
		interpretation: "pb"
	}

	text: {
		encoding: "text"
		form:     "data"
	}
	binary: {
		encoding: "binary"
		form:     "data"
	}
	go: {
		encoding:       "code"
		interpretation: ""
		tags: lang: "go"
	}
	code: {
		encoding:       "code"
		interpretation: ""
		tags: lang: string
	}

	auto: {
		interpretation: "auto"
		encoding:       *"json" | _
	}
	jsonschema: {
		interpretation: "jsonschema"
		encoding:       *"json" | _
	}
	openapi: {
		interpretation: "openapi"
		encoding:       *"json" | _
	}
}

// forms defines schema for all forms. It does not include the form ID.
forms: [Name=string]: #FileInfo

forms: "": _

forms: schema: {
	form:   *"schema" | "final" | "graph"
	stream: true | *false

	incomplete:   *true | false
	definitions:  *true | false
	optional:     *true | false
	constraints:  *true | false
	keepDefaults: *true | false
	imports:      *true | false
	optional:     *true | false
}

forms: final: {
	form: "final"
	forms.schema

	keepDefaults: false
	optional:     false
}

forms: graph: {
	form: *"graph" | "dag" | "data"
	data: true

	incomplete:   false
	definitions:  false
	optional:     false
	constraints:  false
	keepDefaults: false
	imports:      false
}

forms: dag: {
	form: !="graph"
	forms.graph

	cycles: false
}

forms: data: {
	form: !="dag"
	forms.dag

	constraints: false
	references:  false
	cycles:      false
	imports:     false
	optional:    false
}

// encodings: "": error("no encoding specified")

encodings: cue: {
	stream: false
}

encodings: json: {
	forms.data
	stream:     *false | true
	docs:       false
	attributes: false
}

encodings: yaml: {
	forms.graph
	stream: false | *true
}

encodings: jsonl: {
	forms.data
	stream: true
}

encodings: text: {
	forms.data
	stream: false
}

encodings: binary: {
	forms.data
	stream: false
}

encodings: toml: {
	forms.data
	stream: false
}

encodings: proto: {
	forms.schema
	encoding: "proto"
}

encodings: textproto: {
	forms.data
	encoding: "textproto"
	stream:   false
}

encodings: binarypb: {
	forms.data
	encoding: "binarypb"
	stream:   false
}

// encodings: binproto: {
//  forms.DataEncoding
//  encoding: "binproto"
// }

encodings: code: {
	forms.schema
	stream: false
}

interpretations: [Name=string]: #FileInfo

interpretations: "": _

interpretations: auto: {
	forms.schema
}

interpretations: jsonschema: {
	forms.schema
	encoding: *"json" | _
}

interpretations: openapi: {
	forms.schema
	encoding: *"json" | _
}

interpretations: pb: {
	forms.data
	stream: true
}
