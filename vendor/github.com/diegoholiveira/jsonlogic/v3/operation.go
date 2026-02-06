package jsonlogic

// customOperators holds custom operators
var customOperators = make(map[string]func(values, data any) (result any))

// AddOperator allows for custom operators to be used
func AddOperator(key string, cb func(values, data any) (result any)) {
	customOperators[key] = cb
}

func operation(operator string, values, data any) any {
	// "AND" evaluates values lazily, so parseValues() is delayed until needed
	if operator == "and" {
		return _and(values, data)
	}

	// "OR" evaluates values lazily, so parseValues() is delayed until needed
	if operator == "or" {
		return _or(values, data)
	}

	// Parse the entire remaining tree and eval recursively for non-lazy eval operators
	values = parseValues(values, data)

	// Check against any custom operators
	customOperation, isCustomOperation := customOperators[operator]
	if isCustomOperation {
		return customOperation(values, data)
	}

	if operator == "missing" {
		return missing(values, data)
	}

	if operator == "missing_some" {
		return missingSome(values, data)
	}

	if operator == "var" {
		return getVar(values, data)
	}

	if operator == "set" {
		return setProperty(values, data)
	}

	if operator == "cat" {
		return concat(values)
	}

	if operator == "substr" {
		return substr(values)
	}

	if operator == "merge" {
		return merge(values, 0)
	}

	if operator == "if" {
		return conditional(values, data)
	}

	if isPrimitive(values) {
		return unary(operator, values)
	}

	if operator == "max" {
		return max(values)
	}

	if operator == "min" {
		return min(values)
	}

	if values == nil {
		return nil
	}

	parsed := values.([]any)

	if operator != "in" && len(parsed) == 1 {
		return unary(operator, parsed[0])
	}

	if operator == "?:" {
		if parsed[0].(bool) {
			return parsed[1]
		}

		return parsed[2]
	}

	if operator == "+" {
		return sum(values)
	}

	if operator == "-" {
		return minus(values)
	}

	if operator == "*" {
		return mult(values)
	}

	if operator == "/" {
		return div(values)
	}

	if operator == "in" {
		if len(parsed) > 1 {
			return _in(parsed[0], parsed[1])
		}
		return _in(parsed[0], nil)
	}

	if operator == "%" {
		return mod(parsed[0], parsed[1])
	}

	if len(parsed) == 3 {
		return between(operator, parsed, data)
	}

	if operator == "<" {
		return less(at(parsed, 0), at(parsed, 1))
	}

	if operator == ">" {
		return less(at(parsed, 1), at(parsed, 0))
	}

	if operator == "<=" {
		return less(parsed[0], parsed[1]) || equals(parsed[0], parsed[1])
	}

	if operator == ">=" {
		return less(parsed[1], parsed[0]) || equals(parsed[0], parsed[1])
	}

	if operator == "===" {
		return hardEquals(parsed[0], parsed[1])
	}

	if operator == "!=" {
		return !equals(parsed[0], parsed[1])
	}

	if operator == "!==" {
		return !hardEquals(parsed[0], parsed[1])
	}

	if operator == "==" {
		return equals(parsed[0], parsed[1])
	}

	panic(ErrInvalidOperator{
		operator: operator,
	})
}
