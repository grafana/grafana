// Copyright 2020 The CUE Authors
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

// Copyright 2018 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Generated with go run cuelang.org/go/internal/cmd/qgo -exclude=Escaper$,Must,Parse -stripstr extract text/template

package template

import "text/template"

// HTMLEscape returns the escaped HTML equivalent of the plain text data s.
func HTMLEscape(s string) string {
	return template.HTMLEscapeString(s)
}

// JSEscape returns the escaped JavaScript equivalent of the plain text data s.
func JSEscape(s string) string {
	return template.JSEscapeString(s)
}
