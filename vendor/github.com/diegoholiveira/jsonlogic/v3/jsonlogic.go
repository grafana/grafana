package jsonlogic

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"

	"github.com/barkimedes/go-deepcopy"
)

type ErrInvalidOperator struct {
	operator string
}

func (e ErrInvalidOperator) Error() string {
	return fmt.Sprintf("The operator \"%s\" is not supported", e.operator)
}

func between(operator string, values []any, data any) any {
	a := parseValues(values[0], data)
	b := parseValues(values[1], data)
	c := parseValues(values[2], data)

	if operator == "<" {
		return less(a, b) && less(b, c)
	}

	if operator == "<=" {
		return (less(a, b) || equals(a, b)) && (less(b, c) || equals(b, c))
	}

	if operator == ">=" {
		return (less(c, b) || equals(c, b)) && (less(b, a) || equals(b, a))
	}

	return less(c, b) && less(b, a)
}

func unary(operator string, value any) any {
	if operator == "+" || operator == "*" || operator == "/" {
		return toNumber(value)
	}

	if operator == "-" {
		return -1 * toNumber(value)
	}

	if operator == "!!" {
		return !unary("!", value).(bool)
	}

	if operator == "abs" {
		return abs(value)
	}

	b := isTrue(value)

	if operator == "!" {
		return !b
	}

	return b
}

func _and(values, data any) any {
	values = getValuesWithoutParsing(values, data)
	var v float64

	isBoolExpression := true

	for _, value := range values.([]any) {
		value = parseValues(value, data)
		if isSlice(value) {
			return value
		}

		if isBool(value) && !value.(bool) {
			return false
		}

		if isString(value) && toString(value) == "" {
			return value
		}

		if !isNumber(value) {
			continue
		}

		isBoolExpression = false

		_value := toNumber(value)

		if _value > v {
			v = _value
		}
	}

	if isBoolExpression {
		return true
	}

	return v
}

func _or(values, data any) any {
	values = getValuesWithoutParsing(values, data)

	for _, value := range values.([]any) {
		parsed := parseValues(value, data)
		if isTrue(parsed) {
			return parsed
		}
	}

	return false
}

func _inRange(value any, values any) bool {
	v := values.([]any)

	i := v[0]
	j := v[1]

	if isNumber(value) {
		return toNumber(value) >= toNumber(i) && toNumber(j) >= toNumber(value)
	}

	return toString(value) >= toString(i) && toString(j) >= toString(value)
}

func _in(value any, values any) bool {
	if value == nil || values == nil {
		return false
	}

	if isString(values) {
		return strings.Contains(values.(string), value.(string))
	}

	if !isSlice(values) {
		return false
	}

	for _, element := range values.([]any) {
		if isSlice(element) {
			if _inRange(value, element) {
				return true
			}

			continue
		}

		if isNumber(value) {
			if toNumber(element) == value {
				return true
			}

			continue
		}

		if element == value {
			return true
		}
	}

	return false
}

func max(values any) any {
	converted := values.([]any)
	size := len(converted)
	if size == 0 {
		return nil
	}

	bigger := toNumber(converted[0])

	for i := 1; i < size; i++ {
		_n := toNumber(converted[i])
		if _n > bigger {
			bigger = _n
		}
	}

	return bigger
}

func min(values any) any {
	converted := values.([]any)
	size := len(converted)
	if size == 0 {
		return nil
	}

	smallest := toNumber(converted[0])

	for i := 1; i < size; i++ {
		_n := toNumber(converted[i])
		if smallest > _n {
			smallest = _n
		}
	}

	return smallest
}

func merge(values any, level int8) any {
	result := make([]any, 0)

	if isPrimitive(values) || level > 1 {
		return append(result, values)
	}

	if isSlice(values) {
		for _, value := range values.([]any) {
			_values := merge(value, level+1).([]any)

			result = append(result, _values...)
		}
	}

	return result
}

func conditional(values, data any) any {
	if isPrimitive(values) {
		return values
	}

	parsed := values.([]any)

	length := len(parsed)

	if length == 0 {
		return nil
	}

	for i := 0; i < length-1; i = i + 2 {
		v := parsed[i]
		if isMap(v) {
			v = getVar(parsed[i], data)
		}

		if isTrue(v) {
			return parseValues(parsed[i+1], data)
		}
	}

	if length%2 == 1 {
		return parsed[length-1]
	}

	return nil
}

func setProperty(value, data any) any {
	_value := value.([]any)

	object := _value[0]

	if !isMap(object) {
		return object
	}

	property := _value[1].(string)
	modified, err := deepcopy.Anything(object)
	if err != nil {
		panic(err)
	}

	_modified := modified.(map[string]any)
	_modified[property] = parseValues(_value[2], data)

	return any(_modified)
}

func missing(values, data any) any {
	if isString(values) {
		values = []any{values}
	}

	missing := make([]any, 0)

	for _, _var := range values.([]any) {
		_value := getVar(_var, data)

		if _value == nil {
			missing = append(missing, _var)
		}
	}

	return missing
}

func missingSome(values, data any) any {
	parsed := values.([]any)
	number := int(toNumber(parsed[0]))
	vars := parsed[1]

	missing := make([]any, 0)
	found := make([]any, 0)

	for _, _var := range vars.([]any) {
		_value := getVar(_var, data)

		if _value == nil {
			missing = append(missing, _var)
		} else {
			found = append(found, _var)
		}
	}

	if number > len(found) {
		return missing
	}

	return make([]any, 0)
}

func all(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if !isTrue(subject) {
		return false
	}

	for _, value := range subject.([]any) {
		conditions := solveVars(parsed[1], value)
		v := apply(conditions, value)

		if !isTrue(v) {
			return false
		}
	}

	return true
}

func none(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if !isTrue(subject) {
		return true
	}

	conditions := solveVars(parsed[1], data)

	for _, value := range subject.([]any) {
		v := apply(conditions, value)

		if isTrue(v) {
			return false
		}
	}

	return true
}

func some(values, data any) any {
	parsed := values.([]any)

	var subject any

	if isMap(parsed[0]) {
		subject = apply(parsed[0], data)
	}

	if isSlice(parsed[0]) {
		subject = parsed[0]
	}

	if !isTrue(subject) {
		return false
	}

	for _, value := range subject.([]any) {
		v := apply(
			solveVars(
				solveVars(parsed[1], data),
				value,
			),
			value,
		)

		if isTrue(v) {
			return true
		}
	}

	return false
}

func parseValues(values, data any) any {
	if values == nil || isPrimitive(values) {
		return values
	}

	if isMap(values) {
		return apply(values, data)
	}

	parsed := make([]any, 0)

	for _, value := range values.([]any) {
		if isMap(value) {
			parsed = append(parsed, apply(value, data))
		} else {
			parsed = append(parsed, value)
		}
	}

	return parsed
}

// If values represents a map (an operation), returns the result. Otherwise returns the
// values without parsing. This means that each of the returned values might be a subtree
// of JSONLogic.
// Used in lazy evaluation of "AND" and "OR" operators
func getValuesWithoutParsing(values, data any) any {
	if values == nil || isPrimitive(values) {
		return values
	}

	if isMap(values) {
		return apply(values, data)
	}

	return values.([]any)
}

func apply(rules, data any) any {
	ruleMap := rules.(map[string]any)

	// A map with more than 1 key counts as a primitive
	// end recursion
	if len(ruleMap) > 1 {
		return ruleMap
	}

	for operator, values := range ruleMap {
		if operator == "filter" {
			return filter(values, data)
		}

		if operator == "map" {
			return _map(values, data)
		}

		if operator == "reduce" {
			return reduce(values, data)
		}

		if operator == "all" {
			return all(values, data)
		}

		if operator == "none" {
			return none(values, data)
		}

		if operator == "some" {
			return some(values, data)
		}

		return operation(operator, values, data)
	}

	// an empty-map rule should return an empty-map
	return make(map[string]any)
}

// Apply read the rule and it's data from io.Reader, executes it
// and write back a JSON into an io.Writer result
func Apply(rule, data io.Reader, result io.Writer) error {
	if data == nil {
		data = strings.NewReader("{}")
	}

	var _rule any
	var _data any

	decoder := json.NewDecoder(rule)
	err := decoder.Decode(&_rule)
	if err != nil {
		return err
	}

	decoder = json.NewDecoder(data)
	err = decoder.Decode(&_data)
	if err != nil {
		return err
	}

	output, err := ApplyInterface(_rule, _data)
	if err != nil {
		return err
	}

	return json.NewEncoder(result).Encode(output)
}

func GetJsonLogicWithSolvedVars(rule, data json.RawMessage) ([]byte, error) {
	if data == nil {
		data = json.RawMessage("{}")
	}

	// parse rule and data from json.RawMessage to interface
	var _rule any
	var _data any

	err := json.Unmarshal(rule, &_rule)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &_data)
	if err != nil {
		return nil, err
	}

	return solveVarsBackToJsonLogic(_rule, _data)
}

// ApplyRaw receives a rule and data as json.RawMessage and returns the result
// of the rule applied to the data.
func ApplyRaw(rule, data json.RawMessage) (json.RawMessage, error) {
	if data == nil {
		data = json.RawMessage("{}")
	}

	var _rule any
	var _data any

	err := json.Unmarshal(rule, &_rule)
	if err != nil {
		return nil, err
	}

	err = json.Unmarshal(data, &_data)
	if err != nil {
		return nil, err
	}

	result, err := ApplyInterface(_rule, _data)
	if err != nil {
		return nil, err
	}

	return json.Marshal(&result)
}

// ApplyInterface receives a rule and data as any and returns the result
// of the rule applied to the data.
func ApplyInterface(rule, data any) (output any, err error) {
	defer func() {
		if e := recover(); e != nil {
			// fmt.Println("stacktrace from panic: \n" + string(debug.Stack()))
			err = e.(error)
		}
	}()

	if isMap(rule) {
		return apply(rule, data), err
	}

	if isSlice(rule) {
		var parsed []any

		for _, value := range rule.([]any) {
			parsed = append(parsed, parseValues(value, data))
		}

		return any(parsed), nil
	}

	return rule, err
}
