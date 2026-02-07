// Copyright (C) 2018 Yasuhiro Matsumoto <mattn.jp@gmail.com>.
//
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

#ifdef SQLITE_ENABLE_UNLOCK_NOTIFY
#include <stdio.h>
#ifndef USE_LIBSQLITE3
#include "sqlite3-binding.h"
#else
#include <sqlite3.h>
#endif

extern int unlock_notify_wait(sqlite3 *db);

int
_sqlite3_step_blocking(sqlite3_stmt *stmt)
{
  int rv;
  sqlite3* db;

  db = sqlite3_db_handle(stmt);
  for (;;) {
    rv = sqlite3_step(stmt);
    if (rv != SQLITE_LOCKED) {
      break;
    }
    if (sqlite3_extended_errcode(db) != SQLITE_LOCKED_SHAREDCACHE) {
      break;
    }
    rv = unlock_notify_wait(db);
    if (rv != SQLITE_OK) {
      break;
    }
    sqlite3_reset(stmt);
  }

  return rv;
}

int
_sqlite3_step_row_blocking(sqlite3_stmt* stmt, long long* rowid, long long* changes)
{
  int rv;
  sqlite3* db;

  db = sqlite3_db_handle(stmt);
  for (;;) {
    rv = sqlite3_step(stmt);
    if (rv!=SQLITE_LOCKED) {
      break;
    }
    if (sqlite3_extended_errcode(db) != SQLITE_LOCKED_SHAREDCACHE) {
      break;
    }
    rv = unlock_notify_wait(db);
    if (rv != SQLITE_OK) {
      break;
    }
    sqlite3_reset(stmt);
  }

  *rowid = (long long) sqlite3_last_insert_rowid(db);
  *changes = (long long) sqlite3_changes(db);
  return rv;
}

int
_sqlite3_prepare_v2_blocking(sqlite3 *db, const char *zSql, int nBytes, sqlite3_stmt **ppStmt, const char **pzTail)
{
  int rv;

  for (;;) {
    rv = sqlite3_prepare_v2(db, zSql, nBytes, ppStmt, pzTail);
    if (rv!=SQLITE_LOCKED) {
      break;
    }
    if (sqlite3_extended_errcode(db) != SQLITE_LOCKED_SHAREDCACHE) {
      break;
    }
    rv = unlock_notify_wait(db);
    if (rv != SQLITE_OK) {
      break;
    }
  }

  return rv;
}
#endif
