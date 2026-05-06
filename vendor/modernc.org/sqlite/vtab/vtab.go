package vtab

import (
	"database/sql"
	"database/sql/driver"
	"errors"
)

// Value is the value type passed to and from virtual table cursors. It
// aliases database/sql/driver.Value to avoid exposing low-level details to
// module authors while remaining compatible with the driver.
type Value = driver.Value

// Context carries information that a Module may need when creating or
// connecting a table instance. It intentionally does not expose *sql.DB to
// avoid leaking database/sql internals into the vtab API. Additional fields
// may be added in the future as needed.
type Context struct {
	declare func(string) error
}

// Declare must be called by a module from within Create or Connect to declare
// the schema of the virtual table. The provided SQL must be a CREATE TABLE
// statement describing the exposed columns.
//
// The engine installs this callback so that the declaration is executed in the
// correct context. Calling Declare outside of Create/Connect may fail.
func (c Context) Declare(schema string) error {
	if c.declare == nil {
		return errors.New("vtab: declare not available in this context")
	}
	return c.declare(schema)
}

// NewContext is used by the engine to create a Context bound to the current
// xCreate/xConnect call. External modules should not need to call this.
func NewContext(declare func(string) error) Context { return Context{declare: declare} }

// Module represents a virtual table module, analogous to sqlite3_module in
// the SQLite C API. Implementations are responsible for creating and
// connecting table instances.
type Module interface {
	// Create is called to create a new virtual table. args corresponds to the
	// argv array passed to xCreate in the SQLite C API: it contains the module
	// name, the database name, the table name, and module arguments.
	Create(ctx Context, args []string) (Table, error)

	// Connect is called to connect to an existing virtual table. Its
	// semantics mirror xConnect in the SQLite C API.
	Connect(ctx Context, args []string) (Table, error)
}

// Table represents a single virtual table instance (the Go analogue of
// sqlite3_vtab and its associated methods).
type Table interface {
	// BestIndex allows the virtual table to inform SQLite about which
	// constraints and orderings it can efficiently support. The IndexInfo
	// structure mirrors sqlite3_index_info.
	BestIndex(info *IndexInfo) error

	// Open creates a new cursor for scanning the table.
	Open() (Cursor, error)

	// Disconnect is called to disconnect from a table instance (xDisconnect).
	Disconnect() error

	// Destroy is called when a table is dropped (xDestroy).
	Destroy() error
}

// Renamer can be implemented by a Table to handle xRename.
type Renamer interface {
	Rename(newName string) error
}

// Transactional can be implemented by a Table to handle transaction-related
// callbacks. Methods are optional; unimplemented methods are treated as no-op.
type Transactional interface {
	Begin() error
	Sync() error
	Commit() error
	Rollback() error
	Savepoint(i int) error
	Release(i int) error
	RollbackTo(i int) error
}

// Cursor represents a cursor over a virtual table (sqlite3_vtab_cursor).
type Cursor interface {
	// Filter corresponds to xFilter. idxNum and idxStr are the chosen index
	// number and string; vals are the constraint arguments.
	Filter(idxNum int, idxStr string, vals []Value) error

	// Next advances the cursor to the next row (xNext).
	Next() error

	// Eof reports whether the cursor is past the last row (xEof != 0).
	Eof() bool

	// Column returns the value of the specified column in the current row
	// (xColumn).
	Column(col int) (Value, error)

	// Rowid returns the current rowid (xRowid).
	Rowid() (int64, error)

	// Close closes the cursor (xClose).
	Close() error
}

// Updater can be implemented by a Table to support writes via xUpdate.
//
// Semantics follow SQLite's xUpdate:
//   - Delete: Delete(oldRowid) is called.
//   - Insert: Insert(cols, rowid) is called. *rowid may contain a desired rowid
//     (if provided by SQL) and should be set to the final rowid of the new row.
//   - Update: Update(oldRowid, cols, newRowid) is called. *newRowid may be set
//     to the final rowid of the updated row when changed.
type Updater interface {
	Insert(cols []Value, rowid *int64) error
	Update(oldRowid int64, cols []Value, newRowid *int64) error
	Delete(oldRowid int64) error
}

// ConstraintOp describes the operator used in a constraint on a virtual
// table column. It loosely mirrors the op field of sqlite3_index_constraint.
type ConstraintOp int

const (
	// OpUnknown indicates an operator that is not recognized or not mapped.
	// Modules should treat this conservatively.
	OpUnknown ConstraintOp = iota
	OpEQ
	OpGT
	OpLE
	OpLT
	OpGE
	OpMATCH // "MATCH" operator (e.g. for FTS or KNN semantics)
	OpNE
	OpIS
	OpISNOT
	OpISNULL
	OpISNOTNULL
	OpLIKE
	OpGLOB
	OpREGEXP
	OpFUNCTION
	OpLIMIT
	OpOFFSET
)

// Constraint describes a single WHERE-clause constraint that SQLite is
// considering pushing down to the virtual table.
type Constraint struct {
	Column int
	Op     ConstraintOp
	Usable bool
	// ArgIndex selects which position in argv[] (0-based) should contain the
	// RHS value for this constraint when Filter is called. Set to -1 to ignore.
	ArgIndex int
	// Omit requests SQLite to omit the corresponding constraint from the
	// parent query if the virtual table fully handles it.
	Omit bool
}

// OrderBy describes a single ORDER BY term for a query involving a virtual
// table.
type OrderBy struct {
	Column int
	Desc   bool
}

// IndexInfo holds information about constraints and orderings for a virtual
// table query. It is the Go analogue of sqlite3_index_info.
type IndexInfo struct {
	Constraints []Constraint
	OrderBy     []OrderBy

	// IdxNum selects the query plan chosen in BestIndex. This value is passed
	// back to Cursor.Filter. Note: SQLite stores this as a 32-bit signed
	// integer (int32). Implementations must ensure IdxNum fits within the
	// int32 range; values outside of int32 will cause an error in the driver
	// to avoid silent truncation.
	IdxNum int64
	IdxStr string
	// IdxFlags provides extra information about the chosen plan.
	// Set to IndexScanUnique to indicate the plan visits at most one row.
	IdxFlags        int
	OrderByConsumed bool
	EstimatedCost   float64
	EstimatedRows   int64
	// ColUsed is a bitmask indicating which columns are used by the query.
	// Bit N is set if column N is referenced.
	ColUsed uint64
}

// Index flag values for IndexInfo.IdxFlags.
const (
	// IndexScanUnique mirrors SQLITE_INDEX_SCAN_UNIQUE and indicates that the
	// chosen plan will visit at most one row.
	IndexScanUnique = 1
)

// ErrNotImplemented is returned by RegisterModule when the underlying engine
// has not yet installed a registration hook. External projects can depend on
// the vtab API surface before the low-level bridge to sqlite3_create_module
// is fully wired; once the engine sets the hook via SetRegisterFunc,
// RegisterModule will forward calls to it.
var ErrNotImplemented = errors.New("vtab: RegisterModule not wired into engine")

// registerHook is installed by the engine package via SetRegisterFunc. It is
// invoked by RegisterModule to perform the actual module registration.
var registerHook func(name string, m Module) error

// SetRegisterFunc is intended to be called by the engine package to provide
// the concrete implementation of module registration. External callers
// should use RegisterModule instead.
func SetRegisterFunc(fn func(name string, m Module) error) { registerHook = fn }

// RegisterModule registers a virtual table module with the provided *sql.DB.
//
// Registration applies to new connections only. Existing open connections will
// not be updated to include newly registered modules.
//
// Registration is performed when opening a new connection. If the underlying
// sqlite3_create_module_v2 call fails, opening the connection fails and returns
// that error. This fail-fast behavior prevents partially-initialized
// connections when a module cannot be installed.
//
// The db parameter is currently unused by the engine; it is available so
// module implementations can capture it if they need a *sql.DB for their own
// internal queries.
func RegisterModule(db *sql.DB, name string, m Module) error {
	_ = db
	if registerHook == nil {
		return ErrNotImplemented
	}
	if name == "" {
		return errors.New("vtab: module name must be non-empty")
	}
	if m == nil {
		return errors.New("vtab: module implementation is nil")
	}
	return registerHook(name, m)
}
