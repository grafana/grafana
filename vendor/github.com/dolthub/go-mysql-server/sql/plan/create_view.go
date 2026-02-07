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

package plan

import (
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/mysql_db"
	"github.com/dolthub/go-mysql-server/sql/transform"
	"github.com/dolthub/go-mysql-server/sql/types"

	"github.com/dolthub/go-mysql-server/sql"
)

// CreateView is a node representing the creation (or replacement) of a view,
// which is defined by the Child node. The Columns member represent the
// explicit columns specified by the query, if any.
type CreateView struct {
	UnaryNode
	database         sql.Database
	Definition       *SubqueryAlias
	Name             string
	CreateViewString string
	Algorithm        string
	Definer          string
	Security         string
	CheckOpt         string
	targetSchema     sql.Schema
	IfNotExists      bool
	IsReplace        bool
}

var _ sql.Node = (*CreateView)(nil)
var _ sql.CollationCoercible = (*CreateView)(nil)
var _ sql.SchemaTarget = (*CreateView)(nil)

// NewCreateView creates a CreateView node with the specified parameters,
// setting its catalog to nil.
func NewCreateView(database sql.Database, name string, definition *SubqueryAlias, ifNotExists, isReplace bool, createViewStr, algorithm, definer, security string) *CreateView {
	return &CreateView{
		UnaryNode:        UnaryNode{Child: definition},
		database:         database,
		Name:             name,
		IfNotExists:      ifNotExists,
		IsReplace:        isReplace,
		Definition:       definition,
		CreateViewString: createViewStr,
		Algorithm:        algorithm,
		Definer:          definer,
		Security:         security,
	}
}

// View returns the view that will be created by this node.
func (cv *CreateView) View() *sql.View {
	return cv.Definition.AsView(cv.CreateViewString)
}

// Children implements the Node interface. It returns the Child of the
// CreateView node; i.e., the definition of the view that will be created.
func (cv *CreateView) Children() []sql.Node {
	return []sql.Node{cv.Child}
}

// Resolved implements the Node interface. This node is resolved if and only if
// the database and the Child are both resolved.
func (cv *CreateView) Resolved() bool {
	_, ok := cv.database.(sql.UnresolvedDatabase)
	return !ok && cv.Child.Resolved()
}

func (cv *CreateView) IsReadOnly() bool {
	return false
}

// Schema implements the Node interface. It always returns Query OK result.
func (cv *CreateView) Schema() sql.Schema {
	return types.OkResultSchema
}

// String implements the fmt.Stringer interface, using sql.TreePrinter to
// generate the string.
func (cv *CreateView) String() string {
	pr := sql.NewTreePrinter()
	_ = pr.WriteNode("CreateView(%s)", cv.Name)
	return pr.String()
}

// WithChildren implements the Node interface. It only succeeds if the length
// of the specified children equals 1.
func (cv *CreateView) WithChildren(children ...sql.Node) (sql.Node, error) {
	if len(children) != 1 {
		return nil, sql.ErrInvalidChildrenNumber.New(cv, len(children), 1)
	}

	newCreate := *cv
	newCreate.Child = children[0]
	return &newCreate, nil
}

// CollationCoercibility implements the interface sql.CollationCoercible.
func (*CreateView) CollationCoercibility(ctx *sql.Context) (collation sql.CollationID, coercibility byte) {
	return sql.Collation_binary, 7
}

// Database implements the Databaser interface, and it returns the database in
// which CreateView will create the view.
func (cv *CreateView) Database() sql.Database {
	return cv.database
}

// WithDatabase implements the Databaser interface, and it returns a copy of this
// node with the specified database.
func (cv *CreateView) WithDatabase(database sql.Database) (sql.Node, error) {
	if privilegedDatabase, ok := database.(mysql_db.PrivilegedDatabase); ok {
		database = privilegedDatabase.Unwrap()
	}
	newCreate := *cv
	newCreate.database = database
	return &newCreate, nil
}

// WithTargetSchema implements the SchemaTarget interface.
func (cv *CreateView) WithTargetSchema(sch sql.Schema) (sql.Node, error) {
	ncv := *cv
	ncv.targetSchema = sch
	return &ncv, nil
}

// TargetSchema implements the SchemaTarget interface.
func (cv *CreateView) TargetSchema() sql.Schema {
	return cv.targetSchema
}

// GetIsUpdatableFromCreateView returns whether the view is updatable or not.
// https://dev.mysql.com/doc/refman/8.0/en/view-updatability.html
func GetIsUpdatableFromCreateView(cv *CreateView) bool {
	isUpdatable := true
	node := cv.Child

	if cv.Algorithm == "TEMPTABLE" {
		return false
	}

	transform.InspectExpressionsWithNode(node, func(n sql.Node, e sql.Expression) bool {
		switch e.(type) {
		case sql.Aggregation, sql.WindowAggregation, *Subquery:
			isUpdatable = false
			return false
		}

		switch nn := n.(type) {
		case *Distinct, *GroupBy, *Having, *SetOp:
			isUpdatable = false
			return false
		case *Project:
			// Refers only to literal values (in this case, there is no underlying table to update)
			allLiteral := true
			transform.InspectExpressions(nn, func(ne sql.Expression) bool {
				switch ne.(type) {
				case *expression.Literal:

				default:
					allLiteral = false
					return false
				}
				return true
			})

			if allLiteral {
				isUpdatable = false
			}

			return false
		}

		// TODO: these are missing checks for isUpdatable = false in these conditions.
		//  we do not differentiate 'view' from 'table' in FROM clause
		// If the view is a join view, all components of the view must be updatable
		// Reference to nonupdatable view in the FROM clause
		// Multiple references to any column of a base table

		return true
	})

	return isUpdatable
}
