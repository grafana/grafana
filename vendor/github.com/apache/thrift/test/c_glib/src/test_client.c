/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include <glib-object.h>
#include <inttypes.h>
#include <signal.h>
#include <stdio.h>
#include <string.h>

#include <sys/time.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>
#include <thrift/c_glib/protocol/thrift_compact_protocol.h>
#include <thrift/c_glib/transport/thrift_buffered_transport.h>
#include <thrift/c_glib/transport/thrift_framed_transport.h>
#include <thrift/c_glib/transport/thrift_socket.h>
#include <thrift/c_glib/transport/thrift_transport.h>

#include "../gen-c_glib/t_test_thrift_test.h"

/* Handle SIGPIPE signals (indicating the server has closed the
   connection prematurely) by outputting an error message before
   exiting. */
static void
sigpipe_handler (int signal_number)
{
  THRIFT_UNUSED_VAR (signal_number);

  /* Flush standard output to make sure the test results so far are
     logged */
  fflush (stdout);

  fputs ("Broken pipe (server closed connection prematurely)\n", stderr);
  fflush (stderr);

  /* Re-raise the signal, this time invoking the default signal
     handler, to terminate the program */
  raise (SIGPIPE);
}

/* Compare two gint32 values. Used for sorting and finding integer
   values within a GList. */
static gint
gint32_compare (gconstpointer a, gconstpointer b)
{
  gint32 int32_a = *(gint32 *)a;
  gint32 int32_b = *(gint32 *)b;
  int result = 0;

  if (int32_a < int32_b)
    result = -1;
  else if (int32_a > int32_b)
    result = 1;

  return result;
}

int
main (int argc, char **argv)
{
  static gchar *host = NULL;
  static gint   port = 9090;
  static gchar *transport_option = NULL;
  static gchar *protocol_option = NULL;
  static gint   num_tests = 1;

  static
    GOptionEntry option_entries[] ={
    { "host",            0, 0, G_OPTION_ARG_STRING,   &host,
      "Host to connect (=localhost)", NULL },
    { "port",            0, 0, G_OPTION_ARG_INT,      &port,
      "Port number to connect (=9090)", NULL },
    { "transport",       0, 0, G_OPTION_ARG_STRING,   &transport_option,
      "Transport: buffered, framed (=buffered)", NULL },
    { "protocol",        0, 0, G_OPTION_ARG_STRING,   &protocol_option,
      "Protocol: binary, compact (=binary)", NULL },
    { "testloops",     'n', 0, G_OPTION_ARG_INT,      &num_tests,
      "Number of tests (=1)", NULL },
    { NULL }
  };

  struct sigaction sigpipe_action;

  GType  transport_type = THRIFT_TYPE_BUFFERED_TRANSPORT;
  gchar *transport_name = "buffered";
  GType  protocol_type  = THRIFT_TYPE_BINARY_PROTOCOL;
  gchar *protocol_name  = "binary";

  ThriftSocket    *socket;
  ThriftTransport *transport;
  ThriftProtocol  *protocol;

  TTestThriftTestIf *test_client;

  struct timeval time_start, time_stop, time_elapsed;
  guint64 time_elapsed_usec, time_total_usec = 0;
  guint64 time_min_usec = G_MAXUINT64, time_max_usec = 0, time_avg_usec;

  GOptionContext *option_context;
  gboolean options_valid = TRUE;
  int test_num = 0;
  int fail_count = 0;
  GError *error = NULL;

#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  /* Configure and parse our command-line options */
  option_context = g_option_context_new (NULL);
  g_option_context_add_main_entries (option_context,
                                     option_entries,
                                     NULL);
  if (!g_option_context_parse (option_context,
                               &argc,
                               &argv,
                               &error)) {
    fprintf (stderr, "%s\n", error->message);
    return 255;
  }
  g_option_context_free (option_context);

  /* Set remaining default values for unspecified options */
  if (host == NULL)
    host = g_strdup ("localhost");

  /* Validate the parsed options */
  if (protocol_option != NULL) {
    if (strncmp (protocol_option, "compact", 8) == 0) {
      protocol_type = THRIFT_TYPE_COMPACT_PROTOCOL;
      protocol_name = "compact";
    }
    else if (strncmp (protocol_option, "binary", 7) != 0) {
      fprintf (stderr, "Unknown protocol type %s\n", protocol_option);
      options_valid = FALSE;
    }
  }

  if (transport_option != NULL) {
    if (strncmp (transport_option, "framed", 7) == 0) {
      transport_type = THRIFT_TYPE_FRAMED_TRANSPORT;
      transport_name = "framed";
    }
    else if (strncmp (transport_option, "buffered", 9) != 0) {
      fprintf (stderr, "Unknown transport type %s\n", transport_option);
      options_valid = FALSE;
    }
  }

  if (!options_valid)
    return 254;

  printf ("Connecting (%s/%s) to: %s:%d\n",
          transport_name,
          protocol_name,
          host,
          port);

  /* Install our SIGPIPE handler, which outputs an error message to
     standard error before exiting so testers can know what
     happened */
  memset (&sigpipe_action, 0, sizeof (sigpipe_action));
  sigpipe_action.sa_handler = sigpipe_handler;
  sigpipe_action.sa_flags = SA_RESETHAND;
  sigaction (SIGPIPE, &sigpipe_action, NULL);

  /* Establish all our connection objects */
  socket = g_object_new (THRIFT_TYPE_SOCKET,
                         "hostname", host,
                         "port",     port,
                         NULL);
  transport = g_object_new (transport_type,
                            "transport", socket,
                            NULL);
  protocol = g_object_new (protocol_type,
                           "transport", transport,
                           NULL);
  test_client = g_object_new (T_TEST_TYPE_THRIFT_TEST_CLIENT,
                              "input_protocol",  protocol,
                              "output_protocol", protocol,
                              NULL);

  /* Execute the actual tests */
  for (test_num = 0; test_num < num_tests; ++test_num) {
    if (thrift_transport_open (transport, &error)) {
      gchar   *string  = NULL;
      gboolean boolean = 0;
      gint8    byte    = 0;
      gint32   int32   = 0;
      gint64   int64   = 0;
      gdouble  dub     = 0;

      gint byte_thing, i32_thing, inner_byte_thing, inner_i32_thing;
      gint64 i64_thing, inner_i64_thing;

      TTestXtruct  *xtruct_out,  *xtruct_out2, *xtruct_in,  *inner_xtruct_in;
      TTestXtruct2 *xtruct2_out, *xtruct2_in;

      GHashTable *map_out, *map_in, *inner_map_in;
      GHashTable *set_out, *set_in;
      gpointer key, value;
      gint32 *i32_key_ptr, *i32_value_ptr;
      GHashTableIter hash_table_iter, inner_hash_table_iter;
      GList *keys_out, *keys_in, *keys_elem;

      GArray *list_out, *list_in;

      TTestNumberz numberz;
      TTestNumberz numberz2;

      TTestUserId user_id, *user_id_ptr, *user_id_ptr2;

      TTestInsanity *insanity_out, *insanity_in;
      GHashTable *user_map;
      GHashTableIter user_map_iter;
      GPtrArray *xtructs;

      TTestXception  *xception  = NULL;
      TTestXception2 *xception2 = NULL;

      gboolean oneway_result;
      struct timeval oneway_start, oneway_end, oneway_elapsed;
      gint oneway_elapsed_usec;

      gboolean first;
      gint32 i, j;

      printf ("Test #%d, connect %s:%d\n", test_num + 1, host, port);
      gettimeofday (&time_start, NULL);

      /* These test routines have been ported from the C++ test
         client, care being taken to ensure their output remains as
         close as possible to the original to facilitate diffs.

         For simplicity comments have been omitted, but every routine
         has the same basic structure:

         - Create and populate data structures as necessary.

         - Format and output (to the console) a representation of the
           outgoing data.

         - Issue the remote method call to the server.

         - Format and output a representation of the returned data.

         - Verify the returned data matches what was expected.

         - Deallocate any created data structures.

         Note the recognized values and expected behaviour of each
         remote method are described in ThriftTest.thrift, which
         you'll find in the top-level "test" folder. */

      /**
       * VOID TEST
       */
      printf ("testVoid()");
      if (t_test_thrift_test_if_test_void (test_client, &error)) {
        printf (" = void\n");
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * STRING TEST
       */
      printf ("testString(\"Test\")");
      if (t_test_thrift_test_if_test_string (test_client,
                                             &string,
                                             "Test",
                                             &error)) {
        printf (" = \"%s\"\n", string);
        if (strncmp (string, "Test", 5) != 0)
          fail_count++;

        g_free (string);
        string = NULL;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * BOOL TEST
       */
      printf ("testByte(true)");
      if (t_test_thrift_test_if_test_bool (test_client,
                                           &boolean,
                                           1,
                                           &error)) {
        printf (" = %s\n", boolean ? "true" : "false");
        if (boolean != 1)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }
      printf ("testByte(false)");
      if (t_test_thrift_test_if_test_bool (test_client,
                                           &boolean,
                                           0,
                                           &error)) {
        printf (" = %s\n", boolean ? "true" : "false");
        if (boolean != 0)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * BYTE TEST
       */
      printf ("testByte(1)");
      if (t_test_thrift_test_if_test_byte (test_client,
                                           &byte,
                                           1,
                                           &error)) {
        printf (" = %d\n", byte);
        if (byte != 1)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }
      printf ("testByte(-1)");
      if (t_test_thrift_test_if_test_byte (test_client,
                                           &byte,
                                           -1,
                                           &error)) {
        printf (" = %d\n", byte);
        if (byte != -1)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * I32 TEST
       */
      printf ("testI32(-1)");
      if (t_test_thrift_test_if_test_i32 (test_client,
                                          &int32,
                                          -1,
                                          &error)) {
        printf (" = %d\n", int32);
        if (int32 != -1)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * I64 TEST
       */
      printf ("testI64(-34359738368)");
      if (t_test_thrift_test_if_test_i64 (test_client,
                                          &int64,
                                          (gint64)-34359738368,
                                          &error)) {
        printf (" = %" PRId64 "\n", int64);
        if (int64 != (gint64)-34359738368)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * DOUBLE TEST
       */
      printf("testDouble(-5.2098523)");
      if (t_test_thrift_test_if_test_double (test_client,
                                             &dub,
                                             -5.2098523,
                                             &error)) {
        printf (" = %f\n", dub);
        if ((dub - (-5.2098523)) > 0.001)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      // TODO: add testBinary() 	  
	  
      /**
       * STRUCT TEST
       */
      printf ("testStruct({\"Zero\", 1, -3, -5})");
      xtruct_out = g_object_new (T_TEST_TYPE_XTRUCT,
                                 "string_thing", "Zero",
                                 "byte_thing",        1,
                                 "i32_thing",        -3,
                                 "i64_thing",      -5LL,
                                 NULL);
      xtruct_in = g_object_new (T_TEST_TYPE_XTRUCT, NULL);

      if (t_test_thrift_test_if_test_struct (test_client,
                                             &xtruct_in,
                                             xtruct_out,
                                             &error)) {
        g_object_get (xtruct_in,
                      "string_thing", &string,
                      "byte_thing",   &byte_thing,
                      "i32_thing",    &i32_thing,
                      "i64_thing",    &i64_thing,
                      NULL);

        printf (" = {\"%s\", %d, %d, %" PRId64 "}\n",
                string,
                byte_thing,
                i32_thing,
                i64_thing);
        if ((string == NULL || strncmp (string, "Zero", 5) != 0) ||
            byte_thing != 1 ||
            i32_thing != -3 ||
            i64_thing != (gint64)-5)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }
      g_object_unref (xtruct_in);

      /**
       * NESTED STRUCT TEST
       */
      printf ("testNest({1, {\"Zero\", 1, -3, -5}), 5}");
      xtruct2_out = g_object_new (T_TEST_TYPE_XTRUCT2,
                                  "byte_thing",            1,
                                  "struct_thing", xtruct_out,
                                  "i32_thing",             5,
                                  NULL);
      xtruct2_in = g_object_new (T_TEST_TYPE_XTRUCT2, NULL);

      if (t_test_thrift_test_if_test_nest (test_client,
                                           &xtruct2_in,
                                           xtruct2_out,
                                           &error)) {
        g_object_get (xtruct2_in,
                      "byte_thing",   &byte_thing,
                      "struct_thing", &xtruct_in,
                      "i32_thing",    &i32_thing,
                      NULL);
        g_object_get (xtruct_in,
                      "string_thing", &string,
                      "byte_thing",   &inner_byte_thing,
                      "i32_thing",    &inner_i32_thing,
                      "i64_thing",    &inner_i64_thing,
                      NULL);

        printf (" = {%d, {\"%s\", %d, %d, %" PRId64 "}, %d}\n",
                byte_thing,
                string,
                inner_byte_thing,
                inner_i32_thing,
                inner_i64_thing,
                i32_thing);
        if (byte_thing != 1 ||
            (string == NULL || strncmp (string, "Zero", 5) != 0) ||
            inner_byte_thing != 1 ||
            inner_i32_thing != -3 ||
            inner_i64_thing != (gint64)-5 ||
            i32_thing != 5)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_object_unref (xtruct_in);
      g_object_unref (xtruct2_in);
      g_object_unref (xtruct2_out);
      g_object_unref (xtruct_out);

      /**
       * MAP TEST
       */
      map_out = g_hash_table_new_full (g_int_hash,
                                       g_int_equal,
                                       g_free,
                                       g_free);
      for (i = 0; i < 5; ++i) {
        i32_key_ptr   = g_malloc (sizeof *i32_key_ptr);
        i32_value_ptr = g_malloc (sizeof *i32_value_ptr);

        *i32_key_ptr   = i;
        *i32_value_ptr = i - 10;

        g_hash_table_insert (map_out, i32_key_ptr, i32_value_ptr);
      }
      printf ("testMap({");
      first = TRUE;
      g_hash_table_iter_init (&hash_table_iter, map_out);
      while (g_hash_table_iter_next (&hash_table_iter,
                                     &key,
                                     &value)) {
        if (first)
          first = FALSE;
        else
          printf (", ");

        printf ("%d => %d", *(gint32 *)key, *(gint32 *)value);
      }
      printf ("})");

      map_in = g_hash_table_new_full (g_int_hash,
                                      g_int_equal,
                                      g_free,
                                      g_free);

      if (t_test_thrift_test_if_test_map (test_client,
                                          &map_in,
                                          map_out,
                                          &error)) {
        printf (" = {");
        first = TRUE;
        g_hash_table_iter_init (&hash_table_iter, map_in);
        while (g_hash_table_iter_next (&hash_table_iter,
                                       &key,
                                       &value)) {
          if (first)
            first = FALSE;
          else
            printf (", ");

          printf ("%d => %d", *(gint32 *)key, *(gint32 *)value);
        }
        printf ("}\n");

        if (g_hash_table_size (map_in) != g_hash_table_size (map_out))
          fail_count++;
        else {
          g_hash_table_iter_init (&hash_table_iter, map_out);
          while (g_hash_table_iter_next (&hash_table_iter,
                                         &key,
                                         &value)) {
            gpointer in_value = g_hash_table_lookup (map_in, key);
            if (in_value == NULL ||
                *(gint32 *)in_value != *(gint32 *)value) {
              fail_count++;
              break;
            }
          }
        }
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_hash_table_unref (map_in);
      g_hash_table_unref (map_out);

      /**
       * STRING MAP TEST
       */
      map_out = g_hash_table_new_full (g_str_hash,
                                       g_str_equal,
                                       NULL,
                                       NULL);
      g_hash_table_insert (map_out, "a",    "2");
      g_hash_table_insert (map_out, "b",    "blah");
      g_hash_table_insert (map_out, "some", "thing");
      printf ("testStringMap({");
      first = TRUE;
      g_hash_table_iter_init (&hash_table_iter, map_out);
      while (g_hash_table_iter_next (&hash_table_iter,
                                     &key,
                                     &value)) {
        if (first)
          first = FALSE;
        else
          printf (", ");

        printf ("\"%s\" => \"%s\"", (gchar *)key, (gchar *)value);
      }
      printf (")}");

      map_in = g_hash_table_new_full (g_str_hash,
                                      g_str_equal,
                                      g_free,
                                      g_free);

      if (t_test_thrift_test_if_test_string_map (test_client,
                                                 &map_in,
                                                 map_out,
                                                 &error)) {
        printf (" = {");
        first = TRUE;
        g_hash_table_iter_init (&hash_table_iter, map_in);
        while (g_hash_table_iter_next (&hash_table_iter,
                                       &key,
                                       &value)) {
          if (first)
            first = FALSE;
          else
            printf (", ");

          printf ("\"%s\" => \"%s\"", (gchar *)key, (gchar *)value);
        }
        printf ("}\n");

        if (g_hash_table_size (map_in) != g_hash_table_size (map_out))
          fail_count++;
        else {
          g_hash_table_iter_init (&hash_table_iter, map_out);
          while (g_hash_table_iter_next (&hash_table_iter,
                                         &key,
                                         &value)) {
            gpointer in_value = g_hash_table_lookup (map_in, key);
            if (in_value == NULL ||
                strcmp ((gchar *)in_value, (gchar *)value) != 0) {
              fail_count++;
              break;
            }
          }
        }
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_hash_table_unref (map_in);
      g_hash_table_unref (map_out);

      /**
       * SET TEST
       */
      set_out = g_hash_table_new_full (g_int_hash, g_int_equal, g_free, NULL);
      for (i = -2; i < 3; ++i) {
        i32_key_ptr = g_malloc (sizeof *i32_key_ptr);
        *i32_key_ptr = i;

        g_hash_table_insert (set_out, i32_key_ptr, NULL);
      }
      printf ("testSet({");
      first = TRUE;
      keys_out = g_hash_table_get_keys (set_out);
      keys_elem = keys_out;
      while (keys_elem != NULL) {
        if (first)
          first = FALSE;
        else
          printf (", ");

        printf ("%d", *(gint32 *)keys_elem->data);

        keys_elem = keys_elem->next;
      }
      printf ("})");

      set_in = g_hash_table_new_full (g_int_hash, g_int_equal, g_free, NULL);

      if (t_test_thrift_test_if_test_set (test_client,
                                          &set_in,
                                          set_out,
                                          &error)) {
        printf(" = {");
        first = TRUE;
        keys_in = g_hash_table_get_keys (set_in);
        keys_elem = keys_in;
        while (keys_elem != NULL) {
          if (first)
            first = FALSE;
          else
            printf (", ");

          printf ("%d", *(gint32 *)keys_elem->data);

          keys_elem = keys_elem->next;
        }
        printf ("}\n");

        if (g_list_length (keys_in) != g_list_length (keys_out))
          fail_count++;
        else {
          keys_elem = keys_out;
          while (keys_elem != NULL) {
            if (g_list_find_custom (keys_in,
                                    keys_elem->data,
                                    gint32_compare) == NULL) {
              fail_count++;
              break;
            }

            keys_elem = keys_elem->next;
          }
        }

        g_list_free (keys_in);
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_hash_table_unref (set_in);
      g_list_free (keys_out);
      g_hash_table_unref (set_out);

      /**
       * LIST TEST
       */
      list_out = g_array_new (FALSE, TRUE, sizeof (gint32));
      for (i = -2; i < 3; ++i) {
        g_array_append_val (list_out, i);
      }
      printf ("testList({");
      first = TRUE;
      for (i = 0; i < (gint32)list_out->len; ++i) {
        if (first)
          first = FALSE;
        else
          printf (", ");

        printf ("%d", g_array_index (list_out, gint32, i));
      }
      printf ("})");

      list_in = g_array_new (FALSE, TRUE, sizeof (gint32));

      if (t_test_thrift_test_if_test_list (test_client,
                                           &list_in,
                                           list_out,
                                           &error)) {
        printf (" = {");
        first = TRUE;
        for (i = 0; i < (gint32)list_in->len; ++i) {
          if (first)
            first = FALSE;
          else
            printf (", ");

          printf ("%d", g_array_index (list_in, gint32, i));
        }
        printf ("}\n");

        if (list_in->len != list_out->len ||
            memcmp (list_in->data,
                    list_out->data,
                    list_in->len * sizeof (gint32)) != 0)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_array_unref (list_in);
      g_array_unref (list_out);

      /**
       * ENUM TEST
       */
      printf("testEnum(ONE)");
      if (t_test_thrift_test_if_test_enum (test_client,
                                           &numberz,
                                           T_TEST_NUMBERZ_ONE,
                                           &error)) {
        printf(" = %d\n", numberz);
        if (numberz != T_TEST_NUMBERZ_ONE)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      printf("testEnum(TWO)");
      if (t_test_thrift_test_if_test_enum (test_client,
                                           &numberz,
                                           T_TEST_NUMBERZ_TWO,
                                           &error)) {
        printf(" = %d\n", numberz);
        if (numberz != T_TEST_NUMBERZ_TWO)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      printf("testEnum(THREE)");
      if (t_test_thrift_test_if_test_enum (test_client,
                                           &numberz,
                                           T_TEST_NUMBERZ_THREE,
                                           &error)) {
        printf(" = %d\n", numberz);
        if (numberz != T_TEST_NUMBERZ_THREE)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      printf("testEnum(FIVE)");
      if (t_test_thrift_test_if_test_enum (test_client,
                                           &numberz,
                                           T_TEST_NUMBERZ_FIVE,
                                           &error)) {
        printf(" = %d\n", numberz);
        if (numberz != T_TEST_NUMBERZ_FIVE)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      printf("testEnum(EIGHT)");
      if (t_test_thrift_test_if_test_enum (test_client,
                                           &numberz,
                                           T_TEST_NUMBERZ_EIGHT,
                                           &error)) {
        printf(" = %d\n", numberz);
        if (numberz != T_TEST_NUMBERZ_EIGHT)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * TYPEDEF TEST
       */
      printf ("testTypedef(309858235082523)");
      if (t_test_thrift_test_if_test_typedef (test_client,
                                              &user_id,
                                              309858235082523LL,
                                              &error)) {
        printf(" = %" PRId64 "\n", user_id);
        if (user_id != 309858235082523LL)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * NESTED MAP TEST
       */
      printf ("testMapMap(1)");
      map_in = g_hash_table_new_full (g_int_hash,
                                      g_int_equal,
                                      g_free,
                                      (GDestroyNotify)g_hash_table_unref);
      if (t_test_thrift_test_if_test_map_map (test_client,
                                              &map_in,
                                              1,
                                              &error)) {
        g_hash_table_iter_init (&hash_table_iter, map_in);

        printf (" = {");
        while (g_hash_table_iter_next (&hash_table_iter,
                                       &key,
                                       &value)) {
          printf ("%d => {", *(gint32 *)key);

          g_hash_table_iter_init (&inner_hash_table_iter,
                                  (GHashTable *)value);
          while (g_hash_table_iter_next (&inner_hash_table_iter,
                                         &key,
                                         &value)) {
            printf ("%d => %d, ", *(gint32 *)key, *(gint32 *)value);
          }

          printf ("}, ");
        }
        printf ("}\n");

        if (g_hash_table_size (map_in) != 2)
          fail_count++;
        else {
          gint32 inner_keys[] = {1, 2, 3, 4};
          gint32 i32_key;

          i32_key = -4;
          inner_map_in = g_hash_table_lookup (map_in, &i32_key);
          if (inner_map_in == NULL ||
              g_hash_table_size (inner_map_in) != 4)
            fail_count++;
          else {
            keys_in = g_hash_table_get_keys (inner_map_in);
            keys_in = g_list_sort (keys_in, gint32_compare);

            for (i = 0; i < 4; i++) {
              keys_elem = g_list_nth (keys_in, 3 - i);

              if (*(gint32 *)keys_elem->data != (-1 * inner_keys[i]) ||
                  *(gint32 *)g_hash_table_lookup (inner_map_in,
                                                  keys_elem->data) !=
                  (-1 * inner_keys[i])) {
                fail_count++;
                break;
              }
            }

            g_list_free (keys_in);
          }

          i32_key = 4;
          inner_map_in = g_hash_table_lookup (map_in, &i32_key);
          if (inner_map_in == NULL ||
              g_hash_table_size (inner_map_in) != 4)
            fail_count++;
          else {
            keys_in = g_hash_table_get_keys (inner_map_in);
            keys_in = g_list_sort (keys_in, gint32_compare);

            for (i = 0; i < 4; i++) {
              keys_elem = g_list_nth (keys_in, i);

              if (*(gint32 *)keys_elem->data != inner_keys[i] ||
                  *(gint32 *)g_hash_table_lookup (inner_map_in,
                                                  keys_elem->data) !=
                  inner_keys[i]) {
                fail_count++;
                break;
              }
            }

            g_list_free (keys_in);
          }
        }
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_hash_table_unref (map_in);

      /**
       * INSANITY TEST
       */
      insanity_out = g_object_new (T_TEST_TYPE_INSANITY, NULL);
      g_object_get (insanity_out,
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

      xtruct_out = g_object_new (T_TEST_TYPE_XTRUCT,
                                 "string_thing", "Hello2",
                                 "byte_thing",   2,
                                 "i32_thing",    2,
                                 "i64_thing",    2LL,
                                 NULL);
      xtruct_out2 = g_object_new (T_TEST_TYPE_XTRUCT,
                                 "string_thing", "Goodbye4",
                                 "byte_thing",   4,
                                 "i32_thing",    4,
                                 "i64_thing",    4LL,
                                 NULL);
      g_ptr_array_add (xtructs, xtruct_out2);
      g_ptr_array_add (xtructs, xtruct_out);
      g_ptr_array_unref (xtructs);

      map_in = g_hash_table_new_full (g_int64_hash,
                                      g_int64_equal,
                                      g_free,
                                      (GDestroyNotify)g_hash_table_unref);

      printf("testInsanity()");
      if (t_test_thrift_test_if_test_insanity (test_client,
                                               &map_in,
                                               insanity_out,
                                               &error)) {
        printf (" = {");
        g_hash_table_iter_init (&hash_table_iter, map_in);
        while (g_hash_table_iter_next (&hash_table_iter,
                                       &key,
                                       &value)) {
          printf ("%" PRId64 " => {", *(TTestUserId *)key);

          g_hash_table_iter_init (&inner_hash_table_iter,
                                  (GHashTable *)value);
          while (g_hash_table_iter_next (&inner_hash_table_iter,
                                         &key,
                                         &value)) {
            printf ("%d => {", (TTestNumberz)key);

            g_object_get ((TTestInsanity *)value,
                          "userMap", &user_map,
                          "xtructs", &xtructs,
                          NULL);

            printf ("{");
            g_hash_table_iter_init (&user_map_iter, user_map);
            while (g_hash_table_iter_next (&user_map_iter,
                                           &key,
                                           &value)) {
              printf ("%d => %" PRId64 ", ",
                      (TTestNumberz)key,
                      *(TTestUserId *)value);
            }
            printf ("}, ");
            g_hash_table_unref (user_map);

            printf("{");
            for (i = 0; i < (gint32)xtructs->len; ++i) {
              xtruct_in = g_ptr_array_index (xtructs, i);
              g_object_get (xtruct_in,
                            "string_thing", &string,
                            "byte_thing",   &byte_thing,
                            "i32_thing",    &i32_thing,
                            "i64_thing",    &i64_thing,
                            NULL);

              printf ("{\"%s\", %d, %d, %" PRId64 "}, ",
                      string,
                      byte_thing,
                      i32_thing,
                      i64_thing);
            }
            printf ("}");
            g_ptr_array_unref (xtructs);

            printf ("}, ");
          }
          printf("}, ");
        }
        printf("}\n");

        if (g_hash_table_size (map_in) != 2)
          fail_count++;
        else {
          TTestNumberz numberz_key_values[] = {
            T_TEST_NUMBERZ_TWO, T_TEST_NUMBERZ_THREE
          };
          gint user_map_values[] = { 5, 8 };
          TTestUserId user_id_key;

          user_id_key = 1;
          inner_map_in = g_hash_table_lookup (map_in, &user_id_key);
          if (inner_map_in == NULL ||
              g_hash_table_size (inner_map_in) != 2)
            fail_count++;
          else {
            TTestNumberz numberz_key;

            for (i = 0; i < 2; ++i) {
              numberz_key = numberz_key_values[i];
              insanity_in =
                g_hash_table_lookup (inner_map_in,
                                     (gconstpointer)numberz_key);
              if (insanity_in == NULL)
                fail_count++;
              else {
                g_object_get (insanity_in,
                              "userMap", &user_map,
                              "xtructs", &xtructs,
                              NULL);

                if (user_map == NULL)
                  fail_count++;
                else {
                  if (g_hash_table_size (user_map) != 2)
                    fail_count++;
                  else {
                    for (j = 0; j < 2; ++j) {
                      numberz_key = (TTestNumberz)user_map_values[j];

                      value =
                        g_hash_table_lookup (user_map,
                                             (gconstpointer)numberz_key);
                      if (value == NULL ||
                          *(TTestUserId *)value != (TTestUserId)user_map_values[j])
                        fail_count++;
                    }
                  }

                  g_hash_table_unref (user_map);
                }

                if (xtructs == NULL)
                  fail_count++;
                else {
                  if (xtructs->len != 2)
                    fail_count++;
                  else {
                    xtruct_in = g_ptr_array_index (xtructs, 0);
                    g_object_get (xtruct_in,
                                  "string_thing", &string,
                                  "byte_thing",   &byte_thing,
                                  "i32_thing",    &i32_thing,
                                  "i64_thing",    &i64_thing,
                                  NULL);
                    if ((string == NULL ||
                         strncmp (string, "Goodbye4", 9) != 0) ||
                        byte_thing != 4 ||
                        i32_thing != 4 ||
                        i64_thing != 4)
                      fail_count++;

                    if (string != NULL)
                      g_free (string);

                    xtruct_in = g_ptr_array_index (xtructs, 1);
                    g_object_get (xtruct_in,
                                  "string_thing", &string,
                                  "byte_thing",   &byte_thing,
                                  "i32_thing",    &i32_thing,
                                  "i64_thing",    &i64_thing,
                                  NULL);
                    if ((string == NULL ||
                         strncmp (string, "Hello2", 7) != 0) ||
                        byte_thing != 2 ||
                        i32_thing != 2 ||
                        i64_thing != 2)
                      fail_count++;

                    if (string != NULL)
                      g_free (string);
                  }

                  g_ptr_array_unref (xtructs);
                }
              }
            }
          }

          user_id_key = 2;
          inner_map_in = g_hash_table_lookup (map_in, &user_id_key);
          if (inner_map_in == NULL ||
              g_hash_table_size (inner_map_in) != 1)
            fail_count++;
          else {
            insanity_in =
              g_hash_table_lookup (inner_map_in,
                                   (gconstpointer)T_TEST_NUMBERZ_SIX);
            if (insanity_in == NULL)
              fail_count++;
            else {
              g_object_get (insanity_in,
                            "userMap", &user_map,
                            "xtructs", &xtructs,
                            NULL);

              if (user_map == NULL)
                fail_count++;
              else {
                if (g_hash_table_size (user_map) != 0)
                  fail_count++;

                g_hash_table_unref (user_map);
              }

              if (xtructs == NULL)
                fail_count++;
              else {
                if (xtructs->len != 0)
                  fail_count++;

                g_ptr_array_unref (xtructs);
              }
            }
          }
        }
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      g_hash_table_unref (map_in);
      g_object_unref (insanity_out);

      /* test exception */
      printf ("testClient.testException(\"Xception\") =>");
      if (!t_test_thrift_test_if_test_exception (test_client,
                                                 "Xception",
                                                 &xception,
                                                 &error) &&
          xception != NULL) {
        g_object_get (xception,
                      "errorCode", &int32,
                      "message",   &string,
                      NULL);
        printf ("  {%u, \"%s\"}\n", int32, string);
        g_free (string);

        g_object_unref (xception);
        xception = NULL;

        g_error_free (error);
        error = NULL;
      }
      else {
        printf ("  void\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        if (error != NULL) {
          g_error_free (error);
          error = NULL;
        }
      }

      printf ("testClient.testException(\"TException\") =>");
      if (!t_test_thrift_test_if_test_exception (test_client,
                                                 "TException",
                                                 &xception,
                                                 &error) &&
          xception == NULL &&
          error != NULL) {
        printf ("  Caught TException\n");

        g_error_free (error);
        error = NULL;
      }
      else {
        printf ("  void\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        if (error != NULL) {
          g_error_free (error);
          error = NULL;
        }
      }

      printf ("testClient.testException(\"success\") =>");
      if (t_test_thrift_test_if_test_exception (test_client,
                                                "success",
                                                &xception,
                                                &error))
        printf ("  void\n");
      else {
        printf ("  void\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        g_error_free (error);
        error = NULL;
      }

      g_assert (error == NULL);

      /* test multi exception */
      printf ("testClient.testMultiException(\"Xception\", \"test 1\") =>");
      xtruct_in = g_object_new (T_TEST_TYPE_XTRUCT, NULL);
      if (!t_test_thrift_test_if_test_multi_exception (test_client,
                                                       &xtruct_in,
                                                       "Xception",
                                                       "test 1",
                                                       &xception,
                                                       &xception2,
                                                       &error) &&
          xception != NULL &&
          xception2 == NULL) {
        g_object_get (xception,
                      "errorCode", &int32,
                      "message",   &string,
                      NULL);
        printf ("  {%u, \"%s\"}\n", int32, string);
        g_free (string);

        g_object_unref (xception);
        xception = NULL;

        g_error_free (error);
        error = NULL;
      }
      else {
        printf ("  result\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        if (xception2 != NULL) {
          g_object_unref (xception2);
          xception = NULL;
        }

        if (error != NULL) {
          g_error_free (error);
          error = NULL;
        }
      }
      g_object_unref (xtruct_in);

      printf ("testClient.testMultiException(\"Xception2\", \"test 2\") =>");
      xtruct_in = g_object_new (T_TEST_TYPE_XTRUCT, NULL);
      if (!t_test_thrift_test_if_test_multi_exception (test_client,
                                                       &xtruct_in,
                                                       "Xception2",
                                                       "test 2",
                                                       &xception,
                                                       &xception2,
                                                       &error) &&
          xception == NULL &&
          xception2 != NULL) {
        g_object_get (xception2,
                      "errorCode",    &int32,
                      "struct_thing", &inner_xtruct_in,
                      NULL);
        g_object_get (inner_xtruct_in,
                      "string_thing", &string,
                      NULL);
        printf ("  {%u, {\"%s\"}}\n", int32, string);
        g_free (string);

        g_object_unref (inner_xtruct_in);
        inner_xtruct_in = NULL;

        g_object_unref (xception2);
        xception2 = NULL;

        g_error_free (error);
        error = NULL;
      }
      else {
        printf ("  result\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        if (xception2 != NULL) {
          g_object_unref (xception2);
          xception = NULL;
        }

        if (error != NULL) {
          g_error_free (error);
          error = NULL;
        }
      }
      g_object_unref (xtruct_in);

      printf ("testClient.testMultiException(\"success\", \"test 3\") =>");
      xtruct_in = g_object_new (T_TEST_TYPE_XTRUCT, NULL);
      if (t_test_thrift_test_if_test_multi_exception (test_client,
                                                      &xtruct_in,
                                                      "success",
                                                      "test 3",
                                                      &xception,
                                                      &xception2,
                                                      &error) &&
          xception == NULL &&
          xception2 == NULL) {
        g_object_get (xtruct_in,
                      "string_thing", &string,
                      NULL);
        printf ("  {{\"%s\"}}\n", string);
        g_free (string);
      }
      else {
        printf ("  result\nFAILURE\n");
        fail_count++;

        if (xception != NULL) {
          g_object_unref (xception);
          xception = NULL;
        }

        if (xception2 != NULL) {
          g_object_unref (xception2);
          xception = NULL;
        }

        if (error != NULL) {
          g_error_free (error);
          error = NULL;
        }
      }
      g_object_unref (xtruct_in);

      /* test oneway void */
      printf ("testClient.testOneway(1) =>");
      gettimeofday (&oneway_start, NULL);
      oneway_result = t_test_thrift_test_if_test_oneway (test_client,
                                                         1,
                                                         &error);
      gettimeofday (&oneway_end, NULL);
      timersub (&oneway_end, &oneway_start, &oneway_elapsed);
      oneway_elapsed_usec =
        oneway_elapsed.tv_sec * 1000 * 1000 + oneway_elapsed.tv_usec;

      if (oneway_result) {
        if (oneway_elapsed_usec > 200 * 1000) {
          printf ("  FAILURE - took %.2f ms\n",
                  (double)oneway_elapsed_usec / 1000.0);
          fail_count++;
        }
        else
          printf ("  success - took %.2f ms\n",
                  (double)oneway_elapsed_usec / 1000.0);
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      /**
       * redo a simple test after the oneway to make sure we aren't "off by
       * one" -- if the server treated oneway void like normal void, this next
       * test will fail since it will get the void confirmation rather than
       * the correct result. In this circumstance, the client will receive the
       * error:
       *
       *   application error: Wrong method name
       */
      /**
       * I32 TEST
       */
      printf ("re-test testI32(-1)");
      if (t_test_thrift_test_if_test_i32 (test_client,
                                          &int32,
                                          -1,
                                          &error)) {
        printf (" = %d\n", int32);
        if (int32 != -1)
          fail_count++;
      }
      else {
        printf ("%s\n", error->message);
        g_error_free (error);
        error = NULL;

        fail_count++;
      }

      gettimeofday (&time_stop, NULL);
      timersub (&time_stop, &time_start, &time_elapsed);
      time_elapsed_usec =
        time_elapsed.tv_sec * 1000 * 1000 + time_elapsed.tv_usec;

      printf("Total time: %" PRIu64 " us\n", time_elapsed_usec);

      time_total_usec += time_elapsed_usec;
      if (time_elapsed_usec < time_min_usec)
        time_min_usec = time_elapsed_usec;
      if (time_elapsed_usec > time_max_usec)
        time_max_usec = time_elapsed_usec;

      thrift_transport_close (transport, &error);
    }
    else {
      printf ("Connect failed: %s\n", error->message);
      g_error_free (error);
      error = NULL;

      return 1;
    }
  }

  /* All done---output statistics */
  puts ("\nAll tests done.");

  time_avg_usec = time_total_usec / num_tests;

  printf ("Min time: %" PRIu64 " us\n", time_min_usec);
  printf ("Max time: %" PRIu64 " us\n", time_max_usec);
  printf ("Avg time: %" PRIu64 " us\n", time_avg_usec);

  g_object_unref (test_client);
  g_object_unref (protocol);
  g_object_unref (transport);
  g_free (host);

  return fail_count;
}
