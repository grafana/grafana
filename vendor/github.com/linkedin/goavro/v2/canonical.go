// Copyright [2019] LinkedIn Corp. Licensed under the Apache License, Version
// 2.0 (the "License"); you may not use this file except in compliance with the
// License.  You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

package goavro

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// pcfProcessor is a function type that given a parsed JSON object, returns its
// Parsing Canonical Form according to the Avro specification.
type pcfProcessor func(s interface{}) (string, error)

// parsingCanonialForm returns the "Parsing Canonical Form" (pcf) for a parsed
// JSON structure of a valid Avro schema, or an error describing the schema
// error.
func parsingCanonicalForm(schema interface{}, parentNamespace string, typeLookup map[string]string) (string, error) {
	switch val := schema.(type) {
	case map[string]interface{}:
		// JSON objects are decoded as a map of strings to empty interfaces
		return pcfObject(val, parentNamespace, typeLookup)
	case []interface{}:
		// JSON arrays are decoded as a slice of empty interfaces
		return pcfArray(val, parentNamespace, typeLookup)
	case string:
		// JSON string values are decoded as a Go string
		return pcfString(val, typeLookup)
	case float64:
		// JSON numerical values are decoded as Go float64
		return pcfNumber(val)
	default:
		return "", fmt.Errorf("cannot parse schema with invalid schema type; ought to be map[string]interface{}, []interface{}, string, or float64; received: %T: %v", schema, schema)
	}
}

// pcfNumber returns the parsing canonical form for a numerical value.
func pcfNumber(val float64) (string, error) {
	return strconv.FormatFloat(val, 'g', -1, 64), nil
}

// pcfString returns the parsing canonical form for a string value.
func pcfString(val string, typeLookup map[string]string) (string, error) {
	if canonicalName, ok := typeLookup[val]; ok {
		return `"` + canonicalName + `"`, nil
	}
	return `"` + val + `"`, nil
}

// pcfArray returns the parsing canonical form for a JSON array.
func pcfArray(val []interface{}, parentNamespace string, typeLookup map[string]string) (string, error) {
	items := make([]string, len(val))
	for i, el := range val {
		p, err := parsingCanonicalForm(el, parentNamespace, typeLookup)
		if err != nil {
			return "", err
		}
		items[i] = p
	}
	return "[" + strings.Join(items, ",") + "]", nil
}

// pcfObject returns the parsing canonical form for a JSON object.
func pcfObject(jsonMap map[string]interface{}, parentNamespace string, typeLookup map[string]string) (string, error) {
	pairs := make(stringPairs, 0, len(jsonMap))

	// Remember the namespace to fully qualify names later
	var namespace string
	if namespaceJSON, ok := jsonMap["namespace"]; ok {
		if namespaceStr, ok := namespaceJSON.(string); ok {
			// and it's value is string (otherwise invalid schema)
			if parentNamespace == "" {
				namespace = namespaceStr
			} else {
				namespace = parentNamespace + "." + namespaceStr
			}
			parentNamespace = namespace
		}
	} else if objectType, ok := jsonMap["type"]; ok && objectType == "record" {
		namespace = parentNamespace
	}

	for k, v := range jsonMap {

		// Reduce primitive schemas to their simple form.
		if len(jsonMap) == 1 && k == "type" {
			if t, ok := v.(string); ok {
				return "\"" + t + "\"", nil
			}
		}

		// Only keep relevant attributes (strip 'doc', 'alias', 'namespace')
		if _, ok := fieldOrder[k]; !ok {
			continue
		}

		// Add namespace to a non-qualified name.
		if k == "name" && namespace != "" {
			// Check if the name isn't already qualified.
			if t, ok := v.(string); ok && !strings.ContainsRune(t, '.') {
				v = namespace + "." + t
				typeLookup[t] = v.(string)
			}
		}

		// Only fixed type allows size, and we must convert a string size to a
		// float.
		if k == "size" {
			if s, ok := v.(string); ok {
				s, err := strconv.ParseUint(s, 10, 0)
				if err != nil {
					// should never get here because already validated schema
					return "", fmt.Errorf("Fixed size ought to be number greater than zero: %v", s)
				}
				v = float64(s)
			}
		}

		pk, err := parsingCanonicalForm(k, parentNamespace, typeLookup)
		if err != nil {
			return "", err
		}
		pv, err := parsingCanonicalForm(v, parentNamespace, typeLookup)
		if err != nil {
			return "", err
		}

		pairs = append(pairs, stringPair{k, pk + ":" + pv})
	}

	// Sort keys by their order in specification.
	sort.Sort(byAvroFieldOrder(pairs))
	return "{" + strings.Join(pairs.Bs(), ",") + "}", nil
}

// stringPair represents a pair of string values.
type stringPair struct {
	A string
	B string
}

// stringPairs is a sortable slice of pairs of strings.
type stringPairs []stringPair

// Bs returns an array of second values of an array of pairs.
func (sp *stringPairs) Bs() []string {
	items := make([]string, len(*sp))
	for i, el := range *sp {
		items[i] = el.B
	}
	return items
}

// fieldOrder defines fields that show up in canonical schema and specifies
// their precedence.
var fieldOrder = map[string]int{
	"name":    1,
	"type":    2,
	"fields":  3,
	"symbols": 4,
	"items":   5,
	"values":  6,
	"size":    7,
}

// byAvroFieldOrder is equipped with a sort order of fields according to the
// specification.
type byAvroFieldOrder []stringPair

func (s byAvroFieldOrder) Len() int {
	return len(s)
}

func (s byAvroFieldOrder) Swap(i, j int) {
	s[i], s[j] = s[j], s[i]
}

func (s byAvroFieldOrder) Less(i, j int) bool {
	return fieldOrder[s[i].A] < fieldOrder[s[j].A]
}
