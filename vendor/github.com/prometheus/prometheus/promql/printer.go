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

package promql

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/pkg/labels"
)

// Tree returns a string of the tree structure of the given node.
func Tree(node Node) string {
	return tree(node, "")
}

func tree(node Node, level string) string {
	if node == nil {
		return fmt.Sprintf("%s |---- %T\n", level, node)
	}
	typs := strings.Split(fmt.Sprintf("%T", node), ".")[1]

	var t string
	// Only print the number of statements for readability.
	if stmts, ok := node.(Statements); ok {
		t = fmt.Sprintf("%s |---- %s :: %d\n", level, typs, len(stmts))
	} else {
		t = fmt.Sprintf("%s |---- %s :: %s\n", level, typs, node)
	}

	level += " · · ·"

	switch n := node.(type) {
	case Statements:
		for _, s := range n {
			t += tree(s, level)
		}
	case *AlertStmt:
		t += tree(n.Expr, level)

	case *EvalStmt:
		t += tree(n.Expr, level)

	case *RecordStmt:
		t += tree(n.Expr, level)

	case Expressions:
		for _, e := range n {
			t += tree(e, level)
		}
	case *AggregateExpr:
		t += tree(n.Expr, level)

	case *BinaryExpr:
		t += tree(n.LHS, level)
		t += tree(n.RHS, level)

	case *Call:
		t += tree(n.Args, level)

	case *ParenExpr:
		t += tree(n.Expr, level)

	case *UnaryExpr:
		t += tree(n.Expr, level)

	case *MatrixSelector, *NumberLiteral, *StringLiteral, *VectorSelector:
		// nothing to do

	default:
		panic("promql.Tree: not all node types covered")
	}
	return t
}

func (stmts Statements) String() (s string) {
	if len(stmts) == 0 {
		return ""
	}
	for _, stmt := range stmts {
		s += stmt.String()
		s += "\n\n"
	}
	return s[:len(s)-2]
}

func (node *AlertStmt) String() string {
	s := fmt.Sprintf("ALERT %s", node.Name)
	s += fmt.Sprintf("\n\tIF %s", node.Expr)
	if node.Duration > 0 {
		s += fmt.Sprintf("\n\tFOR %s", model.Duration(node.Duration))
	}
	if len(node.Labels) > 0 {
		s += fmt.Sprintf("\n\tLABELS %s", node.Labels)
	}
	if len(node.Annotations) > 0 {
		s += fmt.Sprintf("\n\tANNOTATIONS %s", node.Annotations)
	}
	return s
}

func (node *EvalStmt) String() string {
	return "EVAL " + node.Expr.String()
}

func (node *RecordStmt) String() string {
	s := fmt.Sprintf("%s%s = %s", node.Name, node.Labels, node.Expr)
	return s
}

func (es Expressions) String() (s string) {
	if len(es) == 0 {
		return ""
	}
	for _, e := range es {
		s += e.String()
		s += ", "
	}
	return s[:len(s)-2]
}

func (node *AggregateExpr) String() string {
	aggrString := node.Op.String()

	if node.Without {
		aggrString += fmt.Sprintf(" without(%s) ", strings.Join(node.Grouping, ", "))
	} else {
		if len(node.Grouping) > 0 {
			aggrString += fmt.Sprintf(" by(%s) ", strings.Join(node.Grouping, ", "))
		}
	}

	aggrString += "("
	if node.Op.isAggregatorWithParam() {
		aggrString += fmt.Sprintf("%s, ", node.Param)
	}
	aggrString += fmt.Sprintf("%s)", node.Expr)

	return aggrString
}

func (node *BinaryExpr) String() string {
	returnBool := ""
	if node.ReturnBool {
		returnBool = " bool"
	}

	matching := ""
	vm := node.VectorMatching
	if vm != nil && (len(vm.MatchingLabels) > 0 || vm.On) {
		if vm.On {
			matching = fmt.Sprintf(" on(%s)", strings.Join(vm.MatchingLabels, ", "))
		} else {
			matching = fmt.Sprintf(" ignoring(%s)", strings.Join(vm.MatchingLabels, ", "))
		}
		if vm.Card == CardManyToOne || vm.Card == CardOneToMany {
			matching += " group_"
			if vm.Card == CardManyToOne {
				matching += "left"
			} else {
				matching += "right"
			}
			matching += fmt.Sprintf("(%s)", strings.Join(vm.Include, ", "))
		}
	}
	return fmt.Sprintf("%s %s%s%s %s", node.LHS, node.Op, returnBool, matching, node.RHS)
}

func (node *Call) String() string {
	return fmt.Sprintf("%s(%s)", node.Func.Name, node.Args)
}

func (node *MatrixSelector) String() string {
	vecSelector := &VectorSelector{
		Name:          node.Name,
		LabelMatchers: node.LabelMatchers,
	}
	offset := ""
	if node.Offset != time.Duration(0) {
		offset = fmt.Sprintf(" offset %s", model.Duration(node.Offset))
	}
	return fmt.Sprintf("%s[%s]%s", vecSelector.String(), model.Duration(node.Range), offset)
}

func (node *NumberLiteral) String() string {
	return fmt.Sprint(node.Val)
}

func (node *ParenExpr) String() string {
	return fmt.Sprintf("(%s)", node.Expr)
}

func (node *StringLiteral) String() string {
	return fmt.Sprintf("%q", node.Val)
}

func (node *UnaryExpr) String() string {
	return fmt.Sprintf("%s%s", node.Op, node.Expr)
}

func (node *VectorSelector) String() string {
	labelStrings := make([]string, 0, len(node.LabelMatchers)-1)
	for _, matcher := range node.LabelMatchers {
		// Only include the __name__ label if its no equality matching.
		if matcher.Name == labels.MetricName && matcher.Type == labels.MatchEqual {
			continue
		}
		labelStrings = append(labelStrings, matcher.String())
	}
	offset := ""
	if node.Offset != time.Duration(0) {
		offset = fmt.Sprintf(" offset %s", model.Duration(node.Offset))
	}

	if len(labelStrings) == 0 {
		return fmt.Sprintf("%s%s", node.Name, offset)
	}
	sort.Strings(labelStrings)
	return fmt.Sprintf("%s{%s}%s", node.Name, strings.Join(labelStrings, ","), offset)
}
