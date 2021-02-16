// Copyright 2017 The Prometheus Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package labels

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/prometheus/common/model"
)

// MatchType is an enum for label matching types.
type MatchType int

// Possible MatchTypes.
const (
	MatchEqual MatchType = iota
	MatchNotEqual
	MatchRegexp
	MatchNotRegexp
)

func (m MatchType) String() string {
	typeToStr := map[MatchType]string{
		MatchEqual:     "=",
		MatchNotEqual:  "!=",
		MatchRegexp:    "=~",
		MatchNotRegexp: "!~",
	}
	if str, ok := typeToStr[m]; ok {
		return str
	}
	panic("unknown match type")
}

// Matcher models the matching of a label.
type Matcher struct {
	Type  MatchType
	Name  string
	Value string

	re *regexp.Regexp
}

// NewMatcher returns a matcher object.
func NewMatcher(t MatchType, n, v string) (*Matcher, error) {
	m := &Matcher{
		Type:  t,
		Name:  n,
		Value: v,
	}
	if t == MatchRegexp || t == MatchNotRegexp {
		re, err := regexp.Compile("^(?:" + v + ")$")
		if err != nil {
			return nil, err
		}
		m.re = re
	}
	return m, nil
}

func (m *Matcher) String() string {
	return fmt.Sprintf(`%s%s"%s"`, m.Name, m.Type, openMetricsEscape(m.Value))
}

// Matches returns whether the matcher matches the given string value.
func (m *Matcher) Matches(s string) bool {
	switch m.Type {
	case MatchEqual:
		return s == m.Value
	case MatchNotEqual:
		return s != m.Value
	case MatchRegexp:
		return m.re.MatchString(s)
	case MatchNotRegexp:
		return !m.re.MatchString(s)
	}
	panic("labels.Matcher.Matches: invalid match type")
}

type apiV1Matcher struct {
	Name    string `json:"name"`
	Value   string `json:"value"`
	IsRegex bool   `json:"isRegex"`
	IsEqual bool   `json:"isEqual"`
}

// MarshalJSON retains backwards compatibility with types.Matcher for the v1 API.
func (m Matcher) MarshalJSON() ([]byte, error) {
	return json.Marshal(apiV1Matcher{
		Name:    m.Name,
		Value:   m.Value,
		IsRegex: m.Type == MatchRegexp || m.Type == MatchNotRegexp,
		IsEqual: m.Type == MatchRegexp || m.Type == MatchEqual,
	})
}

func (m *Matcher) UnmarshalJSON(data []byte) error {
	var v1m apiV1Matcher
	if err := json.Unmarshal(data, &v1m); err != nil {
		return err
	}

	var t MatchType
	switch {
	case v1m.IsEqual && !v1m.IsRegex:
		t = MatchEqual
	case !v1m.IsEqual && !v1m.IsRegex:
		t = MatchNotEqual
	case v1m.IsEqual && v1m.IsRegex:
		t = MatchRegexp
	case !v1m.IsEqual && v1m.IsRegex:
		t = MatchNotRegexp
	}

	matcher, err := NewMatcher(t, v1m.Name, v1m.Value)
	if err != nil {
		return err
	}
	*m = *matcher
	return nil
}

// openMetricsEscape is similar to the usual string escaping, but more
// restricted. It merely replaces a new-line character with '\n', a double-quote
// character with '\"', and a backslash with '\\', which is the escaping used by
// OpenMetrics.
func openMetricsEscape(s string) string {
	r := strings.NewReplacer(
		`\`, `\\`,
		"\n", `\n`,
		`"`, `\"`,
	)
	return r.Replace(s)
}

// Matchers is a slice of Matchers that is sortable, implements Stringer, and
// provides a Matches method to match a LabelSet against all Matchers in the
// slice. Note that some users of Matchers might require it to be sorted.
type Matchers []*Matcher

func (ms Matchers) Len() int      { return len(ms) }
func (ms Matchers) Swap(i, j int) { ms[i], ms[j] = ms[j], ms[i] }

func (ms Matchers) Less(i, j int) bool {
	if ms[i].Name > ms[j].Name {
		return false
	}
	if ms[i].Name < ms[j].Name {
		return true
	}
	if ms[i].Value > ms[j].Value {
		return false
	}
	if ms[i].Value < ms[j].Value {
		return true
	}
	return ms[i].Type < ms[j].Type
}

// Matches checks whether all matchers are fulfilled against the given label set.
func (ms Matchers) Matches(lset model.LabelSet) bool {
	for _, m := range ms {
		if !m.Matches(string(lset[model.LabelName(m.Name)])) {
			return false
		}
	}
	return true
}

func (ms Matchers) String() string {
	var buf bytes.Buffer

	buf.WriteByte('{')
	for i, m := range ms {
		if i > 0 {
			buf.WriteByte(',')
		}
		buf.WriteString(m.String())
	}
	buf.WriteByte('}')

	return buf.String()
}
