package json

type PathExpression interface{}

type ObjectPath struct {
	Name  string
	Child PathExpression
}
