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
)

// GetSnakeName calls toSnakeName on the passed in string. It produces
// a snake-cased name from the provided camel-cased name.
// It memoizes the transformation and returns the stored result if available.
func GetSnakeName(name string) string {
	return toSnakeCase(name)
}

// toSnakeCase produces a monitoring compliant name from the original.
// For systems (like Prometheus) that ask for snake-case names.
// It converts CamelCase to camel_case, and CAMEL_CASE to camel_case.
// For numbers, it converts 0.5 to v0_5.
func toSnakeCase(name string) (hyphenated string) {
	snakeMemoizer.Lock()
	defer snakeMemoizer.Unlock()
	if hyphenated = snakeMemoizer.memo[name]; hyphenated != "" {
		return hyphenated
	}
	hyphenated = name
	for _, converter := range snakeConverters {
		hyphenated = converter.re.ReplaceAllString(hyphenated, converter.repl)
	}
	hyphenated = strings.ToLower(hyphenated)
	snakeMemoizer.memo[name] = hyphenated
	return
}

var snakeConverters = []struct {
	re   *regexp.Regexp
	repl string
}{
	// example: LC -> L_C (e.g. CamelCase -> Camel_Case).
	{regexp.MustCompile("([a-z])([A-Z])"), "${1}_${2}"},
	// example: CCa -> C_Ca (e.g. CCamel -> C_Camel).
	{regexp.MustCompile("([A-Z])([A-Z][a-z])"), "${1}_${2}"},
	{regexp.MustCompile(`\.`), "_"},
	{regexp.MustCompile("-"), "_"},
}

var snakeMemoizer = memoizerType{
	memo: make(map[string]string),
}
