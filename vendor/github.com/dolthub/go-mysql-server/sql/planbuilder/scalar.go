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

package planbuilder

import (
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"

	"github.com/dolthub/vitess/go/vt/proto/query"
	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/encodings"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/expression/function"
	"github.com/dolthub/go-mysql-server/sql/expression/function/json"
	"github.com/dolthub/go-mysql-server/sql/fulltext"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

var icuVersion = "73.1"

func (b *Builder) buildWhere(inScope *scope, where *ast.Where) {
	if where == nil {
		return
	}
	filter := b.buildScalar(inScope, where.Expr)
	filterNode := plan.NewFilter(filter, inScope.node)
	inScope.node = filterNode
}

func (b *Builder) buildScalar(inScope *scope, e ast.Expr) (ex sql.Expression) {
	defer func() {
		if !(b.bindCtx == nil || b.bindCtx.resolveOnly) {
			return
		}

		if be, ok := ex.(expression.BinaryExpression); ok {
			left := be.Left()
			right := be.Right()
			if leftBindVar, ok := left.(*expression.BindVar); ok {
				if typ, ok := hasColumnType(right); ok {
					leftBindVar.Typ = typ
					left = leftBindVar
				}
			} else if rightBindVar, ok := right.(*expression.BindVar); ok {
				if typ, ok := hasColumnType(left); ok {
					rightBindVar.Typ = typ
					right = rightBindVar
				}
			}
			ex, _ = be.WithChildren(left, right)
		}
	}()

	switch v := e.(type) {
	case *ast.Default:
		return expression.WrapExpression(expression.NewDefaultColumn(v.ColName))
	case *ast.SubstrExpr:
		var name sql.Expression
		if v.Name != nil {
			name = b.buildScalar(inScope, v.Name)
		} else {
			name = b.buildScalar(inScope, v.StrVal)
		}
		start := b.buildScalar(inScope, v.From)

		if v.To == nil {
			return &function.Substring{Str: name, Start: start}
		}
		len := b.buildScalar(inScope, v.To)
		return &function.Substring{Str: name, Start: start, Len: len}
	case *ast.TrimExpr:
		pat := b.buildScalar(inScope, v.Pattern)
		str := b.buildScalar(inScope, v.Str)
		return function.NewTrim(str, pat, v.Dir)
	case *ast.ComparisonExpr:
		return b.buildComparison(inScope, v)
	case *ast.IsExpr:
		return b.buildIsExprToExpression(inScope, v)
	case *ast.NotExpr:
		c := b.buildScalar(inScope, v.Expr)
		b.qFlags.Set(sql.QFlgNotExpr)

		return expression.NewNot(c)
	case *ast.SQLVal:
		return b.ConvertVal(v)
	case ast.BoolVal:
		return expression.NewLiteral(bool(v), types.Boolean)
	case *ast.NullVal:
		return expression.NewLiteral(nil, types.Null)
	case *ast.ColName:
		if v.StoredProcVal != nil {
			switch val := v.StoredProcVal.(type) {
			case *ast.SQLVal:
				resVal := b.ConvertVal(val)
				if lit, isLit := resVal.(*expression.Literal); isLit && val.Type == ast.FloatVal {
					return expression.NewLiteral(lit.Value(), types.Float64)
				}
				return resVal
			case *ast.NullVal:
				return expression.NewLiteral(nil, types.Null)
			}
		}
		dbName := strings.ToLower(v.Qualifier.DbQualifier.String())
		tblName := strings.ToLower(v.Qualifier.Name.String())
		colName := strings.ToLower(v.Name.String())
		c, ok := inScope.resolveColumn(dbName, tblName, colName, true, false)
		if !ok {
			if aliasedExpr, ok := inScope.selectAliases[colName]; ok {
				return aliasedExpr
			}
			// Only try system variable lookup if there's no table qualifier.
			// Qualified names like "A.timestamp" are always column references, never system variables.
			var scope ast.SetScope
			if tblName == "" && dbName == "" {
				var sysVar sql.Expression
				sysVar, scope, ok = b.buildSysVar(v, ast.SetScope_None)
				if ok {
					return sysVar
				}
			}
			var err error
			if scope == ast.SetScope_User || scope == ast.SetScope_Persist || scope == ast.SetScope_PersistOnly {
				err = sql.ErrUnknownUserVariable.New(colName)
			} else if scope == ast.SetScope_Global || scope == ast.SetScope_Session {
				err = sql.ErrUnknownSystemVariable.New(colName)
			} else if tblName != "" && !inScope.hasTable(tblName) {
				err = sql.ErrTableNotFound.New(tblName)
			} else if tblName != "" {
				err = sql.ErrTableColumnNotFound.New(tblName, colName)
			} else {
				err = sql.ErrColumnNotFound.New(v)
			}
			b.handleErr(err)
		}

		origTbl := b.getOrigTblName(inScope.node, c.table)
		c = c.withOriginal(origTbl, v.Name.String())
		return c.scalarGf()
	case *ast.FuncExpr:
		name := v.Name.Lowered()
		if name == "name_const" {
			return b.buildNameConst(inScope, v)
		} else if name == "icu_version" {
			return expression.NewLiteral(icuVersion, types.MustCreateString(query.Type_VARCHAR, int64(len(icuVersion)), sql.Collation_Default))
		} else if IsAggregateFunc(name) && v.Over == nil {
			// TODO this assumes aggregate is in the same scope
			// also need to avoid nested aggregates
			return b.buildAggregateFunc(inScope, name, v)
		} else if isWindowFunc(name) {
			return b.buildWindowFunc(inScope, name, v, (*ast.WindowDef)(v.Over))
		}

		f, ok := b.cat.Function(b.ctx, name)
		if !ok {
			// todo(max): similar names in registry?
			err := sql.ErrFunctionNotFound.New(name)
			b.handleErr(err)
		}

		args := make([]sql.Expression, len(v.Exprs))
		for i, e := range v.Exprs {
			args[i] = b.selectExprToExpression(inScope, e)
		}

		if name == "json_value" {
			if len(args) == 3 {
				args[2] = b.getJsonValueTypeLiteral(args[2])
			}
		}

		rf, err := f.NewInstance(args)
		if err != nil {
			b.handleErr(err)
		}

		switch rf.(type) {
		case *function.Sleep, sql.NonDeterministicExpression:
			b.qFlags.Set(sql.QFlagUndeferrableExprs)
		}

		// NOTE: Not all aggregate functions support DISTINCT. Fortunately, the vitess parser will throw
		// errors for when DISTINCT is used on aggregate functions that don't support DISTINCT.
		if v.Distinct {
			if len(args) != 1 {
				return nil
			}
			args[0] = expression.NewDistinctExpression(args[0])
		}

		if _, ok := rf.(sql.NonDeterministicExpression); ok && inScope.nearestSubquery() != nil {
			inScope.nearestSubquery().markVolatile()
		}

		return rf
	case *ast.GroupConcatExpr:
		// TODO this is an aggregation
		return b.buildGroupConcat(inScope, v)
	case *ast.OrderedInjectedExpr:
		// TODO this is an aggregation in practice but is handled differently
		return b.buildOrderedInjectedExpr(inScope, v)
	case *ast.ParenExpr:
		return b.buildScalar(inScope, v.Expr)
	case *ast.AndExpr:
		lhs := b.buildScalar(inScope, v.Left)
		rhs := b.buildScalar(inScope, v.Right)
		return expression.NewAnd(lhs, rhs)
	case *ast.OrExpr:
		lhs := b.buildScalar(inScope, v.Left)
		rhs := b.buildScalar(inScope, v.Right)
		return expression.NewOr(lhs, rhs)
	case *ast.XorExpr:
		lhs := b.buildScalar(inScope, v.Left)
		rhs := b.buildScalar(inScope, v.Right)
		return expression.NewXor(lhs, rhs)
	case *ast.ConvertUsingExpr:
		expr := b.buildScalar(inScope, v.Expr)
		charset, err := sql.ParseCharacterSet(v.Type)
		if err != nil {
			b.handleErr(err)
		}
		return expression.NewConvertUsing(expr, charset)
	case *ast.CharExpr:
		args := make([]sql.Expression, len(v.Exprs))
		for i, e := range v.Exprs {
			args[i] = b.selectExprToExpression(inScope, e)
		}

		f, err := function.NewChar(args...)
		if err != nil {
			b.handleErr(err)
		}

		collId, err := sql.ParseCollation(v.Type, "", true)
		if err != nil {
			b.handleErr(err)
		}

		charFunc := f.(*function.Char)
		charFunc.Collation = collId
		return charFunc
	case *ast.ConvertExpr:
		var err error
		typeLength := 0
		if v.Type.Length != nil {
			// TODO move to vitess
			typeLength, err = strconv.Atoi(v.Type.Length.String())
			if err != nil {
				b.handleErr(err)
			}
		}

		typeScale := 0
		if v.Type.Scale != nil {
			// TODO move to vitess
			typeScale, err = strconv.Atoi(v.Type.Scale.String())
			if err != nil {
				b.handleErr(err)
			}
		}
		expr := b.buildScalar(inScope, v.Expr)
		ret, err := b.f.buildConvert(expr, v.Type.Type, typeLength, typeScale)
		if err != nil {
			b.handleErr(err)
		}
		return ret
	case ast.InjectedExpr:
		return b.buildInjectedExpr(inScope, v)
	case *ast.RangeCond:
		val := b.buildScalar(inScope, v.Left)
		lower := b.buildScalar(inScope, v.From)
		upper := b.buildScalar(inScope, v.To)

		switch strings.ToLower(v.Operator) {
		case ast.BetweenStr:
			return expression.NewBetween(val, lower, upper)
		case ast.NotBetweenStr:
			b.qFlags.Set(sql.QFlgNotExpr)
			return expression.NewNot(expression.NewBetween(val, lower, upper))
		default:
			return nil
		}
	case ast.ValTuple:
		var exprs = make([]sql.Expression, len(v))
		for i, e := range v {
			expr := b.buildScalar(inScope, e)
			exprs[i] = expr
		}
		return expression.NewTuple(exprs...)
	case *ast.BinaryExpr:
		return b.buildBinaryScalar(inScope, v)
	case *ast.UnaryExpr:
		return b.buildUnaryScalar(inScope, v)
	case *ast.Subquery:
		sqScope := inScope.pushSubquery()
		inScope.refsSubquery = true
		selectString := ast.String(v.Select)
		selScope := b.buildSelectStmt(sqScope, v.Select)
		// TODO: get the original select statement, not the reconstruction
		sq := plan.NewSubquery(selScope.node, selectString)
		b.qFlags.Set(sql.QFlagScalarSubquery)
		sq = sq.WithCorrelated(sqScope.correlated())
		if b.TriggerCtx().Active {
			sq = sq.WithVolatile()
		}
		return sq
	case *ast.CaseExpr:
		return b.buildCaseExpr(inScope, v)
	case *ast.IntervalExpr:
		e := b.buildScalar(inScope, v.Expr)
		b.qFlags.Set(sql.QFlagInterval)
		return expression.NewInterval(e, v.Unit)
	case *ast.CollateExpr:
		// handleCollateExpr is meant to handle generic text-returning expressions that should be reinterpreted as a different collation.
		innerExpr := b.buildScalar(inScope, v.Expr)
		collation, err := sql.ParseCollation("", v.Collation, false)
		if err != nil {
			b.handleErr(err)
		}
		// If we're collating a string literal, we check that the charset and collation match now. Other string sources
		// (such as from tables) will have their own charset, which we won't know until after the parsing stage.
		charSet := b.ctx.GetCharacterSet()
		if _, isLiteral := innerExpr.(*expression.Literal); isLiteral && collation.CharacterSet() != charSet {
			b.handleErr(sql.ErrCollationInvalidForCharSet.New(collation.Name(), charSet.Name()))
		}
		return expression.NewCollatedExpression(innerExpr, collation)
	case *ast.ValuesFuncExpr:
		if b.insertActive {
			if v.Name.Qualifier.Name.String() == "" {
				v.Name.Qualifier.Name = ast.NewTableIdent(inScope.insertTableAlias)
				if len(inScope.insertColumnAliases) > 0 {
					v.Name.Name = ast.NewColIdent(inScope.insertColumnAliases[v.Name.Name.Lowered()])
				}
			}
			dbName := strings.ToLower(v.Name.Qualifier.DbQualifier.String())
			tblName := strings.ToLower(v.Name.Qualifier.Name.String())
			colName := strings.ToLower(v.Name.Name.String())
			col, ok := inScope.resolveColumn(dbName, tblName, colName, false, false)
			if !ok {
				err := fmt.Errorf("expected ON DUPLICATE KEY ... VALUES() to reference a column, found: %s", v.Name.String())
				b.handleErr(err)
			}
			return col.scalarGf()
		} else {
			col := b.buildScalar(inScope, v.Name)
			fn, ok := b.cat.Function(b.ctx, "values")
			if !ok {
				err := sql.ErrFunctionNotFound.New("values")
				b.handleErr(err)
			}
			values, err := fn.NewInstance([]sql.Expression{col})
			if err != nil {
				b.handleErr(err)
			}
			return values
		}
	case *ast.ExistsExpr:
		sqScope := inScope.push()
		sqScope.initSubquery()
		selScope := b.buildSelectStmt(sqScope, v.Subquery.Select)
		selectString := ast.String(v.Subquery.Select)
		sq := plan.NewSubquery(selScope.node, selectString)
		sq = sq.WithCorrelated(sqScope.correlated())
		b.qFlags.Set(sql.QFlagScalarSubquery)
		return plan.NewExistsSubquery(sq)
	case *ast.TimestampFuncExpr:
		var (
			unit  sql.Expression
			expr1 sql.Expression
			expr2 sql.Expression
		)

		unit = expression.NewLiteral(v.Unit, types.LongText)
		expr1 = b.buildScalar(inScope, v.Expr1)
		expr2 = b.buildScalar(inScope, v.Expr2)

		switch v.Name {
		case "timestampadd":
			dateAddFunc, err := function.NewDateAdd(expr2, expression.NewInterval(expr1, v.Unit))
			if err != nil {
				b.handleErr(err)
			}
			return dateAddFunc
		case "timestampdiff":
			return function.NewTimestampDiff(unit, expr1, expr2)
		default:
			return nil
		}

	case *ast.ExtractFuncExpr:
		var unit sql.Expression = expression.NewLiteral(strings.ToUpper(v.Unit), types.LongText)
		expr := b.buildScalar(inScope, v.Expr)
		return function.NewExtract(unit, expr)
	case *ast.MatchExpr:
		return b.buildMatchAgainst(inScope, v)
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(e)))
	}
	return nil
}

func (b *Builder) buildInjectedExpr(inScope *scope, v ast.InjectedExpr) sql.Expression {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, v.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}

	var resolvedChildren []any
	if len(v.Children) > 0 {
		resolvedChildren = make([]any, len(v.Children))
		for i, child := range v.Children {
			resolvedChildren[i] = b.buildScalar(inScope, child)
		}
	} else {
		resolvedChildren = make([]any, len(v.SelectExprChildren))
		for i, child := range v.SelectExprChildren {
			resolvedChildren[i] = b.selectExprToExpression(inScope, child)
		}
	}
	return b.buildInjectedExpressionFromResolvedChildren(v, resolvedChildren)
}

func (b *Builder) buildInjectedExpressionFromResolvedChildren(v ast.InjectedExpr, resolvedChildren []any) sql.Expression {
	expr, err := v.Expression.WithResolvedChildren(resolvedChildren)
	if err != nil {
		b.handleErr(err)
		return nil
	}
	if sqlExpr, ok := expr.(sql.Expression); ok {
		return sqlExpr
	}
	b.handleErr(fmt.Errorf("injected expression should resolve to sql.Expression, got %T", expr))
	return nil
}

func (b *Builder) getOrigTblName(node sql.Node, alias string) string {
	if node == nil {
		return ""
	}
	// Look past table aliases
	var origTbl string
	transform.Inspect(node, func(n sql.Node) bool {
		switch nn := n.(type) {
		case *plan.TableAlias:
			if nn.Name() == alias {
				if child, ok := nn.Child.(sql.Nameable); ok {
					origTbl = child.Name()
				}
			}
			return false
		default:
			return true
		}
	})
	return origTbl
}

// getJsonValueTypeLiteral converts a type coercion string into a literal
// expression with the zero type of the coercion (see json_value function).
func (b *Builder) getJsonValueTypeLiteral(e sql.Expression) sql.Expression {
	typLit, ok := e.(*expression.Literal)
	if !ok {
		err := fmt.Errorf("invalid json_value coercion type: %s", e)
		b.handleErr(err)
	}
	convStr, _, err := types.LongText.Convert(b.ctx, typLit.Value())
	if err != nil {
		err := fmt.Errorf("invalid json_value coercion type: %s; %s", typLit.Value(), err.Error())
		b.handleErr(err)
	}
	var typ sql.Type
	switch strings.ToLower(convStr.(string)) {
	case "float":
		typ = types.Float32
	case "double", "decimal":
		typ = types.Float64
	case "signed":
		typ = types.Int64
	case "unsigned":
		typ = types.Uint64
	case "char":
		typ = types.Text
	case "json":
		typ = types.JSON
	case "time":
		typ = types.Time
	case "datetime":
		typ = types.Datetime
	case "date":
		typ = types.Date
	case "year":
		typ = types.Year
	default:
		err := fmt.Errorf("invalid type for json_value: %s", convStr)
		b.handleErr(err)
	}
	return expression.NewLiteral(typ.Zero(), typ)
}

func (b *Builder) buildUnaryScalar(inScope *scope, e *ast.UnaryExpr) sql.Expression {
	switch strings.ToLower(e.Operator) {
	case ast.MinusStr:
		expr := b.buildScalar(inScope, e.Expr)
		return expression.NewUnaryMinus(expr)
	case ast.PlusStr:
		// Unary plus expressions do nothing (do not turn the expression positive). Just return the underlying expressio return b.buildScalar(inScope, e.Expr)
		return b.buildScalar(inScope, e.Expr)
	case ast.BangStr:
		c := b.buildScalar(inScope, e.Expr)
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(c)
	case ast.BinaryStr:
		c := b.buildScalar(inScope, e.Expr)
		return expression.NewBinary(c)
	default:
		lowerOperator := strings.TrimSpace(strings.ToLower(e.Operator))
		if strings.HasPrefix(lowerOperator, "_") {
			// This is a character set introducer, so we need to decode the string to our internal encoding (`utf8mb4`)
			charSet, err := sql.ParseCharacterSet(lowerOperator[1:])
			if err != nil {
				b.handleErr(err)
			}
			if charSet.Encoder() == nil {
				err := sql.ErrUnsupportedFeature.New("unsupported character set: " + charSet.Name())
				b.handleErr(err)
			}

			// Due to how vitess orders expressions, COLLATE is a child rather than a parent, so we need to handle it in a special way
			collation := charSet.DefaultCollation()
			if collateExpr, ok := e.Expr.(*ast.CollateExpr); ok {
				// We extract the expression out of CollateExpr as we're only concerned about the collation string
				e.Expr = collateExpr.Expr
				collation, err = sql.ParseCollation("", collateExpr.Collation, false)
				if err != nil {
					b.handleErr(err)
				}
				if collation.CharacterSet() != charSet {
					err := sql.ErrCollationInvalidForCharSet.New(collation.Name(), charSet.Name())
					b.handleErr(err)
				}
			}

			// Character set introducers only work on string literals
			expr := b.buildScalar(inScope, e.Expr)
			if _, ok := expr.(*expression.Literal); !ok || !types.IsText(expr.Type()) {
				err := sql.ErrCharSetIntroducer.New()
				b.handleErr(err)
			}
			literal, _ := expr.Eval(b.ctx, nil)

			// Internally all strings are `utf8mb4`, so we need to decode the string (which applies the introducer)
			if strLiteral, ok := literal.(string); ok {
				decodedLiteral, ok := charSet.Encoder().Decode(encodings.StringToBytes(strLiteral))
				if !ok {
					err := sql.ErrCharSetInvalidString.New(charSet.Name(), strLiteral)
					b.handleErr(err)
				}
				return expression.NewLiteral(encodings.BytesToString(decodedLiteral), types.CreateLongText(collation))
			} else if byteLiteral, ok := literal.([]byte); ok {
				decodedLiteral, ok := charSet.Encoder().Decode(byteLiteral)
				if !ok {
					err := sql.ErrCharSetInvalidString.New(charSet.Name(), strLiteral)
					b.handleErr(err)
				}
				return expression.NewLiteral(decodedLiteral, types.CreateLongText(collation))
			} else {
				// Should not be possible
				err := fmt.Errorf("expression literal returned type `%s` but literal value had type `%T`",
					expr.Type().String(), literal)
				b.handleErr(err)
			}
		}
		err := sql.ErrUnsupportedFeature.New("unary operator: " + e.Operator)
		b.handleErr(err)
	}
	return nil
}

func (b *Builder) buildBinaryScalar(inScope *scope, be *ast.BinaryExpr) sql.Expression {
	expr, err := b.binaryExprToExpression(inScope, be)
	if err != nil {
		b.handleErr(err)
	}
	return expr
}

// typeExpandComparisonLiteral expands comparison literals to column types
// to simplify comparison execution when the conversion is safe.
func (b *Builder) typeExpandComparisonLiteral(left, right sql.Expression) (sql.Expression, sql.Expression) {
	var leftLit, rightLit *expression.Literal
	var leftGf, rightGf *expression.GetField
	switch l := left.(type) {
	case *expression.GetField:
		leftGf = l
	case *expression.Literal:
		leftLit = l
	}
	switch r := right.(type) {
	case *expression.GetField:
		rightGf = r
	case *expression.Literal:
		rightLit = r
	}

	var swap bool
	if leftLit != nil && rightGf != nil {
		// format: col = lit
		swap = true
		left, right = right, left
		rightLit, leftGf = leftLit, rightGf
	}

	if leftGf != nil && rightLit != nil {
		if types.IsSigned(left.Type()) && types.IsSigned(right.Type()) ||
			types.IsUnsigned(left.Type()) && types.IsUnsigned(right.Type()) ||
			types.IsFloat(left.Type()) && types.IsFloat(right.Type()) ||
			types.IsDecimal(left.Type()) && types.IsDecimal(right.Type()) ||
			types.IsText(left.Type()) && types.IsText(right.Type()) {
			if left.Type().MaxTextResponseByteLength(b.ctx) >= right.Type().MaxTextResponseByteLength(b.ctx) {
				// The types are congruent and the literal does not lose
				// information casting to the column type. The conditions
				// should preclude out of range, casting errors, or
				// correctness missteps.
				val, _, err := leftGf.Type().Convert(b.ctx, rightLit.Value())
				if err != nil && !expression.ErrNilOperand.Is(err) {
					b.handleErr(err)
				}
				right = expression.NewLiteral(val, leftGf.Type())
			}
		}

	}
	if swap {
		return right, left
	}
	return left, right
}

func (b *Builder) buildComparison(inScope *scope, c *ast.ComparisonExpr) sql.Expression {
	left := b.buildScalar(inScope, c.Left)
	right := b.buildScalar(inScope, c.Right)

	left, right = b.typeExpandComparisonLiteral(left, right)

	var escape sql.Expression = nil
	if c.Escape != nil {
		escape = b.buildScalar(inScope, c.Escape)
	}

	switch strings.ToLower(c.Operator) {
	case ast.RegexpStr:
		regexpLike, err := function.NewRegexpLike(left, right)
		if err != nil {
			b.handleErr(err)
		}
		return regexpLike
	case ast.NotRegexpStr:
		regexpLike, err := function.NewRegexpLike(left, right)
		if err != nil {
			b.handleErr(err)
		}
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(regexpLike)
	case ast.EqualStr:
		return expression.NewEquals(left, right)
	case ast.LessThanStr:
		return expression.NewLessThan(left, right)
	case ast.LessEqualStr:
		return expression.NewLessThanOrEqual(left, right)
	case ast.GreaterThanStr:
		return expression.NewGreaterThan(left, right)
	case ast.GreaterEqualStr:
		return expression.NewGreaterThanOrEqual(left, right)
	case ast.NullSafeEqualStr:
		return expression.NewNullSafeEquals(left, right)
	case ast.NotEqualStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(
			expression.NewEquals(left, right),
		)
	case ast.InStr:
		switch right.(type) {
		case expression.Tuple:
			return expression.NewInTuple(left, right)
		case *plan.Subquery:
			b.qFlags.Set(sql.QFlagScalarSubquery)
			return plan.NewInSubquery(left, right)
		default:
			err := sql.ErrUnsupportedFeature.New(fmt.Sprintf("IN %T", right))
			b.handleErr(err)
		}
	case ast.NotInStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		switch right.(type) {
		case expression.Tuple:
			b.qFlags.Set(sql.QFlgNotExpr)
			return expression.NewNotInTuple(left, right)
		case *plan.Subquery:
			b.qFlags.Set(sql.QFlagScalarSubquery)
			return plan.NewNotInSubquery(left, right)
		default:
			err := sql.ErrUnsupportedFeature.New(fmt.Sprintf("NOT IN %T", right))
			b.handleErr(err)
		}
	case ast.LikeStr:
		return expression.NewLike(left, right, escape)
	case ast.NotLikeStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(expression.NewLike(left, right, escape))
	default:
		err := sql.ErrUnsupportedFeature.New(c.Operator)
		b.handleErr(err)
	}
	return nil
}

func hasColumnType(e sql.Expression) (sql.Type, bool) {
	var typ sql.Type
	sql.Inspect(e, func(e sql.Expression) bool {
		if col, ok := e.(*expression.GetField); ok {
			typ = col.Type()
			return false
		}
		return true
	})
	return typ, typ != nil
}

func (b *Builder) buildCaseExpr(inScope *scope, e *ast.CaseExpr) sql.Expression {
	expr, err := b.caseExprToExpression(inScope, e)
	if err != nil {
		b.handleErr(err)
	}
	return expr
}

func (b *Builder) buildIsExprToExpression(inScope *scope, c *ast.IsExpr) sql.Expression {
	e := b.buildScalar(inScope, c.Expr)
	switch strings.ToLower(c.Operator) {
	case ast.IsNullStr:
		return expression.DefaultExpressionFactory.NewIsNull(e)
	case ast.IsNotNullStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.DefaultExpressionFactory.NewIsNotNull(e)
	case ast.IsTrueStr:
		return expression.NewIsTrue(e)
	case ast.IsFalseStr:
		return expression.NewIsFalse(e)
	case ast.IsNotTrueStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(expression.NewIsTrue(e))
	case ast.IsNotFalseStr:
		b.qFlags.Set(sql.QFlgNotExpr)
		return expression.NewNot(expression.NewIsFalse(e))
	default:
		err := sql.ErrUnsupportedSyntax.New(ast.String(c))
		b.handleErr(err)
	}
	return nil
}

func (b *Builder) binaryExprToExpression(inScope *scope, be *ast.BinaryExpr) (sql.Expression, error) {
	l := b.buildScalar(inScope, be.Left)
	r := b.buildScalar(inScope, be.Right)

	operator := strings.ToLower(be.Operator)
	switch operator {
	case
		ast.PlusStr,
		ast.MinusStr,
		ast.MultStr,
		ast.DivStr,
		ast.ShiftLeftStr,
		ast.ShiftRightStr,
		ast.BitAndStr,
		ast.BitOrStr,
		ast.BitXorStr,
		ast.IntDivStr,
		ast.ModStr:

		_, lok := l.(*expression.Interval)
		_, rok := r.(*expression.Interval)
		if lok && be.Operator == "-" {
			return nil, sql.ErrUnsupportedSyntax.New("subtracting from an interval")
		} else if (lok || rok) && be.Operator != "+" && be.Operator != "-" {
			return nil, sql.ErrUnsupportedSyntax.New("only + and - can be used to add or subtract intervals from dates")
		} else if lok && rok {
			return nil, sql.ErrUnsupportedSyntax.New("intervals cannot be added or subtracted from other intervals")
		}

		switch operator {
		case ast.DivStr:
			return expression.NewDiv(l, r), nil
		case ast.ModStr:
			return expression.NewMod(l, r), nil
		case ast.BitAndStr, ast.BitOrStr, ast.BitXorStr, ast.ShiftRightStr, ast.ShiftLeftStr:
			return expression.NewBitOp(l, r, be.Operator), nil
		case ast.IntDivStr:
			return expression.NewIntDiv(l, r), nil
		case ast.MultStr:
			return expression.NewMult(l, r), nil
		case ast.PlusStr:
			return expression.NewPlus(l, r), nil
		case ast.MinusStr:
			return expression.NewMinus(l, r), nil
		default:
			return nil, sql.ErrUnsupportedSyntax.New("unsupported operator: %s", be.Operator)
		}

	case ast.JSONExtractOp, ast.JSONUnquoteExtractOp:
		jsonExtract, err := json.NewJSONExtract(l, r)
		if err != nil {
			return nil, err
		}

		if operator == ast.JSONUnquoteExtractOp {
			return json.NewJSONUnquote(jsonExtract), nil
		}
		return jsonExtract, nil

	default:
		return nil, sql.ErrUnsupportedFeature.New(be.Operator)
	}
}

func (b *Builder) caseExprToExpression(inScope *scope, e *ast.CaseExpr) (sql.Expression, error) {
	var expr sql.Expression

	if e.Expr != nil {
		expr = b.buildScalar(inScope, e.Expr)
	}

	var branches []expression.CaseBranch
	for _, w := range e.Whens {
		var cond sql.Expression
		cond = b.buildScalar(inScope, w.Cond)

		var val sql.Expression
		val = b.buildScalar(inScope, w.Val)

		branches = append(branches, expression.CaseBranch{
			Cond:  cond,
			Value: val,
		})
	}

	var elseExpr sql.Expression
	if e.Else != nil {
		elseExpr = b.buildScalar(inScope, e.Else)
	}

	newCase := expression.NewCase(expr, branches, elseExpr)
	if types.IsText(newCase.Type()) {
		for _, branch := range branches {
			if types.IsEnum(branch.Value.Type()) {
				branch.Value = expression.NewEnumToString(branch.Value)
			}
		}
		if elseExpr != nil && types.IsEnum(elseExpr.Type()) {
			elseExpr = expression.NewEnumToString(elseExpr)
		}
		newCase = expression.NewCase(expr, branches, elseExpr)
	}

	return newCase, nil
}

func (b *Builder) intervalExprToExpression(inScope *scope, e *ast.IntervalExpr) *expression.Interval {
	expr := b.buildScalar(inScope, e.Expr)
	b.qFlags.Set(sql.QFlagInterval)
	return expression.NewInterval(expr, e.Unit)
}

// Convert an integer, represented by the specified string in the specified
// base, to its smallest representation possible, out of:
// int8, uint8, int16, uint16, int32, uint32, int64 and uint64
func (b *Builder) convertInt(value string, base int) *expression.Literal {
	if i8, err := strconv.ParseInt(value, base, 8); err == nil {
		return expression.NewLiteral(int8(i8), types.Int8)
	}
	if ui8, err := strconv.ParseUint(value, base, 8); err == nil {
		return expression.NewLiteral(uint8(ui8), types.Uint8)
	}
	if i16, err := strconv.ParseInt(value, base, 16); err == nil {
		return expression.NewLiteral(int16(i16), types.Int16)
	}
	if ui16, err := strconv.ParseUint(value, base, 16); err == nil {
		return expression.NewLiteral(uint16(ui16), types.Uint16)
	}
	if i32, err := strconv.ParseInt(value, base, 32); err == nil {
		return expression.NewLiteral(int32(i32), types.Int32)
	}
	if ui32, err := strconv.ParseUint(value, base, 32); err == nil {
		return expression.NewLiteral(uint32(ui32), types.Uint32)
	}
	if i64, err := strconv.ParseInt(value, base, 64); err == nil {
		return expression.NewLiteral(int64(i64), types.Int64)
	}
	if ui64, err := strconv.ParseUint(value, base, 64); err == nil {
		return expression.NewLiteral(uint64(ui64), types.Uint64)
	}
	if decimal, _, err := types.InternalDecimalType.Convert(b.ctx, value); err == nil {
		return expression.NewLiteral(decimal, types.InternalDecimalType)
	}

	b.handleErr(fmt.Errorf("could not convert %s to any numerical type", value))
	return nil
}

func (b *Builder) ConvertVal(v *ast.SQLVal) sql.Expression {
	switch v.Type {
	case ast.StrVal:
		return expression.NewLiteral(string(v.Val), types.CreateLongText(b.ctx.GetCollation()))
	case ast.IntVal:
		return b.convertInt(string(v.Val), 10)
	case ast.FloatVal:
		// any float value is parsed as decimal except when the value has scientific notation
		ogVal := strings.ToLower(string(v.Val))
		if strings.Contains(ogVal, "e") {
			val, err := strconv.ParseFloat(string(v.Val), 64)
			if err != nil {
				b.handleErr(err)
			}
			return expression.NewLiteral(val, types.Float64)
		}

		// using DECIMAL data type avoids precision error of rounded up float64 value
		if ps := strings.Split(string(v.Val), "."); len(ps) == 2 {
			p, s := expression.GetDecimalPrecisionAndScale(ogVal)
			dt, err := types.CreateDecimalType(p, s)
			if err != nil {
				return expression.NewLiteral(string(v.Val), types.CreateLongText(b.ctx.GetCollation()))
			}
			dVal, _, err := dt.Convert(b.ctx, ogVal)
			if err != nil {
				return expression.NewLiteral(string(v.Val), types.CreateLongText(b.ctx.GetCollation()))
			}
			return expression.NewLiteral(dVal, dt)
		} else {
			// if the value is not float type - this should not happen
			return b.convertInt(string(v.Val), 10)
		}
	case ast.HexNum:
		// TODO: binary collation?
		v := strings.ToLower(string(v.Val))
		if strings.HasPrefix(v, "0x") {
			v = v[2:]
		} else if strings.HasPrefix(v, "x") {
			v = strings.Trim(v[1:], "'")
		}

		// pad string to even length
		if len(v)%2 == 1 {
			v = "0" + v
		}

		val, err := hex.DecodeString(v)
		if err != nil {
			b.handleErr(err)
		}
		return expression.NewLiteral(val, types.LongBlob)
	case ast.HexVal:
		// TODO: binary collation?
		val, err := v.HexDecode()
		if err != nil {
			b.handleErr(err)
		}
		return expression.NewLiteral(val, types.LongBlob)
	case ast.ValArg:
		name := strings.TrimPrefix(string(v.Val), ":")
		if b.bindCtx != nil {
			if b.bindCtx.resolveOnly {
				return expression.NewBindVar(name)
			}
			replacement, ok := b.normalizeValArg(v)
			if ok {
				return replacement
			}
		}
		return expression.NewBindVar(name)
	case ast.BitVal:
		if len(v.Val) == 0 {
			return expression.NewLiteral(0, types.Uint64)
		}

		res, err := strconv.ParseUint(string(v.Val), 2, 64)
		if err != nil {
			b.handleErr(err)
		}

		return expression.NewLiteral(res, types.Uint64)
	}

	b.handleErr(sql.ErrInvalidSQLValType.New(v.Type))
	return nil
}

// processMatchAgainst returns a new MatchAgainst expression that has had
// all of its tables filled in. This essentially grabs the appropriate index
// (if it hasn't already been grabbed), and then loads the appropriate
// tables that are referenced by the index. The returned expression contains
// everything needed to calculate relevancy.
//
// A fully resolved MatchAgainst expression is also used by the index
// filter, since we only need to load the tables once. All steps after this
// one can assume that the expression has been fully resolved and is valid.
func (b *Builder) buildMatchAgainst(inScope *scope, v *ast.MatchExpr) *expression.MatchAgainst {
	rts := getTablesByName(inScope.node)
	var rt *plan.ResolvedTable
	var matchTable string
	cols := make([]*expression.GetField, len(v.Columns))
	for i, selectExpr := range v.Columns {
		expr := b.selectExprToExpression(inScope, selectExpr)
		gf, ok := expr.(*expression.GetField)
		if !ok {
			err := sql.ErrFullTextMatchAgainstNotColumns.New()
			b.handleErr(err)
		}
		if rt == nil {
			matchTable = strings.ToLower(gf.Table())
			rt, ok = rts[matchTable]
			if !ok {
				// shouldn't be able to resolve expression without table being available
				panic("shouldn't be able to resolve expression without table being available")
			}
		} else if !strings.EqualFold(matchTable, gf.Table()) {
			err := sql.ErrFullTextMatchAgainstSameTable.New()
			b.handleErr(err)
		}
		cols[i] = gf
	}
	matchExpr := b.buildScalar(inScope, v.Expr)
	var searchModifier fulltext.SearchModifier
	var err error
	switch v.Option {
	case ast.NaturalLanguageModeStr, "":
		searchModifier = fulltext.SearchModifier_NaturalLanguage
	case ast.NaturalLanguageModeWithQueryExpansionStr:
		searchModifier = fulltext.SearchModifier_NaturalLangaugeQueryExpansion
		err = fmt.Errorf(`"IN NATURAL LANGUAGE MODE WITH QUERY EXPANSION" is not supported yet`)
	case ast.BooleanModeStr:
		searchModifier = fulltext.SearchModifier_Boolean
		err = fmt.Errorf(`"IN BOOLEAN MODE" is not supported yet`)
	case ast.QueryExpansionStr:
		searchModifier = fulltext.SearchModifier_QueryExpansion
		err = fmt.Errorf(`"WITH QUERY EXPANSION" is not supported yet`)
	default:
		err = sql.ErrUnsupportedFeature.New(v.Option)
	}
	if err != nil {
		b.handleErr(err)
	}

	innerTbl := rt.UnderlyingTable()
	indexedTbl, ok := innerTbl.(sql.IndexAddressableTable)
	if !ok {
		err := fmt.Errorf("cannot use MATCH ... AGAINST ... on a table that does not declare indexes")
		b.handleErr(err)
	}

	indexes, err := indexedTbl.GetIndexes(b.ctx)
	if err != nil {
		b.handleErr(err)
	}
	ftIndex := findMatchAgainstIndex(cols, indexes)
	if ftIndex == nil {
		err := sql.ErrNoFullTextIndexFound.New(indexedTbl.Name())
		b.handleErr(err)
	}

	// Get the key columns
	keyCols, err := ftIndex.FullTextKeyColumns(b.ctx)
	if err != nil {
		b.handleErr(err)
	}

	genericCols := make([]sql.Expression, len(cols))
	for i, e := range cols {
		genericCols[i] = e
	}

	// Grab the pseudo-index table names
	tableNames, err := ftIndex.FullTextTableNames(b.ctx)
	if err != nil {
		b.handleErr(err)
	}

	fullindexTableNames := [5]string{tableNames.Config, tableNames.Position, tableNames.DocCount, tableNames.GlobalCount, tableNames.RowCount}
	idxTables := make([]sql.IndexAddressableTable, 5)
	for i, name := range fullindexTableNames {
		configTbl, ok, err := rt.SqlDatabase.GetTableInsensitive(b.ctx, name)
		if err != nil {
			b.handleErr(err)
		}
		if !ok {
			err := fmt.Errorf("Full-Text index `%s` on table `%s` is linked to table `%s` which could not be found",
				ftIndex.ID(), indexedTbl.Name(), tableNames.Config)
			b.handleErr(err)
		}
		idxTables[i], ok = configTbl.(sql.IndexAddressableTable)
		if !ok {
			err := fmt.Errorf("Full-Text index `%s` on table `%s` requires table `%s` to implement sql.IndexAddressableTable",
				ftIndex.ID(), indexedTbl.Name(), tableNames.Config)
			b.handleErr(err)
		}
	}

	matchAgainst := expression.NewMatchAgainst(genericCols, matchExpr, searchModifier)
	matchAgainst.SetIndex(ftIndex)

	return matchAgainst.WithInfo(indexedTbl, idxTables[0], idxTables[1], idxTables[2], idxTables[3], idxTables[4], keyCols)
}

func findMatchAgainstIndex(cols []*expression.GetField, indexes []sql.Index) fulltext.Index {
	var found fulltext.Index
	for _, idx := range indexes {
		idxExprs := idx.Expressions()
		if !idx.IsFullText() || len(cols) != len(idxExprs) {
			continue
		}
		// check that index expressions match |cols|
		allMatch := true
		for _, gf := range cols {
			var match bool
			for _, idxExpr := range idxExprs {
				if gf.String() == idxExpr {
					match = true
					break
				}
			}
			if !match {
				allMatch = false
				break
			}
		}
		if !allMatch {
			continue
		}
		var ok bool
		found, ok = idx.(fulltext.Index)
		if ok {
			break
		}
	}
	return found
}
