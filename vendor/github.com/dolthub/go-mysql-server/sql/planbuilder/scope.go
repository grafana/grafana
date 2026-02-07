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
	"strings"

	ast "github.com/dolthub/vitess/go/vt/sqlparser"

	"github.com/dolthub/go-mysql-server/sql"
	"github.com/dolthub/go-mysql-server/sql/expression"
	"github.com/dolthub/go-mysql-server/sql/plan"
	"github.com/dolthub/go-mysql-server/sql/transform"
)

// scope tracks relational dependencies necessary to type check expressions,
// resolve name definitions, and build relational nodes.
type scope struct {
	node   sql.Node
	colset sql.ColSet
	ast    ast.SQLNode

	// exprs collects unique expression ids for reference
	exprs map[string]columnId

	// tables are the list of table definitions in this scope
	tables              map[string]sql.TableId
	windowDefs          map[string]*sql.WindowDefinition
	selectAliases       map[string]sql.Expression
	insertColumnAliases map[string]string

	// redirectCol is used for using and natural joins right-table
	// attributes that redirect to the left table intersection
	redirectCol map[string]scopeColumn

	// ctes are common table expressions defined in this scope
	// TODO: these should be case-sensitive
	ctes map[string]*scope

	b              *Builder
	proc           *procCtx
	parent         *scope
	activeSubquery *subquery

	// groupBy collects aggregation functions and inputs
	groupBy *groupBy

	insertTableAlias string

	// cols are definitions provided by this scope
	cols []scopeColumn
	// extraCols are auxillary output columns required for sorting or grouping
	extraCols []scopeColumn
	// windowFuncs is a list of window functions in the current scope
	windowFuncs []scopeColumn

	refsSubquery bool
}

// resolveColumn matches a variable use to a column definition with a unique
// expression id. |chooseFirst| is indicated for accepting ambiguous having and
// group by columns.
func (s *scope) resolveColumn(db, table, col string, checkParent, chooseFirst bool) (scopeColumn, bool) {
	// procedure params take precedence
	if table == "" && checkParent && s.procActive() {
		col, ok := s.proc.GetVar(col)
		if ok {
			return col, true
		}
	}

	// Unqualified columns that have been redirected should return early to avoid ambiguous column errors.
	if table == "" && s.redirectCol != nil {
		if rCol, ok := s.redirectCol[col]; ok {
			return rCol, true
		}
	}

	var found scopeColumn
	var foundCand bool
	for _, c := range s.cols {
		if strings.EqualFold(c.col, col) && (strings.EqualFold(c.table, table) || table == "") && (strings.EqualFold(c.db, db) || db == "") {
			if foundCand {
				if found.equals(c) {
					continue
				}

				if !s.b.TriggerCtx().Call && len(s.b.TriggerCtx().UnresolvedTables) > 0 {
					c, ok := s.triggerCol(table, col)
					if ok {
						return c, true
					}
				}
				if c.table == OnDupValuesPrefix {
					return found, true
				} else if found.table == OnDupValuesPrefix {
					return c, true
				}
				err := sql.ErrAmbiguousColumnName.New(col, []string{c.table, found.table})
				if c.table == "" {
					err = sql.ErrAmbiguousColumnOrAliasName.New(c.col)
				}
				s.handleErr(err)
			}
			if chooseFirst || s.groupBy != nil {
				return c, true
			}
			found = c
			foundCand = true
		}
	}
	if foundCand {
		return found, true
	}

	if s.groupBy != nil {
		if c, ok := s.groupBy.outScope.resolveColumn(db, table, col, false, false); ok {
			return c, true
		}
	}

	if !s.b.TriggerCtx().Call && len(s.b.TriggerCtx().UnresolvedTables) > 0 {
		c, ok := s.triggerCol(table, col)
		if ok {
			return c, true
		}
	}

	if !checkParent || s.parent == nil {
		return scopeColumn{}, false
	}

	c, foundCand := s.parent.resolveColumn(db, table, col, true, false)
	if !foundCand {
		return scopeColumn{}, false
	}

	if s.parent.activeSubquery != nil {
		s.parent.activeSubquery.addOutOfScope(c.id)
	}
	return c, true
}

// getCol gets a scopeColumn based on a columnId
func (s *scope) getCol(colId sql.ColumnId) (scopeColumn, bool) {
	if s.colset.Contains(colId) {
		for _, c := range s.cols {
			if sql.ColumnId(c.id) == colId {
				return c, true
			}
		}
	}
	return scopeColumn{}, false
}

func (s *scope) hasTable(table string) bool {
	_, ok := s.tables[strings.ToLower(table)]
	if ok {
		return true
	}
	if s.parent != nil {
		return s.parent.hasTable(table)
	}
	return false
}

// triggerCol is used to hallucinate a new column during trigger DDL
// when we fail a resolveColumn.
func (s *scope) triggerCol(table, col string) (scopeColumn, bool) {
	// hallucinate tablecol
	dbName := ""
	if s.b.currentDatabase != nil {
		dbName = s.b.currentDatabase.Name()
	}
	for _, t := range s.b.TriggerCtx().UnresolvedTables {
		if strings.EqualFold(t, table) {
			col := scopeColumn{db: dbName, table: table, col: col}
			id := s.newColumn(col)
			col.id = id
			return col, true
		}
	}
	if table == "" {
		col := scopeColumn{db: dbName, table: table, col: col}
		id := s.newColumn(col)
		col.id = id
		return col, true
	}
	return scopeColumn{}, false
}

// getExpr returns a columnId if the given expression has
// been built.
func (s *scope) getExpr(name string, checkCte bool) (columnId, bool) {
	n := strings.ToLower(name)
	id, ok := s.exprs[n]
	if !ok && s.groupBy != nil {
		id, ok = s.groupBy.outScope.getExpr(n, checkCte)
	}
	if !ok && checkCte && s.ctes != nil {
		for _, cte := range s.ctes {
			id, ok = cte.getExpr(n, false)
			if ok {
				break
			}
		}
	}
	// TODO: possibly want to look in parent scopes
	if !ok && s.parent != nil {
		return s.parent.getExpr(name, checkCte)
	}
	return id, ok
}

func (s *scope) procActive() bool {
	return s.proc != nil
}

func (s *scope) initProc() {
	s.proc = &procCtx{
		s:          s,
		conditions: make(map[string]*plan.DeclareCondition),
		cursors:    make(map[string]struct{}),
		vars:       make(map[string]scopeColumn),
		labels:     make(map[string]bool),
		lastState:  dsVariable,
	}
}

// initGroupBy creates a container scope for aggregation
// functions and function inputs.
func (s *scope) initGroupBy() {
	if s.groupBy == nil {
		s.groupBy = &groupBy{outScope: s.replace()}
	}
}

// pushSubquery creates a new scope with the subquery already initialized.
func (s *scope) pushSubquery() *scope {
	newScope := s.push()
	newScope.activeSubquery = &subquery{parent: s.nearestSubquery()}
	return newScope
}

// replaceSubquery creates a new scope with the subquery already initialized.
func (s *scope) replaceSubquery() *scope {
	newScope := s.replace()
	newScope.activeSubquery = &subquery{parent: s.nearestSubquery()}
	return newScope
}

// initSubquery creates a container for tracking out of scope
// column references and volatile functions.
func (s *scope) initSubquery() {
	s.activeSubquery = &subquery{}
}

func (s *scope) correlated() sql.ColSet {
	if s.activeSubquery == nil {
		return sql.ColSet{}
	}
	return s.activeSubquery.correlated
}

func (s *scope) volatile() bool {
	if s.activeSubquery == nil {
		return false
	}
	return s.activeSubquery.volatile
}

func (s *scope) nearestSubquery() *subquery {
	n := s
	for n != nil {
		if n.activeSubquery != nil {
			return n.activeSubquery
		}
		n = n.parent
	}
	return nil
}

// setTableAlias updates column definitions in this scope to
// appear sourced from a new table name.
func (s *scope) setTableAlias(t string) {
	t = strings.ToLower(t)
	var oldTable string
	for i := range s.cols {
		beforeColStr := s.cols[i].String()
		if oldTable == "" {
			oldTable = s.cols[i].table
		}
		s.cols[i].table = t
		id, ok := s.getExpr(beforeColStr, true)
		if ok {
			// todo better way to do projections
			delete(s.exprs, beforeColStr)
		}
		s.exprs[strings.ToLower(s.cols[i].String())] = id
	}
	id, ok := s.tables[oldTable]
	if !ok {
		return
	}
	delete(s.tables, oldTable)
	if s.tables == nil {
		s.tables = make(map[string]sql.TableId)
	}
	s.tables[t] = id
}

// setColAlias updates the column name definitions for this scope
// to the names in the input list.
func (s *scope) setColAlias(cols []string) {
	if len(cols) != len(s.cols) {
		err := sql.ErrColumnCountMismatch.New()
		s.b.handleErr(err)
	}
	ids := make([]columnId, len(cols))
	for i := range s.cols {
		beforeColStr := s.cols[i].String()
		id, ok := s.getExpr(beforeColStr, true)
		if ok {
			// todo better way to do projections
			delete(s.exprs, beforeColStr)
		}
		ids[i] = id
		delete(s.exprs, beforeColStr)
	}
	for i := range s.cols {
		name := strings.ToLower(cols[i])
		s.cols[i].col = name
		s.exprs[s.cols[i].String()] = ids[i]
	}
}

// push creates a new scope referencing the current scope as a
// parent. Variables in the new scope will have name visibility
// into this scope.
func (s *scope) push() *scope {
	new := &scope{
		b:      s.b,
		parent: s,
	}
	if s.procActive() {
		new.initProc()
	}
	return new
}

// replace creates a new scope with the same parent definition
// visibility as the current scope. Useful for groupby and subqueries
// that have more complex naming hierarchy.
func (s *scope) replace() *scope {
	if s == nil {
		return &scope{}
	}
	return &scope{
		b:      s.b,
		parent: s.parent,
	}
}

// aliasCte copies a scope, but increments the column and table ids
// for the new relation.
func (s *scope) aliasCte(alias string) *scope {
	if s == nil {
		return nil
	}
	outScope := s.copy()

	sq, _ := outScope.node.(*plan.SubqueryAlias)

	name := strings.ToLower(outScope.node.(sql.NameableNode).Name())

	var tabId sql.TableId
	if alias != "" {
		tabId = outScope.addTable(alias)
	} else {
		alias = name
		tabId = s.tables[strings.ToLower(name)]
	}

	outScope.cols = nil
	var colSet sql.ColSet
	scopeMapping := make(map[sql.ColumnId]sql.Expression)
	for _, c := range s.cols {
		id := outScope.newColumn(scopeColumn{
			tableId:     tabId,
			db:          c.db,
			table:       alias,
			col:         c.col,
			originalCol: c.originalCol,
			id:          0,
			typ:         c.typ,
			nullable:    c.nullable,
		})
		colSet.Add(sql.ColumnId(id))
		// todo double scope mapping
		if sq != nil {
			scopeMapping[sql.ColumnId(id)] = sq.ScopeMapping[sql.ColumnId(c.id)]
		}
	}

	if sq != nil {
		outScope.node = sq.WithScopeMapping(scopeMapping).WithColumns(colSet).WithId(tabId)
	}
	return outScope
}

// copy produces an identical scope with copied references.
func (s *scope) copy() *scope {
	if s == nil {
		return nil
	}

	ret := *s
	if ret.node != nil {
		ret.node, _ = DeepCopyNode(s.node)
	}
	if s.tables != nil {
		ret.tables = make(map[string]sql.TableId, len(s.tables))
		for k, v := range s.tables {
			ret.tables[k] = v
		}
	}
	if s.ctes != nil {
		ret.ctes = make(map[string]*scope, len(s.ctes))
		for k, v := range s.ctes {
			ret.ctes[k] = v
		}
	}
	if s.exprs != nil {
		ret.exprs = make(map[string]columnId, len(s.exprs))
		for k, v := range s.exprs {
			ret.exprs[k] = v
		}
	}
	if s.groupBy != nil {
		gbCopy := *s.groupBy
		ret.groupBy = &gbCopy
	}
	if s.cols != nil {
		ret.cols = make([]scopeColumn, len(s.cols))
		copy(ret.cols, s.cols)
	}
	if !s.colset.Empty() {
		ret.colset = s.colset.Copy()
	}
	if s.selectAliases != nil {
		ret.selectAliases = make(map[string]sql.Expression, len(s.selectAliases))
		for k, v := range s.selectAliases {
			ret.selectAliases[k] = v
		}
	}

	return &ret
}

// DeepCopyNode copies a sql.Node.
func DeepCopyNode(node sql.Node) (sql.Node, error) {
	n, _, err := transform.NodeExprs(node, func(e sql.Expression) (sql.Expression, transform.TreeIdentity, error) {
		e, err := transform.Clone(e)
		return e, transform.NewTree, err
	})
	return n, err
}

// addCte adds a cte definition to this scope for table resolution.
func (s *scope) addCte(name string, cteScope *scope) {
	if s.ctes == nil {
		s.ctes = make(map[string]*scope)
	}
	s.ctes[name] = cteScope
	s.addTable(name)
}

// getCte attempts to resolve a table name as a cte definition.
func (s *scope) getCte(name string) *scope {
	checkScope := s
	for checkScope != nil {
		if checkScope.ctes != nil {
			cte, ok := checkScope.ctes[strings.ToLower(name)]
			if ok {
				cte.tables[name] += 1
				return cte
			}
		}
		checkScope = checkScope.parent
	}
	return nil
}

// redirect overwrites a definition with an alias rewrite,
// without preventing us from resolving the original column.
// This is used for resolving natural join projections.
func (s *scope) redirect(from, to scopeColumn) {
	if s.redirectCol == nil {
		s.redirectCol = make(map[string]scopeColumn)
	}
	s.redirectCol[from.String()] = to
}

// addColumn interns and saves the given column to this scope.
// todo: new IR should absorb interning and use bitmaps for
// column identity
func (s *scope) addColumn(col scopeColumn) {
	s.cols = append(s.cols, col)
	s.colset.Add(sql.ColumnId(col.id))
	if s.exprs == nil {
		s.exprs = make(map[string]columnId)
	}
	s.exprs[strings.ToLower(col.String())] = col.id
	return
}

// newColumn adds the column to the current scope and assigns a
// new columnId for referencing. newColumn builds a new expression
// reference, whereas addColumn only adds a preexisting expression
// definition to a given scope.
func (s *scope) newColumn(col scopeColumn) columnId {
	s.b.colId++
	col.id = s.b.colId
	if col.table != "" {
		tabId := s.addTable(col.table)
		col.tableId = tabId
	}
	s.addColumn(col)
	return col.id
}

// addTable records adds a table name defined in this scope
func (s *scope) addTable(name string) sql.TableId {
	if name == "" {
		return 0
	}
	name = strings.ToLower(name)
	if s.tables == nil {
		s.tables = make(map[string]sql.TableId)
	}
	if _, ok := s.tables[name]; !ok {
		s.b.tabId++
		s.tables[name] = s.b.tabId
	}
	return s.tables[name]
}

// addExtraColumn marks an auxiliary column used in an
// aggregation, sorting, or having clause.
func (s *scope) addExtraColumn(col scopeColumn) {
	s.extraCols = append(s.extraCols, col)
}

func (s *scope) addColumns(cols []scopeColumn) {
	s.cols = append(s.cols, cols...)
}

func (s *scope) addExpressions(newExprs map[string]columnId) {
	if s.exprs == nil {
		s.exprs = make(map[string]columnId)
	}
	for k, v := range newExprs {
		s.exprs[k] = v
	}
}

// appendColumnsFromScope merges column definitions for
// multi-relational expressions.
func (s *scope) appendColumnsFromScope(src *scope) {
	s.cols = append(s.cols, src.cols...)
	if len(src.exprs) > 0 && s.exprs == nil {
		s.exprs = make(map[string]columnId)
	}
	for k, v := range src.exprs {
		s.exprs[k] = v
	}
	if len(src.redirectCol) > 0 && s.redirectCol == nil {
		s.redirectCol = make(map[string]scopeColumn)
	}
	for k, v := range src.redirectCol {
		s.redirectCol[k] = v
	}
	if len(src.tables) > 0 && s.tables == nil {
		s.tables = make(map[string]sql.TableId)
	}
	for k, v := range src.tables {
		s.tables[k] = v
	}
	// these become pass-through columns in the new scope.
	for i := len(src.cols); i < len(s.cols); i++ {
		s.cols[i].scalar = nil
	}
}

func (s *scope) handleErr(err error) {
	panic(parseErr{err})
}

// tableId and columnId are temporary ways to track expression
// and name uniqueness.
// todo: the plan format should track these
type tableId uint16
type columnId uint16

type scopeColumn struct {
	typ         sql.Type
	scalar      sql.Expression
	db          string
	table       string
	col         string
	originalCol string
	id          columnId
	tableId     sql.TableId
	nullable    bool
	descending  bool
	outOfScope  bool
}

// empty returns true if a scopeColumn is the null value
func (c scopeColumn) empty() bool {
	return c.id == 0
}

func (c scopeColumn) equals(other scopeColumn) bool {
	if c.id == other.id {
		return true
	}
	if c.unwrapGetFieldAliasId() == other.unwrapGetFieldAliasId() {
		return true
	}
	return false
}

func (c scopeColumn) unwrapGetFieldAliasId() columnId {
	if c.scalar != nil {
		if a, ok := c.scalar.(*expression.Alias); ok {
			if gf, ok := a.Child.(*expression.GetField); ok {
				return columnId(gf.Id())
			}
		}
	}
	return c.id
}

func (c scopeColumn) withOriginal(origTbl, col string) scopeColumn {
	// info schema columns always presented as uppercase, except for processlist
	// can't reference information_schema.ProcessListTableName because of import cycles
	if !strings.EqualFold(c.db, sql.InformationSchemaDatabaseName) ||
		(strings.EqualFold(c.db, sql.InformationSchemaDatabaseName) && strings.EqualFold(c.table, "processlist")) ||
		(strings.EqualFold(c.db, sql.InformationSchemaDatabaseName) && strings.EqualFold(origTbl, "processlist")) {
		c.originalCol = col
	}
	return c
}

// scalarGf returns a getField reference to this column's expression.
func (c scopeColumn) scalarGf() sql.Expression {
	if c.scalar != nil {
		switch e := c.scalar.(type) {
		case *expression.ProcedureParam:
			return e
		}
	}
	if c.originalCol != "" {
		return expression.NewGetFieldWithTable(int(c.id), int(c.tableId), c.typ, c.db, c.table, c.originalCol, c.nullable)
	}
	return expression.NewGetFieldWithTable(int(c.id), int(c.tableId), c.typ, c.db, c.table, c.col, c.nullable)
}

func (c scopeColumn) String() string {
	if c.table == "" {
		return c.col
	} else {
		return c.table + "." + c.col
	}
}
