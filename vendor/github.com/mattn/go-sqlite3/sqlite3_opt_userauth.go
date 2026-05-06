// Copyright (C) 2018 G.J.R. Timmer <gjr.timmer@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

//go:build sqlite_userauth
// +build sqlite_userauth

package sqlite3

/*
#cgo CFLAGS: -DSQLITE_USER_AUTHENTICATION
#cgo LDFLAGS: -lm
#ifndef USE_LIBSQLITE3
#include "sqlite3-binding.h"
#else
#include <sqlite3.h>
#endif
#include <stdlib.h>

static int
_sqlite3_user_authenticate(sqlite3* db, const char* zUsername, const char* aPW, int nPW)
{
  return sqlite3_user_authenticate(db, zUsername, aPW, nPW);
}

static int
_sqlite3_user_add(sqlite3* db, const char* zUsername, const char* aPW, int nPW, int isAdmin)
{
  return sqlite3_user_add(db, zUsername, aPW, nPW, isAdmin);
}

static int
_sqlite3_user_change(sqlite3* db, const char* zUsername, const char* aPW, int nPW, int isAdmin)
{
  return sqlite3_user_change(db, zUsername, aPW, nPW, isAdmin);
}

static int
_sqlite3_user_delete(sqlite3* db, const char* zUsername)
{
  return sqlite3_user_delete(db, zUsername);
}

static int
_sqlite3_auth_enabled(sqlite3* db)
{
	int exists = -1;

	sqlite3_stmt *stmt;
	sqlite3_prepare_v2(db, "select count(type) from sqlite_master WHERE type='table' and name='sqlite_user';", -1, &stmt, NULL);

	while ( sqlite3_step(stmt) == SQLITE_ROW) {
		exists = sqlite3_column_int(stmt, 0);
	}

	sqlite3_finalize(stmt);

	return exists;
}
*/
import "C"
import (
	"errors"
	"unsafe"
)

const (
	SQLITE_AUTH = C.SQLITE_AUTH
)

var (
	ErrUnauthorized  = errors.New("SQLITE_AUTH: Unauthorized")
	ErrAdminRequired = errors.New("SQLITE_AUTH: Unauthorized; Admin Privileges Required")
)

// Authenticate will perform an authentication of the provided username
// and password against the database.
//
// If a database contains the SQLITE_USER table, then the
// call to Authenticate must be invoked with an
// appropriate username and password prior to enable read and write
// access to the database.
//
// Return SQLITE_OK on success or SQLITE_ERROR if the username/password
// combination is incorrect or unknown.
//
// If the SQLITE_USER table is not present in the database file, then
// this interface is a harmless no-op returnning SQLITE_OK.
func (c *SQLiteConn) Authenticate(username, password string) error {
	rv := c.authenticate(username, password)
	switch rv {
	case C.SQLITE_ERROR, C.SQLITE_AUTH:
		return ErrUnauthorized
	case C.SQLITE_OK:
		return nil
	default:
		return c.lastError()
	}
}

// authenticate provides the actual authentication to SQLite.
// This is not exported for usage in Go.
// It is however exported for usage within SQL by the user.
//
// Returns:
//
//		C.SQLITE_OK (0)
//		C.SQLITE_ERROR (1)
//	 C.SQLITE_AUTH (23)
func (c *SQLiteConn) authenticate(username, password string) int {
	// Allocate C Variables
	cuser := C.CString(username)
	cpass := C.CString(password)

	// Free C Variables
	defer func() {
		C.free(unsafe.Pointer(cuser))
		C.free(unsafe.Pointer(cpass))
	}()

	return int(C._sqlite3_user_authenticate(c.db, cuser, cpass, C.int(len(password))))
}

// AuthUserAdd can be used (by an admin user only)
// to create a new user. When called on a no-authentication-required
// database, this routine converts the database into an authentication-
// required database, automatically makes the added user an
// administrator, and logs in the current connection as that user.
// The AuthUserAdd only works for the "main" database, not
// for any ATTACH-ed databases. Any call to AuthUserAdd by a
// non-admin user results in an error.
func (c *SQLiteConn) AuthUserAdd(username, password string, admin bool) error {
	isAdmin := 0
	if admin {
		isAdmin = 1
	}

	rv := c.authUserAdd(username, password, isAdmin)
	switch rv {
	case C.SQLITE_ERROR, C.SQLITE_AUTH:
		return ErrAdminRequired
	case C.SQLITE_OK:
		return nil
	default:
		return c.lastError()
	}
}

// authUserAdd enables the User Authentication if not enabled.
// Otherwise it will add a user.
//
// When user authentication is already enabled then this function
// can only be called by an admin.
//
// This is not exported for usage in Go.
// It is however exported for usage within SQL by the user.
//
// Returns:
//
//		C.SQLITE_OK (0)
//		C.SQLITE_ERROR (1)
//	 C.SQLITE_AUTH (23)
func (c *SQLiteConn) authUserAdd(username, password string, admin int) int {
	// Allocate C Variables
	cuser := C.CString(username)
	cpass := C.CString(password)

	// Free C Variables
	defer func() {
		C.free(unsafe.Pointer(cuser))
		C.free(unsafe.Pointer(cpass))
	}()

	return int(C._sqlite3_user_add(c.db, cuser, cpass, C.int(len(password)), C.int(admin)))
}

// AuthUserChange can be used to change a users
// login credentials or admin privilege.  Any user can change their own
// login credentials. Only an admin user can change another users login
// credentials or admin privilege setting. No user may change their own
// admin privilege setting.
func (c *SQLiteConn) AuthUserChange(username, password string, admin bool) error {
	isAdmin := 0
	if admin {
		isAdmin = 1
	}

	rv := c.authUserChange(username, password, isAdmin)
	switch rv {
	case C.SQLITE_ERROR, C.SQLITE_AUTH:
		return ErrAdminRequired
	case C.SQLITE_OK:
		return nil
	default:
		return c.lastError()
	}
}

// authUserChange allows to modify a user.
// Users can change their own password.
//
// Only admins can change passwords for other users
// and modify the admin flag.
//
// The admin flag of the current logged in user cannot be changed.
// THis ensures that their is always an admin.
//
// This is not exported for usage in Go.
// It is however exported for usage within SQL by the user.
//
// Returns:
//
//		C.SQLITE_OK (0)
//		C.SQLITE_ERROR (1)
//	 C.SQLITE_AUTH (23)
func (c *SQLiteConn) authUserChange(username, password string, admin int) int {
	// Allocate C Variables
	cuser := C.CString(username)
	cpass := C.CString(password)

	// Free C Variables
	defer func() {
		C.free(unsafe.Pointer(cuser))
		C.free(unsafe.Pointer(cpass))
	}()

	return int(C._sqlite3_user_change(c.db, cuser, cpass, C.int(len(password)), C.int(admin)))
}

// AuthUserDelete can be used (by an admin user only)
// to delete a user. The currently logged-in user cannot be deleted,
// which guarantees that there is always an admin user and hence that
// the database cannot be converted into a no-authentication-required
// database.
func (c *SQLiteConn) AuthUserDelete(username string) error {
	rv := c.authUserDelete(username)
	switch rv {
	case C.SQLITE_ERROR, C.SQLITE_AUTH:
		return ErrAdminRequired
	case C.SQLITE_OK:
		return nil
	default:
		return c.lastError()
	}
}

// authUserDelete can be used to delete a user.
//
// This function can only be executed by an admin.
//
// This is not exported for usage in Go.
// It is however exported for usage within SQL by the user.
//
// Returns:
//
//		C.SQLITE_OK (0)
//		C.SQLITE_ERROR (1)
//	 C.SQLITE_AUTH (23)
func (c *SQLiteConn) authUserDelete(username string) int {
	// Allocate C Variables
	cuser := C.CString(username)

	// Free C Variables
	defer func() {
		C.free(unsafe.Pointer(cuser))
	}()

	return int(C._sqlite3_user_delete(c.db, cuser))
}

// AuthEnabled checks if the database is protected by user authentication
func (c *SQLiteConn) AuthEnabled() (exists bool) {
	rv := c.authEnabled()
	if rv == 1 {
		exists = true
	}

	return
}

// authEnabled perform the actual check for user authentication.
//
// This is not exported for usage in Go.
// It is however exported for usage within SQL by the user.
//
// Returns:
//
//		0 - Disabled
//	 1 - Enabled
func (c *SQLiteConn) authEnabled() int {
	return int(C._sqlite3_auth_enabled(c.db))
}

// EOF
