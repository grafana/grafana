// Copyright 2022 The Prometheus Authors
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

package parser

import (
	"fmt"
	"strings"
)

// Approach
// --------
// When a PromQL query is parsed, it is converted into PromQL AST,
// which is a nested structure of nodes. Each node has a depth/level
// (distance from the root), that is passed by its parent.
//
// While prettifying, a Node considers 2 things:
// 1. Did the current Node's parent add a new line?
// 2. Does the current Node needs to be prettified?
//
// The level of a Node determines if it should be indented or not.
// The answer to the 1 is NO if the level passed is 0. This means, the
// parent Node did not apply a new line, so the current Node must not
// apply any indentation as prefix.
// If level > 1, a new line is applied by the parent. So, the current Node
// should prefix an indentation before writing any of its content. This indentation
// will be ([level/depth of current Node] * "  ").
//
// The answer to 2 is YES if the normalized length of the current Node exceeds
// the maxCharactersPerLine limit. Hence, it applies the indentation equal to
// its depth and increments the level by 1 before passing down the child.
// If the answer is NO, the current Node returns the normalized string value of itself.

var maxCharactersPerLine = 100

func Prettify(n Node) string {
	return n.Pretty(0)
}

func (e *AggregateExpr) Pretty(level int) string {
	s := indent(level)
	if !needsSplit(e) {
		s += e.String()
		return s
	}

	s += e.getAggOpStr()
	s += "(\n"

	if e.Op.IsAggregatorWithParam() {
		s += fmt.Sprintf("%s,\n", e.Param.Pretty(level+1))
	}
	s += fmt.Sprintf("%s\n%s)", e.Expr.Pretty(level+1), indent(level))
	return s
}

func (e *BinaryExpr) Pretty(level int) string {
	s := indent(level)
	if !needsSplit(e) {
		s += e.String()
		return s
	}
	returnBool := ""
	if e.ReturnBool {
		returnBool = " bool"
	}

	matching := e.getMatchingStr()
	return fmt.Sprintf("%s\n%s%s%s%s\n%s", e.LHS.Pretty(level+1), indent(level), e.Op, returnBool, matching, e.RHS.Pretty(level+1))
}

func (e *Call) Pretty(level int) string {
	s := indent(level)
	if !needsSplit(e) {
		s += e.String()
		return s
	}
	s += fmt.Sprintf("%s(\n%s\n%s)", e.Func.Name, e.Args.Pretty(level+1), indent(level))
	return s
}

func (e *EvalStmt) Pretty(_ int) string {
	return "EVAL " + e.Expr.String()
}

func (e Expressions) Pretty(level int) string {
	// Do not prefix the indent since respective nodes will indent itself.
	s := ""
	for i := range e {
		s += fmt.Sprintf("%s,\n", e[i].Pretty(level))
	}
	return s[:len(s)-2]
}

func (e *ParenExpr) Pretty(level int) string {
	s := indent(level)
	if !needsSplit(e) {
		s += e.String()
		return s
	}
	return fmt.Sprintf("%s(\n%s\n%s)", s, e.Expr.Pretty(level+1), indent(level))
}

func (e *StepInvariantExpr) Pretty(level int) string {
	return e.Expr.Pretty(level)
}

func (e *MatrixSelector) Pretty(level int) string {
	return getCommonPrefixIndent(level, e)
}

func (e *SubqueryExpr) Pretty(level int) string {
	if !needsSplit(e) {
		return e.String()
	}
	return fmt.Sprintf("%s%s", e.Expr.Pretty(level), e.getSubqueryTimeSuffix())
}

func (e *VectorSelector) Pretty(level int) string {
	return getCommonPrefixIndent(level, e)
}

func (e *NumberLiteral) Pretty(level int) string {
	return getCommonPrefixIndent(level, e)
}

func (e *StringLiteral) Pretty(level int) string {
	return getCommonPrefixIndent(level, e)
}

func (e *UnaryExpr) Pretty(level int) string {
	child := e.Expr.Pretty(level)
	// Remove the indent prefix from child since we attach the prefix indent before Op.
	child = strings.TrimSpace(child)
	return fmt.Sprintf("%s%s%s", indent(level), e.Op, child)
}

func getCommonPrefixIndent(level int, current Node) string {
	return fmt.Sprintf("%s%s", indent(level), current.String())
}

// needsSplit normalizes the node and then checks if the node needs any split.
// This is necessary to remove any trailing whitespaces.
func needsSplit(n Node) bool {
	if n == nil {
		return false
	}
	return len(n.String()) > maxCharactersPerLine
}

const indentString = "  "

// indent adds the indentString n number of times.
func indent(n int) string {
	return strings.Repeat(indentString, n)
}
