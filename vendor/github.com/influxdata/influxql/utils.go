package influxql

// This package modified from the corresponding flux code for predicates in flux/semantic/utils.go

// ConjunctionsToExprSlice finds all children of AndOperators that are not themselves AndOperators,
// and returns them in a slice.  If the root node of expr is not an AndOperator, just returns expr.
//
//      AND
//     /   \
//    AND   r    =>   {p, q, r}
//   /   \
//  p     q
//
func ConjunctionsToExprSlice(expr Expr) []Expr {
	if e, ok := expr.(*BinaryExpr); ok && e.Op == AND {
		exprSlice := make([]Expr, 0, 2)
		exprSlice = append(exprSlice, ConjunctionsToExprSlice(e.LHS)...)
		exprSlice = append(exprSlice, ConjunctionsToExprSlice(e.RHS)...)
		return exprSlice
	}
	// grouping should already be taken care of by the tree
	if e, ok := expr.(*ParenExpr); ok {
		return ConjunctionsToExprSlice(e.Expr)
	}

	return []Expr{expr}
}

// ExprsToConjunction accepts a variable number of expressions and ANDs them
// together into a single expression.
//
//                         AND
//                        /   \
//    {p, q, r}    =>    AND   r
//                      /   \
//                     p     q
//
func ExprsToConjunction(exprs ...Expr) Expr {
	if len(exprs) == 0 {
		return nil
	}

	expr := exprs[0]
	for _, e := range exprs[1:] {
		expr = &BinaryExpr{
			LHS: expr,
			RHS: e,
			Op:  AND,
		}
	}

	return expr
}

// PartitionExpr accepts a predicate expression, separates it into components that have been
// logically ANDed together, and applies partitionFn to them.  Returns two expressions: one AND tree
// of the expressions for which partitionFn returned true, and an AND tree of expressions for which
// partitionFn returned false.
//
// Suppose partitonFn returns true for p and r, and false for q:
//
//      AND           passExpr     failExpr
//     /   \
//    AND   r    =>     AND           q
//   /   \             /   \
//  p     q           p     r
//
func PartitionExpr(expr Expr, partitionFn func(expression Expr) (bool, error)) (passExpr, failExpr Expr, err error) {
	exprSlice := ConjunctionsToExprSlice(expr)
	var passSlice, failSlice []Expr
	for _, e := range exprSlice {
		b, err := partitionFn(e)
		if err != nil {
			return nil, nil, err
		}
		if b {
			passSlice = append(passSlice, e)
		} else {
			failSlice = append(failSlice, e)
		}
	}

	passExpr = ExprsToConjunction(passSlice...)
	failExpr = ExprsToConjunction(failSlice...)
	return passExpr, failExpr, nil
}
