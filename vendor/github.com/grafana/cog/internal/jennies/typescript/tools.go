package typescript

import (
	"fmt"
	"strings"

	"github.com/grafana/cog/internal/orderedmap"
	"github.com/grafana/cog/internal/tools"
)

func formatPackageName(pkg string) string {
	return tools.LowerCamelCase(pkg)
}

func formatObjectName(name string) string {
	return tools.CleanupNames(name)
}

func formatIdentifier(name string) string {
	return tools.LowerCamelCase(escapeIdentifier(name))
}

func formatEnumMemberName(name string) string {
	return tools.CleanupNames(tools.UpperCamelCase(escapeEnumMemberName(name)))
}

func escapeIdentifier(name string) string {
	if isReservedTypescriptKeyword(name) {
		return name + "Val"
	}

	return name
}

func escapeEnumMemberName(identifier string) string {
	if strings.EqualFold("nan", identifier) {
		return "not_a_number"
	}

	return identifier
}

func isReservedTypescriptKeyword(input string) bool {
	// see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words
	switch input {
	case "break", "case", "catch", "class", "const", "continue", "debugger", "default", "delete",
		"do", "else", "export", "extends", "false", "finally", "for", "function", "if", "import",
		"in", "instanceof", "new", "null", "return", "super", "switch", "this", "throw", "true",
		"try", "typeof", "var", "void", "while", "with", "let", "static", "yield", "await":
		return true

	default:
		return false
	}
}

func formatValue(val any) string {
	if rawVal, ok := val.(raw); ok {
		return string(rawVal)
	}

	var buffer strings.Builder

	if array, ok := val.([]any); ok {
		buffer.WriteString("[\n")
		for _, v := range array {
			buffer.WriteString(fmt.Sprintf("%s,\n", formatValue(v)))
		}
		buffer.WriteString("]")

		return buffer.String()
	}

	if mapVal, ok := val.(map[string]any); ok {
		buffer.WriteString("{\n")

		for key, value := range mapVal {
			buffer.WriteString(fmt.Sprintf("\t%s: %s,\n", key, formatValue(value)))
		}

		buffer.WriteString("}")

		return buffer.String()
	}

	if orderedMap, ok := val.(*orderedmap.Map[string, any]); ok {
		buffer.WriteString("{\n")

		orderedMap.Iterate(func(key string, value any) {
			buffer.WriteString(fmt.Sprintf("\t%s: %s,\n", key, formatValue(value)))
		})

		buffer.WriteString("}")

		return buffer.String()
	}

	return fmt.Sprintf("%#v", val)
}
