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
	"fmt"
	"strings"
	"sync"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/binlogreplication"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

var BinderFactory = &sync.Pool{New: func() interface{} {
	return &Builder{f: &factory{}}
}}

type Builder struct {
	// EventScheduler is used to communicate with the event scheduler
	// for any EVENT related statements. It can be nil if EventScheduler is not defined.
	scheduler       sql.EventScheduler
	cat             sql.Catalog
	authQueryState  sql.AuthorizationQueryState
	parser          sql.Parser
	currentDatabase sql.Database

	f          *factory
	viewCtx    *ViewContext
	procCtx    *ProcContext
	triggerCtx *TriggerContext
	bindCtx    *BindvarContext
	ctx        *sql.Context
	qFlags     *sql.QueryFlags

	nesting int

	tabId sql.TableId
	colId columnId

	authEnabled  bool
	multiDDL     bool
	insertActive bool
	parserOpts   ast.ParserOptions
}

// BindvarContext holds bind variable replacement literals.
type BindvarContext struct {
	Bindings map[string]sql.Expression
	used     map[string]struct{}
	// resolveOnly indicates that we are resolving plan names,
	// but will not error for missing bindvar replacements.
	resolveOnly bool
}

func (bv *BindvarContext) GetSubstitute(s string) (sql.Expression, bool) {
	if bv.Bindings != nil {
		ret, ok := bv.Bindings[s]
		bv.used[s] = struct{}{}
		return ret, ok
	}
	return nil, false
}

func (bv *BindvarContext) UnusedBindings() []string {
	if len(bv.used) == len(bv.Bindings) {
		return nil
	}
	var unused []string
	for k, _ := range bv.Bindings {
		if _, ok := bv.used[k]; !ok {
			unused = append(unused, k)
		}
	}
	return unused
}

// ViewContext overwrites database root source of nested
// calls.
type ViewContext struct {
	AsOf   interface{}
	DbName string
}

type TriggerContext struct {
	ResolveErr       error
	UnresolvedTables []string
	Active           bool
	Call             bool
}

// ProcContext allows nested CALLs to use the same database for resolving
// procedure definitions without changing the underlying database roots.
type ProcContext struct {
	AsOf   interface{}
	DbName string
}

// New takes ctx, catalog, event scheduler, and parser. If the parser is nil, then default parser is mysql parser.
func New(ctx *sql.Context, cat sql.Catalog, es sql.EventScheduler, p sql.Parser) *Builder {
	if p == nil {
		p = sql.GlobalParser
	}

	var state sql.AuthorizationQueryState
	if cat != nil {
		state = cat.AuthorizationHandler().NewQueryState(ctx)
	}
	return &Builder{
		ctx:            ctx,
		cat:            cat,
		scheduler:      es,
		parserOpts:     sql.LoadSqlMode(ctx).ParserOptions(),
		f:              &factory{},
		parser:         p,
		qFlags:         &sql.QueryFlags{},
		authEnabled:    true,
		authQueryState: state,
	}
}

func (b *Builder) SetDebug(val bool) {
	b.f.debug = val
}

func (b *Builder) SetBindings(bindings map[string]ast.Expr) {
	bindingExprs := make(map[string]sql.Expression)
	for i, bv := range bindings {
		bindingExprs[i] = b.buildScalar(&scope{}, bv)
	}
	b.bindCtx = &BindvarContext{
		Bindings: bindingExprs,
		used:     make(map[string]struct{}),
	}
}

func (b *Builder) SetBindingsWithExpr(bindings map[string]sql.Expression) {
	b.bindCtx = &BindvarContext{
		Bindings: bindings,
		used:     make(map[string]struct{}),
	}
}

func (b *Builder) SetParserOptions(opts ast.ParserOptions) {
	b.parserOpts = opts
}

func (b *Builder) BindCtx() *BindvarContext {
	return b.bindCtx
}

func (b *Builder) ViewCtx() *ViewContext {
	if b.viewCtx == nil {
		b.viewCtx = &ViewContext{}
	}
	return b.viewCtx
}

func (b *Builder) ProcCtx() *ProcContext {
	if b.procCtx == nil {
		b.procCtx = &ProcContext{}
	}
	return b.procCtx
}

func (b *Builder) TriggerCtx() *TriggerContext {
	if b.triggerCtx == nil {
		b.triggerCtx = &TriggerContext{}
	}
	return b.triggerCtx
}

func (b *Builder) newScope() *scope {
	return &scope{b: b}
}

func (b *Builder) Reset() {
	b.colId = 0
	b.tabId = 0
	b.bindCtx = nil
	b.currentDatabase = nil
	b.procCtx = nil
	b.multiDDL = false
	b.insertActive = false
	b.triggerCtx = nil
	b.viewCtx = nil
	b.nesting = 0
	b.qFlags = &sql.QueryFlags{}
	b.authQueryState = b.cat.AuthorizationHandler().NewQueryState(b.ctx)
}

type parseErr struct {
	err error
}

func (p parseErr) Error() string {
	return p.err.Error()
}

func (b *Builder) handleErr(err error) {
	panic(parseErr{err})
}

func (b *Builder) build(inScope *scope, stmt ast.Statement, query string) (outScope *scope) {
	return b.buildSubquery(inScope, stmt, query, query)
}

func (b *Builder) buildSubquery(inScope *scope, stmt ast.Statement, subQuery string, fullQuery string) (outScope *scope) {
	if inScope == nil {
		inScope = b.newScope()
	}
	switch n := stmt.(type) {
	default:
		b.handleErr(sql.ErrUnsupportedSyntax.New(ast.String(n)))
	case ast.SelectStatement:
		outScope = b.buildSelectStmt(inScope, n)
		if into := n.GetInto(); into != nil {
			b.buildInto(outScope, into)
		}
		return outScope
	case *ast.Analyze:
		return b.buildAnalyze(inScope, n, subQuery)
	case *ast.CreateSpatialRefSys:
		return b.buildCreateSpatialRefSys(inScope, n)
	case *ast.Show:
		return b.buildShow(inScope, n)
	case *ast.DDL:
		return b.buildDDL(inScope, subQuery, fullQuery, n)
	case *ast.AlterTable:
		b.qFlags.Set(sql.QFlagAlterTable)
		return b.buildAlterTable(inScope, subQuery, n)
	case *ast.DBDDL:
		b.qFlags.Set(sql.QFlagDBDDL)
		return b.buildDBDDL(inScope, n)
	case *ast.Explain:
		return b.buildExplain(inScope, n)
	case *ast.Insert:
		if n.With != nil {
			cteScope := b.buildWith(inScope, n.With)
			return b.buildInsert(cteScope, n)
		}
		return b.buildInsert(inScope, n)
	case *ast.Delete:
		if n.With != nil {
			cteScope := b.buildWith(inScope, n.With)
			return b.buildDelete(cteScope, n)
		}
		return b.buildDelete(inScope, n)
	case *ast.Update:
		if n.With != nil {
			cteScope := b.buildWith(inScope, n.With)
			return b.buildUpdate(cteScope, n)
		}
		return b.buildUpdate(inScope, n)
	case *ast.Load:
		return b.buildLoad(inScope, n)
	case *ast.Set:
		return b.buildSet(inScope, n)
	case *ast.Use:
		return b.buildUse(inScope, n)
	case *ast.Begin:
		outScope = inScope.push()
		transChar := sql.ReadWrite
		if n.TransactionCharacteristic == ast.TxReadOnly {
			transChar = sql.ReadOnly
		}

		outScope.node = plan.NewStartTransaction(transChar)
	case *ast.Commit:
		outScope = inScope.push()
		outScope.node = plan.NewCommit()
	case *ast.Rollback:
		outScope = inScope.push()
		outScope.node = plan.NewRollback()
	case *ast.Savepoint:
		outScope = inScope.push()
		outScope.node = plan.NewCreateSavepoint(n.Identifier)
	case *ast.RollbackSavepoint:
		outScope = inScope.push()
		outScope.node = plan.NewRollbackSavepoint(n.Identifier)
	case *ast.ReleaseSavepoint:
		outScope = inScope.push()
		outScope.node = plan.NewReleaseSavepoint(n.Identifier)
	case *ast.ChangeReplicationSource:
		return b.buildChangeReplicationSource(inScope, n)
	case *ast.ChangeReplicationFilter:
		return b.buildChangeReplicationFilter(inScope, n)
	case *ast.StartReplica:
		if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
			b.handleErr(err)
		}
		outScope = inScope.push()
		startRep := plan.NewStartReplica()
		if binCat, ok := b.cat.(binlogreplication.BinlogReplicaCatalog); ok && binCat.HasBinlogReplicaController() {
			startRep.ReplicaController = binCat.GetBinlogReplicaController()
		}
		outScope.node = startRep
	case *ast.StopReplica:
		if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
			b.handleErr(err)
		}
		outScope = inScope.push()
		stopRep := plan.NewStopReplica()
		if binCat, ok := b.cat.(binlogreplication.BinlogReplicaCatalog); ok && binCat.HasBinlogReplicaController() {
			stopRep.ReplicaController = binCat.GetBinlogReplicaController()
		}
		outScope.node = stopRep
	case *ast.ResetReplica:
		if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
			b.handleErr(err)
		}
		outScope = inScope.push()
		resetRep := plan.NewResetReplica(n.All)
		if binCat, ok := b.cat.(binlogreplication.BinlogReplicaCatalog); ok && binCat.HasBinlogReplicaController() {
			resetRep.ReplicaController = binCat.GetBinlogReplicaController()
		}
		outScope.node = resetRep
	case *ast.BeginEndBlock:
		return b.buildBeginEndBlock(inScope, n, fullQuery)
	case *ast.IfStatement:
		return b.buildIfBlock(inScope, n, fullQuery)
	case *ast.CaseStatement:
		return b.buildCaseStatement(inScope, n, fullQuery)
	case *ast.Call:
		return b.buildCall(inScope, n)
	case *ast.Declare:
		return b.buildDeclare(inScope, n, subQuery)
	case *ast.FetchCursor:
		return b.buildFetchCursor(inScope, n)
	case *ast.OpenCursor:
		return b.buildOpenCursor(inScope, n)
	case *ast.CloseCursor:
		return b.buildCloseCursor(inScope, n)
	case *ast.Loop:
		return b.buildLoop(inScope, n, fullQuery)
	case *ast.Repeat:
		return b.buildRepeat(inScope, n, fullQuery)
	case *ast.While:
		return b.buildWhile(inScope, n, fullQuery)
	case *ast.Leave:
		return b.buildLeave(inScope, n)
	case *ast.Iterate:
		return b.buildIterate(inScope, n)
	case *ast.Kill:
		return b.buildKill(inScope, n)
	case *ast.Signal:
		return b.buildSignal(inScope, n)
	case *ast.LockTables:
		return b.buildLockTables(inScope, n)
	case *ast.UnlockTables:
		return b.buildUnlockTables(inScope, n)
	case *ast.CreateUser:
		return b.buildCreateUser(inScope, n)
	case *ast.RenameUser:
		return b.buildRenameUser(inScope, n)
	case *ast.DropUser:
		return b.buildDropUser(inScope, n)
	case *ast.CreateRole:
		return b.buildCreateRole(inScope, n)
	case *ast.DropRole:
		return b.buildDropRole(inScope, n)
	case *ast.GrantPrivilege:
		return b.buildGrantPrivilege(inScope, n)
	case *ast.GrantRole:
		return b.buildGrantRole(inScope, n)
	case *ast.GrantProxy:
		return b.buildGrantProxy(inScope, n)
	case *ast.RevokePrivilege:
		return b.buildRevokePrivilege(inScope, n)
	case *ast.RevokeRole:
		return b.buildRevokeRole(inScope, n)
	case *ast.RevokeProxy:
		return b.buildRevokeProxy(inScope, n)
	case *ast.ShowGrants:
		return b.buildShowGrants(inScope, n)
	case *ast.ShowPrivileges:
		return b.buildShowPrivileges(inScope, n)
	case *ast.Flush:
		return b.buildFlush(inScope, n)
	case *ast.Prepare:
		return b.buildPrepare(inScope, n)
	case *ast.Execute:
		return b.buildExecute(inScope, n)
	case *ast.Deallocate:
		return b.buildDeallocate(inScope, n)
	case ast.InjectedStatement:
		return b.buildInjectedStatement(inScope, n)
	}
	return
}

// buildVirtualTableScan returns a VirtualColumnTable for a table with virtual columns.
func (b *Builder) buildVirtualTableScan(db string, tab sql.Table) *plan.VirtualColumnTable {
	tableScope := b.newScope()
	schema := tab.Schema()
	for _, c := range schema {
		tableScope.newColumn(scopeColumn{
			table:       strings.ToLower(tab.Name()),
			db:          strings.ToLower(db),
			col:         strings.ToLower(c.Name),
			originalCol: c.Name,
			typ:         c.Type,
			nullable:    c.Nullable,
		})
	}

	tableId := tableScope.tables[strings.ToLower(tab.Name())]
	projections := make([]sql.Expression, len(schema))
	for i, c := range schema {
		if !c.Virtual {
			projections[i] = expression.NewGetFieldWithTable(i+1, int(tableId), c.Type, db, tab.Name(), c.Name, c.Nullable)
		} else {
			projections[i] = b.resolveColumnDefaultExpression(tableScope, c, c.Generated)
		}
	}

	// Unlike other kinds of nodes, the projection on this table wrapper is invisible to the analyzer, so we need to
	// get the column indexes correct here, they won't be fixed later like other kinds of expressions.
	for i, p := range projections {
		projections[i] = assignColumnIndexes(p, schema)
	}

	return plan.NewVirtualColumnTable(tab, projections)
}

// buildInjectedStatement returns the sql.Node encapsulated by the injected statement.
func (b *Builder) buildInjectedStatement(inScope *scope, n ast.InjectedStatement) (outScope *scope) {
	if err := b.cat.AuthorizationHandler().HandleAuth(b.ctx, b.authQueryState, n.Auth); err != nil && b.authEnabled {
		b.handleErr(err)
	}
	resolvedChildren := make([]any, len(n.Children))
	for i, child := range n.Children {
		resolvedChildren[i] = b.buildScalar(inScope, child)
	}
	stmt, err := n.Statement.WithResolvedChildren(resolvedChildren)
	if err != nil {
		b.handleErr(err)
		return nil
	}
	if sqlNode, ok := stmt.(sql.ExecSourceRel); ok {
		outScope = inScope.push()
		outScope.node = sqlNode
		return outScope
	}
	b.handleErr(fmt.Errorf("Injected statement does not resolve to a valid node"))
	return nil
}

// assignColumnIndexes fixes the column indexes in the expression to match the schema given
func assignColumnIndexes(e sql.Expression, schema sql.Schema) sql.Expression {
	e, _, _ = transform.Expr(e, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		if gf, ok := e.(*expression.GetField); ok {
			idx := schema.IndexOfColName(gf.Name())
			return gf.WithIndex(idx), transform.NewTree, nil
		}
		return e, transform.SameTree, nil
	})
	return e
}

// Below methods are used in Doltgres. TODO: maybe find way to not expose these methods

func (b *Builder) BuildScalarWithTable(expr ast.Expr, tableExpr ast.TableExpr) sql.Expression {
	outscope := b.newScope()
	if tableExpr != nil {
		outscope = b.buildDataSource(outscope, tableExpr)
	}
	return b.buildScalar(outscope, expr)
}

func (b *Builder) BuildColumnDefaultValueWithTable(defExpr ast.Expr, tableExpr ast.TableExpr, typ sql.Type, nullable bool) *sql.ColumnDefaultValue {
	outscope := b.newScope()
	if tableExpr != nil {
		outscope = b.buildDataSource(outscope, tableExpr)
	}
	return b.convertDefaultExpression(outscope, defExpr, typ, nullable)
}

// DisableAuth disables all authorization checks.
func (b *Builder) DisableAuth() {
	b.authEnabled = false
}

// EnableAuth enables all authorization checks. Auth is enabled by default, so this only needs to be called when it was
// previously disabled using DisableAuth.
func (b *Builder) EnableAuth() {
	b.authEnabled = true
}
