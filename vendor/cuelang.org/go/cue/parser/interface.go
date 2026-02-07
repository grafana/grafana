// Copyright 2018 The CUE Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This file contains the exported entry points for invoking the

package parser

import (
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/cue/ast/astutil"
	"cuelang.org/go/cue/errors"
	"cuelang.org/go/cue/token"
	"cuelang.org/go/internal"
	"cuelang.org/go/internal/source"
)

// Option specifies a parse option.
type Option func(p *parser)

var (
	// PackageClauseOnly causes parsing to stop after the package clause.
	PackageClauseOnly Option = packageClauseOnly
	packageClauseOnly        = func(p *parser) {
		p.mode |= packageClauseOnlyMode
	}

	// ImportsOnly causes parsing to stop parsing after the import declarations.
	ImportsOnly Option = importsOnly
	importsOnly        = func(p *parser) {
		p.mode |= importsOnlyMode
	}

	// ParseComments causes comments to be parsed.
	ParseComments Option = parseComments
	parseComments        = func(p *parser) {
		p.mode |= parseCommentsMode
	}

	// ParseFuncs causes function declarations to be parsed.
	//
	// This is an experimental function and the API is likely to
	// change or dissapear.
	ParseFuncs Option = parseFuncs
	parseFuncs        = func(p *parser) {
		p.mode |= parseFuncsMode
	}

	// Trace causes parsing to print a trace of parsed productions.
	Trace    Option = traceOpt
	traceOpt        = func(p *parser) {
		p.mode |= traceMode
	}

	// DeclarationErrors causes parsing to report declaration errors.
	DeclarationErrors Option = declarationErrors
	declarationErrors        = func(p *parser) {
		p.mode |= declarationErrorsMode
	}

	// AllErrors causes all errors to be reported (not just the first 10 on different lines).
	AllErrors Option = allErrors
	allErrors        = func(p *parser) {
		p.mode |= allErrorsMode
	}

	// AllowPartial allows the parser to be used on a prefix buffer.
	AllowPartial Option = allowPartial
	allowPartial        = func(p *parser) {
		p.mode |= partialMode
	}
)

// FromVersion specifies until which legacy version the parser should provide
// backwards compatibility.
func FromVersion(version int) Option {
	if version >= 0 {
		version++
	}
	// Versions:
	// <0:  major version 0 (counting -1000 + x, where x = 100*m+p in 0.m.p
	// >=0: x+1 in 1.x.y
	return func(p *parser) { p.version = version }
}

// DeprecationError is a sentinel error to indicate that an error is
// related to an unsupported old CUE syntax.
type DeprecationError struct {
	Version int
}

func (e *DeprecationError) Error() string {
	return "try running `cue fix` (possibly with an earlier version, like v0.2.2) to upgrade"
}

const (
	// Latest specifies the latest version of the parser, effectively setting
	// the strictest implementation.
	Latest = latest

	latest = -1000 + (100 * internal.MinorCurrent) + 0

	// FullBackwardCompatibility enables all deprecated features that are
	// currently still supported by the parser.
	FullBackwardCompatibility = fullCompatibility

	fullCompatibility = -1000
)

// FileOffset specifies the File position info to use.
func FileOffset(pos int) Option {
	return func(p *parser) { p.offset = pos }
}

// A mode value is a set of flags (or 0).
// They control the amount of source code parsed and other optional
// parser functionality.
type mode uint

const (
	packageClauseOnlyMode mode = 1 << iota // stop parsing after package clause
	importsOnlyMode                        // stop parsing after import declarations
	parseCommentsMode                      // parse comments and add them to AST
	parseFuncsMode                         // parse function declarations (experimental)
	partialMode
	traceMode             // print a trace of parsed productions
	declarationErrorsMode // report declaration errors
	allErrorsMode         // report all errors (not just the first 10 on different lines)
)

// ParseFile parses the source code of a single CUE source file and returns
// the corresponding File node. The source code may be provided via
// the filename of the source file, or via the src parameter.
//
// If src != nil, ParseFile parses the source from src and the filename is
// only used when recording position information. The type of the argument
// for the src parameter must be string, []byte, or io.Reader.
// If src == nil, ParseFile parses the file specified by filename.
//
// The mode parameter controls the amount of source text parsed and other
// optional parser functionality. Position information is recorded in the
// file set fset, which must not be nil.
//
// If the source couldn't be read, the returned AST is nil and the error
// indicates the specific failure. If the source was read but syntax
// errors were found, the result is a partial AST (with Bad* nodes
// representing the fragments of erroneous source code). Multiple errors
// are returned via a ErrorList which is sorted by file position.
func ParseFile(filename string, src interface{}, mode ...Option) (f *ast.File, err error) {

	// get source
	text, err := source.Read(filename, src)
	if err != nil {
		return nil, err
	}

	var pp parser
	defer func() {
		if pp.panicking {
			_ = recover()
		}

		// set result values
		if f == nil {
			// source is not a valid Go source file - satisfy
			// ParseFile API and return a valid (but) empty
			// *File
			f = &ast.File{
				// Scope: NewScope(nil),
			}
		}

		err = errors.Sanitize(pp.errors)
	}()

	// parse source
	pp.init(filename, text, mode)
	f = pp.parseFile()
	if f == nil {
		return nil, pp.errors
	}
	f.Filename = filename
	astutil.Resolve(f, pp.errf)

	return f, pp.errors
}

// ParseExpr is a convenience function for parsing an expression.
// The arguments have the same meaning as for Parse, but the source must
// be a valid CUE (type or value) expression. Specifically, fset must not
// be nil.
func ParseExpr(filename string, src interface{}, mode ...Option) (ast.Expr, error) {
	// get source
	text, err := source.Read(filename, src)
	if err != nil {
		return nil, err
	}

	var p parser
	defer func() {
		if p.panicking {
			_ = recover()
		}
		err = errors.Sanitize(p.errors)
	}()

	// parse expr
	p.init(filename, text, mode)
	// Set up pkg-level scopes to avoid nil-pointer errors.
	// This is not needed for a correct expression x as the
	// parser will be ok with a nil topScope, but be cautious
	// in case of an erroneous x.
	e := p.parseRHS()

	// If a comma was inserted, consume it;
	// report an error if there's more tokens.
	if p.tok == token.COMMA && p.lit == "\n" {
		p.next()
	}
	if p.mode&partialMode == 0 {
		p.expect(token.EOF)
	}

	if p.errors != nil {
		return nil, p.errors
	}
	astutil.ResolveExpr(e, p.errf)

	return e, p.errors
}

// parseExprString is a convenience function for obtaining the AST of an
// expression x. The position information recorded in the AST is undefined. The
// filename used in error messages is the empty string.
func parseExprString(x string) (ast.Expr, error) {
	return ParseExpr("", []byte(x))
}
