package jsonlogic

import (
	"encoding/json"
	"io"
)

var operators = map[string]bool{
	"==":           true,
	"===":          true,
	"!=":           true,
	"!==":          true,
	">":            true,
	">=":           true,
	"<":            true,
	"<=":           true,
	"!":            true,
	"or":           true,
	"and":          true,
	"?:":           true,
	"in":           true,
	"cat":          true,
	"%":            true,
	"abs":          true,
	"max":          true,
	"min":          true,
	"+":            true,
	"-":            true,
	"*":            true,
	"/":            true,
	"substr":       true,
	"merge":        true,
	"if":           true,
	"!!":           true,
	"missing":      true,
	"missing_some": true,
	"some":         true,
	"filter":       true,
	"map":          true,
	"reduce":       true,
	"all":          true,
	"none":         true,
	"set":          true,
	"var":          true,
}

// IsValid reads a JSON Logic rule from io.Reader and validates it
func IsValid(rule io.Reader) bool {
	var _rule any

	decoderRule := json.NewDecoder(rule)
	err := decoderRule.Decode(&_rule)
	if err != nil {
		return false
	}

	return ValidateJsonLogic(_rule)
}

func ValidateJsonLogic(rules any) bool {
	if isVar(rules) {
		return true
	}

	if isMap(rules) {
		for operator, value := range rules.(map[string]any) {
			if !isOperator(operator) {
				return false
			}

			return ValidateJsonLogic(value)
		}
	}

	if isSlice(rules) {
		for _, value := range rules.([]any) {
			if isSlice(value) || isMap(value) {
				if ValidateJsonLogic(value) {
					continue
				}

				return false
			}

			if isVar(value) || isPrimitive(value) {
				continue
			}
		}

		return true
	}

	return isPrimitive(rules)
}

func isOperator(op string) bool {
	_, isOperator := operators[op]

	if !isOperator && customOperators[op] != nil {
		return true
	}

	return isOperator
}

func isVar(value any) bool {
	if !isMap(value) {
		return false
	}

	_var, ok := value.(map[string]any)["var"]
	if !ok {
		return false
	}

	return isString(_var) || isNumber(_var) || _var == nil
}
