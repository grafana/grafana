// Copyright 2024 Dolthub, Inc.
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

// Most QFlags indicate the presence of a specific AST node.
// Flags with more complex meanings have more specific comments.
const (
	QFlagNull int = iota

	QFlagShowWarnings
	QFlagInsert
	QFlagUpdate
	QFlagDelete
	QFlagScalarSubquery
	QFlagRelSubquery
	QFlgNotExpr
	QFlagCount
	QFlagCountStar
	QFlagDDL
	QFlagDBDDL
	QFlagAlterTable
	QFlagCrossJoin
	QFlagSort
	QFlagFilter
	QFlagAggregation
	QFlagSetDatabase
	QFlagStar
	QFlagInnerJoin
	QFlagLimit
	QFlagInterval
	QFlagAnyAgg

	// QFlagMax1Row indicates that a query can only return at most one row
	QFlagMax1Row

	// QFlagDeferProjections indicates that a top-level projections for this query should be deferred and handled by
	// RowToSQL
	QFlagDeferProjections
	// QFlagUndeferrableExprs indicates that the query has expressions that cannot be deferred
	QFlagUndeferrableExprs
	QFlagTrigger

	QFlagCreateEvent
	QFlagCreateTrigger
	QFlagCreateProcedure
	QFlagAnalyzeProcedure
)

type QueryFlags struct {
	Flags FastIntSet
}

func (qp *QueryFlags) Set(flag int) {
	if qp == nil {
		return
	}
	qp.Flags.Add(flag)
}

func (qp *QueryFlags) Unset(flag int) {
	if qp == nil {
		return
	}
	qp.Flags.Remove(flag)
}

func (qp *QueryFlags) IsSet(flag int) bool {
	if qp == nil {
		return false
	}
	return qp.Flags.Contains(flag)
}

var DmlFlags = NewFastIntSet(QFlagDelete, QFlagUpdate, QFlagInsert)

func (qp *QueryFlags) DmlIsSet() bool {
	if qp == nil {
		return true
	}
	return qp.Flags.Intersects(DmlFlags)
}

var SubqueryFlags = NewFastIntSet(QFlagScalarSubquery, QFlagRelSubquery)

func (qp *QueryFlags) SubqueryIsSet() bool {
	if qp == nil {
		return true
	}
	return qp.Flags.Intersects(SubqueryFlags)
}

var JoinFlags = NewFastIntSet(QFlagInnerJoin, QFlagCrossJoin)

func (qp *QueryFlags) JoinIsSet() bool {
	if qp == nil {
		return true
	}
	return qp.Flags.Intersects(JoinFlags)
}
