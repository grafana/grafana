package traceql

func Validate(expr *RootExpr) error {
	return expr.validate()
}
