package query

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/mithrandie/csvq/lib/option"
	"github.com/mithrandie/csvq/lib/parser"
	"github.com/mithrandie/csvq/lib/value"

	"github.com/mithrandie/ternary"
)

const LimitToUseFieldIndexSliceChache = 8

var blockScopePool = sync.Pool{
	New: func() interface{} {
		return NewBlockScope()
	},
}

func GetBlockScope() BlockScope {
	scope := blockScopePool.Get().(BlockScope)
	return scope
}

func PutBlockScope(scope BlockScope) {
	scope.Clear()
	blockScopePool.Put(scope)
}

var nodeScopePool = sync.Pool{
	New: func() interface{} {
		return NewNodeScope()
	},
}

func GetNodeScope() NodeScope {
	scope := nodeScopePool.Get().(NodeScope)
	return scope
}

func PutNodeScope(scope NodeScope) {
	scope.Clear()
	nodeScopePool.Put(scope)
}

type BlockScope struct {
	Variables       VariableMap
	TemporaryTables ViewMap
	Cursors         CursorMap
	Functions       UserDefinedFunctionMap
}

func NewBlockScope() BlockScope {
	return BlockScope{
		Variables:       NewVariableMap(),
		TemporaryTables: NewViewMap(),
		Cursors:         NewCursorMap(),
		Functions:       NewUserDefinedFunctionMap(),
	}
}

func (scope BlockScope) Clear() {
	scope.Variables.Clear()
	scope.TemporaryTables.Clear()
	scope.Cursors.Clear()
	scope.Functions.Clear()
}

type NodeScope struct {
	inlineTables InlineTableMap
	aliases      AliasMap
}

func NewNodeScope() NodeScope {
	return NodeScope{
		inlineTables: make(InlineTableMap),
		aliases:      make(AliasMap),
	}
}

func (scope NodeScope) Clear() {
	scope.inlineTables.Clear()
	scope.aliases.Clear()
}

type ReferenceRecord struct {
	view        *View
	recordIndex int

	cache *FieldIndexCache
}

func NewReferenceRecord(view *View, recordIdx int, cacheLen int) ReferenceRecord {
	return ReferenceRecord{
		view:        view,
		recordIndex: recordIdx,
		cache:       NewFieldIndexCache(cacheLen, LimitToUseFieldIndexSliceChache),
	}
}

func (r *ReferenceRecord) IsInRange() bool {
	return -1 < r.recordIndex && r.recordIndex < r.view.RecordLen()
}

type FieldIndexCache struct {
	limitToUseSlice int
	m               map[parser.QueryExpression]int
	exprs           []parser.QueryExpression
	indices         []int
}

func NewFieldIndexCache(initCap int, limitToUseSlice int) *FieldIndexCache {
	return &FieldIndexCache{
		limitToUseSlice: limitToUseSlice,
		m:               nil,
		exprs:           make([]parser.QueryExpression, 0, initCap),
		indices:         make([]int, 0, initCap),
	}
}

func (c *FieldIndexCache) Get(expr parser.QueryExpression) (int, bool) {
	if c.m != nil {
		idx, ok := c.m[expr]
		return idx, ok
	}

	for i := range c.exprs {
		if expr == c.exprs[i] {
			return c.indices[i], true
		}
	}
	return -1, false
}

func (c *FieldIndexCache) Add(expr parser.QueryExpression, idx int) {
	if c.m == nil && c.limitToUseSlice <= len(c.exprs) {
		c.m = make(map[parser.QueryExpression]int, c.limitToUseSlice*2)
		for i := range c.exprs {
			c.m[c.exprs[i]] = c.indices[i]
		}
		c.exprs = nil
		c.indices = nil
	}

	if c.m == nil {
		c.exprs = append(c.exprs, expr)
		c.indices = append(c.indices, idx)
	} else {
		c.m[expr] = idx
	}
}

type ReferenceScope struct {
	Tx *Transaction

	Blocks []BlockScope
	nodes  []NodeScope

	cachedFilePath map[string]string
	now            time.Time

	Records []ReferenceRecord

	RecursiveTable   *parser.InlineTable
	RecursiveTmpView *View
	RecursiveCount   *int64
}

func NewReferenceScope(tx *Transaction) *ReferenceScope {
	return NewReferenceScopeWithBlock(tx, GetBlockScope())
}

func NewReferenceScopeWithBlock(tx *Transaction, scope BlockScope) *ReferenceScope {
	return &ReferenceScope{
		Tx:     tx,
		Blocks: []BlockScope{scope},
		nodes:  nil,
	}
}

func (rs *ReferenceScope) CreateScopeForRecordEvaluation(view *View, recordIndex int) *ReferenceScope {
	records := make([]ReferenceRecord, len(rs.Records)+1)
	records[0] = NewReferenceRecord(view, recordIndex, view.FieldLen())
	for i := range rs.Records {
		records[i+1] = rs.Records[i]
	}
	return rs.createScope(records)
}

func (rs *ReferenceScope) CreateScopeForSequentialEvaluation(view *View) *ReferenceScope {
	return rs.CreateScopeForRecordEvaluation(view, -1)
}

func (rs *ReferenceScope) CreateScopeForAnalytics() *ReferenceScope {
	records := make([]ReferenceRecord, len(rs.Records))
	records[0] = NewReferenceRecord(rs.Records[0].view, -1, rs.Records[0].view.FieldLen())
	for i := 1; i < len(rs.Records); i++ {
		records[i] = rs.Records[i]
	}
	return rs.createScope(records)
}

func (rs *ReferenceScope) createScope(referenceRecords []ReferenceRecord) *ReferenceScope {
	return &ReferenceScope{
		Tx:               rs.Tx,
		Blocks:           rs.Blocks,
		nodes:            rs.nodes,
		cachedFilePath:   rs.cachedFilePath,
		now:              rs.now,
		Records:          referenceRecords,
		RecursiveTable:   rs.RecursiveTable,
		RecursiveTmpView: rs.RecursiveTmpView,
		RecursiveCount:   rs.RecursiveCount,
	}
}

func (rs *ReferenceScope) CreateChild() *ReferenceScope {
	blocks := make([]BlockScope, len(rs.Blocks)+1)
	blocks[0] = GetBlockScope()
	for i := range rs.Blocks {
		blocks[i+1] = rs.Blocks[i]
	}

	return &ReferenceScope{
		Tx:               rs.Tx,
		Blocks:           blocks,
		nodes:            nil,
		cachedFilePath:   rs.cachedFilePath,
		now:              rs.now,
		RecursiveTable:   rs.RecursiveTable,
		RecursiveTmpView: rs.RecursiveTmpView,
		RecursiveCount:   rs.RecursiveCount,
	}
}

func (rs *ReferenceScope) CreateNode() *ReferenceScope {
	nodes := make([]NodeScope, len(rs.nodes)+1)
	nodes[0] = GetNodeScope()
	for i := range rs.nodes {
		nodes[i+1] = rs.nodes[i]
	}

	node := &ReferenceScope{
		Tx:               rs.Tx,
		Blocks:           rs.Blocks,
		nodes:            nodes,
		cachedFilePath:   rs.cachedFilePath,
		now:              rs.now,
		Records:          rs.Records,
		RecursiveTable:   rs.RecursiveTable,
		RecursiveTmpView: rs.RecursiveTmpView,
		RecursiveCount:   rs.RecursiveCount,
	}

	if node.cachedFilePath == nil {
		node.cachedFilePath = make(map[string]string)
	}
	if node.now.IsZero() {
		node.now = option.Now(rs.Tx.Flags.GetTimeLocation())
	}

	return node
}

func (rs *ReferenceScope) Global() BlockScope {
	return rs.Blocks[len(rs.Blocks)-1]
}

func (rs *ReferenceScope) CurrentBlock() BlockScope {
	return rs.Blocks[0]
}

func (rs *ReferenceScope) ClearCurrentBlock() {
	rs.CurrentBlock().Clear()
}

func (rs *ReferenceScope) CloseCurrentBlock() {
	PutBlockScope(rs.CurrentBlock())
}

func (rs *ReferenceScope) CloseCurrentNode() {
	PutNodeScope(rs.nodes[0])
}

func (rs *ReferenceScope) NextRecord() bool {
	rs.Records[0].recordIndex++

	if rs.Records[0].view.Len() <= rs.Records[0].recordIndex {
		return false
	}
	return true
}

func (rs *ReferenceScope) FilePathExists(identifier string) bool {
	if rs.cachedFilePath == nil {
		return false
	}
	_, ok := rs.cachedFilePath[identifier]
	return ok
}

func (rs *ReferenceScope) StoreFilePath(identifier string, fpath string) {
	if rs.cachedFilePath != nil {
		rs.cachedFilePath[identifier] = fpath
	}
}

func (rs *ReferenceScope) LoadFilePath(identifier string) (string, bool) {
	if rs.cachedFilePath != nil {
		if p, ok := rs.cachedFilePath[identifier]; ok {
			return p, true
		}
	}
	return "", false
}

func (rs *ReferenceScope) Now() time.Time {
	if rs.now.IsZero() {
		return option.Now(rs.Tx.Flags.GetTimeLocation())
	}
	return rs.now
}

func (rs *ReferenceScope) DeclareVariable(ctx context.Context, expr parser.VariableDeclaration) error {
	return rs.Blocks[0].Variables.Declare(ctx, rs, expr)
}

func (rs *ReferenceScope) DeclareVariableDirectly(variable parser.Variable, val value.Primary) error {
	return rs.Blocks[0].Variables.Add(variable, val)
}

func (rs *ReferenceScope) GetVariable(expr parser.Variable) (val value.Primary, err error) {
	for i := range rs.Blocks {
		if v, ok := rs.Blocks[i].Variables.Get(expr); ok {
			return v, nil
		}
	}
	return nil, NewUndeclaredVariableError(expr)
}

func (rs *ReferenceScope) SubstituteVariable(ctx context.Context, expr parser.VariableSubstitution) (val value.Primary, err error) {
	val, err = Evaluate(ctx, rs, expr.Value)
	if err != nil {
		return
	}

	for i := range rs.Blocks {
		if rs.Blocks[i].Variables.Set(expr.Variable, val) {
			return
		}
	}
	err = NewUndeclaredVariableError(expr.Variable)
	return
}

func (rs *ReferenceScope) SubstituteVariableDirectly(variable parser.Variable, val value.Primary) (value.Primary, error) {
	for i := range rs.Blocks {
		if rs.Blocks[i].Variables.Set(variable, val) {
			return val, nil
		}
	}
	return nil, NewUndeclaredVariableError(variable)
}

func (rs *ReferenceScope) DisposeVariable(expr parser.Variable) error {
	for i := range rs.Blocks {
		if rs.Blocks[i].Variables.Dispose(expr) {
			return nil
		}
	}
	return NewUndeclaredVariableError(expr)
}

func (rs *ReferenceScope) AllVariables() VariableMap {
	all := NewVariableMap()
	for i := range rs.Blocks {
		rs.Blocks[i].Variables.Range(func(key, val interface{}) bool {
			if !all.Exists(key.(string)) {
				all.Store(key.(string), val.(value.Primary))
			}
			return true
		})
	}
	return all
}

func (rs *ReferenceScope) TemporaryTableExists(identifier string) bool {
	identifier = strings.ToUpper(identifier)
	for i := range rs.Blocks {
		if rs.Blocks[i].TemporaryTables.Exists(identifier) {
			return true
		}
	}
	return false
}

func (rs *ReferenceScope) GetTemporaryTable(identifier parser.Identifier) (*View, error) {
	fileIdentifier := strings.ToUpper(identifier.Literal)
	for i := range rs.Blocks {
		if view, err := rs.Blocks[i].TemporaryTables.Get(fileIdentifier); err == nil {
			return view, nil
		}
	}
	return nil, NewUndeclaredTemporaryTableError(identifier)
}

func (rs *ReferenceScope) GetTemporaryTableWithInternalId(ctx context.Context, identifier parser.Identifier, flags *option.Flags) (view *View, err error) {
	fileIdentifier := strings.ToUpper(identifier.Literal)
	for i := range rs.Blocks {
		if view, err = rs.Blocks[i].TemporaryTables.GetWithInternalId(ctx, fileIdentifier, flags); err == nil {
			return
		} else if err != errTableNotLoaded {
			return nil, err
		}
	}
	return nil, NewUndeclaredTemporaryTableError(identifier)
}

func (rs *ReferenceScope) SetTemporaryTable(view *View) {
	rs.Blocks[0].TemporaryTables.Set(view)
}

func (rs *ReferenceScope) ReplaceTemporaryTable(view *View) {
	for i := range rs.Blocks {
		if rs.Blocks[i].TemporaryTables.Exists(view.FileInfo.IdentifiedPath()) {
			rs.Blocks[i].TemporaryTables.Set(view)
			return
		}
	}
}

func (rs *ReferenceScope) DisposeTemporaryTable(name parser.QueryExpression) error {
	for i := range rs.Blocks {
		if rs.Blocks[i].TemporaryTables.DisposeTemporaryTable(name) {
			return nil
		}
	}
	return NewUndeclaredTemporaryTableError(name)
}

func (rs *ReferenceScope) StoreTemporaryTable(session *Session, uncomittedViews map[string]*FileInfo) []string {
	msglist := make([]string, 0, len(uncomittedViews))
	for i := range rs.Blocks {
		rs.Blocks[i].TemporaryTables.Range(func(key, value interface{}) bool {
			if _, ok := uncomittedViews[key.(string)]; ok {
				view := value.(*View)

				if view.FileInfo.IsStdin() {
					session.updateStdinView(view.Copy())
					msglist = append(msglist, fmt.Sprintf("Commit: restore point of view %q is created.", view.FileInfo.Path))
				} else if view.FileInfo.IsTemporaryTable() {
					view.CreateRestorePoint()
					msglist = append(msglist, fmt.Sprintf("Commit: restore point of view %q is created.", view.FileInfo.Path))
				}
			}
			return true
		})
	}
	return msglist
}

func (rs *ReferenceScope) RestoreTemporaryTable(uncomittedViews map[string]*FileInfo) []string {
	msglist := make([]string, 0, len(uncomittedViews))
	for i := range rs.Blocks {
		rs.Blocks[i].TemporaryTables.Range(func(key, value interface{}) bool {
			if _, ok := uncomittedViews[key.(string)]; ok {
				view := value.(*View)

				if view.FileInfo.IsStdin() {
					rs.Blocks[i].TemporaryTables.Delete(view.FileInfo.IdentifiedPath())
					msglist = append(msglist, fmt.Sprintf("Rollback: view %q is restored.", view.FileInfo.Path))
				} else if view.FileInfo.IsTemporaryTable() {
					view.Restore()
					msglist = append(msglist, fmt.Sprintf("Rollback: view %q is restored.", view.FileInfo.Path))
				}
			}
			return true
		})
	}
	return msglist
}

func (rs *ReferenceScope) AllTemporaryTables() ViewMap {
	all := NewViewMap()

	for i := range rs.Blocks {
		rs.Blocks[i].TemporaryTables.Range(func(key, value interface{}) bool {
			if value.(*View).FileInfo.IsInMemoryTable() {
				k := key.(string)
				if !all.Exists(k) {
					all.Store(k, value.(*View))
				}
			}
			return true
		})
	}
	return all
}

func (rs *ReferenceScope) DeclareCursor(expr parser.CursorDeclaration) error {
	return rs.Blocks[0].Cursors.Declare(expr)
}

func (rs *ReferenceScope) AddPseudoCursor(name parser.Identifier, values []value.Primary) error {
	return rs.Blocks[0].Cursors.AddPseudoCursor(name, values)
}

func (rs *ReferenceScope) DisposeCursor(name parser.Identifier) error {
	for i := range rs.Blocks {
		err := rs.Blocks[i].Cursors.Dispose(name)
		if err == nil {
			return nil
		}
		if err == errPseudoCursor {
			return NewPseudoCursorError(name)
		}
	}
	return NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) OpenCursor(ctx context.Context, name parser.Identifier, values []parser.ReplaceValue) error {
	var err error
	for i := range rs.Blocks {
		err = rs.Blocks[i].Cursors.Open(ctx, rs, name, values)
		if err == nil {
			return nil
		}
		if err != errUndeclaredCursor {
			return err
		}
	}
	return NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) CloseCursor(name parser.Identifier) error {
	for i := range rs.Blocks {
		err := rs.Blocks[i].Cursors.Close(name)
		if err == nil {
			return nil
		}
		if err != errUndeclaredCursor {
			return err
		}
	}
	return NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) FetchCursor(name parser.Identifier, position int, number int) ([]value.Primary, error) {
	var values []value.Primary
	var err error

	for i := range rs.Blocks {
		values, err = rs.Blocks[i].Cursors.Fetch(name, position, number)
		if err == nil {
			return values, nil
		}
		if err != errUndeclaredCursor {
			return nil, err
		}
	}
	return nil, NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) CursorIsOpen(name parser.Identifier) (ternary.Value, error) {
	for i := range rs.Blocks {
		if ok, err := rs.Blocks[i].Cursors.IsOpen(name); err == nil {
			return ok, nil
		}
	}
	return ternary.FALSE, NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) CursorIsInRange(name parser.Identifier) (ternary.Value, error) {
	var result ternary.Value
	var err error

	for i := range rs.Blocks {
		result, err = rs.Blocks[i].Cursors.IsInRange(name)
		if err == nil {
			return result, nil
		}
		if err != errUndeclaredCursor {
			return result, err
		}
	}
	return ternary.FALSE, NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) CursorCount(name parser.Identifier) (int, error) {
	var count int
	var err error

	for i := range rs.Blocks {
		count, err = rs.Blocks[i].Cursors.Count(name)
		if err == nil {
			return count, nil
		}
		if err != errUndeclaredCursor {
			return 0, err
		}
	}
	return 0, NewUndeclaredCursorError(name)
}

func (rs *ReferenceScope) AllCursors() CursorMap {
	all := NewCursorMap()
	for i := range rs.Blocks {
		rs.Blocks[i].Cursors.Range(func(key, val interface{}) bool {
			cur := val.(*Cursor)
			if !cur.isPseudo {
				if !all.Exists(key.(string)) {
					all.Store(key.(string), cur)
				}
			}
			return true
		})
	}
	return all
}

func (rs *ReferenceScope) DeclareFunction(expr parser.FunctionDeclaration) error {
	return rs.Blocks[0].Functions.Declare(expr)
}

func (rs *ReferenceScope) DeclareAggregateFunction(expr parser.AggregateDeclaration) error {
	return rs.Blocks[0].Functions.DeclareAggregate(expr)
}

func (rs *ReferenceScope) GetFunction(expr parser.QueryExpression, name string) (*UserDefinedFunction, error) {
	for i := range rs.Blocks {
		if fn, ok := rs.Blocks[i].Functions.Get(name); ok {
			return fn, nil
		}
	}
	return nil, NewFunctionNotExistError(expr, name)
}

func (rs *ReferenceScope) DisposeFunction(name parser.Identifier) error {
	for i := range rs.Blocks {
		if rs.Blocks[i].Functions.Dispose(name) {
			return nil
		}
	}
	return NewFunctionNotExistError(name, name.Literal)
}

func (rs *ReferenceScope) AllFunctions() (UserDefinedFunctionMap, UserDefinedFunctionMap) {
	scalarAll := NewUserDefinedFunctionMap()
	aggregateAll := NewUserDefinedFunctionMap()

	for i := range rs.Blocks {
		rs.Blocks[i].Functions.Range(func(key, val interface{}) bool {
			fn := val.(*UserDefinedFunction)
			if fn.IsAggregate {
				if !aggregateAll.Exists(key.(string)) {
					aggregateAll.Store(key.(string), fn)
				}
			} else {
				if !scalarAll.Exists(key.(string)) {
					scalarAll.Store(key.(string), fn)
				}
			}
			return true
		})
	}

	return scalarAll, aggregateAll
}

func (rs *ReferenceScope) SetInlineTable(ctx context.Context, inlineTable parser.InlineTable) error {
	return rs.nodes[0].inlineTables.Set(ctx, rs, inlineTable)
}

func (rs *ReferenceScope) GetInlineTable(name parser.Identifier) (*View, error) {
	for i := range rs.nodes {
		if view, err := rs.nodes[i].inlineTables.Get(name); err == nil {
			return view, nil
		}
	}
	return nil, NewUndefinedInLineTableError(name)
}

func (rs *ReferenceScope) StoreInlineTable(name parser.Identifier, view *View) error {
	return rs.nodes[0].inlineTables.Store(name, view)
}

func (rs *ReferenceScope) InlineTableExists(name parser.Identifier) bool {
	for i := range rs.nodes {
		if rs.nodes[i].inlineTables.Exists(name) {
			return true
		}
	}
	return false
}

func (rs *ReferenceScope) LoadInlineTable(ctx context.Context, clause parser.WithClause) error {
	for _, v := range clause.InlineTables {
		inlineTable := v.(parser.InlineTable)
		err := rs.SetInlineTable(ctx, inlineTable)
		if err != nil {
			return err
		}
	}

	return nil
}

func (rs *ReferenceScope) AddAlias(alias parser.Identifier, path string) error {
	return rs.nodes[0].aliases.Add(alias, path)
}

func (rs *ReferenceScope) GetAlias(alias parser.Identifier) (path string, err error) {
	for i := range rs.nodes {
		if path, err = rs.nodes[i].aliases.Get(alias); err == nil {
			return
		}
	}
	err = NewTableNotLoadedError(alias)
	return
}
