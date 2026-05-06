// Copyright 2025 Dolthub, Inc.
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

package sql

// NodeOverriding is a Node that makes use of functionality that may be overridden.
type NodeOverriding interface {
	Node
	WithOverrides(overrides EngineOverrides) Node
}

// ExpressionOverriding is a Node that makes use of functionality that may be overridden.
type ExpressionOverriding interface {
	Expression
	WithOverrides(overrides EngineOverrides) Expression
}

// EngineOverrides contains functions and variables that can replace, supplement, or override functionality within the
// various engine phases (such as the analysis, node execution, etc.). The empty struct is valid, which will not
// override any functionality (uses the default MySQL functionality for all applicable situations).
type EngineOverrides struct {
	// Builder contains functions and variables that can replace, supplement, or override functionality within the builder.
	Builder BuilderOverrides
	// SchemaFormatter is the formatter for schema string creation. If nil, this will format in MySQL's style.
	SchemaFormatter SchemaFormatter
	// Hooks contain various hooks that are called within a statement's lifecycle.
	Hooks ExecutionHooks
	// CostedIndexScanExpressionFilter is used to walk expression trees in order to apply index scans based on
	// filter expressions. Some expressions may need to be modified or skipped in order to properly apply indexes
	// for all integrators.
	CostedIndexScanExpressionFilter ExpressionTreeFilter
}

// ExpressionTreeFilter is an interface for walking logic expression trees or AND, OR, and leaf nodes.
type ExpressionTreeFilter interface {
	// Next returns the next expression to process, skipping any irrelevant nodes.
	Next(e Expression) Expression
}

// BuilderOverrides contains functions and variables that can replace, supplement, or override functionality within the
// builder.
type BuilderOverrides struct {
	// When this is non-nil, then this allows for table names to be used in the same context as column names. When a
	// table name creates a match, then this function is called to create an expression. The return value of the created
	// expression will be used in place of the `GetField` expression used for columns. The input `fields` contains the
	// `GetField` expressions for all of the table's columns. For standard MySQL compatibility, this should be nil.
	ParseTableAsColumn func(ctx *Context, tableName string, fields []Expression) (Expression, error)
	// Represents the parser to use. If this is nil, then the MySQL parser will be used.
	Parser Parser
}

// ExecutionHooks contain various hooks that are called within a statement's lifecycle. Each inner struct represents a
// specific statement.
type ExecutionHooks struct {
	CreateTable       CreateTable       // CreateTable contains hooks related to CREATE TABLE statements.
	RenameTable       RenameTable       // RenameTable contains hooks related to RENAME TABLE statements.
	DropTable         DropTable         // DropTable contains hooks related to DROP TABLE statements.
	TableAddColumn    TableAddColumn    // TableAddColumn contains hooks related to ALTER TABLE ... ADD COLUMN statements.
	TableRenameColumn TableRenameColumn // TableRenameColumn contains hooks related to ALTER TABLE ... RENAME COLUMN statements.
	TableModifyColumn TableModifyColumn // TableModifyColumn contains hooks related to ALTER TABLE ... MODIFY COLUMN statements.
	TableDropColumn   TableDropColumn   // TableDropColumn contains hooks related to ALTER TABLE ... DROP COLUMN statements.
}

// CreateTable contains hooks related to CREATE TABLE statements. These will take a *plan.CreateTable.
type CreateTable struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// RenameTable contains hooks related to RENAME TABLE statements. These will take a *plan.RenameTable.
type RenameTable struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// DropTable contains hooks related to DROP TABLE statements. These will take a *plan.DropTable.
type DropTable struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// TableAddColumn contains hooks related to ALTER TABLE ... ADD COLUMN statements. These will take a *plan.AddColumn.
type TableAddColumn struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// TableRenameColumn contains hooks related to ALTER TABLE ... RENAME COLUMN statements. These will take a *plan.RenameColumn.
type TableRenameColumn struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// TableModifyColumn contains hooks related to ALTER TABLE ... MODIFY COLUMN statements. These will take a
// *plan.ModifyColumn.
type TableModifyColumn struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}

// TableDropColumn contains hooks related to ALTER TABLE ... DROP COLUMN statements. These will take a *plan.DropColumn.
type TableDropColumn struct {
	// PreSQLExecution is called before the final step of statement execution, after analysis.
	PreSQLExecution func(*Context, StatementRunner, Node) (Node, error)
	// PostSQLExecution is called after the final step of statement execution, after analysis.
	PostSQLExecution func(*Context, StatementRunner, Node) error
}
