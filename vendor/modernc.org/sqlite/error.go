// Copyright 2025 The Sqlite Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sqlite // import "modernc.org/sqlite"

import (
	sqlite3 "modernc.org/sqlite/lib"
)

// Error represents sqlite library error code.
type Error struct {
	msg  string
	code int
}

// Error implements error.
func (e *Error) Error() string { return e.msg }

// Code returns the sqlite result code for this error.
func (e *Error) Code() int { return e.code }

var (
	// ErrorCodeString maps Error.Code() to its string representation.
	ErrorCodeString = map[int]string{
		sqlite3.SQLITE_ABORT:             "Callback routine requested an abort (SQLITE_ABORT)",
		sqlite3.SQLITE_AUTH:              "Authorization denied (SQLITE_AUTH)",
		sqlite3.SQLITE_BUSY:              "The database file is locked (SQLITE_BUSY)",
		sqlite3.SQLITE_CANTOPEN:          "Unable to open the database file (SQLITE_CANTOPEN)",
		sqlite3.SQLITE_CONSTRAINT:        "Abort due to constraint violation (SQLITE_CONSTRAINT)",
		sqlite3.SQLITE_CORRUPT:           "The database disk image is malformed (SQLITE_CORRUPT)",
		sqlite3.SQLITE_DONE:              "sqlite3_step() has finished executing (SQLITE_DONE)",
		sqlite3.SQLITE_EMPTY:             "Internal use only (SQLITE_EMPTY)",
		sqlite3.SQLITE_ERROR:             "Generic error (SQLITE_ERROR)",
		sqlite3.SQLITE_FORMAT:            "Not used (SQLITE_FORMAT)",
		sqlite3.SQLITE_FULL:              "Insertion failed because database is full (SQLITE_FULL)",
		sqlite3.SQLITE_INTERNAL:          "Internal logic error in SQLite (SQLITE_INTERNAL)",
		sqlite3.SQLITE_INTERRUPT:         "Operation terminated by sqlite3_interrupt()(SQLITE_INTERRUPT)",
		sqlite3.SQLITE_IOERR | (1 << 8):  "(SQLITE_IOERR_READ)",
		sqlite3.SQLITE_IOERR | (10 << 8): "(SQLITE_IOERR_DELETE)",
		sqlite3.SQLITE_IOERR | (11 << 8): "(SQLITE_IOERR_BLOCKED)",
		sqlite3.SQLITE_IOERR | (12 << 8): "(SQLITE_IOERR_NOMEM)",
		sqlite3.SQLITE_IOERR | (13 << 8): "(SQLITE_IOERR_ACCESS)",
		sqlite3.SQLITE_IOERR | (14 << 8): "(SQLITE_IOERR_CHECKRESERVEDLOCK)",
		sqlite3.SQLITE_IOERR | (15 << 8): "(SQLITE_IOERR_LOCK)",
		sqlite3.SQLITE_IOERR | (16 << 8): "(SQLITE_IOERR_CLOSE)",
		sqlite3.SQLITE_IOERR | (17 << 8): "(SQLITE_IOERR_DIR_CLOSE)",
		sqlite3.SQLITE_IOERR | (2 << 8):  "(SQLITE_IOERR_SHORT_READ)",
		sqlite3.SQLITE_IOERR | (3 << 8):  "(SQLITE_IOERR_WRITE)",
		sqlite3.SQLITE_IOERR | (4 << 8):  "(SQLITE_IOERR_FSYNC)",
		sqlite3.SQLITE_IOERR | (5 << 8):  "(SQLITE_IOERR_DIR_FSYNC)",
		sqlite3.SQLITE_IOERR | (6 << 8):  "(SQLITE_IOERR_TRUNCATE)",
		sqlite3.SQLITE_IOERR | (7 << 8):  "(SQLITE_IOERR_FSTAT)",
		sqlite3.SQLITE_IOERR | (8 << 8):  "(SQLITE_IOERR_UNLOCK)",
		sqlite3.SQLITE_IOERR | (9 << 8):  "(SQLITE_IOERR_RDLOCK)",
		sqlite3.SQLITE_IOERR:             "Some kind of disk I/O error occurred (SQLITE_IOERR)",
		sqlite3.SQLITE_LOCKED | (1 << 8): "(SQLITE_LOCKED_SHAREDCACHE)",
		sqlite3.SQLITE_LOCKED:            "A table in the database is locked (SQLITE_LOCKED)",
		sqlite3.SQLITE_MISMATCH:          "Data type mismatch (SQLITE_MISMATCH)",
		sqlite3.SQLITE_MISUSE:            "Library used incorrectly (SQLITE_MISUSE)",
		sqlite3.SQLITE_NOLFS:             "Uses OS features not supported on host (SQLITE_NOLFS)",
		sqlite3.SQLITE_NOMEM:             "A malloc() failed (SQLITE_NOMEM)",
		sqlite3.SQLITE_NOTADB:            "File opened that is not a database file (SQLITE_NOTADB)",
		sqlite3.SQLITE_NOTFOUND:          "Unknown opcode in sqlite3_file_control() (SQLITE_NOTFOUND)",
		sqlite3.SQLITE_NOTICE:            "Notifications from sqlite3_log() (SQLITE_NOTICE)",
		sqlite3.SQLITE_PERM:              "Access permission denied (SQLITE_PERM)",
		sqlite3.SQLITE_PROTOCOL:          "Database lock protocol error (SQLITE_PROTOCOL)",
		sqlite3.SQLITE_RANGE:             "2nd parameter to sqlite3_bind out of range (SQLITE_RANGE)",
		sqlite3.SQLITE_READONLY:          "Attempt to write a readonly database (SQLITE_READONLY)",
		sqlite3.SQLITE_ROW:               "sqlite3_step() has another row ready (SQLITE_ROW)",
		sqlite3.SQLITE_SCHEMA:            "The database schema changed (SQLITE_SCHEMA)",
		sqlite3.SQLITE_TOOBIG:            "String or BLOB exceeds size limit (SQLITE_TOOBIG)",
		sqlite3.SQLITE_WARNING:           "Warnings from sqlite3_log() (SQLITE_WARNING)",
	}
)
