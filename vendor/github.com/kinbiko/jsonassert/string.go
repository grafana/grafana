package jsonassert

import (
	"encoding/json"
	"fmt"
	"strings"
)

func (a *Asserter) checkString(path, act, exp string) {
	if t, ok := a.Printer.(tt); ok {
		t.Helper()
	}
	if act != exp {
		if len(exp+act) < 50 {
			a.Printer.Errorf("expected string at '%s' to be '%s' but was '%s'", path, exp, act)
		} else {
			a.Printer.Errorf("expected string at '%s' to be\n'%s'\nbut was\n'%s'", path, exp, act)
		}
	}
}

func extractString(s string) (string, error) {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return "", fmt.Errorf("cannot parse nothing as string")
	}
	if s[0] != '"' {
		return "", fmt.Errorf("cannot parse '%s' as string", s)
	}
	var str string
	err := json.Unmarshal([]byte(s), &str)
	return str, err
}
