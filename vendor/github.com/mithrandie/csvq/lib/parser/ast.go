package parser

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

const TokenUndefined = 0

type Statement interface{}

type Expression interface {
	GetBaseExpr() *BaseExpr
	ClearBaseExpr()
	HasParseInfo() bool
	Line() int
	Char() int
	SourceFile() string
}

type QueryExpression interface {
	String() string

	GetBaseExpr() *BaseExpr
	ClearBaseExpr()
	HasParseInfo() bool
	Line() int
	Char() int
	SourceFile() string
}

type BaseExpr struct {
	line       int
	char       int
	sourceFile string
}

func (e *BaseExpr) Line() int {
	return e.line
}

func (e *BaseExpr) Char() int {
	return e.char
}

func (e *BaseExpr) SourceFile() string {
	return e.sourceFile
}

func (e *BaseExpr) HasParseInfo() bool {
	if e == nil {
		return false
	}
	return true
}

func (e *BaseExpr) GetBaseExpr() *BaseExpr {
	return e
}

func (e *BaseExpr) ClearBaseExpr() {
	e.line = 0
	e.char = 0
	e.sourceFile = ""
}

func NewBaseExpr(token Token) *BaseExpr {
	return &BaseExpr{
		line:       token.Line,
		char:       token.Char,
		sourceFile: token.SourceFile,
	}
}

type PrimitiveType struct {
	*BaseExpr
	Literal string
	Value   value.Primary
}

func NewStringValue(s string) PrimitiveType {
	return PrimitiveType{
		Literal: s,
		Value:   value.NewString(s),
	}
}

func NewIntegerValueFromString(s string) PrimitiveType {
	return PrimitiveType{
		Literal: s,
		Value:   value.NewIntegerFromString(s),
	}
}

func NewIntegerValue(i int64) PrimitiveType {
	return PrimitiveType{
		Value: value.NewInteger(i),
	}
}

func NewFloatValueFromString(s string) PrimitiveType {
	return PrimitiveType{
		Literal: s,
		Value:   value.NewFloatFromString(s),
	}
}

func NewFloatValue(f float64) PrimitiveType {
	return PrimitiveType{
		Value: value.NewFloat(f),
	}
}

func NewTernaryValueFromString(s string) PrimitiveType {
	return PrimitiveType{
		Value: value.NewTernaryFromString(s),
	}
}

func NewTernaryValue(t ternary.Value) PrimitiveType {
	return PrimitiveType{
		Value: value.NewTernary(t),
	}
}

func NewDatetimeValueFromString(s string, formats []string, location *time.Location) PrimitiveType {
	return PrimitiveType{
		Literal: s,
		Value:   value.NewDatetimeFromString(s, formats, location),
	}
}

func NewDatetimeValue(t time.Time) PrimitiveType {
	return PrimitiveType{
		Value: value.NewDatetime(t),
	}
}

func NewNullValue() PrimitiveType {
	return PrimitiveType{
		Value: value.NewNull(),
	}
}

func (e PrimitiveType) String() string {
	if 0 < len(e.Literal) {
		switch e.Value.(type) {
		case *value.String, *value.Datetime:
			return option.QuoteString(e.Literal)
		default:
			return e.Literal
		}
	}
	return e.Value.String()
}

func (e PrimitiveType) IsInteger() bool {
	_, ok := e.Value.(*value.Integer)
	return ok
}

type Placeholder struct {
	*BaseExpr
	Literal string
	Ordinal int
	Name    string
}

func (e Placeholder) String() string {
	if len(e.Name) < 1 {
		return fmt.Sprintf("%s{%d}", e.Literal, e.Ordinal)
	}
	return e.Literal
}

type Identifier struct {
	*BaseExpr
	Literal string
	Quoted  bool
}

func (i Identifier) String() string {
	if i.Quoted {
		return option.QuoteIdentifier(i.Literal)
	}
	return i.Literal
}

type Constant struct {
	*BaseExpr
	Space string
	Name  string
}

func (e Constant) String() string {
	return strings.ToUpper(e.Space) + ConstantDelimiter + strings.ToUpper(e.Name)
}

type FieldReference struct {
	*BaseExpr
	View   Identifier
	Column QueryExpression
}

func (e FieldReference) String() string {
	s := e.Column.String()
	if 0 < len(e.View.Literal) {
		s = e.View.String() + "." + s
	}
	return s
}

type ColumnNumber struct {
	*BaseExpr
	View   Identifier
	Number *value.Integer
}

func (e ColumnNumber) String() string {
	return e.View.String() + "." + e.Number.String()
}

type Parentheses struct {
	*BaseExpr
	Expr QueryExpression
}

func (p Parentheses) String() string {
	return putParentheses(p.Expr.String())
}

type RowValue struct {
	*BaseExpr
	Value QueryExpression
}

func (e RowValue) String() string {
	return e.Value.String()
}

type ValueList struct {
	*BaseExpr
	Values []QueryExpression
}

func (e ValueList) String() string {
	return putParentheses(listQueryExpressions(e.Values))
}

type RowValueList struct {
	*BaseExpr
	RowValues []QueryExpression
}

func (e RowValueList) String() string {
	return putParentheses(listQueryExpressions(e.RowValues))
}

type SelectQuery struct {
	*BaseExpr
	WithClause    QueryExpression
	SelectEntity  QueryExpression
	OrderByClause QueryExpression
	LimitClause   QueryExpression
	Context       Token
}

func (e SelectQuery) IsForUpdate() bool {
	return e.Context.Token == UPDATE
}

func (e SelectQuery) String() string {
	s := make([]string, 0)
	if e.WithClause != nil {
		s = append(s, e.WithClause.String())
	}
	s = append(s, e.SelectEntity.String())
	if e.OrderByClause != nil {
		s = append(s, e.OrderByClause.String())
	}
	if e.LimitClause != nil {
		s = append(s, e.LimitClause.String())
	}
	if e.IsForUpdate() {
		s = append(s, keyword(FOR), e.Context.String())
	}
	return joinWithSpace(s)
}

type SelectSet struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	All      Token
	RHS      QueryExpression
}

func (e SelectSet) String() string {
	s := []string{e.LHS.String(), e.Operator.String()}
	if !e.All.IsEmpty() {
		s = append(s, e.All.String())
	}
	s = append(s, e.RHS.String())
	return joinWithSpace(s)
}

type SelectEntity struct {
	*BaseExpr
	SelectClause  QueryExpression
	IntoClause    QueryExpression
	FromClause    QueryExpression
	WhereClause   QueryExpression
	GroupByClause QueryExpression
	HavingClause  QueryExpression
}

func (e SelectEntity) String() string {
	s := []string{e.SelectClause.String()}
	if e.IntoClause != nil {
		s = append(s, e.IntoClause.String())
	}
	if e.FromClause != nil {
		s = append(s, e.FromClause.String())
	}
	if e.WhereClause != nil {
		s = append(s, e.WhereClause.String())
	}
	if e.GroupByClause != nil {
		s = append(s, e.GroupByClause.String())
	}
	if e.HavingClause != nil {
		s = append(s, e.HavingClause.String())
	}
	return joinWithSpace(s)
}

type SelectClause struct {
	*BaseExpr
	Distinct Token
	Fields   []QueryExpression
}

func (sc SelectClause) IsDistinct() bool {
	return sc.Distinct.Token == DISTINCT
}

func (sc SelectClause) String() string {
	s := []string{keyword(SELECT)}
	if sc.IsDistinct() {
		s = append(s, sc.Distinct.String())
	}
	s = append(s, listQueryExpressions(sc.Fields))
	return joinWithSpace(s)
}

type IntoClause struct {
	*BaseExpr
	Variables []Variable
}

func (e IntoClause) String() string {
	vars := make([]QueryExpression, 0, len(e.Variables))
	for _, v := range e.Variables {
		vars = append(vars, v)
	}
	return joinWithSpace([]string{keyword(INTO), listQueryExpressions(vars)})
}

type FromClause struct {
	*BaseExpr
	Tables []QueryExpression
}

func (f FromClause) String() string {
	s := []string{keyword(FROM), listQueryExpressions(f.Tables)}
	return joinWithSpace(s)
}

type WhereClause struct {
	*BaseExpr
	Filter QueryExpression
}

func (w WhereClause) String() string {
	s := []string{keyword(WHERE), w.Filter.String()}
	return joinWithSpace(s)
}

type GroupByClause struct {
	*BaseExpr
	Items []QueryExpression
}

func (gb GroupByClause) String() string {
	s := []string{keyword(GROUP), keyword(BY), listQueryExpressions(gb.Items)}
	return joinWithSpace(s)
}

type HavingClause struct {
	*BaseExpr
	Filter QueryExpression
}

func (h HavingClause) String() string {
	s := []string{keyword(HAVING), h.Filter.String()}
	return joinWithSpace(s)
}

type OrderByClause struct {
	*BaseExpr
	Items []QueryExpression
}

func (ob OrderByClause) String() string {
	s := []string{keyword(ORDER), keyword(BY), listQueryExpressions(ob.Items)}
	return joinWithSpace(s)
}

type LimitClause struct {
	*BaseExpr
	Type         Token
	Position     Token
	Value        QueryExpression
	Unit         Token
	Restriction  Token
	OffsetClause QueryExpression
}

func (e LimitClause) restrictionString() []string {
	s := make([]string, 0, 2)
	if e.WithTies() {
		s = append(s, keyword(WITH))
	}
	return append(s, e.Restriction.String())
}

func (e LimitClause) String() string {
	s := make([]string, 0, 6)

	if e.Type.Token == LIMIT {
		s = append(s, e.Type.String())
		s = append(s, e.Value.String())
		if !e.Unit.IsEmpty() {
			s = append(s, e.Unit.String())
		}
		if !e.Restriction.IsEmpty() {
			s = append(s, e.restrictionString()...)
		}
		if e.OffsetClause != nil {
			s = append(s, e.OffsetClause.String())
		}
	} else if e.Type.Token == FETCH {
		if e.OffsetClause != nil {
			s = append(s, e.OffsetClause.String())
		}
		s = append(s, e.Type.String())
		s = append(s, e.Position.String())
		s = append(s, e.Value.String())
		s = append(s, e.Unit.String())
		if !e.Restriction.IsEmpty() {
			s = append(s, e.restrictionString()...)
		}
	} else {
		if e.OffsetClause != nil {
			s = append(s, e.OffsetClause.String())
		}
	}
	return joinWithSpace(s)
}

func (e LimitClause) Percentage() bool {
	return e.Unit.Token == PERCENT
}

func (e LimitClause) WithTies() bool {
	return e.Restriction.Token == TIES
}

type OffsetClause struct {
	*BaseExpr
	Value QueryExpression
	Unit  Token
}

func (e OffsetClause) String() string {
	s := make([]string, 2, 3)
	s[0] = keyword(OFFSET)
	s[1] = e.Value.String()
	if !e.Unit.IsEmpty() {
		s = append(s, e.Unit.String())
	}
	return joinWithSpace(s)
}

type WithClause struct {
	*BaseExpr
	InlineTables []QueryExpression
}

func (e WithClause) String() string {
	s := []string{keyword(WITH), listQueryExpressions(e.InlineTables)}
	return joinWithSpace(s)
}

type InlineTable struct {
	*BaseExpr
	Recursive Token
	Name      Identifier
	Fields    []QueryExpression
	Query     SelectQuery
}

func (e InlineTable) String() string {
	s := make([]string, 0)
	if !e.Recursive.IsEmpty() {
		s = append(s, e.Recursive.String())
	}
	s = append(s, e.Name.String())
	if e.Fields != nil {
		s = append(s, putParentheses(listQueryExpressions(e.Fields)))
	}
	s = append(s, keyword(AS), putParentheses(e.Query.String()))
	return joinWithSpace(s)
}

func (e InlineTable) IsRecursive() bool {
	return !e.Recursive.IsEmpty()
}

type Subquery struct {
	*BaseExpr
	Query SelectQuery
}

func (e Subquery) String() string {
	return putParentheses(e.Query.String())
}

type Url struct {
	*BaseExpr
	Raw string
}

func (e Url) String() string {
	return e.Raw
}

type TableFunction struct {
	*BaseExpr
	Name string
	Args []QueryExpression
}

func (e TableFunction) String() string {
	return strings.ToUpper(e.Name) + ConstantDelimiter + putParentheses(listQueryExpressions(e.Args))
}

type FormatSpecifiedFunction struct {
	*BaseExpr
	Type          Token
	FormatElement QueryExpression
	Path          QueryExpression
	Args          []QueryExpression
}

func (e FormatSpecifiedFunction) String() string {
	allArgs := make([]QueryExpression, 0, len(e.Args)+2)
	if e.FormatElement != nil {
		allArgs = append(allArgs, e.FormatElement)
	}
	allArgs = append(allArgs, e.Path)
	if e.Args != nil {
		allArgs = append(allArgs, e.Args...)
	}
	return e.Type.String() + putParentheses(listQueryExpressions(allArgs))
}

type JsonQuery struct {
	*BaseExpr
	JsonQuery Token
	Query     QueryExpression
	JsonText  QueryExpression
}

func (e JsonQuery) String() string {
	return e.JsonQuery.String() + putParentheses(e.Query.String()+", "+e.JsonText.String())
}

type Comparison struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	RHS      QueryExpression
}

func (c Comparison) String() string {
	s := []string{c.LHS.String(), c.Operator.String(), c.RHS.String()}
	return joinWithSpace(s)
}

type Is struct {
	*BaseExpr
	LHS      QueryExpression
	RHS      QueryExpression
	Negation Token
}

func (i Is) IsNegated() bool {
	return !i.Negation.IsEmpty()
}

func (i Is) String() string {
	s := []string{i.LHS.String(), keyword(IS)}
	if i.IsNegated() {
		s = append(s, i.Negation.String())
	}
	s = append(s, i.RHS.String())
	return joinWithSpace(s)
}

type Between struct {
	*BaseExpr
	LHS      QueryExpression
	Low      QueryExpression
	High     QueryExpression
	Negation Token
}

func (b Between) IsNegated() bool {
	return !b.Negation.IsEmpty()
}

func (b Between) String() string {
	s := []string{b.LHS.String()}
	if b.IsNegated() {
		s = append(s, b.Negation.String())
	}
	s = append(s, keyword(BETWEEN), b.Low.String(), keyword(AND), b.High.String())
	return joinWithSpace(s)
}

type In struct {
	*BaseExpr
	LHS      QueryExpression
	Values   QueryExpression
	Negation Token
}

func (i In) IsNegated() bool {
	return !i.Negation.IsEmpty()
}

func (i In) String() string {
	s := []string{i.LHS.String()}
	if i.IsNegated() {
		s = append(s, i.Negation.String())
	}
	s = append(s, keyword(IN), i.Values.String())
	return joinWithSpace(s)
}

type All struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	Values   QueryExpression
}

func (a All) String() string {
	s := []string{a.LHS.String(), a.Operator.String(), keyword(ALL), a.Values.String()}
	return joinWithSpace(s)
}

type Any struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	Values   QueryExpression
}

func (a Any) String() string {
	s := []string{a.LHS.String(), a.Operator.String(), keyword(ANY), a.Values.String()}
	return joinWithSpace(s)
}

type Like struct {
	*BaseExpr
	LHS      QueryExpression
	Pattern  QueryExpression
	Negation Token
}

func (l Like) IsNegated() bool {
	return !l.Negation.IsEmpty()
}

func (l Like) String() string {
	s := []string{l.LHS.String()}
	if l.IsNegated() {
		s = append(s, l.Negation.String())
	}
	s = append(s, keyword(LIKE), l.Pattern.String())
	return joinWithSpace(s)
}

type Exists struct {
	*BaseExpr
	Query Subquery
}

func (e Exists) String() string {
	s := []string{keyword(EXISTS), e.Query.String()}
	return joinWithSpace(s)
}

type Arithmetic struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	RHS      QueryExpression
}

func (a Arithmetic) String() string {
	s := []string{a.LHS.String(), a.Operator.String(), a.RHS.String()}
	return joinWithSpace(s)
}

type UnaryArithmetic struct {
	*BaseExpr
	Operand  QueryExpression
	Operator Token
}

func (e UnaryArithmetic) String() string {
	return e.Operator.String() + e.Operand.String()
}

type Logic struct {
	*BaseExpr
	LHS      QueryExpression
	Operator Token
	RHS      QueryExpression
}

func (l Logic) String() string {
	s := []string{l.LHS.String(), l.Operator.String(), l.RHS.String()}
	return joinWithSpace(s)
}

type UnaryLogic struct {
	*BaseExpr
	Operand  QueryExpression
	Operator Token
}

func (e UnaryLogic) String() string {
	if e.Operator.Token == NOT {
		s := []string{e.Operator.String(), e.Operand.String()}
		return joinWithSpace(s)
	}
	return e.Operator.String() + e.Operand.String()
}

type Concat struct {
	*BaseExpr
	Items []QueryExpression
}

func (c Concat) String() string {
	s := make([]string, len(c.Items))
	for i, v := range c.Items {
		s[i] = v.String()
	}
	return strings.Join(s, " || ")
}

type Function struct {
	*BaseExpr
	Name string
	Args []QueryExpression
	From Token
	For  Token
}

func (e Function) String() string {
	var args string
	if strings.EqualFold(e.Name, keyword(SUBSTRING)) && !e.From.IsEmpty() {
		elems := make([]string, 0, 5)
		elems = append(elems, e.Args[0].String(), e.From.String(), e.Args[1].String())
		if !e.For.IsEmpty() {
			elems = append(elems, e.For.String(), e.Args[2].String())
		}
		args = joinWithSpace(elems)
	} else {
		args = listQueryExpressions(e.Args)
	}
	return strings.ToUpper(e.Name) + "(" + args + ")"
}

type AggregateFunction struct {
	*BaseExpr
	Name     string
	Distinct Token
	Args     []QueryExpression
}

func (e AggregateFunction) String() string {
	s := make([]string, 0)
	if !e.Distinct.IsEmpty() {
		s = append(s, e.Distinct.String())
	}
	s = append(s, listQueryExpressions(e.Args))

	return strings.ToUpper(e.Name) + "(" + joinWithSpace(s) + ")"
}

func (e AggregateFunction) IsDistinct() bool {
	return e.Distinct.Token == DISTINCT
}

type Table struct {
	*BaseExpr
	Lateral Token
	Object  QueryExpression
	As      Token
	Alias   QueryExpression
}

func (e Table) String() string {
	s := make([]string, 0, 4)
	if !e.Lateral.IsEmpty() {
		s = append(s, e.Lateral.String())
	}
	s = append(s, e.Object.String())
	if !e.As.IsEmpty() {
		s = append(s, e.As.String())
	}
	if e.Alias != nil {
		s = append(s, e.Alias.String())
	}
	return joinWithSpace(s)
}

type Join struct {
	*BaseExpr
	Table     QueryExpression
	JoinTable QueryExpression
	Natural   Token
	JoinType  Token
	Direction Token
	Condition QueryExpression
}

func (j Join) String() string {
	s := []string{j.Table.String()}
	if !j.Natural.IsEmpty() {
		s = append(s, j.Natural.String())
	}
	if !j.Direction.IsEmpty() {
		s = append(s, j.Direction.String())
	}
	if !j.JoinType.IsEmpty() {
		s = append(s, j.JoinType.String())
	}
	s = append(s, keyword(JOIN), j.JoinTable.String())
	if j.Condition != nil {
		s = append(s, j.Condition.String())
	}
	return joinWithSpace(s)
}

type JoinCondition struct {
	*BaseExpr
	On    QueryExpression
	Using []QueryExpression
}

func (jc JoinCondition) String() string {
	var s []string
	if jc.On != nil {
		s = []string{keyword(ON), jc.On.String()}
	} else {
		s = []string{keyword(USING), putParentheses(listQueryExpressions(jc.Using))}
	}

	return joinWithSpace(s)
}

type Field struct {
	*BaseExpr
	Object QueryExpression
	As     Token
	Alias  QueryExpression
}

func (f Field) String() string {
	s := []string{f.Object.String()}
	if !f.As.IsEmpty() {
		s = append(s, f.As.String())
	}
	if f.Alias != nil {
		s = append(s, f.Alias.String())
	}
	return joinWithSpace(s)
}

func (f Field) Name() string {
	if f.Alias != nil {
		return f.Alias.(Identifier).Literal
	}
	if t, ok := f.Object.(PrimitiveType); ok {
		return t.Literal
	}
	if fr, ok := f.Object.(FieldReference); ok {
		if col, ok := fr.Column.(Identifier); ok {
			return col.Literal
		}
	}
	return f.Object.String()
}

type AllColumns struct {
	*BaseExpr
}

func (ac AllColumns) String() string {
	return "*"
}

type Dual struct {
	*BaseExpr
}

func (d Dual) String() string {
	return keyword(DUAL)
}

type Stdin struct {
	*BaseExpr
}

func (si Stdin) String() string {
	return keyword(STDIN)
}

type OrderItem struct {
	*BaseExpr
	Value         QueryExpression
	Direction     Token
	NullsPosition Token
}

func (e OrderItem) String() string {
	s := []string{e.Value.String()}
	if !e.Direction.IsEmpty() {
		s = append(s, e.Direction.String())
	}
	if !e.NullsPosition.IsEmpty() {
		s = append(s, keyword(NULLS), e.NullsPosition.String())
	}
	return joinWithSpace(s)
}

type CaseExpr struct {
	*BaseExpr
	Value QueryExpression
	When  []QueryExpression
	Else  QueryExpression
}

func (e CaseExpr) String() string {
	s := []string{keyword(CASE)}
	if e.Value != nil {
		s = append(s, e.Value.String())
	}
	for _, v := range e.When {
		s = append(s, v.String())
	}
	if e.Else != nil {
		s = append(s, e.Else.String())
	}
	s = append(s, keyword(END))
	return joinWithSpace(s)
}

type CaseExprWhen struct {
	*BaseExpr
	Condition QueryExpression
	Result    QueryExpression
}

func (e CaseExprWhen) String() string {
	s := []string{keyword(WHEN), e.Condition.String(), keyword(THEN), e.Result.String()}
	return joinWithSpace(s)
}

type CaseExprElse struct {
	*BaseExpr
	Result QueryExpression
}

func (e CaseExprElse) String() string {
	s := []string{keyword(ELSE), e.Result.String()}
	return joinWithSpace(s)
}

type ListFunction struct {
	*BaseExpr
	Name     string
	Distinct Token
	Args     []QueryExpression
	OrderBy  QueryExpression
}

func (e ListFunction) String() string {
	args := make([]string, 0, 3)
	if !e.Distinct.IsEmpty() {
		args = append(args, e.Distinct.String())
	}
	args = append(args, listQueryExpressions(e.Args))

	s := []string{strings.ToUpper(e.Name) + "(" + joinWithSpace(args) + ")"}
	if e.OrderBy != nil {
		s = append(s, keyword(WITHIN), keyword(GROUP), "("+e.OrderBy.String()+")")
	}
	return joinWithSpace(s)
}

func (e ListFunction) IsDistinct() bool {
	return !e.Distinct.IsEmpty()
}

type AnalyticFunction struct {
	*BaseExpr
	Name           string
	Distinct       Token
	Args           []QueryExpression
	IgnoreType     Token
	AnalyticClause AnalyticClause
}

func (e AnalyticFunction) String() string {
	args := make([]string, 0, 6)
	if !e.Distinct.IsEmpty() {
		args = append(args, e.Distinct.String())
	}
	if e.Args != nil {
		args = append(args, listQueryExpressions(e.Args))
	}
	if !e.IgnoreType.IsEmpty() {
		args = append(args, keyword(IGNORE), e.IgnoreType.String())
	}

	s := []string{
		strings.ToUpper(e.Name) + "(" + joinWithSpace(args) + ")",
		keyword(OVER),
		"(" + e.AnalyticClause.String() + ")",
	}
	return joinWithSpace(s)
}

func (e AnalyticFunction) IsDistinct() bool {
	return !e.Distinct.IsEmpty()
}

func (e AnalyticFunction) IgnoreNulls() bool {
	return e.IgnoreType.Token == NULLS
}

type AnalyticClause struct {
	*BaseExpr
	PartitionClause QueryExpression
	OrderByClause   QueryExpression
	WindowingClause QueryExpression
}

func (e AnalyticClause) String() string {
	s := make([]string, 0)
	if e.PartitionClause != nil {
		s = append(s, e.PartitionClause.String())
	}
	if e.OrderByClause != nil {
		s = append(s, e.OrderByClause.String())
	}
	if e.WindowingClause != nil {
		s = append(s, e.WindowingClause.String())
	}
	return joinWithSpace(s)
}

func (e AnalyticClause) PartitionValues() []QueryExpression {
	if e.PartitionClause == nil {
		return nil
	}
	return e.PartitionClause.(PartitionClause).Values
}

type PartitionClause struct {
	*BaseExpr
	Values []QueryExpression
}

func (e PartitionClause) String() string {
	s := []string{keyword(PARTITION), keyword(BY), listQueryExpressions(e.Values)}
	return joinWithSpace(s)
}

type WindowingClause struct {
	*BaseExpr
	FrameLow  QueryExpression
	FrameHigh QueryExpression
}

func (e WindowingClause) String() string {
	s := []string{keyword(ROWS)}
	if e.FrameHigh == nil {
		s = append(s, e.FrameLow.String())
	} else {
		s = append(s, keyword(BETWEEN), e.FrameLow.String(), keyword(AND), e.FrameHigh.String())
	}
	return joinWithSpace(s)
}

type WindowFramePosition struct {
	*BaseExpr
	Direction Token
	Unbounded Token
	Offset    int
}

func (e WindowFramePosition) String() string {
	s := make([]string, 0, 2)
	if e.Direction.Token == CURRENT {
		s = append(s, keyword(CURRENT), keyword(ROW))
	} else if !e.Unbounded.IsEmpty() {
		s = append(s, e.Unbounded.String(), e.Direction.String())
	} else {
		s = append(s, strconv.Itoa(e.Offset), e.Direction.String())
	}
	return joinWithSpace(s)
}

type Variable struct {
	*BaseExpr
	Name string
}

func (v Variable) String() string {
	return string(VariableSign) + v.Name
}

type VariableSubstitution struct {
	*BaseExpr
	Variable Variable
	Value    QueryExpression
}

func (vs VariableSubstitution) String() string {
	return joinWithSpace([]string{vs.Variable.String(), SubstitutionOperator, vs.Value.String()})
}

type VariableAssignment struct {
	*BaseExpr
	Variable Variable
	Value    QueryExpression
}

type VariableDeclaration struct {
	*BaseExpr
	Assignments []VariableAssignment
}

type DisposeVariable struct {
	*BaseExpr
	Variable Variable
}

type EnvironmentVariable struct {
	*BaseExpr
	Name   string
	Quoted bool
}

func (e EnvironmentVariable) String() string {
	name := e.Name
	if e.Quoted {
		name = option.QuoteIdentifier(name)
	}

	return string(VariableSign) + string(EnvironmentVariableSign) + name
}

type RuntimeInformation struct {
	*BaseExpr
	Name string
}

func (e RuntimeInformation) String() string {
	return string(VariableSign) + string(RuntimeInformationSign) + strings.ToUpper(e.Name)
}

type Flag struct {
	*BaseExpr
	Name string
}

func (e Flag) String() string {
	return string(VariableSign) + string(VariableSign) + strings.ToUpper(e.Name)
}

type SetEnvVar struct {
	*BaseExpr
	EnvVar EnvironmentVariable
	Value  QueryExpression
}

type UnsetEnvVar struct {
	*BaseExpr
	EnvVar EnvironmentVariable
}

type InsertQuery struct {
	*BaseExpr
	WithClause QueryExpression
	Table      Table
	Fields     []QueryExpression
	ValuesList []QueryExpression
	Query      QueryExpression
}

type UpdateQuery struct {
	*BaseExpr
	WithClause  QueryExpression
	Tables      []QueryExpression
	SetList     []UpdateSet
	FromClause  QueryExpression
	WhereClause QueryExpression
}

type UpdateSet struct {
	*BaseExpr
	Field QueryExpression
	Value QueryExpression
}

type ReplaceQuery struct {
	*BaseExpr
	WithClause QueryExpression
	Table      Table
	Fields     []QueryExpression
	Keys       []QueryExpression
	ValuesList []QueryExpression
	Query      QueryExpression
}

type DeleteQuery struct {
	*BaseExpr
	WithClause  QueryExpression
	Tables      []QueryExpression
	FromClause  FromClause
	WhereClause QueryExpression
}

type CreateTable struct {
	*BaseExpr
	Table       Identifier
	Fields      []QueryExpression
	Query       QueryExpression
	IfNotExists bool
}

type AddColumns struct {
	*BaseExpr
	Table    QueryExpression
	Columns  []ColumnDefault
	Position Expression
}

type ColumnDefault struct {
	*BaseExpr
	Column Identifier
	Value  QueryExpression
}

type ColumnPosition struct {
	*BaseExpr
	Position Token
	Column   QueryExpression
}

type DropColumns struct {
	*BaseExpr
	Table   QueryExpression
	Columns []QueryExpression
}

type RenameColumn struct {
	*BaseExpr
	Table QueryExpression
	Old   QueryExpression
	New   Identifier
}

type SetTableAttribute struct {
	*BaseExpr
	Table     QueryExpression
	Attribute Identifier
	Value     QueryExpression
}

type FunctionDeclaration struct {
	*BaseExpr
	Name       Identifier
	Parameters []VariableAssignment
	Statements []Statement
}

type AggregateDeclaration struct {
	*BaseExpr
	Name       Identifier
	Cursor     Identifier
	Parameters []VariableAssignment
	Statements []Statement
}

type DisposeFunction struct {
	*BaseExpr
	Name Identifier
}

type Return struct {
	*BaseExpr
	Value QueryExpression
}

type Echo struct {
	*BaseExpr
	Value QueryExpression
}

type Print struct {
	*BaseExpr
	Value QueryExpression
}

type Printf struct {
	*BaseExpr
	Format QueryExpression
	Values []QueryExpression
}

type Source struct {
	*BaseExpr
	FilePath QueryExpression
}

type Chdir struct {
	*BaseExpr
	DirPath QueryExpression
}

type Pwd struct {
	*BaseExpr
}

type Reload struct {
	*BaseExpr
	Type Identifier
}

type Execute struct {
	*BaseExpr
	Statements QueryExpression
	Values     []QueryExpression
}

type Syntax struct {
	*BaseExpr
	Keywords []QueryExpression
}

type SetFlag struct {
	*BaseExpr
	Flag  Flag
	Value QueryExpression
}

type AddFlagElement struct {
	*BaseExpr
	Flag  Flag
	Value QueryExpression
}

type RemoveFlagElement struct {
	*BaseExpr
	Flag  Flag
	Value QueryExpression
}

type ShowFlag struct {
	*BaseExpr
	Flag Flag
}

type ShowObjects struct {
	*BaseExpr
	Type Identifier
}

type ShowFields struct {
	*BaseExpr
	Type  Identifier
	Table QueryExpression
}

type If struct {
	*BaseExpr
	Condition  QueryExpression
	Statements []Statement
	ElseIf     []ElseIf
	Else       Else
}

type ElseIf struct {
	*BaseExpr
	Condition  QueryExpression
	Statements []Statement
}

type Else struct {
	*BaseExpr
	Statements []Statement
}

type Case struct {
	*BaseExpr
	Value QueryExpression
	When  []CaseWhen
	Else  CaseElse
}

type CaseWhen struct {
	*BaseExpr
	Condition  QueryExpression
	Statements []Statement
}

type CaseElse struct {
	*BaseExpr
	Statements []Statement
}

type While struct {
	*BaseExpr
	Condition  QueryExpression
	Statements []Statement
}

type WhileInCursor struct {
	*BaseExpr
	WithDeclaration bool
	Variables       []Variable
	Cursor          Identifier
	Statements      []Statement
}

type CursorDeclaration struct {
	*BaseExpr
	Cursor    Identifier
	Query     SelectQuery
	Statement Identifier
}

type OpenCursor struct {
	*BaseExpr
	Cursor Identifier
	Values []ReplaceValue
}

type CloseCursor struct {
	*BaseExpr
	Cursor Identifier
}

type DisposeCursor struct {
	*BaseExpr
	Cursor Identifier
}

type FetchCursor struct {
	*BaseExpr
	Position  FetchPosition
	Cursor    Identifier
	Variables []Variable
}

type FetchPosition struct {
	*BaseExpr
	Position Token
	Number   QueryExpression
}

type CursorStatus struct {
	*BaseExpr
	Cursor   Identifier
	Negation Token
	Type     Token
}

func (e CursorStatus) String() string {
	s := []string{keyword(CURSOR), e.Cursor.String(), keyword(IS)}
	if !e.Negation.IsEmpty() {
		s = append(s, e.Negation.String())
	}
	if e.Type.Token == RANGE {
		s = append(s, keyword(IN))
	}
	s = append(s, e.Type.String())
	return joinWithSpace(s)
}

type CursorAttrebute struct {
	*BaseExpr
	Cursor    Identifier
	Attrebute Token
}

func (e CursorAttrebute) String() string {
	s := []string{keyword(CURSOR), e.Cursor.String(), e.Attrebute.String()}
	return joinWithSpace(s)
}

type ViewDeclaration struct {
	*BaseExpr
	View   Identifier
	Fields []QueryExpression
	Query  QueryExpression
}

type DisposeView struct {
	*BaseExpr
	View QueryExpression
}

type StatementPreparation struct {
	*BaseExpr
	Name      Identifier
	Statement *value.String
}

type ReplaceValue struct {
	*BaseExpr
	Value QueryExpression
	Name  Identifier
}

type ExecuteStatement struct {
	*BaseExpr
	Name   Identifier
	Values []ReplaceValue
}

type DisposeStatement struct {
	*BaseExpr
	Name Identifier
}

type TransactionControl struct {
	*BaseExpr
	Token int
}

type FlowControl struct {
	*BaseExpr
	Token int
}

type Trigger struct {
	*BaseExpr
	Event   Identifier
	Message QueryExpression
	Code    value.Primary
}

type Exit struct {
	*BaseExpr
	Code value.Primary
}

type ExternalCommand struct {
	*BaseExpr
	Command string
}

func putParentheses(s string) string {
	return "(" + s + ")"
}

func joinWithSpace(s []string) string {
	return strings.Join(s, " ")
}

func listQueryExpressions(exprs []QueryExpression) string {
	s := make([]string, len(exprs))
	for i, v := range exprs {
		s[i] = v.String()
	}
	return strings.Join(s, ", ")
}

func keyword(token int) string {
	s, _ := KeywordLiteral(token)
	return s
}
