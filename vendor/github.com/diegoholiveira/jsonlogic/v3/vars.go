package jsonlogic

import (
	"encoding/json"
	"strconv"
	"strings"
)

func solveVars(values, data any) any {
	if isMap(values) {
		logic := map[string]any{}

		for key, value := range values.(map[string]any) {
			if key == "var" {
				if isString(value) && (value == "" || strings.HasPrefix(value.(string), ".")) {
					logic["var"] = value
					continue
				}

				if isEmptySlice(value) {
					logic["var"] = ""
					continue
				}

				val := getVar(value, data)
				if val != nil {
					return val
				}

				logic["var"] = value
			} else {
				logic[key] = solveVars(value, data)
			}
		}

		return any(logic)
	}

	if isSlice(values) {
		logic := []any{}

		for _, value := range values.([]any) {
			logic = append(logic, solveVars(value, data))
		}

		return logic
	}

	return values
}

func getVar(value, data any) any {
	if value == nil {
		if !isPrimitive(data) {
			return nil
		}
		return data
	}

	if isString(value) && toString(value) == "" {
		return data
	}

	if isNumber(value) {
		value = toString(value)
	}

	var _default any

	if isSlice(value) { // syntax sugar
		v := value.([]any)

		if len(v) == 0 {
			return data
		}

		if len(v) == 2 {
			_default = v[1]
		}

		value = v[0].(string)
	}

	if data == nil {
		return _default
	}

	parts := strings.Split(value.(string), ".")

	var _value any

	for _, part := range parts {
		if part == "" {
			continue
		}

		if isMap(data) {
			_value = data.(map[string]any)[part]
		}

		if isSlice(data) {
			pos := int(toNumber(part))
			container := data.([]any)
			if pos >= len(container) {
				return _default
			}
			_value = container[pos]
		}

		if _value == nil {
			return _default
		}

		if isPrimitive(_value) {
			continue
		}

		data = _value
	}

	return _value
}

func solveVarsBackToJsonLogic(rule, data any) (json.RawMessage, error) {
	ruleMap := rule.(map[string]any)
	result := make(map[string]any)

	for operator, values := range ruleMap {
		result[operator] = solveVars(values, data)
	}

	resultJson, err := json.Marshal(result)

	if err != nil {
		return nil, err
	}

	// we need to use Unquote due to unicode characters (example \u003e= need to be >=)
	// used for prettier json.RawMessage
	resultEscaped, err := strconv.Unquote(strings.Replace(strconv.Quote(string(resultJson)), `\\u`, `\u`, -1))

	if err != nil {
		return nil, err
	}

	return []byte(resultEscaped), nil
}
