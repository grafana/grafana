package log

type LabelExtractionExpr struct {
	Identifier string
	Expression string
}

func NewLabelExtractionExpr(identifier, expression string) LabelExtractionExpr {
	return LabelExtractionExpr{
		Identifier: identifier,
		Expression: expression,
	}
}
