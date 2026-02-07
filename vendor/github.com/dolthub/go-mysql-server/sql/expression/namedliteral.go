// Copyright 2022 Dolthub, Inc.
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

package expression

import (
	"github.com/dolthub/go-mysql-server/sql"
)

// NamedLiteral represents a literal value, but returns the name field rather than the value for String.
type NamedLiteral struct {
	*Literal
	Name string
}

var _ sql.Expression = NamedLiteral{}
var _ sql.Expression2 = NamedLiteral{}
var _ sql.CollationCoercible = NamedLiteral{}

// NewNamedLiteral returns a new NamedLiteral.
func NewNamedLiteral(name string, value interface{}, fieldType sql.Type) NamedLiteral {
	return NamedLiteral{
		Literal: NewLiteral(value, fieldType),
		Name:    name,
	}
}

// String implements the interface sql.Expression.
func (lit NamedLiteral) String() string {
	return lit.Name
}
