package sqlite

import (
	"errors"
	"fmt"
	"sync"
	"unsafe"

	"modernc.org/libc"
	"modernc.org/libc/sys/types"
	sqlite3 "modernc.org/sqlite/lib"
)

var (
	xPreUpdateHandlers = struct {
		mu sync.RWMutex
		m  map[uintptr]func(SQLitePreUpdateData)
	}{
		m: make(map[uintptr]func(SQLitePreUpdateData)),
	}
	xCommitHandlers = struct {
		mu sync.RWMutex
		m  map[uintptr]CommitHookFn
	}{
		m: make(map[uintptr]CommitHookFn),
	}
	xRollbackHandlers = struct {
		mu sync.RWMutex
		m  map[uintptr]RollbackHookFn
	}{
		m: make(map[uintptr]RollbackHookFn),
	}
)

type PreUpdateHookFn func(SQLitePreUpdateData)

func (c *conn) RegisterPreUpdateHook(callback PreUpdateHookFn) {

	if callback == nil {
		xPreUpdateHandlers.mu.Lock()
		delete(xPreUpdateHandlers.m, c.db)
		xPreUpdateHandlers.mu.Unlock()
		sqlite3.Xsqlite3_preupdate_hook(c.tls, c.db, uintptr(unsafe.Pointer(nil)), uintptr(unsafe.Pointer(nil)))
		return
	}
	xPreUpdateHandlers.mu.Lock()
	xPreUpdateHandlers.m[c.db] = callback
	xPreUpdateHandlers.mu.Unlock()

	sqlite3.Xsqlite3_preupdate_hook(c.tls, c.db, cFuncPointer(preUpdateHookTrampoline), c.db)
}

type CommitHookFn func() int32

func (c *conn) RegisterCommitHook(callback CommitHookFn) {
	if callback == nil {
		xCommitHandlers.mu.Lock()
		delete(xCommitHandlers.m, c.db)
		xCommitHandlers.mu.Unlock()
		sqlite3.Xsqlite3_commit_hook(c.tls, c.db, uintptr(unsafe.Pointer(nil)), uintptr(unsafe.Pointer(nil)))
		return
	}
	xCommitHandlers.mu.Lock()
	xCommitHandlers.m[c.db] = callback
	xCommitHandlers.mu.Unlock()
	sqlite3.Xsqlite3_commit_hook(c.tls, c.db, cFuncPointer(commitHookTrampoline), c.db)
}

type RollbackHookFn func()

func (c *conn) RegisterRollbackHook(callback RollbackHookFn) {
	if callback == nil {
		xRollbackHandlers.mu.Lock()
		delete(xRollbackHandlers.m, c.db)
		xRollbackHandlers.mu.Unlock()
		sqlite3.Xsqlite3_rollback_hook(c.tls, c.db, uintptr(unsafe.Pointer(nil)), uintptr(unsafe.Pointer(nil)))
		return
	}
	xRollbackHandlers.mu.Lock()
	xRollbackHandlers.m[c.db] = callback
	xRollbackHandlers.mu.Unlock()
	sqlite3.Xsqlite3_rollback_hook(c.tls, c.db, cFuncPointer(rollbackHookTrampoline), c.db)
}

type SQLitePreUpdateData struct {
	tls          *libc.TLS
	pCsr         uintptr
	Op           int32
	DatabaseName string
	TableName    string
	OldRowID     int64
	NewRowID     int64
}

// Depth returns the source path of the write, see sqlite3_preupdate_depth()
func (d *SQLitePreUpdateData) Depth() int {
	return int(sqlite3.Xsqlite3_preupdate_depth(d.tls, d.pCsr))
}

// Count returns the number of columns in the row
func (d *SQLitePreUpdateData) Count() int {
	return int(sqlite3.Xsqlite3_preupdate_count(d.tls, d.pCsr))
}

func (d *SQLitePreUpdateData) row(dest []any, new bool) error {
	count := d.Count()
	ppValue, err := mallocValue(d.tls)
	if err != nil {
		return err
	}
	defer libc.Xfree(d.tls, ppValue)

	for i := 0; i < count && i < len(dest); i++ {
		val, err := d.value(ppValue, i, new)
		if err != nil {
			return err
		}
		err = convertAssign(&dest[i], val)
		if err != nil {
			return err
		}
	}
	return nil
}

// Old populates dest with the row data to be replaced. This works similar to
// database/sql's Rows.Scan()
func (d *SQLitePreUpdateData) Old(dest ...any) error {
	if d.Op == sqlite3.SQLITE_INSERT {
		return errors.New("there is no old row for INSERT operations")
	}
	return d.row(dest, false)
}

// New populates dest with the replacement row data. This works similar to
// database/sql's Rows.Scan()
func (d *SQLitePreUpdateData) New(dest ...any) error {
	if d.Op == sqlite3.SQLITE_DELETE {
		return errors.New("there is no new row for DELETE operations")
	}
	return d.row(dest, true)
}

const ptrValSize = types.Size_t(unsafe.Sizeof(&sqlite3.Sqlite3_value{}))

func mallocValue(tls *libc.TLS) (uintptr, error) {
	p := libc.Xmalloc(tls, ptrValSize)
	if p == 0 {
		return 0, fmt.Errorf("out of memory")
	}
	return p, nil
}

func (d *SQLitePreUpdateData) value(ppValue uintptr, i int, new bool) (any, error) {
	var src any
	if new {
		sqlite3.Xsqlite3_preupdate_new(d.tls, d.pCsr, int32(i), ppValue)
	} else {
		sqlite3.Xsqlite3_preupdate_old(d.tls, d.pCsr, int32(i), ppValue)
	}
	ptrValue := *(*uintptr)(unsafe.Pointer(ppValue))
	switch sqlite3.Xsqlite3_value_type(d.tls, ptrValue) {
	case sqlite3.SQLITE_INTEGER:
		src = int64(sqlite3.Xsqlite3_value_int64(d.tls, ptrValue))
	case sqlite3.SQLITE_FLOAT:
		src = float64(sqlite3.Xsqlite3_value_double(d.tls, ptrValue))
	case sqlite3.SQLITE_BLOB:
		size := sqlite3.Xsqlite3_value_bytes(d.tls, ptrValue)
		blobPtr := sqlite3.Xsqlite3_value_blob(d.tls, ptrValue)

		var v []byte
		if size != 0 {
			v = make([]byte, size)
			copy(v, (*libc.RawMem)(unsafe.Pointer(blobPtr))[:size:size])
		}
		src = v
	case sqlite3.SQLITE_TEXT:
		src = libc.GoString(sqlite3.Xsqlite3_value_text(d.tls, ptrValue))
	case sqlite3.SQLITE_NULL:
		src = nil
	}
	return src, nil
}

func preUpdateHookTrampoline(tls *libc.TLS, handle uintptr, pCsr uintptr, op int32, zDb uintptr, pTab uintptr, iKey1 int64, iReg int32, iBlobWrite int32) {
	xPreUpdateHandlers.mu.RLock()
	xPreUpdateHandler := xPreUpdateHandlers.m[handle]
	xPreUpdateHandlers.mu.RUnlock()

	if xPreUpdateHandler == nil {
		return
	}
	data := SQLitePreUpdateData{
		tls:          tls,
		pCsr:         pCsr,
		Op:           op,
		DatabaseName: libc.GoString(zDb),
		TableName:    libc.GoString(pTab),
		OldRowID:     iKey1,
		NewRowID:     int64(iReg),
	}
	xPreUpdateHandler(data)
}

func commitHookTrampoline(tls *libc.TLS, handle uintptr, pCsr uintptr) int32 {
	xCommitHandlers.mu.RLock()
	xCommitHandler := xCommitHandlers.m[handle]
	xCommitHandlers.mu.RUnlock()

	if xCommitHandler == nil {
		return 0
	}

	return xCommitHandler()
}

func rollbackHookTrampoline(tls *libc.TLS, handle uintptr, pCsr uintptr) {
	xRollbackHandlers.mu.RLock()
	xRollbackHandler := xRollbackHandlers.m[handle]
	xRollbackHandlers.mu.RUnlock()

	if xRollbackHandler == nil {
		return
	}

	xRollbackHandler()
}
