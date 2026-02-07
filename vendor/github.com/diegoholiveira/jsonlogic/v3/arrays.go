package jsonlogic

import (
	"fmt"
)

type ErrReduceDataType struct {
	dataType string
}

func (e ErrReduceDataType) Error() string {
	return fmt.Sprintf("The type \"%s\" is not supported", e.dataType)
}

func filter(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	result := make([]any, 0)

	if subject == nil {
		return result
	}

	logic := solveVars(parsed[1], data)

	for _, value := range subject.([]any) {
		v := parseValues(logic, value)

		if isTrue(v) {
			result = append(result, value)
		}
	}

	return result
}

func _map(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	result := make([]any, 0)

	if subject == nil {
		return result
	}

	logic := solveVars(parsed[1], data)

	for _, value := range subject.([]any) {
		v := parseValues(logic, value)

		if isTrue(v) || isNumber(v) || isBool(v) {
			result = append(result, v)
		}
	}

	return result
}

func reduce(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	if subject == nil {
		return float64(0)
	}

	var (
		accumulator any
		valueType   string
	)

	{
		initialValue := parsed[2]
		if isMap(initialValue) {
			initialValue = apply(initialValue, data)
		}

		if isBool(initialValue) {
			accumulator = isTrue(initialValue)
			valueType = "bool"
		} else if isNumber(initialValue) {
			accumulator = toNumber(initialValue)
			valueType = "number"
		} else if isString(initialValue) {
			accumulator = toString(initialValue)
			valueType = "string"
		} else {
			panic(ErrReduceDataType{
				dataType: fmt.Sprintf("%T", parsed[2]),
			})
		}
	}

	context := map[string]any{
		"current":     float64(0),
		"accumulator": accumulator,
		"valueType":   valueType,
	}

	for _, value := range subject.([]any) {
		if value == nil {
			continue
		}

		context["current"] = value

		v := apply(parsed[1], context)

		switch context["valueType"] {
		case "bool":
			context["accumulator"] = isTrue(v)
		case "number":
			context["accumulator"] = toNumber(v)
		case "string":
			context["accumulator"] = toString(v)
		}
	}

	return context["accumulator"]
}
