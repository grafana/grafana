//  Copyright (c) 2014 Couchbase, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// 		http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// as of Go 1.8 this requires the goyacc external tool
// available from golang.org/x/tools/cmd/goyacc

//go:generate goyacc -o query_string.y.go query_string.y
//go:generate sed -i.tmp -e 1d query_string.y.go
//go:generate rm query_string.y.go.tmp

// note: OSX sed and gnu sed handle the -i (in-place) option differently.
// using -i.tmp works on both, at the expense of having to remove
// the unsightly .tmp files

package query

import (
	"fmt"
	"strings"
)

var debugParser bool
var debugLexer bool

func parseQuerySyntax(query string) (rq Query, err error) {
	if query == "" {
		return NewMatchNoneQuery(), nil
	}
	lex := newLexerWrapper(newQueryStringLex(strings.NewReader(query)))
	doParse(lex)

	if len(lex.errs) > 0 {
		return nil, fmt.Errorf(strings.Join(lex.errs, "\n"))
	}
	return lex.query, nil
}

func doParse(lex *lexerWrapper) {
	defer func() {
		r := recover()
		if r != nil {
			lex.errs = append(lex.errs, fmt.Sprintf("parse error: %v", r))
		}
	}()

	yyParse(lex)
}

const (
	queryShould = iota
	queryMust
	queryMustNot
)

type lexerWrapper struct {
	lex   yyLexer
	errs  []string
	query *BooleanQuery
}

func newLexerWrapper(lex yyLexer) *lexerWrapper {
	return &lexerWrapper{
		lex:   lex,
		query: NewBooleanQueryForQueryString(nil, nil, nil),
	}
}

func (l *lexerWrapper) Lex(lval *yySymType) int {
	return l.lex.Lex(lval)
}

func (l *lexerWrapper) Error(s string) {
	l.errs = append(l.errs, s)
}
