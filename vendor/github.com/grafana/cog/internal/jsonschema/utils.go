package jsonschema

import (
	"encoding/json"
	"strings"

	schemaparser "github.com/santhosh-tekuri/jsonschema/v5"
)

func schemaComments(schema *schemaparser.Schema) []string {
	comment := schema.Description

	lines := strings.Split(comment, "\n")
	filtered := make([]string, 0, len(lines))

	for _, line := range lines {
		if line == "" {
			continue
		}

		filtered = append(filtered, line)
	}

	return filtered
}

func unwrapJSONNumber(input any) any {
	if val, ok := input.(json.Number); ok {
		asInt, err := val.Int64()
		if err == nil {
			return asInt
		}

		asFloat, err := val.Float64()
		if err == nil {
			return asFloat
		}

		return val.String()
	}

	return input
}
