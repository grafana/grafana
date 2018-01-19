#include <pcre.h>
#include <string.h>
#include <stdio.h>
#include <sqlite3ext.h>

SQLITE_EXTENSION_INIT1
static void regexp_func(sqlite3_context *context, int argc, sqlite3_value **argv) {
  if (argc >= 2) {
    const char *target  = (const char *)sqlite3_value_text(argv[1]);
    const char *pattern = (const char *)sqlite3_value_text(argv[0]);
    const char* errstr = NULL;
    int erroff = 0;
    int vec[500];
    int n, rc;
    pcre* re = pcre_compile(pattern, 0, &errstr, &erroff, NULL);
    rc = pcre_exec(re, NULL, target, strlen(target), 0, 0, vec, 500); 
    if (rc <= 0) {
      sqlite3_result_error(context, errstr, 0);
      return;
    }
    sqlite3_result_int(context, 1);
  }
}

#ifdef _WIN32
__declspec(dllexport)
#endif
int sqlite3_extension_init(sqlite3 *db, char **errmsg, const sqlite3_api_routines *api) {
  SQLITE_EXTENSION_INIT2(api);
  return sqlite3_create_function(db, "regexp", 2, SQLITE_UTF8, (void*)db, regexp_func, NULL, NULL);
}
