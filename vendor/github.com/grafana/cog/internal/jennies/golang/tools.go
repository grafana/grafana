package golang

import (
	"fmt"
	"reflect"
	"regexp"
	"strings"

	"github.com/grafana/cog/internal/tools"
)

func formatPackageName(pkg string) string {
	splitPath := strings.Split(pkg, "/")
	if len(splitPath) > 1 {
		pkg = splitPath[len(splitPath)-1]
	}
	rgx := regexp.MustCompile("[^a-zA-Z0-9_]+")

	return strings.ToLower(rgx.ReplaceAllString(pkg, ""))
}

func formatFileName(name string) string {
	return strings.ToLower(name)
}

func formatArgName(name string) string {
	return escapeVarName(tools.LowerCamelCase(name))
}

func formatVarName(name string) string {
	return escapeVarName(tools.LowerCamelCase(name))
}

func formatObjectName(name string) string {
	return tools.UpperCamelCase(name)
}

func formatFunctionName(name string) string {
	return tools.UpperCamelCase(name)
}

func formatFieldName(name string) string {
	return tools.UpperCamelCase(name)
}

func escapeVarName(varName string) string {
	if isReservedGoKeyword(varName) {
		return varName + "Arg"
	}

	return varName
}

func formatScalar(val any) string {
	if val == nil {
		return "nil"
	}

	if list, ok := val.([]any); ok {
		items := make([]string, 0, len(list))

		for _, item := range list {
			items = append(items, formatScalar(item))
		}

		// FIXME: this is wrong, we can't just assume a list of strings.
		return fmt.Sprintf("[]string{%s}", strings.Join(items, ", "))
	}

	return fmt.Sprintf("%#v", val)
}

func isReservedGoKeyword(input string) bool {
	return input == "string" ||
		input == "uint8" ||
		input == "uint16" ||
		input == "uint32" ||
		input == "uint64" ||
		input == "int8" ||
		input == "int16" ||
		input == "int32" ||
		input == "int64" ||
		input == "float32" ||
		input == "float64" ||
		input == "complex64" ||
		input == "complex128" ||
		input == "byte" ||
		input == "rune" ||
		input == "uint" ||
		input == "int" ||
		input == "uintptr" ||
		input == "bool" ||
		// see: https://go.dev/ref/spec#Keywords
		input == "break" ||
		input == "case" ||
		input == "chan" ||
		input == "continue" ||
		input == "const" ||
		input == "default" ||
		input == "defer" ||
		input == "else" ||
		input == "error" ||
		input == "fallthrough" ||
		input == "for" ||
		input == "func" ||
		input == "go" ||
		input == "goto" ||
		input == "if" ||
		input == "import" ||
		input == "interface" ||
		input == "map" ||
		input == "package" ||
		input == "range" ||
		input == "return" ||
		input == "select" ||
		input == "struct" ||
		input == "switch" ||
		input == "type" ||
		input == "var"
}

func anyToDisjunctionBranchName(value any) string {
	return valueToDisjunctionBranchName(reflect.ValueOf(value))
}

func valueToDisjunctionBranchName(value reflect.Value) string {
	reflectKind := value.Kind()

	if reflectKind == reflect.Slice || reflectKind == reflect.Array {
		if value.Len() != 0 {
			return "ArrayOf" + valueToDisjunctionBranchName(unpackValue(value.Index(0)))
		}
	}

	return tools.UpperCamelCase(value.Kind().String())
}

func unpackValue(value reflect.Value) reflect.Value {
	if value.Kind() == reflect.Interface && !value.IsNil() {
		value = value.Elem()
	}
	return value
}
