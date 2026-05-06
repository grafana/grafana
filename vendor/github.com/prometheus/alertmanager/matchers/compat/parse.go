// Copyright 2023 The Prometheus Authors
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

package compat

import (
	"fmt"
	"reflect"
	"strings"
	"unicode/utf8"

	"github.com/go-kit/log"
	"github.com/go-kit/log/level"
	"github.com/prometheus/common/model"

	"github.com/prometheus/alertmanager/featurecontrol"
	"github.com/prometheus/alertmanager/matchers/parse"
	"github.com/prometheus/alertmanager/pkg/labels"
)

var (
	isValidLabelName = isValidClassicLabelName(log.NewNopLogger())
	parseMatcher     = ClassicMatcherParser(log.NewNopLogger())
	parseMatchers    = ClassicMatchersParser(log.NewNopLogger())
)

// IsValidLabelName returns true if the string is a valid label name.
func IsValidLabelName(name model.LabelName) bool {
	return isValidLabelName(name)
}

type ParseMatcher func(input, origin string) (*labels.Matcher, error)

type ParseMatchers func(input, origin string) (labels.Matchers, error)

// Matcher parses the matcher in the input string. It returns an error
// if the input is invalid or contains two or more matchers.
func Matcher(input, origin string) (*labels.Matcher, error) {
	return parseMatcher(input, origin)
}

// Matchers parses one or more matchers in the input string. It returns
// an error if the input is invalid.
func Matchers(input, origin string) (labels.Matchers, error) {
	return parseMatchers(input, origin)
}

// InitFromFlags initializes the compat package from the flagger.
func InitFromFlags(l log.Logger, f featurecontrol.Flagger) {
	if f.ClassicMode() {
		isValidLabelName = isValidClassicLabelName(l)
		parseMatcher = ClassicMatcherParser(l)
		parseMatchers = ClassicMatchersParser(l)
	} else if f.UTF8StrictMode() {
		isValidLabelName = isValidUTF8LabelName(l)
		parseMatcher = UTF8MatcherParser(l)
		parseMatchers = UTF8MatchersParser(l)
	} else {
		isValidLabelName = isValidUTF8LabelName(l)
		parseMatcher = FallbackMatcherParser(l)
		parseMatchers = FallbackMatchersParser(l)
	}
}

// ClassicMatcherParser uses the pkg/labels parser to parse the matcher in
// the input string.
func ClassicMatcherParser(l log.Logger) ParseMatcher {
	return func(input, origin string) (matcher *labels.Matcher, err error) {
		level.Debug(l).Log("msg", "Parsing with classic matchers parser", "input", input, "origin", origin)
		return labels.ParseMatcher(input)
	}
}

// ClassicMatchersParser uses the pkg/labels parser to parse zero or more
// matchers in the input string. It returns an error if the input is invalid.
func ClassicMatchersParser(l log.Logger) ParseMatchers {
	return func(input, origin string) (matchers labels.Matchers, err error) {
		level.Debug(l).Log("msg", "Parsing with classic matchers parser", "input", input, "origin", origin)
		return labels.ParseMatchers(input)
	}
}

// UTF8MatcherParser uses the new matchers/parse parser to parse the matcher
// in the input string. If this fails it does not revert to the pkg/labels parser.
func UTF8MatcherParser(l log.Logger) ParseMatcher {
	return func(input, origin string) (matcher *labels.Matcher, err error) {
		level.Debug(l).Log("msg", "Parsing with UTF-8 matchers parser", "input", input, "origin", origin)
		if strings.HasPrefix(input, "{") || strings.HasSuffix(input, "}") {
			return nil, fmt.Errorf("unexpected open or close brace: %s", input)
		}
		return parse.Matcher(input)
	}
}

// UTF8MatchersParser uses the new matchers/parse parser to parse zero or more
// matchers in the input string. If this fails it does not revert to the
// pkg/labels parser.
func UTF8MatchersParser(l log.Logger) ParseMatchers {
	return func(input, origin string) (matchers labels.Matchers, err error) {
		level.Debug(l).Log("msg", "Parsing with UTF-8 matchers parser", "input", input, "origin", origin)
		return parse.Matchers(input)
	}
}

// FallbackMatcherParser uses the new matchers/parse parser to parse zero or more
// matchers in the string. If this fails it reverts to the pkg/labels parser and
// emits a warning log line.
func FallbackMatcherParser(l log.Logger) ParseMatcher {
	return func(input, origin string) (matcher *labels.Matcher, err error) {
		level.Debug(l).Log("msg", "Parsing with UTF-8 matchers parser, with fallback to classic matchers parser", "input", input, "origin", origin)
		if strings.HasPrefix(input, "{") || strings.HasSuffix(input, "}") {
			return nil, fmt.Errorf("unexpected open or close brace: %s", input)
		}
		// Parse the input in both parsers to look for disagreement and incompatible
		// inputs.
		nMatcher, nErr := parse.Matcher(input)
		cMatcher, cErr := labels.ParseMatcher(input)
		if nErr != nil {
			// If the input is invalid in both parsers, return the error.
			if cErr != nil {
				return nil, cErr
			}
			// The input is valid in the pkg/labels parser, but not the matchers/parse
			// parser. This means the input is not forwards compatible.
			suggestion := cMatcher.String()
			level.Warn(l).Log("msg", "Alertmanager is moving to a new parser for labels and matchers, and this input is incompatible. Alertmanager has instead parsed the input using the classic matchers parser as a fallback. To make this input compatible with the UTF-8 matchers parser please make sure all regular expressions and values are double-quoted. If you are still seeing this message please open an issue.", "input", input, "origin", origin, "err", nErr, "suggestion", suggestion)
			return cMatcher, nil
		}
		// If the input is valid in both parsers, but produces different results,
		// then there is disagreement.
		if nErr == nil && cErr == nil && !reflect.DeepEqual(nMatcher, cMatcher) {
			level.Warn(l).Log("msg", "Matchers input has disagreement", "input", input, "origin", origin)
			return cMatcher, nil
		}
		return nMatcher, nil
	}
}

// FallbackMatchersParser uses the new matchers/parse parser to parse the
// matcher in the input string. If this fails it falls back to the pkg/labels
// parser and emits a warning log line.
func FallbackMatchersParser(l log.Logger) ParseMatchers {
	return func(input, origin string) (matchers labels.Matchers, err error) {
		level.Debug(l).Log("msg", "Parsing with UTF-8 matchers parser, with fallback to classic matchers parser", "input", input, "origin", origin)
		// Parse the input in both parsers to look for disagreement and incompatible
		// inputs.
		nMatchers, nErr := parse.Matchers(input)
		cMatchers, cErr := labels.ParseMatchers(input)
		if nErr != nil {
			// If the input is invalid in both parsers, return the error.
			if cErr != nil {
				return nil, cErr
			}
			// The input is valid in the pkg/labels parser, but not the matchers/parse
			// parser. This means the input is not forwards compatible.
			var sb strings.Builder
			for i, n := range cMatchers {
				sb.WriteString(n.String())
				if i < len(cMatchers)-1 {
					sb.WriteRune(',')
				}
			}
			suggestion := sb.String()
			// The input is valid in the pkg/labels parser, but not the
			// new matchers/parse parser.
			level.Warn(l).Log("msg", "Alertmanager is moving to a new parser for labels and matchers, and this input is incompatible. Alertmanager has instead parsed the input using the classic matchers parser as a fallback. To make this input compatible with the UTF-8 matchers parser please make sure all regular expressions and values are double-quoted. If you are still seeing this message please open an issue.", "input", input, "origin", origin, "err", nErr, "suggestion", suggestion)
			return cMatchers, nil
		}
		// If the input is valid in both parsers, but produces different results,
		// then there is disagreement. We need to compare to labels.Matchers(cMatchers)
		// as cMatchers is a []*labels.Matcher not labels.Matchers.
		if nErr == nil && cErr == nil && !reflect.DeepEqual(nMatchers, labels.Matchers(cMatchers)) {
			level.Warn(l).Log("msg", "Matchers input has disagreement", "input", input, "origin", origin)
			return cMatchers, nil
		}
		return nMatchers, nil
	}
}

// isValidClassicLabelName returns true if the string is a valid classic label name.
func isValidClassicLabelName(_ log.Logger) func(model.LabelName) bool {
	return func(name model.LabelName) bool {
		return name.IsValid()
	}
}

// isValidUTF8LabelName returns true if the string is a valid UTF-8 label name.
func isValidUTF8LabelName(_ log.Logger) func(model.LabelName) bool {
	return func(name model.LabelName) bool {
		if len(name) == 0 {
			return false
		}
		return utf8.ValidString(string(name))
	}
}
