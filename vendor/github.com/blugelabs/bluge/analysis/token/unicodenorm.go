//  Copyright (c) 2020 Couchbase, Inc.
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

package token

import (
	"github.com/blugelabs/bluge/analysis"
	"golang.org/x/text/unicode/norm"
)

type UnicodeNormalizeFilter struct {
	form norm.Form
}

func NewUnicodeNormalizeFilter(form norm.Form) *UnicodeNormalizeFilter {
	return &UnicodeNormalizeFilter{
		form: form,
	}
}

func (s *UnicodeNormalizeFilter) Filter(input analysis.TokenStream) analysis.TokenStream {
	for _, token := range input {
		token.Term = s.form.Bytes(token.Term)
	}
	return input
}
