/*
Copyright 2019 The Vitess Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package stats

import (
	"regexp"
	"strings"
	"sync"
)

// toKebabCase produces a monitoring compliant name from the
// original. It converts CamelCase to camel-case,
// and CAMEL_CASE to camel-case. For numbers, it
// converts 0.5 to v0_5.
func toKebabCase(name string) (hyphenated string) {
	memoizer.Lock()
	defer memoizer.Unlock()
	if hyphenated = memoizer.memo[name]; hyphenated != "" {
		return hyphenated
	}
	hyphenated = name
	for _, converter := range kebabConverters {
		hyphenated = converter.re.ReplaceAllString(hyphenated, converter.repl)
	}
	hyphenated = strings.ToLower(hyphenated)
	memoizer.memo[name] = hyphenated
	return
}

var kebabConverters = []struct {
	re   *regexp.Regexp
	repl string
}{
	// example: LC -> L-C (e.g. CamelCase -> Camel-Case).
	{regexp.MustCompile("([a-z])([A-Z])"), "$1-$2"},
	// example: CCa -> C-Ca (e.g. CCamel -> C-Camel).
	{regexp.MustCompile("([A-Z])([A-Z][a-z])"), "$1-$2"},
	{regexp.MustCompile("_"), "-"},
	{regexp.MustCompile(`\.`), "_"},
}

var memoizer = memoizerType{
	memo: make(map[string]string),
}

type memoizerType struct {
	sync.Mutex
	memo map[string]string
}
