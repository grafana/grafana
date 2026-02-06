// Copyright 2015 The Prometheus Authors
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

// Only build when go-fuzz is in use
//go:build gofuzz

package promql

import (
	"errors"
	"io"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/model/textparse"
	"github.com/prometheus/prometheus/promql/parser"
)

// PromQL parser fuzzing instrumentation for use with
// https://github.com/dvyukov/go-fuzz.
//
// Fuzz each parser by building appropriately instrumented parser, ex.
// FuzzParseMetric and execute it with it's
//
//     go-fuzz-build -func FuzzParseMetric -o FuzzParseMetric.zip github.com/prometheus/prometheus/promql
//
// And then run the tests with the appropriate inputs
//
//     go-fuzz -bin FuzzParseMetric.zip -workdir fuzz-data/ParseMetric
//
// Further input samples should go in the folders fuzz-data/ParseMetric/corpus.
//
// Repeat for FuzzParseOpenMetric, FuzzParseMetricSelector and FuzzParseExpr.

// Tuning which value is returned from Fuzz*-functions has a strong influence
// on how quick the fuzzer converges on "interesting" cases. At least try
// switching between fuzzMeh (= included in corpus, but not a priority) and
// fuzzDiscard (=don't use this input for re-building later inputs) when
// experimenting.
const (
	fuzzInteresting = 1
	fuzzMeh         = 0
	fuzzDiscard     = -1

	// Input size above which we know that Prometheus would consume too much
	// memory. The recommended way to deal with it is check input size.
	// https://google.github.io/oss-fuzz/getting-started/new-project-guide/#input-size
	maxInputSize = 10240
)

// Use package-scope symbol table to avoid memory allocation on every fuzzing operation.
var symbolTable = labels.NewSymbolTable()

func fuzzParseMetricWithContentType(in []byte, contentType string) int {
	p, warning := textparse.New(in, contentType, "", false, false, symbolTable)
	if p == nil || warning != nil {
		// An invalid content type is being passed, which should not happen
		// in this context.
		panic(warning)
	}

	var err error
	for {
		_, err = p.Next()
		if err != nil {
			break
		}
	}
	if errors.Is(err, io.EOF) {
		err = nil
	}

	if err == nil {
		return fuzzInteresting
	}

	return fuzzMeh
}

// Fuzz the metric parser.
//
// Note that this is not the parser for the text-based exposition-format; that
// lives in github.com/prometheus/client_golang/text.
func FuzzParseMetric(in []byte) int {
	return fuzzParseMetricWithContentType(in, "text/plain")
}

func FuzzParseOpenMetric(in []byte) int {
	return fuzzParseMetricWithContentType(in, "application/openmetrics-text")
}

// Fuzz the metric selector parser.
func FuzzParseMetricSelector(in []byte) int {
	if len(in) > maxInputSize {
		return fuzzMeh
	}
	_, err := parser.ParseMetricSelector(string(in))
	if err == nil {
		return fuzzInteresting
	}

	return fuzzMeh
}

// Fuzz the expression parser.
func FuzzParseExpr(in []byte) int {
	if len(in) > maxInputSize {
		return fuzzMeh
	}
	_, err := parser.ParseExpr(string(in))
	if err == nil {
		return fuzzInteresting
	}

	return fuzzMeh
}
