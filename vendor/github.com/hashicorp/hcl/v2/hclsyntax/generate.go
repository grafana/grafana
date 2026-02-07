// Copyright (c) HashiCorp, Inc.
// SPDX-License-Identifier: MPL-2.0

package hclsyntax

//go:generate go run expression_vars_gen.go
//go:generate ruby unicode2ragel.rb --url=http://www.unicode.org/Public/9.0.0/ucd/DerivedCoreProperties.txt -m UnicodeDerived -p ID_Start,ID_Continue -o unicode_derived.rl
//go:generate ragel -Z scan_tokens.rl
//go:generate gofmt -w scan_tokens.go
//go:generate ragel -Z scan_string_lit.rl
//go:generate gofmt -w scan_string_lit.go
//go:generate go run golang.org/x/tools/cmd/stringer -type TokenType -output token_type_string.go
