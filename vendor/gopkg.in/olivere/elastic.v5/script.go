// Copyright 2012-present Oliver Eilhard. All rights reserved.
// Use of this source code is governed by a MIT-license.
// See http://olivere.mit-license.org/license.txt for details.

package elastic

import "errors"

// Script holds all the paramaters necessary to compile or find in cache
// and then execute a script.
//
// See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/modules-scripting.html
// for details of scripting.
type Script struct {
	script string
	typ    string
	lang   string
	params map[string]interface{}
}

// NewScript creates and initializes a new Script.
func NewScript(script string) *Script {
	return &Script{
		script: script,
		typ:    "", // default type is "inline"
		params: make(map[string]interface{}),
	}
}

// NewScriptInline creates and initializes a new Script of type "inline".
func NewScriptInline(script string) *Script {
	return NewScript(script).Type("inline")
}

// NewScriptId creates and initializes a new Script of type "id".
func NewScriptId(script string) *Script {
	return NewScript(script).Type("id")
}

// NewScriptFile creates and initializes a new Script of type "file".
func NewScriptFile(script string) *Script {
	return NewScript(script).Type("file")
}

// Script is either the cache key of the script to be compiled/executed
// or the actual script source code for inline scripts. For indexed
// scripts this is the id used in the request. For file scripts this is
// the file name.
func (s *Script) Script(script string) *Script {
	s.script = script
	return s
}

// Type sets the type of script: "inline", "id", or "file".
func (s *Script) Type(typ string) *Script {
	s.typ = typ
	return s
}

// Lang sets the language of the script. Permitted values are "groovy",
// "expression", "mustache", "mvel" (default), "javascript", "python".
// To use certain languages, you need to configure your server and/or
// add plugins. See https://www.elastic.co/guide/en/elasticsearch/reference/5.2/modules-scripting.html
// for details.
func (s *Script) Lang(lang string) *Script {
	s.lang = lang
	return s
}

// Param adds a key/value pair to the parameters that this script will be executed with.
func (s *Script) Param(name string, value interface{}) *Script {
	if s.params == nil {
		s.params = make(map[string]interface{})
	}
	s.params[name] = value
	return s
}

// Params sets the map of parameters this script will be executed with.
func (s *Script) Params(params map[string]interface{}) *Script {
	s.params = params
	return s
}

// Source returns the JSON serializable data for this Script.
func (s *Script) Source() (interface{}, error) {
	if s.typ == "" && s.lang == "" && len(s.params) == 0 {
		return s.script, nil
	}
	source := make(map[string]interface{})
	if s.typ == "" {
		source["inline"] = s.script
	} else {
		source[s.typ] = s.script
	}
	if s.lang != "" {
		source["lang"] = s.lang
	}
	if len(s.params) > 0 {
		source["params"] = s.params
	}
	return source, nil
}

// -- Script Field --

// ScriptField is a single script field.
type ScriptField struct {
	FieldName string // name of the field

	script *Script
}

// NewScriptField creates and initializes a new ScriptField.
func NewScriptField(fieldName string, script *Script) *ScriptField {
	return &ScriptField{FieldName: fieldName, script: script}
}

// Source returns the serializable JSON for the ScriptField.
func (f *ScriptField) Source() (interface{}, error) {
	if f.script == nil {
		return nil, errors.New("ScriptField expects script")
	}
	source := make(map[string]interface{})
	src, err := f.script.Source()
	if err != nil {
		return nil, err
	}
	source["script"] = src
	return source, nil
}
