// Package vtab defines a Go-facing API for implementing SQLite virtual table
// modules on top of the modernc.org/sqlite driver.
//
// It is intentionally small and generic so that external projects can
// implement virtual tables without depending on the translated C internals.
package vtab

// API notes
//
// - Schema declaration: Modules must call Context.Declare from within Create
//   or Connect to declare the virtual table schema (a CREATE TABLE statement).
//   The driver no longer auto-declares based on USING(...) args to support
//   dynamic schemas (e.g., CSV headers).
//
// - Constraint operators: ConstraintOp includes OpUnknown for operators that
//   are not recognized. The driver maps common SQLite operators including EQ,
//   NE, GT, GE, LT, LE, MATCH, IS/ISNOT, ISNULL/ISNOTNULL, LIKE, GLOB, REGEXP,
//   FUNCTION, LIMIT, and OFFSET.
//
// - ArgIndex: Set as 0-based in Go to indicate which position in argv[] should
//   receive a constraint value. The driver adds +1 when communicating with
//   SQLite (which is 1-based). Use -1 (default) to ignore.
//
// - Omit: Set Constraint.Omit to ask SQLite to not re-evaluate that constraint
//   in the parent query if the virtual table fully handles it.
//
// - ColUsed: IndexInfo.ColUsed provides a bitmask of columns referenced by the
//   query. Bit N indicates column N is used.
//
// - IdxFlags: IndexInfo.IdxFlags allows modules to set planning flags.
//   Currently, IndexScanUnique (mirrors SQLITE_INDEX_SCAN_UNIQUE) indicates
//   the plan will visit at most one row. This can help the optimizer.
//
// Optional interfaces
//
// - Updater: Implement on your Table to support writes via xUpdate.
//   Insert(cols, *rowid), Update(oldRowid, cols, *newRowid), Delete(oldRowid).
//   The trampoline maps SQLite xUpdate’s calling convention to these methods.
//
// - Renamer: Implement Rename(newName string) on your Table to handle xRename.
//   If unimplemented, rename is treated as a no-op.
//
// - Transactional: Implement Begin/Sync/Commit/Rollback/Savepoint/Release/
//   RollbackTo as needed. Unimplemented methods are treated as no-ops.
//   These callbacks let writable or advanced modules coordinate with SQLite
//   transaction boundaries.
//
// Re-entrancy cautions
// - Avoid executing SQL on the same connection from within vtab methods
//   (Create/Connect/BestIndex/Filter/etc.). SQLite virtual table callbacks run
//   inside the engine and issuing re-entrant SQL on the same connection can
//   lead to deadlocks or undefined behavior. If a module requires issuing SQL,
//   consider using a separate connection and document the concurrency model.
