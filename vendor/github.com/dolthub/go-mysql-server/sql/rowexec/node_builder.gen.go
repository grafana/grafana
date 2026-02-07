// Copyright 2023 Dolthub, Inc.
//
// GENERATED
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
	"fmt"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/plan"
)

func (b *BaseBuilder) buildNodeExec(ctx *sql.Context, n sql.Node, row sql.Row) (sql.RowIter, error) {
	var iter sql.RowIter
	var err error
	if b.override != nil {
		iter, err = b.override.Build(ctx, n, row)
	}
	if err != nil {
		return nil, err
	}
	if iter == nil {
		iter, err = b.buildNodeExecNoAnalyze(ctx, n, row)
	}
	if err != nil {
		return nil, err
	}
	if withDescribeStats, ok := n.(sql.WithDescribeStats); ok {
		iter = sql.NewCountingRowIter(iter, withDescribeStats)
	}
	return iter, nil
}

func (b *BaseBuilder) buildNodeExecNoAnalyze(ctx *sql.Context, n sql.Node, row sql.Row) (sql.RowIter, error) {
	switch n := n.(type) {
	case *plan.CreateForeignKey:
		return b.buildCreateForeignKey(ctx, n, row)
	case *plan.AlterTableCollation:
		return b.buildAlterTableCollation(ctx, n, row)
	case *plan.AlterTableComment:
		return b.buildAlterTableComment(ctx, n, row)
	case *plan.CreateRole:
		return b.buildCreateRole(ctx, n, row)
	case *plan.Loop:
		return b.buildLoop(ctx, n, row)
	case *plan.DropColumn:
		return b.buildDropColumn(ctx, n, row)
	case *plan.AnalyzeTable:
		return b.buildAnalyzeTable(ctx, n, row)
	case *plan.UpdateHistogram:
		return b.buildUpdateHistogram(ctx, n, row)
	case *plan.DropHistogram:
		return b.buildDropHistogram(ctx, n, row)
	case *plan.ShowBinlogs:
		return b.buildShowBinlogs(ctx, n, row)
	case *plan.ShowBinlogStatus:
		return b.buildShowBinlogStatus(ctx, n, row)
	case *plan.ShowReplicaStatus:
		return b.buildShowReplicaStatus(ctx, n, row)
	case *plan.UpdateSource:
		return b.buildUpdateSource(ctx, n, row)
	case plan.ElseCaseError:
		return b.buildElseCaseError(ctx, n, row)
	case *plan.PrepareQuery:
		return b.buildPrepareQuery(ctx, n, row)
	case *plan.ResolvedTable:
		return b.buildResolvedTable(ctx, n, row)
	case *plan.TableCountLookup:
		return b.buildTableCount(ctx, n, row)
	case *plan.ShowCreateTable:
		return b.buildShowCreateTable(ctx, n, row)
	case *plan.ShowIndexes:
		return b.buildShowIndexes(ctx, n, row)
	case *plan.PrependNode:
		return b.buildPrependNode(ctx, n, row)
	case *plan.UnresolvedTable:
		return b.buildUnresolvedTable(ctx, n, row)
	case *plan.Use:
		return b.buildUse(ctx, n, row)
	case *plan.CreateTable:
		return b.buildCreateTable(ctx, n, row)
	case *plan.CreateProcedure:
		return b.buildCreateProcedure(ctx, n, row)
	case *plan.CreateTrigger:
		return b.buildCreateTrigger(ctx, n, row)
	case *plan.IfConditional:
		return b.buildIfConditional(ctx, n, row)
	case *plan.ShowGrants:
		return b.buildShowGrants(ctx, n, row)
	case *plan.ShowDatabases:
		return b.buildShowDatabases(ctx, n, row)
	case *plan.UpdateJoin:
		return b.buildUpdateJoin(ctx, n, row)
	case *plan.Call:
		return b.buildCall(ctx, n, row)
	case *plan.Close:
		return b.buildClose(ctx, n, row)
	case *plan.Describe:
		return b.buildDescribe(ctx, n, row)
	case *plan.ExecuteQuery:
		return b.buildExecuteQuery(ctx, n, row)
	case *plan.ProcedureResolvedTable:
		return b.buildProcedureResolvedTable(ctx, n, row)
	case *plan.ShowTriggers:
		return b.buildShowTriggers(ctx, n, row)
	case *plan.BeginEndBlock:
		return b.buildBeginEndBlock(ctx, n, row)
	case *plan.AlterDB:
		return b.buildAlterDB(ctx, n, row)
	case *plan.Grant:
		return b.buildGrant(ctx, n, row)
	case *plan.Open:
		return b.buildOpen(ctx, n, row)
	case *plan.ChangeReplicationFilter:
		return b.buildChangeReplicationFilter(ctx, n, row)
	case *plan.StopReplica:
		return b.buildStopReplica(ctx, n, row)
	case *plan.ShowVariables:
		return b.buildShowVariables(ctx, n, row)
	case *plan.Sort:
		return b.buildSort(ctx, n, row)
	case *plan.SubqueryAlias:
		return b.buildSubqueryAlias(ctx, n, row)
	case *plan.SetOp:
		return b.buildSetOp(ctx, n, row)
	case *plan.IndexedTableAccess:
		return b.buildIndexedTableAccess(ctx, n, row)
	case *plan.TableAlias:
		return b.buildTableAlias(ctx, n, row)
	case *plan.AddColumn:
		return b.buildAddColumn(ctx, n, row)
	case *plan.RenameColumn:
		return b.buildRenameColumn(ctx, n, row)
	case *plan.DropDB:
		return b.buildDropDB(ctx, n, row)
	case *plan.Distinct:
		return b.buildDistinct(ctx, n, row)
	case *plan.Having:
		return b.buildHaving(ctx, n, row)
	case *plan.Signal:
		return b.buildSignal(ctx, n, row)
	case *plan.ExternalProcedure:
		return b.buildExternalProcedure(ctx, n, row)
	case *plan.Into:
		return b.buildInto(ctx, n, row)
	case *plan.LockTables:
		return b.buildLockTables(ctx, n, row)
	case *plan.Truncate:
		return b.buildTruncate(ctx, n, row)
	case *plan.DeclareHandler:
		return b.buildDeclareHandler(ctx, n, row)
	case *plan.DropProcedure:
		return b.buildDropProcedure(ctx, n, row)
	case *plan.ChangeReplicationSource:
		return b.buildChangeReplicationSource(ctx, n, row)
	case *plan.Max1Row:
		return b.buildMax1Row(ctx, n, row)
	case *plan.Rollback:
		return b.buildRollback(ctx, n, row)
	case *plan.Limit:
		return b.buildLimit(ctx, n, row)
	case *plan.RecursiveCte:
		return b.buildRecursiveCte(ctx, n, row)
	case *plan.ShowColumns:
		return b.buildShowColumns(ctx, n, row)
	case *plan.ShowTables:
		return b.buildShowTables(ctx, n, row)
	case *plan.ShowCreateDatabase:
		return b.buildShowCreateDatabase(ctx, n, row)
	case *plan.DropIndex:
		return b.buildDropIndex(ctx, n, row)
	case *plan.ResetReplica:
		return b.buildResetReplica(ctx, n, row)
	case *plan.ShowCreateTrigger:
		return b.buildShowCreateTrigger(ctx, n, row)
	case *plan.TableCopier:
		return b.buildTableCopier(ctx, n, row)
	case *plan.DeclareVariables:
		return b.buildDeclareVariables(ctx, n, row)
	case *plan.Filter:
		return b.buildFilter(ctx, n, row)
	case *plan.Kill:
		return b.buildKill(ctx, n, row)
	case *plan.ShowPrivileges:
		return b.buildShowPrivileges(ctx, n, row)
	case *plan.AlterPK:
		return b.buildAlterPK(ctx, n, row)
	case plan.Nothing:
		return b.buildNothing(ctx, n, row)
	case *plan.DeferredAsOfTable:
		return b.buildDeferredAsOfTable(ctx, n, row)
	case *plan.CreateUser:
		return b.buildCreateUser(ctx, n, row)
	case *plan.AlterUser:
		return b.buildAlterUser(ctx, n, row)
	case *plan.DropView:
		return b.buildDropView(ctx, n, row)
	case *plan.GroupBy:
		return b.buildGroupBy(ctx, n, row)
	case *plan.Block:
		return b.buildBlock(ctx, n, row)
	case *plan.InsertDestination:
		return b.buildInsertDestination(ctx, n, row)
	case *plan.Set:
		return b.buildSet(ctx, n, row)
	case *plan.TriggerExecutor:
		return b.buildTriggerExecutor(ctx, n, row)
	case *plan.AlterDefaultDrop:
		return b.buildAlterDefaultDrop(ctx, n, row)
	case *plan.CachedResults:
		return b.buildCachedResults(ctx, n, row)
	case *plan.CreateDB:
		return b.buildCreateDB(ctx, n, row)
	case *plan.CreateSchema:
		return b.buildCreateSchema(ctx, n, row)
	case *plan.Revoke:
		return b.buildRevoke(ctx, n, row)
	case *plan.DeclareCondition:
		return b.buildDeclareCondition(ctx, n, row)
	case *plan.TriggerBeginEndBlock:
		return b.buildTriggerBeginEndBlock(ctx, n, row)
	case *plan.RecursiveTable:
		return b.buildRecursiveTable(ctx, n, row)
	case *plan.AlterIndex:
		return b.buildAlterIndex(ctx, n, row)
	case *plan.TransformedNamedNode:
		return b.buildTransformedNamedNode(ctx, n, row)
	case *plan.CreateIndex:
		return b.buildCreateIndex(ctx, n, row)
	case *plan.Procedure:
		return b.buildProcedure(ctx, n, row)
	case *plan.With:
		return b.buildWith(ctx, n, row)
	case *plan.Project:
		return b.buildProject(ctx, n, row)
	case *plan.ModifyColumn:
		return b.buildModifyColumn(ctx, n, row)
	case *plan.DeclareCursor:
		return b.buildDeclareCursor(ctx, n, row)
	case *plan.OrderedDistinct:
		return b.buildOrderedDistinct(ctx, n, row)
	case *plan.SingleDropView:
		return b.buildSingleDropView(ctx, n, row)
	case *plan.EmptyTable:
		return b.buildEmptyTable(ctx, n, row)
	case *plan.JoinNode:
		return b.buildJoinNode(ctx, n, row)
	case *plan.RenameUser:
		return b.buildRenameUser(ctx, n, row)
	case *plan.ShowCreateProcedure:
		return b.buildShowCreateProcedure(ctx, n, row)
	case *plan.Commit:
		return b.buildCommit(ctx, n, row)
	case *plan.DeferredFilteredTable:
		return b.buildDeferredFilteredTable(ctx, n, row)
	case *plan.Values:
		return b.buildValues(ctx, n, row)
	case *plan.DropRole:
		return b.buildDropRole(ctx, n, row)
	case *plan.Fetch:
		return b.buildFetch(ctx, n, row)
	case *plan.RevokeRole:
		return b.buildRevokeRole(ctx, n, row)
	case *plan.ShowStatus:
		return b.buildShowStatus(ctx, n, row)
	case *plan.ShowTableStatus:
		return b.buildShowTableStatus(ctx, n, row)
	case *plan.ShowCreateEvent:
		return b.buildShowCreateEvent(ctx, n, row)
	case *plan.SignalName:
		return b.buildSignalName(ctx, n, row)
	case *plan.StartTransaction:
		return b.buildStartTransaction(ctx, n, row)
	case *plan.ValueDerivedTable:
		return b.buildValueDerivedTable(ctx, n, row)
	case *plan.CreateView:
		return b.buildCreateView(ctx, n, row)
	case *plan.InsertInto:
		return b.buildInsertInto(ctx, n, row)
	case *plan.TopN:
		return b.buildTopN(ctx, n, row)
	case *plan.Window:
		return b.buildWindow(ctx, n, row)
	case *plan.DropCheck:
		return b.buildDropCheck(ctx, n, row)
	case *plan.DropTrigger:
		return b.buildDropTrigger(ctx, n, row)
	case *plan.DeallocateQuery:
		return b.buildDeallocateQuery(ctx, n, row)
	case *plan.RollbackSavepoint:
		return b.buildRollbackSavepoint(ctx, n, row)
	case *plan.ReleaseSavepoint:
		return b.buildReleaseSavepoint(ctx, n, row)
	case *plan.Update:
		return b.buildUpdate(ctx, n, row)
	case plan.ShowWarnings:
		return b.buildShowWarnings(ctx, n, row)
	case *plan.Releaser:
		return b.buildReleaser(ctx, n, row)
	case *plan.Concat:
		return b.buildConcat(ctx, n, row)
	case *plan.DeleteFrom:
		return b.buildDeleteFrom(ctx, n, row)
	case *plan.DescribeQuery:
		return b.buildDescribeQuery(ctx, n, row)
	case *plan.ForeignKeyHandler:
		return b.buildForeignKeyHandler(ctx, n, row)
	case *plan.LoadData:
		return b.buildLoadData(ctx, n, row)
	case *plan.ShowCharset:
		return b.buildShowCharset(ctx, n, row)
	case *plan.StripRowNode:
		return b.buildStripRowNode(ctx, n, row)
	case *plan.DropConstraint:
		return b.buildDropConstraint(ctx, n, row)
	case *plan.FlushPrivileges:
		return b.buildFlushPrivileges(ctx, n, row)
	case *plan.Leave:
		return b.buildLeave(ctx, n, row)
	case *plan.While:
		return b.buildWhile(ctx, n, row)
	case *plan.ShowProcessList:
		return b.buildShowProcessList(ctx, n, row)
	case *plan.CreateSavepoint:
		return b.buildCreateSavepoint(ctx, n, row)
	case *plan.CreateCheck:
		return b.buildCreateCheck(ctx, n, row)
	case *plan.AlterDefaultSet:
		return b.buildAlterDefaultSet(ctx, n, row)
	case *plan.DropUser:
		return b.buildDropUser(ctx, n, row)
	case *plan.IfElseBlock:
		return b.buildIfElseBlock(ctx, n, row)
	case *plan.NamedWindows:
		return b.buildNamedWindows(ctx, n, row)
	case *plan.Repeat:
		return b.buildRepeat(ctx, n, row)
	case *plan.RevokeProxy:
		return b.buildRevokeProxy(ctx, n, row)
	case *plan.RenameTable:
		return b.buildRenameTable(ctx, n, row)
	case *plan.CaseStatement:
		return b.buildCaseStatement(ctx, n, row)
	case *plan.GrantRole:
		return b.buildGrantRole(ctx, n, row)
	case *plan.GrantProxy:
		return b.buildGrantProxy(ctx, n, row)
	case *plan.Offset:
		return b.buildOffset(ctx, n, row)
	case *plan.StartReplica:
		return b.buildStartReplica(ctx, n, row)
	case *plan.AlterAutoIncrement:
		return b.buildAlterAutoIncrement(ctx, n, row)
	case *plan.DropForeignKey:
		return b.buildDropForeignKey(ctx, n, row)
	case *plan.DropTable:
		return b.buildDropTable(ctx, n, row)
	case *plan.JSONTable:
		return b.buildJSONTable(ctx, n, row)
	case *plan.UnlockTables:
		return b.buildUnlockTables(ctx, n, row)
	case *plan.HashLookup:
		return b.buildHashLookup(ctx, n, row)
	case *plan.Iterate:
		return b.buildIterate(ctx, n, row)
	case sql.ExecSourceRel:
		// escape hatch for custom data sources
		return n.RowIter(ctx, row)
	case *plan.CreateSpatialRefSys:
		return b.buildCreateSpatialRefSys(ctx, n, row)
	case *plan.RenameForeignKey:
		return b.buildRenameForeignKey(ctx, n, row)
	default:
		return nil, fmt.Errorf("exec builder found unknown Node type %T", n)
	}
}
