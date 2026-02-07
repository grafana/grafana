package tools

import (
	"strings"
)

// naive way of checking if the input regex describes a constant string, or something else.
// ex: `^math$` or `^reduce$` would return true, while `^foo[0-9]+$` wouldn't
func RegexMatchesConstantString(regex string) bool {
	if regex == "" {
		return false
	}

	if regex[0] != '^' || regex[len(regex)-1] != '$' {
		return false
	}

	return !strings.ContainsAny(regex, ".+*?()|[]{}")
}

func ConstantStringFromRegex(regex string) string {
	return regex[1 : len(regex)-1]
}
