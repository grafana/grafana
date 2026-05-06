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

package rowexec

import (
	"runtime/trace"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

// BaseBuilder converts a plan tree into a RowIter tree. All relational nodes
// have a build statement. Custom source nodes that provide rows that implement
// sql.ExecSourceRel are also built into the tree.
type BaseBuilder struct {
	PriorityBuilder sql.NodeExecBuilder
	EngineOverrides sql.EngineOverrides
	Runner          sql.StatementRunner
	schemaFormatter sql.SchemaFormatter
}

var _ sql.NodeExecBuilder = (*BaseBuilder)(nil)

// NewBuilder creates a new builder. If a priority builder is given, then it is tried first, and only uses the internal
// builder logic if the given one does not return a result (and does not error).
func NewBuilder(priority sql.NodeExecBuilder, overrides sql.EngineOverrides) *BaseBuilder {
	return &BaseBuilder{
		PriorityBuilder: priority,
		EngineOverrides: overrides,
		Runner:          nil, // This is often set later (directly on the variable), as it's not yet available during creation
		schemaFormatter: sql.GetSchemaFormatter(overrides),
	}
}

// Build implements the interface sql.NodeExecBuilder.
func (b *BaseBuilder) Build(ctx *sql.Context, n sql.Node, r sql.Row) (sql.RowIter, error) {
	defer trace.StartRegion(ctx, "ExecBuilder.Build").End()
	return b.buildNodeExec(ctx, n, r)
}

// FinalizeIters applies the final transformations on sql.RowIter before execution.
func FinalizeIters(ctx *sql.Context, analyzed sql.Node, qFlags *sql.QueryFlags, iter sql.RowIter) (sql.RowIter, sql.Schema, error) {
	var sch sql.Schema
	var err error
	iter, sch = AddAccumulatorIter(ctx, iter)
	iter = AddTriggerRollbackIter(ctx, qFlags, iter)
	iter, err = AddTransactionCommittingIter(ctx, qFlags, iter)
	if err != nil {
		return nil, nil, err
	}
	iter = plan.AddTrackedRowIter(ctx, analyzed, iter)
	iter = AddExpressionCloser(analyzed, iter)
	return iter, sch, nil
}
