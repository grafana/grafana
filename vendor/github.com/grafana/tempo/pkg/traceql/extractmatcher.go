package traceql

import (
	"regexp"
	"strings"
)

// TODO: Support spaces, quotes
//  See: https://github.com/grafana/grafana/issues/77394

// Regex to extract matchers from a query string
// This regular expression matches a string that contains three groups separated by operators.
// The first group matches one or more Unicode letters, digits, underscores, or periods. It essentially matches variable names or identifiers
// The second group is a comparison operator, which can be one of several possibilities, including =, >, <, and !=.
// The third group is one of several possible values:
//  1. A double-quoted string consisting of one or more Unicode characters, including letters, digits, punctuation, diacritical marks, and symbols,
//  2. A sequence of one or more digits, which can represent numeric values, possibly with units like 's', 'm', or 'h'.
//  3. The boolean values "true" or "false".
//
// Example: "http.status_code = 200" from the query "{ .http.status_code = 200 && .http.method = }"
var matchersRegexp = regexp.MustCompile(`[\p{L}\p{N}._\-:" ]+\s*(=|<=|>=|=~|!=|>|<|!~)\s*(?:"[\p{L}\p{N}\p{P}\p{M}\p{S}]+"|true|false|[a-z]+|[0-9smh]+)`)

// TODO: Merge into a single regular expression

// Regex to extract selectors from a query string
// This regular expression matches a string that contains a single spanset filter and no OR `||` conditions.
// Examples
//
//	Query                                    |  Match
//
// { .bar = "foo" }                          |   Yes
// { .bar =~ "foo|bar" }                     |   Yes
// { .bar = "foo" && .foo = "bar" }          |   Yes
// { .bar = "foo" || .foo = "bar" }          |   No
// { .bar = "foo" } && { .foo = "bar" }      |   No
// { .bar = "foo" } || { .foo = "bar" }      |   No
var singleFilterRegexp = regexp.MustCompile(`^(\{[^|{}]*[^|{}]}?|\{[^|{}]*=~[^{}]*})$`)

const emptyQuery = "{}"

// ExtractMatchers extracts matchers from a query string and returns a string that can be parsed by the storage layer.
func ExtractMatchers(query string) string {
	query = strings.TrimSpace(query)

	if len(query) == 0 {
		return emptyQuery
	}

	selector := singleFilterRegexp.FindString(query)
	if len(selector) == 0 {
		return emptyQuery
	}

	matchers := matchersRegexp.FindAllString(query, -1)

	var q strings.Builder
	q.WriteString("{")
	for i, m := range matchers {
		m = strings.TrimSpace(m)
		if i > 0 {
			q.WriteString(" && ")
		}
		q.WriteString(m)
	}
	q.WriteString("}")

	return q.String()
}

func IsEmptyQuery(query string) bool {
	return query == emptyQuery || len(query) == 0
}
