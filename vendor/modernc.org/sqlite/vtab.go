// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	"fmt"
	"math"
	"sync"
	"unsafe"

	"modernc.org/libc"
	sqlite3 "modernc.org/sqlite/lib"
	"modernc.org/sqlite/vtab"
)

func init() {
	vtab.SetRegisterFunc(registerModule)
}

var (
	// vtabModules tracks Go virtual table modules registered via the vtab
	// package. Each module is identified by an integer ID used as pAux when
	// calling sqlite3_create_module_v2, so that trampolines can recover the
	// Go Module implementation.
	vtabModules = struct {
		mu  sync.RWMutex
		m   map[uintptr]*goModule
		ids idGen
		// name2id keeps stable IDs per module name to avoid unbounded growth
		// across connections.
		name2id map[string]uintptr
	}{
		m:       make(map[uintptr]*goModule),
		name2id: make(map[string]uintptr),
	}

	// nativeModules holds sqlite3_module instances for registered modules. We
	// keep them in Go memory so their addresses remain stable for the C layer.
	nativeModules = struct {
		mu sync.RWMutex
		m  map[string]*sqlite3.Sqlite3_module
	}{
		m: make(map[string]*sqlite3.Sqlite3_module),
	}

	// vtabTables maps sqlite3_vtab* (pVtab) to the corresponding Go Table.
	vtabTables = struct {
		mu sync.RWMutex
		m  map[uintptr]*goTable
	}{
		m: make(map[uintptr]*goTable),
	}

	// vtabCursors maps sqlite3_vtab_cursor* (pCursor) to the corresponding Go
	// Cursor.
	vtabCursors = struct {
		mu sync.RWMutex
		m  map[uintptr]*goCursor
	}{
		m: make(map[uintptr]*goCursor),
	}
)

// goModule wraps a vtab.Module implementation with its name.
type goModule struct {
	name string
	impl vtab.Module
}

// goTable wraps a vtab.Table implementation and remembers its module.
type goTable struct {
	mod  *goModule
	impl vtab.Table
}

// goCursor wraps a vtab.Cursor implementation and remembers its table.
type goCursor struct {
	table *goTable
	impl  vtab.Cursor
}

// Use aliases of the underlying lib types so field layouts remain correct.
type cIndexConstraint = sqlite3.Tsqlite3_index_constraint
type cIndexOrderBy = sqlite3.Tsqlite3_index_orderby
type cConstraintUsage = sqlite3.Tsqlite3_index_constraint_usage

// registerModule is installed as the hook for vtab.RegisterModule.
func registerModule(name string, m vtab.Module) error {
	if _, exists := d.modules[name]; exists {
		return fmt.Errorf("sqlite: module %q already registered", name)
	}
	d.modules[name] = m
	return nil
}

// registerModules installs all globally registered vtab modules on this
// connection by calling sqlite3_create_module_v2 for each one.
func (c *conn) registerModules() error {
	for name, mod := range d.modules {
		if err := c.registerSingleModule(name, mod); err != nil {
			return err
		}
	}
	return nil
}

func (c *conn) registerSingleModule(name string, m vtab.Module) error {
	// Allocate or reuse a stable ID for this module name and remember the Go implementation.
	vtabModules.mu.Lock()
	modID, ok := vtabModules.name2id[name]
	if !ok {
		modID = vtabModules.ids.next()
		vtabModules.name2id[name] = modID
	}
	vtabModules.m[modID] = &goModule{name: name, impl: m}
	vtabModules.mu.Unlock()

	nativeModules.mu.Lock()
	defer nativeModules.mu.Unlock()
	if _, exists := nativeModules.m[name]; exists {
		// Module struct already created; nothing more to do for this connection.
		return nil
	}

	// Build a sqlite3_module descriptor with trampolines.
	mod := &sqlite3.Sqlite3_module{}
	mod.FiVersion = 1
	mod.FxCreate = cFuncPointer(vtabCreateTrampoline)
	mod.FxConnect = cFuncPointer(vtabConnectTrampoline)
	mod.FxBestIndex = cFuncPointer(vtabBestIndexTrampoline)
	mod.FxDisconnect = cFuncPointer(vtabDisconnectTrampoline)
	mod.FxDestroy = cFuncPointer(vtabDestroyTrampoline)
	mod.FxOpen = cFuncPointer(vtabOpenTrampoline)
	mod.FxClose = cFuncPointer(vtabCloseTrampoline)
	mod.FxFilter = cFuncPointer(vtabFilterTrampoline)
	mod.FxNext = cFuncPointer(vtabNextTrampoline)
	mod.FxEof = cFuncPointer(vtabEofTrampoline)
	mod.FxColumn = cFuncPointer(vtabColumnTrampoline)
	mod.FxRowid = cFuncPointer(vtabRowidTrampoline)
	mod.FxFindFunction = cFuncPointer(vtabFindFunctionTrampoline)
	mod.FxRename = cFuncPointer(vtabRenameTrampoline)
	mod.FxUpdate = cFuncPointer(vtabUpdateTrampoline)
	mod.FxBegin = cFuncPointer(vtabBeginTrampoline)
	mod.FxSync = cFuncPointer(vtabSyncTrampoline)
	mod.FxCommit = cFuncPointer(vtabCommitTrampoline)
	mod.FxRollback = cFuncPointer(vtabRollbackTrampoline)
	mod.FxSavepoint = cFuncPointer(vtabSavepointTrampoline)
	mod.FxRelease = cFuncPointer(vtabReleaseTrampoline)
	mod.FxRollbackTo = cFuncPointer(vtabRollbackToTrampoline)

	nativeModules.m[name] = mod

	// Prepare C string for module name.
	zName, err := libc.CString(name)
	if err != nil {
		return err
	}
	defer libc.Xfree(c.tls, zName)

	// Register the module with this connection.
	if rc := sqlite3.Xsqlite3_create_module_v2(c.tls, c.db, zName, uintptr(unsafe.Pointer(mod)), modID, 0); rc != sqlite3.SQLITE_OK {
		return fmt.Errorf("create_module %q: %w", name, c.errstr(rc))
	}
	return nil
}

// vtabCreateTrampoline is the xCreate callback. It invokes the corresponding
// Go vtab.Module.Create method, declares a default schema based on argv, and
// allocates a sqlite3_vtab.
func vtabCreateTrampoline(tls *libc.TLS, db uintptr, pAux uintptr, argc int32, argv uintptr, ppVtab uintptr, pzErr uintptr) int32 {
	gm := lookupGoModule(pAux)
	if gm == nil {
		setVtabError(tls, pzErr, fmt.Sprintf("vtab: unknown module id %d", pAux))
		return sqlite3.SQLITE_ERROR
	}
	args := extractVtabArgs(tls, argc, argv)
	ctx := vtab.NewContext(func(schema string) error {
		zSchema, err := libc.CString(schema)
		if err != nil {
			return err
		}
		defer libc.Xfree(tls, zSchema)
		if rc := sqlite3.Xsqlite3_declare_vtab(tls, db, zSchema); rc != sqlite3.SQLITE_OK {
			return fmt.Errorf("declare_vtab failed: rc=%d", rc)
		}
		return nil
	})
	tbl, err := gm.impl.Create(ctx, args)
	if err != nil {
		setVtabError(tls, pzErr, err.Error())
		return sqlite3.SQLITE_ERROR
	}
	sz := unsafe.Sizeof(sqlite3.Sqlite3_vtab{})
	p := sqlite3.Xsqlite3_malloc(tls, int32(sz))
	if p == 0 {
		setVtabError(tls, pzErr, "vtab: out of memory")
		return sqlite3.SQLITE_NOMEM
	}
	mem := (*libc.RawMem)(unsafe.Pointer(p))[:sz:sz]
	for i := range mem {
		mem[i] = 0
	}
	*(*uintptr)(unsafe.Pointer(ppVtab)) = p

	gt := &goTable{mod: gm, impl: tbl}
	vtabTables.mu.Lock()
	vtabTables.m[p] = gt
	vtabTables.mu.Unlock()
	return sqlite3.SQLITE_OK
}

// vtabConnectTrampoline is the xConnect callback. It mirrors
// vtabCreateTrampoline but calls Module.Connect.
func vtabConnectTrampoline(tls *libc.TLS, db uintptr, pAux uintptr, argc int32, argv uintptr, ppVtab uintptr, pzErr uintptr) int32 {
	gm := lookupGoModule(pAux)
	if gm == nil {
		setVtabError(tls, pzErr, fmt.Sprintf("vtab: unknown module id %d", pAux))
		return sqlite3.SQLITE_ERROR
	}
	args := extractVtabArgs(tls, argc, argv)
	ctx := vtab.NewContext(func(schema string) error {
		zSchema, err := libc.CString(schema)
		if err != nil {
			return err
		}
		defer libc.Xfree(tls, zSchema)
		if rc := sqlite3.Xsqlite3_declare_vtab(tls, db, zSchema); rc != sqlite3.SQLITE_OK {
			return fmt.Errorf("declare_vtab failed: rc=%d", rc)
		}
		return nil
	})
	tbl, err := gm.impl.Connect(ctx, args)
	if err != nil {
		setVtabError(tls, pzErr, err.Error())
		return sqlite3.SQLITE_ERROR
	}
	sz := unsafe.Sizeof(sqlite3.Sqlite3_vtab{})
	p := sqlite3.Xsqlite3_malloc(tls, int32(sz))
	if p == 0 {
		setVtabError(tls, pzErr, "vtab: out of memory")
		return sqlite3.SQLITE_NOMEM
	}
	mem := (*libc.RawMem)(unsafe.Pointer(p))[:sz:sz]
	for i := range mem {
		mem[i] = 0
	}
	*(*uintptr)(unsafe.Pointer(ppVtab)) = p

	gt := &goTable{mod: gm, impl: tbl}
	vtabTables.mu.Lock()
	vtabTables.m[p] = gt
	vtabTables.mu.Unlock()
	return sqlite3.SQLITE_OK
}

// vtabBestIndexTrampoline maps sqlite3_index_info to vtab.IndexInfo and
// delegates to Table.BestIndex. It also mirrors constraint and ORDER BY
// information into the Go structure.
func vtabBestIndexTrampoline(tls *libc.TLS, pVtab uintptr, pInfo uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}

	idx := (*sqlite3.Sqlite3_index_info)(unsafe.Pointer(pInfo))
	info := &vtab.IndexInfo{}

	// Populate Constraints from sqlite3_index_info.aConstraint.
	if idx.FnConstraint > 0 && idx.FaConstraint != 0 {
		n := int(idx.FnConstraint)
		cs := make([]vtab.Constraint, 0, n)
		base := idx.FaConstraint
		sz := unsafe.Sizeof(cIndexConstraint{})
		for i := 0; i < n; i++ {
			c := (*cIndexConstraint)(unsafe.Pointer(base + uintptr(i)*sz))
			op := vtab.OpUnknown
			switch int32(c.Fop) {
			case sqlite3.SQLITE_INDEX_CONSTRAINT_EQ:
				op = vtab.OpEQ
			case sqlite3.SQLITE_INDEX_CONSTRAINT_GT:
				op = vtab.OpGT
			case sqlite3.SQLITE_INDEX_CONSTRAINT_LE:
				op = vtab.OpLE
			case sqlite3.SQLITE_INDEX_CONSTRAINT_LT:
				op = vtab.OpLT
			case sqlite3.SQLITE_INDEX_CONSTRAINT_GE:
				op = vtab.OpGE
			case sqlite3.SQLITE_INDEX_CONSTRAINT_MATCH:
				op = vtab.OpMATCH
			case sqlite3.SQLITE_INDEX_CONSTRAINT_NE:
				op = vtab.OpNE
			case sqlite3.SQLITE_INDEX_CONSTRAINT_IS:
				op = vtab.OpIS
			case sqlite3.SQLITE_INDEX_CONSTRAINT_ISNOT:
				op = vtab.OpISNOT
			case sqlite3.SQLITE_INDEX_CONSTRAINT_ISNULL:
				op = vtab.OpISNULL
			case sqlite3.SQLITE_INDEX_CONSTRAINT_ISNOTNULL:
				op = vtab.OpISNOTNULL
			case sqlite3.SQLITE_INDEX_CONSTRAINT_LIKE:
				op = vtab.OpLIKE
			case sqlite3.SQLITE_INDEX_CONSTRAINT_GLOB:
				op = vtab.OpGLOB
			case sqlite3.SQLITE_INDEX_CONSTRAINT_REGEXP:
				op = vtab.OpREGEXP
			case sqlite3.SQLITE_INDEX_CONSTRAINT_FUNCTION:
				op = vtab.OpFUNCTION
			case sqlite3.SQLITE_INDEX_CONSTRAINT_LIMIT:
				op = vtab.OpLIMIT
			case sqlite3.SQLITE_INDEX_CONSTRAINT_OFFSET:
				op = vtab.OpOFFSET
			}
			cs = append(cs, vtab.Constraint{
				Column:   int(c.FiColumn),
				Op:       op,
				Usable:   c.Fusable != 0,
				ArgIndex: -1, // 0-based; -1 means ignore
				Omit:     false,
			})
		}
		info.Constraints = cs
	}

	// Populate OrderBy from sqlite3_index_info.aOrderBy.
	if idx.FnOrderBy > 0 && idx.FaOrderBy != 0 {
		n := int(idx.FnOrderBy)
		obs := make([]vtab.OrderBy, 0, n)
		base := idx.FaOrderBy
		sz := unsafe.Sizeof(cIndexOrderBy{})
		for i := 0; i < n; i++ {
			ob := (*cIndexOrderBy)(unsafe.Pointer(base + uintptr(i)*sz))
			obs = append(obs, vtab.OrderBy{
				Column: int(ob.FiColumn),
				Desc:   ob.Fdesc != 0,
			})
		}
		info.OrderBy = obs
	}

	// Populate ColUsed and idxFlags for module visibility.
	if idx.FcolUsed != 0 {
		info.ColUsed = uint64(idx.FcolUsed)
	}
	if idx.FidxFlags != 0 {
		info.IdxFlags = int(idx.FidxFlags)
	}

	if err := gt.impl.BestIndex(info); err != nil {
		// Report error via zErrMsg on pVtab.
		setVtabZErrMsg(tls, pVtab, err.Error())
		return sqlite3.SQLITE_ERROR
	}

	// Propagate any ArgIndex assignments back into aConstraintUsage so that
	// SQLite will populate xFilter's argv[] accordingly.
	if idx.FnConstraint > 0 && idx.FaConstraintUsage != 0 && len(info.Constraints) > 0 {
		n := int(idx.FnConstraint)
		base := idx.FaConstraintUsage
		sz := unsafe.Sizeof(cConstraintUsage{})
		for i := 0; i < n && i < len(info.Constraints); i++ {
			cu := (*cConstraintUsage)(unsafe.Pointer(base + uintptr(i)*sz))
			argIndex := info.Constraints[i].ArgIndex
			if argIndex >= 0 {
				// Go ArgIndex is 0-based; SQLite wants 1-based.
				cu.FargvIndex = int32(argIndex + 1)
			}
			if info.Constraints[i].Omit {
				cu.Fomit = 1
			}
		}
	}
	// Guard against int32 overflow: SQLite expects idxNum as int32.
	if info.IdxNum < math.MinInt32 || info.IdxNum > math.MaxInt32 {
		setVtabZErrMsg(tls, pVtab, fmt.Sprintf("vtab: IdxNum %d out of int32 range", info.IdxNum))
		return sqlite3.SQLITE_ERROR
	}
	idx.FidxNum = int32(info.IdxNum)
	if info.IdxStr != "" {
		// Allocate using SQLite allocator because needToFreeIdxStr=1 instructs
		// SQLite to free the string with sqlite3_free.
		z := sqlite3AllocCString(tls, info.IdxStr)
		if z != 0 {
			idx.FidxStr = z
			idx.FneedToFreeIdxStr = 1
		}
	}
	if info.OrderByConsumed {
		idx.ForderByConsumed = 1
	}
	if info.IdxFlags != 0 {
		idx.FidxFlags = int32(info.IdxFlags)
	}
	if info.EstimatedCost != 0 {
		idx.FestimatedCost = info.EstimatedCost
	}
	if info.EstimatedRows != 0 {
		idx.FestimatedRows = sqlite3.Sqlite3_int64(info.EstimatedRows)
	}
	return sqlite3.SQLITE_OK
}

// vtabDisconnectTrampoline is xDisconnect. It frees the sqlite3_vtab and
// calls Table.Disconnect.
func vtabDisconnectTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt != nil {
		_ = gt.impl.Disconnect()
		vtabTables.mu.Lock()
		delete(vtabTables.m, pVtab)
		vtabTables.mu.Unlock()
	}
	sqlite3.Xsqlite3_free(tls, pVtab)
	return sqlite3.SQLITE_OK
}

// vtabDestroyTrampoline is xDestroy. Currently identical to Disconnect.
func vtabDestroyTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt != nil {
		_ = gt.impl.Destroy()
		vtabTables.mu.Lock()
		delete(vtabTables.m, pVtab)
		vtabTables.mu.Unlock()
	}
	sqlite3.Xsqlite3_free(tls, pVtab)
	return sqlite3.SQLITE_OK
}

// vtabOpenTrampoline is xOpen. It allocates an empty sqlite3_vtab_cursor and
// creates a Go Cursor via Table.Open.
func vtabOpenTrampoline(tls *libc.TLS, pVtab uintptr, ppCursor uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}

	curImpl, err := gt.impl.Open()
	if err != nil {
		return sqlite3.SQLITE_ERROR
	}

	sz := unsafe.Sizeof(sqlite3.Sqlite3_vtab_cursor{})
	p := sqlite3.Xsqlite3_malloc(tls, int32(sz))
	if p == 0 {
		return sqlite3.SQLITE_NOMEM
	}
	mem := (*libc.RawMem)(unsafe.Pointer(p))[:sz:sz]
	for i := range mem {
		mem[i] = 0
	}
	*(*uintptr)(unsafe.Pointer(ppCursor)) = p

	// Link cursor back to its vtab so error reporting can set zErrMsg.
	cur := (*sqlite3.Sqlite3_vtab_cursor)(unsafe.Pointer(p))
	cur.FpVtab = pVtab

	gc := &goCursor{table: gt, impl: curImpl}
	vtabCursors.mu.Lock()
	vtabCursors.m[p] = gc
	vtabCursors.mu.Unlock()
	return sqlite3.SQLITE_OK
}

// vtabCloseTrampoline is xClose. It frees the sqlite3_vtab_cursor and calls
// Cursor.Close.
func vtabCloseTrampoline(tls *libc.TLS, pCursor uintptr) int32 {
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc != nil {
		_ = gc.impl.Close()
		vtabCursors.mu.Lock()
		delete(vtabCursors.m, pCursor)
		vtabCursors.mu.Unlock()
	}
	sqlite3.Xsqlite3_free(tls, pCursor)
	return sqlite3.SQLITE_OK
}

// vtabFilterTrampoline is xFilter.
func vtabFilterTrampoline(tls *libc.TLS, pCursor uintptr, idxNum int32, idxStr uintptr, argc int32, argv uintptr) int32 {
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc == nil {
		return sqlite3.SQLITE_ERROR
	}

	var idxStrGo string
	if idxStr != 0 {
		idxStrGo = libc.GoString(idxStr)
	}
	vals := functionArgs(tls, argc, argv)
	if err := gc.impl.Filter(int(idxNum), idxStrGo, vals); err != nil {
		// Set zErrMsg on the associated vtab for better diagnostics.
		if pCursor != 0 {
			cur := (*sqlite3.Sqlite3_vtab_cursor)(unsafe.Pointer(pCursor))
			if cur.FpVtab != 0 {
				setVtabZErrMsg(tls, cur.FpVtab, err.Error())
			}
		}
		return sqlite3.SQLITE_ERROR
	}
	return sqlite3.SQLITE_OK
}

// vtabNextTrampoline is xNext.
func vtabNextTrampoline(tls *libc.TLS, pCursor uintptr) int32 {
	_ = tls
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc == nil {
		return sqlite3.SQLITE_ERROR
	}
	if err := gc.impl.Next(); err != nil {
		return sqlite3.SQLITE_ERROR
	}
	return sqlite3.SQLITE_OK
}

// vtabEofTrampoline is xEof.
func vtabEofTrampoline(tls *libc.TLS, pCursor uintptr) int32 {
	_ = tls
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc == nil || gc.impl.Eof() {
		return 1
	}
	return 0
}

// vtabColumnTrampoline is xColumn.
func vtabColumnTrampoline(tls *libc.TLS, pCursor uintptr, ctx uintptr, iCol int32) int32 {
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc == nil {
		sqlite3.Xsqlite3_result_null(tls, ctx)
		return sqlite3.SQLITE_OK
	}
	val, err := gc.impl.Column(int(iCol))
	if err != nil {
		// Report via result error on the context.
		z, cerr := libc.CString(err.Error())
		if cerr == nil {
			defer libc.Xfree(tls, z)
			sqlite3.Xsqlite3_result_error(tls, ctx, z, -1)
			sqlite3.Xsqlite3_result_error_code(tls, ctx, sqlite3.SQLITE_ERROR)
		} else {
			sqlite3.Xsqlite3_result_error_code(tls, ctx, sqlite3.SQLITE_ERROR)
		}
		return sqlite3.SQLITE_ERROR
	}
	if err := functionReturnValue(tls, ctx, val); err != nil {
		// Include a descriptive error message for easier debugging
		// (e.g., unsupported type conversions).
		if err != nil {
			z, cerr := libc.CString(err.Error())
			if cerr == nil {
				defer libc.Xfree(tls, z)
				sqlite3.Xsqlite3_result_error(tls, ctx, z, -1)
			}
		}
		sqlite3.Xsqlite3_result_error_code(tls, ctx, sqlite3.SQLITE_ERROR)
		return sqlite3.SQLITE_ERROR
	}
	return sqlite3.SQLITE_OK
}

// vtabRowidTrampoline is xRowid.
func vtabRowidTrampoline(tls *libc.TLS, pCursor uintptr, pRowid uintptr) int32 {
	_ = tls
	vtabCursors.mu.RLock()
	gc := vtabCursors.m[pCursor]
	vtabCursors.mu.RUnlock()
	if gc == nil {
		*(*int64)(unsafe.Pointer(pRowid)) = 0
		return sqlite3.SQLITE_OK
	}
	rowid, err := gc.impl.Rowid()
	if err != nil {
		*(*int64)(unsafe.Pointer(pRowid)) = 0
		return sqlite3.SQLITE_ERROR
	}
	*(*int64)(unsafe.Pointer(pRowid)) = rowid
	return sqlite3.SQLITE_OK
}

func lookupGoModule(id uintptr) *goModule {
	vtabModules.mu.RLock()
	defer vtabModules.mu.RUnlock()
	return vtabModules.m[id]
}

func extractVtabArgs(tls *libc.TLS, argc int32, argv uintptr) []string {
	args := make([]string, argc)
	for i := int32(0); i < argc; i++ {
		cstr := *(*uintptr)(unsafe.Pointer(argv + uintptr(i)*unsafe.Sizeof(uintptr(0))))
		args[i] = libc.GoString(cstr)
	}
	return args
}

func setVtabError(tls *libc.TLS, pzErr uintptr, msg string) {
	if pzErr == 0 {
		return
	}
	z := sqlite3AllocCString(tls, msg)
	if z == 0 {
		return
	}
	*(*uintptr)(unsafe.Pointer(pzErr)) = z
}

// setVtabZErrMsg sets pVtab->zErrMsg to a newly allocated C string containing
// msg. SQLite will free this pointer.
func setVtabZErrMsg(tls *libc.TLS, pVtab uintptr, msg string) {
	if pVtab == 0 {
		return
	}
	vt := (*sqlite3.Sqlite3_vtab)(unsafe.Pointer(pVtab))
	if vt.FzErrMsg != 0 {
		sqlite3.Xsqlite3_free(tls, vt.FzErrMsg)
		vt.FzErrMsg = 0
	}
	z := sqlite3AllocCString(tls, msg)
	if z == 0 {
		return
	}
	vt.FzErrMsg = z
}

// Optional vtab callbacks

// vtabFindFunctionTrampoline is xFindFunction. We currently do not expose a
// Go surface for per-table SQL functions; report not found (return 0).
func vtabFindFunctionTrampoline(tls *libc.TLS, pVtab uintptr, nArg int32, zName uintptr, pxFunc uintptr, ppArg uintptr) int32 {
	_ = tls
	_ = pVtab
	_ = nArg
	_ = zName
	if pxFunc != 0 {
		*(*uintptr)(unsafe.Pointer(pxFunc)) = 0
	}
	if ppArg != 0 {
		*(*uintptr)(unsafe.Pointer(ppArg)) = 0
	}
	return 0 // not found
}

// vtabRenameTrampoline is xRename. Calls Table.Rename if implemented.
func vtabRenameTrampoline(tls *libc.TLS, pVtab uintptr, zNew uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	name := libc.GoString(zNew)
	if r, ok := gt.impl.(interface{ Rename(string) error }); ok {
		if err := r.Rename(name); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

// vtabUpdateTrampoline is xUpdate. Not supported by default; report read-only.
func vtabUpdateTrampoline(tls *libc.TLS, pVtab uintptr, argc int32, argv uintptr, pRowid uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	upd, ok := gt.impl.(interface {
		Insert(cols []vtab.Value, rowid *int64) error
		Update(oldRowid int64, cols []vtab.Value, newRowid *int64) error
		Delete(oldRowid int64) error
	})
	if !ok {
		return sqlite3.SQLITE_READONLY
	}

	// DELETE: argc == 1; argv[0]=oldRowid
	if argc == 1 {
		valPtr := *(*uintptr)(unsafe.Pointer(argv))
		oldRowid := int64(0)
		if sqlite3.Xsqlite3_value_type(tls, valPtr) != sqlite3.SQLITE_NULL {
			oldRowid = int64(sqlite3.Xsqlite3_value_int64(tls, valPtr))
		}
		if err := upd.Delete(oldRowid); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
		return sqlite3.SQLITE_OK
	}

	// INSERT or UPDATE: argc == N+2. argv[0]=oldRowid (NULL for insert),
	// argv[1..N]=column values, argv[N+1]=newRowid (or desired rowid for insert, may be NULL).
	if argc < 3 {
		return sqlite3.SQLITE_MISUSE
	}
	nCols := argc - 2
	// Extract column values
	colsPtr := argv + uintptr(1)*sqliteValPtrSize
	cols := functionArgs(tls, nCols, colsPtr)

	// Determine old/new rowid
	oldPtr := *(*uintptr)(unsafe.Pointer(argv + uintptr(0)*sqliteValPtrSize))
	newPtr := *(*uintptr)(unsafe.Pointer(argv + uintptr(argc-1)*sqliteValPtrSize))

	oldIsNull := sqlite3.Xsqlite3_value_type(tls, oldPtr) == sqlite3.SQLITE_NULL
	newIsNull := sqlite3.Xsqlite3_value_type(tls, newPtr) == sqlite3.SQLITE_NULL

	if oldIsNull {
		// INSERT
		var rid int64
		if !newIsNull {
			rid = int64(sqlite3.Xsqlite3_value_int64(tls, newPtr))
		}
		if err := upd.Insert(cols, &rid); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
		if pRowid != 0 {
			*(*int64)(unsafe.Pointer(pRowid)) = rid
		}
		return sqlite3.SQLITE_OK
	}

	// UPDATE
	oldRowid := int64(sqlite3.Xsqlite3_value_int64(tls, oldPtr))
	var newRid int64
	if !newIsNull {
		newRid = int64(sqlite3.Xsqlite3_value_int64(tls, newPtr))
	}
	if err := upd.Update(oldRowid, cols, &newRid); err != nil {
		setVtabZErrMsg(tls, pVtab, err.Error())
		return sqlite3.SQLITE_ERROR
	}
	if pRowid != 0 && newRid != 0 {
		*(*int64)(unsafe.Pointer(pRowid)) = newRid
	}
	return sqlite3.SQLITE_OK
}

// Transactional callbacks
func vtabBeginTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Begin() error }); ok {
		if err := tr.Begin(); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabSyncTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Sync() error }); ok {
		if err := tr.Sync(); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabCommitTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Commit() error }); ok {
		if err := tr.Commit(); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabRollbackTrampoline(tls *libc.TLS, pVtab uintptr) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Rollback() error }); ok {
		if err := tr.Rollback(); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabSavepointTrampoline(tls *libc.TLS, pVtab uintptr, i int32) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Savepoint(int) error }); ok {
		if err := tr.Savepoint(int(i)); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabReleaseTrampoline(tls *libc.TLS, pVtab uintptr, i int32) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ Release(int) error }); ok {
		if err := tr.Release(int(i)); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}

func vtabRollbackToTrampoline(tls *libc.TLS, pVtab uintptr, i int32) int32 {
	vtabTables.mu.RLock()
	gt := vtabTables.m[pVtab]
	vtabTables.mu.RUnlock()
	if gt == nil {
		return sqlite3.SQLITE_ERROR
	}
	if tr, ok := gt.impl.(interface{ RollbackTo(int) error }); ok {
		if err := tr.RollbackTo(int(i)); err != nil {
			setVtabZErrMsg(tls, pVtab, err.Error())
			return sqlite3.SQLITE_ERROR
		}
	}
	return sqlite3.SQLITE_OK
}
