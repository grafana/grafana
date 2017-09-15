// Copyright 2016, Google Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
// notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
// copyright notice, this list of conditions and the following disclaimer
// in the documentation and/or other materials provided with the
// distribution.
//     * Neither the name of Google Inc. nor the names of its
// contributors may be used to endorse or promote products derived from
// this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

package gax

import (
	"errors"
	"fmt"
	"strings"
)

type matcher interface {
	match([]string) (int, error)
	String() string
}

type segment struct {
	matcher
	name string
}

type labelMatcher string

func (ls labelMatcher) match(segments []string) (int, error) {
	if len(segments) == 0 {
		return 0, fmt.Errorf("expected %s but no more segments found", ls)
	}
	if segments[0] != string(ls) {
		return 0, fmt.Errorf("expected %s but got %s", ls, segments[0])
	}
	return 1, nil
}

func (ls labelMatcher) String() string {
	return string(ls)
}

type wildcardMatcher int

func (wm wildcardMatcher) match(segments []string) (int, error) {
	if len(segments) == 0 {
		return 0, errors.New("no more segments found")
	}
	return 1, nil
}

func (wm wildcardMatcher) String() string {
	return "*"
}

type pathWildcardMatcher int

func (pwm pathWildcardMatcher) match(segments []string) (int, error) {
	length := len(segments) - int(pwm)
	if length <= 0 {
		return 0, errors.New("not sufficient segments are supplied for path wildcard")
	}
	return length, nil
}

func (pwm pathWildcardMatcher) String() string {
	return "**"
}

type ParseError struct {
	Pos      int
	Template string
	Message  string
}

func (pe ParseError) Error() string {
	return fmt.Sprintf("at %d of template '%s', %s", pe.Pos, pe.Template, pe.Message)
}

// PathTemplate manages the template to build and match with paths used
// by API services. It holds a template and variable names in it, and
// it can extract matched patterns from a path string or build a path
// string from a binding.
//
// See http.proto in github.com/googleapis/googleapis/ for the details of
// the template syntax.
type PathTemplate struct {
	segments []segment
}

// NewPathTemplate parses a path template, and returns a PathTemplate
// instance if successful.
func NewPathTemplate(template string) (*PathTemplate, error) {
	return parsePathTemplate(template)
}

// MustCompilePathTemplate is like NewPathTemplate but panics if the
// expression cannot be parsed. It simplifies safe initialization of
// global variables holding compiled regular expressions.
func MustCompilePathTemplate(template string) *PathTemplate {
	pt, err := NewPathTemplate(template)
	if err != nil {
		panic(err)
	}
	return pt
}

// Match attempts to match the given path with the template, and returns
// the mapping of the variable name to the matched pattern string.
func (pt *PathTemplate) Match(path string) (map[string]string, error) {
	paths := strings.Split(path, "/")
	values := map[string]string{}
	for _, segment := range pt.segments {
		length, err := segment.match(paths)
		if err != nil {
			return nil, err
		}
		if segment.name != "" {
			value := strings.Join(paths[:length], "/")
			if oldValue, ok := values[segment.name]; ok {
				values[segment.name] = oldValue + "/" + value
			} else {
				values[segment.name] = value
			}
		}
		paths = paths[length:]
	}
	if len(paths) != 0 {
		return nil, fmt.Errorf("Trailing path %s remains after the matching", strings.Join(paths, "/"))
	}
	return values, nil
}

// Render creates a path string from its template and the binding from
// the variable name to the value.
func (pt *PathTemplate) Render(binding map[string]string) (string, error) {
	result := make([]string, 0, len(pt.segments))
	var lastVariableName string
	for _, segment := range pt.segments {
		name := segment.name
		if lastVariableName != "" && name == lastVariableName {
			continue
		}
		lastVariableName = name
		if name == "" {
			result = append(result, segment.String())
		} else if value, ok := binding[name]; ok {
			result = append(result, value)
		} else {
			return "", fmt.Errorf("%s is not found", name)
		}
	}
	built := strings.Join(result, "/")
	return built, nil
}
