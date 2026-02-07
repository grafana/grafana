package expression

//func formatExpr(e sql.Expression) string {
//	f := new(exprFormatter)
//	f.formatExpr(e)
//	return f.String()
//}
//
//type exprFormatter struct {
//	l   int
//	pre string
//	b   strings.Builder
//}
//
//func (f *exprFormatter) String() string {
//	return f.b.String()
//}
//
//func (f *exprFormatter) formatExpr(e sql.Expression) string {
//	name, attrs := format(e)
//	f.b.WriteString("")
//	children := e.Children()
//
//}
//
//func (f *exprFormatter) setPre() {
//	l := f.l
//	for l > 0 {
//		if l == 1 {
//			f.pre += "├─"
//		}
//		f.pre += "│"
//	}
//}
//
//func format(e sql.Expression) (string, []string) {
//	var attrs []string
//	var name string
//	switch e := e.(type) {
//	case *Alias:
//		name = "Alias"
//		attrs = append(attrs, fmt.Sprintf("name: %s", e.name))
//	case *Arithmetic:
//		name = "Arithmetic"
//		attrs = append(attrs, fmt.Sprintf("op: %s", e.Op))
//		attrs = append(attrs)
//	case *AutoIncrement:
//		name = "AutoIncrement"
//	case *Between:
//		name = "Between"
//	case *Binary:
//		name = "Binary"
//	case *BindVar:
//		name = "BindVar"
//	case *Not:
//		name = "Not"
//	case *Case:
//		name = "Case"
//	case *CollatedExpression:
//		name = "CollatedExpression"
//	case *Equals:
//		name = "Equals"
//	case *NullSafeEquals:
//		name = "NullSafeEquals"
//	case *GreaterThan:
//		name = "GreaterThan"
//	case *GreaterThanOrEqual:
//		name = "GreaterThanOrEqual"
//	case *LessThan:
//		name = "LessThan"
//	case *LessThanOrEqual:
//		name = "LessThanOrEqual"
//	case *InTuple:
//		name = "InTuple"
//	case *HashInTuple:
//		name = "HashInTuple"
//	case *Regexp:
//		name = "Regexp"
//	case *Interval:
//		name = "Interval"
//	case *IsNull:
//		name = "IsNull"
//	case *IsTrue:
//		name = "IsTrue"
//	case *Like:
//		name = "Like"
//	case *Literal:
//		name = "Literal"
//	case *And:
//		name = "And"
//	case *Or:
//		name = "Or"
//	case *Xor:
//		name = "Xor"
//	case *ProcedureParam:
//		name = "ProcedureParam"
//	case *SetField:
//		name = "SetField"
//	case *Star:
//		name = "Star"
//	case *Tuple:
//		name = "Tuple"
//	case *UnresolvedColumn:
//		name = "UnresolvedColumn"
//	case *UnresolvedFunction:
//		name = "UnresolvedFunction"
//	case *SystemVar:
//		name = "SystemVar"
//	case *UserVar:
//		name = "UserVar"
//	case *Wrapper:
//		name = "Wrapper"
//	default:
//		panic(fmt.Sprintf("unknown expression type: %T", e))
//	}
//	return name, attrs
//}
