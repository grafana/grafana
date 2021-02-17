package sockjs

import (
	"net/http"
	"regexp"
)

type mapping struct {
	method string
	path   *regexp.Regexp
	chain  []http.HandlerFunc
}

func newMapping(method string, re string, handlers ...http.HandlerFunc) *mapping {
	return &mapping{method, regexp.MustCompile(re), handlers}
}

type matchType uint32

const (
	fullMatch matchType = iota
	pathMatch
	noMatch
)

// matches checks if given req.URL is a match with a mapping. Match can be either full, partial (http method mismatch) or no match.
func (m *mapping) matches(req *http.Request) (match matchType, method string) {
	if !m.path.MatchString(req.URL.Path) {
		match, method = noMatch, ""
	} else if m.method != req.Method {
		match, method = pathMatch, m.method
	} else {
		match, method = fullMatch, m.method
	}
	return
}
