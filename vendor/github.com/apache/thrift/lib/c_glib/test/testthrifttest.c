#include <assert.h>
#include <netdb.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>

#include "t_test_thrift_test_types.h"
#include "thrift_test_handler.h"

static const char TEST_ADDRESS[] = "localhost";
static const int TEST_PORT = 64444;

static void
test_thrift_server (void)
{
  ThriftServerSocket *tsocket = g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                                              "port", TEST_PORT, NULL);

  g_object_unref (tsocket);
}

static void
set_indicator (gpointer data, GObject *where_the_object_was) {
  THRIFT_UNUSED_VAR(where_the_object_was);

  *(gboolean *) data = TRUE;
}

static void
test_thrift_handler (void)
{
  GError *error;
  GHashTable *_return;
  TTestInsanity *argument;
  gboolean indicator;

  TTestXtruct  *xtruct,  *xtruct2;
  TTestNumberz numberz;
  TTestNumberz numberz2;
  TTestUserId user_id, *user_id_ptr, *user_id_ptr2;
  GHashTable *user_map;
  GPtrArray *xtructs;

  error = NULL;
  indicator = FALSE;

  user_map = NULL;
  xtructs = NULL;

  argument = g_object_new (T_TEST_TYPE_INSANITY, NULL);
  g_object_get (argument,
                "userMap", &user_map,
                "xtructs", &xtructs,
                NULL);

  numberz = T_TEST_NUMBERZ_FIVE;
  numberz2 = T_TEST_NUMBERZ_EIGHT;
  user_id_ptr = g_malloc (sizeof *user_id_ptr);
  *user_id_ptr = 5;
  user_id_ptr2 = g_malloc (sizeof *user_id_ptr);
  *user_id_ptr2 = 8;
  g_hash_table_insert (user_map, (gpointer)numberz, user_id_ptr);
  g_hash_table_insert (user_map, (gpointer)numberz2, user_id_ptr2);
  g_hash_table_unref (user_map);

  xtruct = g_object_new (T_TEST_TYPE_XTRUCT,
                         "string_thing", "Hello2",
                         "byte_thing",   2,
                         "i32_thing",    2,
                         "i64_thing",    2LL,
                         NULL);
  xtruct2 = g_object_new (T_TEST_TYPE_XTRUCT,
                          "string_thing", "Goodbye4",
                          "byte_thing",   4,
                          "i32_thing",    4,
                          "i64_thing",    4LL,
                          NULL);
  g_ptr_array_add (xtructs, xtruct2);
  g_ptr_array_add (xtructs, xtruct);
  g_ptr_array_unref (xtructs);

  _return = g_hash_table_new_full (g_int64_hash,
                                   g_int64_equal,
                                   g_free,
                                   (GDestroyNotify)g_hash_table_unref);

  g_object_weak_ref (G_OBJECT (argument), set_indicator, (gpointer) &indicator);

  assert (thrift_test_handler_test_insanity (NULL, &_return, argument, &error));
  assert (! indicator);

  g_hash_table_unref (_return);
  assert (! indicator);

  g_object_unref (argument);
  assert (indicator);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testthrift/Server", test_thrift_server);
  g_test_add_func ("/testthrift/Handler", test_thrift_handler);

  return g_test_run ();
}
