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

// Package parser implements a parser for CUE source files. Input may be
// provided in a variety of forms (see the various Parse* functions); the output
// is an abstract syntax tree (AST) representing the CUE source. The parser is
// invoked through one of the Parse* functions.
//
// The parser accepts a larger language than is syntactically permitted by the
// CUE spec, for simplicity, and for improved robustness in the presence of
// syntax errors.
package parser // import "cuelang.org/go/cue/parser"
