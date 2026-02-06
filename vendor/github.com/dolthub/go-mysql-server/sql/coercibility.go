// Copyright 2023 Dolthub, Inc.
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

package sql

import "strings"

// CollationCoercible represents the coercibility of an expression or node. Although the resulting value from the node
// or expression may be NULL, this interface returns the coercibility as though a NULL would not be returned.
type CollationCoercible interface {
	// CollationCoercibility returns the collation and coercibility of the expression or node.
	CollationCoercibility(ctx *Context) (collation CollationID, coercibility byte)
}

// ResolveCoercibility returns the collation to use by comparing coercibility, along with giving priority to binary
// collations. This is an approximation of MySQL's coercibility rules:
// https://dev.mysql.com/doc/refman/8.0/en/charset-collation-coercibility.html
// As we do not implement the full coercion pipeline, we make some assumptions when information is missing, and never
// error even when MySQL would find an expression invalid.
func ResolveCoercibility(leftCollation CollationID, leftCoercibility byte, rightCollation CollationID, rightCoercibility byte) (CollationID, byte) {
	if leftCoercibility < rightCoercibility {
		return leftCollation, leftCoercibility
	} else if leftCoercibility > rightCoercibility {
		return rightCollation, rightCoercibility
	} else if leftCollation == rightCollation {
		return leftCollation, leftCoercibility
	} else if leftCollation == Collation_Unspecified {
		return rightCollation, rightCoercibility
	} else if rightCollation == Collation_Unspecified {
		return leftCollation, leftCoercibility
	} else { // Collations are not equal
		leftCharset := leftCollation.CharacterSet()
		rightCharset := rightCollation.CharacterSet()
		if leftCharset != rightCharset {
			if leftCharset.MaxLength() == 1 && rightCharset.MaxLength() > 1 { // Left non-Unicode, Right Unicode
				return rightCollation, rightCoercibility
			} else if leftCharset.MaxLength() > 1 && rightCharset.MaxLength() == 1 { // Left Unicode, Right non-Unicode
				return leftCollation, leftCoercibility
			} else {
				return Collation_binary, 7
			}
		} else { // Character sets are equal
			// If the right collation is not _bin, then we default to the left collation (regardless of whether it is
			// or is not _bin).
			if strings.HasSuffix(rightCollation.Name(), "_bin") {
				return rightCollation, rightCoercibility
			} else {
				return leftCollation, leftCoercibility
			}
		}
	}
}

// GetCoercibility returns the coercibility of the given node or expression.
func GetCoercibility(ctx *Context, nodeOrExpr interface{}) (collation CollationID, coercibility byte) {
	if nodeOrExpr == nil {
		return Collation_binary, 6
	}
	if cc, ok := nodeOrExpr.(CollationCoercible); ok {
		return cc.CollationCoercibility(ctx)
	}
	collation = Collation_binary
	coercibility = 7
	// We check for Node, Expressioner, and Expression and take the lowest coercibility since CollationCoercible was
	// not explicitly implemented
	if n, ok := nodeOrExpr.(Node); ok {
		for _, child := range n.Children() {
			nextCollation, nextCoercibility := GetCoercibility(ctx, child)
			collation, coercibility = ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
		}
	}
	if e, ok := nodeOrExpr.(Expressioner); ok {
		for _, child := range e.Expressions() {
			nextCollation, nextCoercibility := GetCoercibility(ctx, child)
			collation, coercibility = ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
		}
	}
	if e, ok := nodeOrExpr.(Expression); ok {
		for _, child := range e.Children() {
			nextCollation, nextCoercibility := GetCoercibility(ctx, child)
			collation, coercibility = ResolveCoercibility(collation, coercibility, nextCollation, nextCoercibility)
		}
	}
	return collation, coercibility
}
