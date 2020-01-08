package jsonassert

import (
	"encoding/json"
	"fmt"
	"strings"
)

func (a *Asserter) checkArray(path string, act, exp []interface{}) {
	if t, ok := a.Printer.(tt); ok {
		t.Helper()
	}
	if len(act) != len(exp) {
		a.Printer.Errorf("length of arrays at '%s' were different. Expected array to be of length %d, but contained %d element(s)", path, len(exp), len(act))
		serializedAct, serializedExp := serialize(act), serialize(exp)
		if len(serializedAct+serializedExp) < 50 {
			a.Printer.Errorf("actual JSON at '%s' was: %+v, but expected JSON was: %+v", path, serializedAct, serializedExp)
		} else {
			a.Printer.Errorf("actual JSON at '%s' was:\n%+v\nbut expected JSON was:\n%+v", path, serializedAct, serializedExp)
		}
		return
	}
	for i := range act {
		a.pathassertf(path+fmt.Sprintf("[%d]", i), serialize(act[i]), serialize(exp[i]))
	}
}

func extractArray(s string) ([]interface{}, error) {
	s = strings.TrimSpace(s)
	if len(s) == 0 {
		return nil, fmt.Errorf("cannot parse empty string as array")
	}
	if s[0] != '[' {
		return nil, fmt.Errorf("cannot parse '%s' as array", s)
	}
	var arr []interface{}
	err := json.Unmarshal([]byte(s), &arr)
	return arr, err
}
