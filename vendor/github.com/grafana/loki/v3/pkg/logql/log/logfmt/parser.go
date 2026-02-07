package logfmt

import (
	"strings"
)

func init() {
	LogfmtExprErrorVerbose = true
}

func Parse(expr string, debug bool) ([]interface{}, error) {
	s := NewScanner(strings.NewReader(expr), debug)
	LogfmtExprParse(s)

	if s.err != nil {
		return nil, s.err
	}
	return s.data, nil
}
