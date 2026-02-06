// Copyright 2020-2021 Dolthub, Inc.
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

package analyzer

import (
	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/information_schema"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"
)

// validateColumnDefaults ensures that newly created column defaults from a DDL statement are legal for the type of
// column, various other business logic checks to match MySQL's logic.
func validateColumnDefaults(ctx *sql.Context, _ *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("validateColumnDefaults")
	defer span.End()

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch node := n.(type) {
		case *plan.AlterDefaultSet:
			table := getResolvedTable(node)
			sch := table.Schema()
			index := sch.IndexOfColName(node.ColumnName)
			if index == -1 {
				return nil, transform.SameTree, sql.ErrColumnNotFound.New(node.ColumnName)
			}
			col := sch[index]
			err := validateColumnDefault(ctx, col, node.Default)
			if err != nil {
				return node, transform.SameTree, err
			}

			newDefault, same, err := normalizeDefault(ctx, node.Default)
			if err != nil {
				return nil, transform.SameTree, err
			}
			if same {
				return node, transform.SameTree, nil
			}

			newNode, err := node.WithDefault(newDefault)
			if err != nil {
				return nil, transform.SameTree, err
			}
			return newNode, transform.NewTree, nil

		case sql.SchemaTarget:
			switch node.(type) {
			case *plan.AlterPK, *plan.AddColumn, *plan.ModifyColumn, *plan.AlterDefaultDrop, *plan.CreateTable, *plan.DropColumn:
				// DDL nodes must validate any new column defaults, continue to logic below
			default:
				// other node types are not altering the schema and therefore don't need validation of column defaults
				return n, transform.SameTree, nil
			}

			// There may be multiple DDL nodes in the plan (ALTER TABLE statements can have many clauses), and for each of them
			// we need to count the column indexes in the very hacky way outlined above.
			i := 0
			return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				eWrapper, ok := e.(*expression.Wrapper)
				if !ok {
					return e, transform.SameTree, nil
				}

				defer func() {
					i++
				}()

				eVal := eWrapper.Unwrap()
				if eVal == nil {
					return e, transform.SameTree, nil
				}
				colDefault, ok := eVal.(*sql.ColumnDefaultValue)
				if !ok {
					return e, transform.SameTree, nil
				}

				col, err := lookupColumnForTargetSchema(ctx, node, i)
				if err != nil {
					return nil, transform.SameTree, err
				}

				err = validateColumnDefault(ctx, col, colDefault)
				if err != nil {
					return nil, transform.SameTree, err
				}

				newDefault, same, err := normalizeDefault(ctx, colDefault)
				if err != nil {
					return nil, transform.SameTree, err
				}
				if same {
					return e, transform.SameTree, nil
				}
				return expression.WrapExpression(newDefault), transform.NewTree, nil
			})
		default:
			return node, transform.SameTree, nil
		}
	})
}

// stripTableNamesFromColumnDefaults removes the table name from any GetField expressions in column default expressions.
// Default values can only reference their host table, and since we serialize the GetField expression for storage, it's
// important that we remove the table name before passing it off for storage. Otherwise we end up with serialized
// defaults like `tableName.field + 1` instead of just `field + 1`.
func stripTableNamesFromColumnDefaults(ctx *sql.Context, _ *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("stripTableNamesFromColumnDefaults")
	defer span.End()

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch node := n.(type) {
		case *plan.AlterDefaultSet:
			eWrapper := expression.WrapExpression(node.Default)
			newExpr, same, err := stripTableNamesFromDefault(eWrapper)
			if err != nil {
				return node, transform.SameTree, err
			}
			if same {
				return node, transform.SameTree, nil
			}

			newNode, err := node.WithDefault(newExpr)
			if err != nil {
				return node, transform.SameTree, err
			}
			return newNode, transform.NewTree, nil
		case sql.SchemaTarget:
			return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				eWrapper, ok := e.(*expression.Wrapper)
				if !ok {
					return e, transform.SameTree, nil
				}

				return stripTableNamesFromDefault(eWrapper)
			})
		case *plan.ResolvedTable:
			ct, ok := node.Table.(*information_schema.ColumnsTable)
			if !ok {
				return node, transform.SameTree, nil
			}

			allColumns, err := ct.AllColumns(ctx)
			if err != nil {
				return nil, transform.SameTree, err
			}

			allDefaults, same, err := transform.Exprs(transform.WrappedColumnDefaults(allColumns), func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				eWrapper, ok := e.(*expression.Wrapper)
				if !ok {
					return e, transform.SameTree, nil
				}

				return stripTableNamesFromDefault(eWrapper)
			})

			if err != nil {
				return nil, transform.SameTree, err
			}

			if !same {
				node.Table, err = ct.WithColumnDefaults(allDefaults)
				if err != nil {
					return nil, transform.SameTree, err
				}
				return node, transform.NewTree, err
			}

			return node, transform.SameTree, err
		default:
			return node, transform.SameTree, nil
		}
	})
}

// lookupColumnForTargetSchema looks at the target schema for the specified SchemaTarget node and returns
// the column based on the specified index. For most node types, this is simply indexing into the target
// schema but a few types require special handling.
func lookupColumnForTargetSchema(_ *sql.Context, node sql.SchemaTarget, colIndex int) (*sql.Column, error) {
	schema := node.TargetSchema()

	switch n := node.(type) {
	case *plan.ModifyColumn:
		if colIndex < len(schema) {
			return schema[colIndex], nil
		} else {
			return n.NewColumn(), nil
		}
	case *plan.AddColumn:
		if colIndex < len(schema) {
			return schema[colIndex], nil
		} else {
			return n.Column(), nil
		}
	case *plan.AlterDefaultSet:
		index := schema.IndexOfColName(n.ColumnName)
		if index == -1 {
			return nil, sql.ErrTableColumnNotFound.New(n.Table, n.ColumnName)
		}
		return schema[index], nil
	default:
		if colIndex < len(schema) {
			return schema[colIndex], nil
		} else {
			// TODO: sql.ErrColumnNotFound would be a better error here, but we need to add all the different node types to
			//  the switch to get it
			return nil, expression.ErrIndexOutOfBounds.New(colIndex, len(schema))
		}
	}
}

// validateColumnDefault validates that the column default expression is valid for the column type and returns an error
// if not
func validateColumnDefault(ctx *sql.Context, col *sql.Column, colDefault *sql.ColumnDefaultValue) error {
	if colDefault == nil {
		return nil
	}

	var err error
	sql.Inspect(colDefault.Expr, func(e sql.Expression) bool {
		switch e.(type) {
		case *expression.UserVar, *expression.SystemVar:
			err = sql.ErrColumnDefaultUserVariable.New(col.Name)
			return false
		case sql.FunctionExpression, *expression.UnresolvedFunction:
			var funcName string
			switch expr := e.(type) {
			case sql.FunctionExpression:
				funcName = expr.FunctionName()
				// TODO: We don't currently support user created functions, but when we do, we need to prevent them
				//       from being used in column default value expressions, since only built-in functions are allowed.
			case *expression.UnresolvedFunction:
				funcName = expr.Name()
			}

			// now and current_timestamps are the only functions that don't have to be enclosed in
			// parens when used as a column default value, but ONLY when they are used with a
			// datetime or timestamp column, otherwise it's invalid.
			if (funcName == "now" || funcName == "current_timestamp") && !colDefault.IsParenthesized() && (!types.IsTimestampType(col.Type) && !types.IsDatetimeType(col.Type)) {
				err = sql.ErrColumnDefaultDatetimeOnlyFunc.New()
				return false
			}
			return true
		case *plan.Subquery:
			err = sql.ErrColumnDefaultSubquery.New(col.Name)
			return false
		case *expression.GetField:
			if !colDefault.IsParenthesized() {
				err = sql.ErrInvalidColumnDefaultValue.New(col.Name)
				return false
			}
			return true
		default:
			return true
		}
	})

	if err != nil {
		return err
	}

	// validate type of default expression
	if err = colDefault.CheckType(ctx); err != nil {
		return err
	}

	if enumType, isEnum := col.Type.(sql.EnumType); isEnum && colDefault.IsLiteral() {
		if err = validateEnumLiteralDefault(enumType, colDefault, col.Name, ctx); err != nil {
			return err
		}
	}

	return nil
}

// validateEnumLiteralDefault validates enum literal defaults more strictly than runtime conversions
// MySQL doesn't allow numeric index references for literal enum defaults
func validateEnumLiteralDefault(enumType sql.EnumType, colDefault *sql.ColumnDefaultValue, columnName string, ctx *sql.Context) error {
	val, err := colDefault.Expr.Eval(ctx, nil)
	if err != nil {
		return err
	}

	switch v := val.(type) {
	case nil:
		// NULL is a valid default for enum columns
		return nil
	case string:
		// For string values, check if it's a direct enum value match
		enumValues := enumType.Values()
		for _, enumVal := range enumValues {
			if enumVal == v {
				return nil // Valid enum value
			}
		}
		// String doesn't match any enum value, return appropriate error
		if v == "" {
			return sql.ErrIncompatibleDefaultType.New()
		}
		return sql.ErrInvalidColumnDefaultValue.New(columnName)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		// MySQL doesn't allow numeric enum indices as literal defaults
		return sql.ErrInvalidColumnDefaultValue.New(columnName)
	default:
		// Other types not supported for enum defaults
		return sql.ErrIncompatibleDefaultType.New()
	}
}

func stripTableNamesFromDefault(e *expression.Wrapper) (sql.Expression, transform.TreeIdentity, error) {
	newDefault, ok := e.Unwrap().(*sql.ColumnDefaultValue)
	if !ok {
		return e, transform.SameTree, nil
	}

	if newDefault == nil {
		return e, transform.SameTree, nil
	}

	newExpr, same, err := transform.Expr(newDefault.Expr, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if expr, ok := e.(*expression.GetField); ok {
			return expr.WithTable(""), transform.NewTree, nil
		}
		return e, transform.SameTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}

	if same {
		return e, transform.SameTree, nil
	}

	nd := *newDefault
	nd.Expr = newExpr
	return expression.WrapExpression(&nd), transform.NewTree, nil
}

func quoteDefaultColumnValueNames(ctx *sql.Context, a *Analyzer, n sql.Node, _ *plan.Scope, _ RuleSelector, qFlags *sql.QueryFlags) (sql.Node, transform.TreeIdentity, error) {
	span, ctx := ctx.Span("quoteDefaultColumnValueNames")
	defer span.End()

	return transform.Node(n, func(n sql.Node) (sql.Node, transform.TreeIdentity, error) {
		switch node := n.(type) {
		case *plan.AlterDefaultSet:
			eWrapper := expression.WrapExpression(node.Default)
			newExpr, same, err := quoteIdentifiers(a.SchemaFormatter, eWrapper)
			if err != nil {
				return node, transform.SameTree, err
			}
			if same {
				return node, transform.SameTree, nil
			}

			newNode, err := node.WithDefault(newExpr)
			if err != nil {
				return node, transform.SameTree, err
			}
			return newNode, transform.NewTree, nil
		case sql.SchemaTarget:
			return transform.NodeExprs(n, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				eWrapper, ok := e.(*expression.Wrapper)
				if !ok {
					return e, transform.SameTree, nil
				}

				return quoteIdentifiers(a.SchemaFormatter, eWrapper)
			})
		case *plan.ResolvedTable:
			ct, ok := node.Table.(*information_schema.ColumnsTable)
			if !ok {
				return node, transform.SameTree, nil
			}

			allColumns, err := ct.AllColumns(ctx)
			if err != nil {
				return nil, transform.SameTree, err
			}

			allDefaults, same, err := transform.Exprs(transform.WrappedColumnDefaults(allColumns), func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
				eWrapper, ok := e.(*expression.Wrapper)
				if !ok {
					return e, transform.SameTree, nil
				}

				return quoteIdentifiers(a.SchemaFormatter, eWrapper)
			})

			if err != nil {
				return nil, transform.SameTree, err
			}

			if !same {
				node.Table, err = ct.WithColumnDefaults(allDefaults)
				if err != nil {
					return nil, transform.SameTree, err
				}
				return node, transform.NewTree, err
			}

			return node, transform.SameTree, err
		default:
			return node, transform.SameTree, nil
		}
	})
}

func quoteIdentifiers(schemaFormatter sql.SchemaFormatter, wrap *expression.Wrapper) (sql.Expression, transform.TreeIdentity, error) {
	newDefault, ok := wrap.Unwrap().(*sql.ColumnDefaultValue)
	if !ok {
		return wrap, transform.SameTree, nil
	}

	if newDefault == nil {
		return wrap, transform.SameTree, nil
	}

	newExpr, same, err := transform.Expr(newDefault.Expr, func(expr sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if e, isGf := expr.(*expression.GetField); isGf {
			return e.WithQuotedNames(schemaFormatter, true), transform.NewTree, nil
		}
		return expr, transform.SameTree, nil
	})
	if err != nil {
		return nil, transform.SameTree, err
	}
	if same {
		return wrap, transform.SameTree, nil
	}

	nd := *newDefault
	nd.Expr = newExpr
	return expression.WrapExpression(&nd), transform.NewTree, nil
}

// normalizeDefault ensures that default values that are literals are normalized literals of the appropriate type.
// This is necessary for the default value to be serialized correctly.
func normalizeDefault(ctx *sql.Context, colDefault *sql.ColumnDefaultValue) (sql.Expression, transform.TreeIdentity, error) {
	if colDefault == nil {
		return colDefault, transform.SameTree, nil
	}
	if !colDefault.IsLiteral() {
		return colDefault, transform.SameTree, nil
	}
	if types.IsNull(colDefault.Expr) {
		return colDefault, transform.SameTree, nil
	}
	typ := colDefault.Type()
	if skipDefaultNormalizationForType(typ) {
		return colDefault, transform.SameTree, nil
	}
	val, err := colDefault.Eval(ctx, nil)
	if err != nil {
		return colDefault, transform.SameTree, nil
	}

	newDefault, err := colDefault.WithChildren(expression.NewLiteral(val, typ))
	if err != nil {
		return nil, transform.SameTree, err
	}
	return newDefault, transform.NewTree, nil
}

// skipDefaultNormalizationForType returns true if the default value for the given type should not be normalized for
// serialization before being passed to the integrator for table creation
func skipDefaultNormalizationForType(typ sql.Type) bool {
	// Extended types handle their own serialization concerns
	if _, ok := typ.(sql.ExtendedType); ok {
		return true
	}
	return types.IsTime(typ) || types.IsTimespan(typ) || types.IsEnum(typ) || types.IsSet(typ) || types.IsJSON(typ)
}
