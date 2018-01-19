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

#include <inttypes.h>
#include <string.h>
#include <unistd.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/thrift_application_exception.h>

#include "thrift_test_handler.h"

/* A handler that implements the TTestThriftTestIf interface */

G_DEFINE_TYPE (ThriftTestHandler,
               thrift_test_handler,
               T_TEST_TYPE_THRIFT_TEST_HANDLER);

gboolean
thrift_test_handler_test_void (TTestThriftTestIf  *iface,
                               GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testVoid()\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_string (TTestThriftTestIf  *iface,
                                 gchar             **_return,
                                 const gchar        *thing,
                                 GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testString(\"%s\")\n", thing);
  *_return = g_strdup (thing);

  return TRUE;
}

gboolean
thrift_test_handler_test_bool (TTestThriftTestIf  *iface,
                               gboolean           *_return,
                               const gboolean      thing,
                               GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testBool(%s)\n", thing ? "true" : "false");
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_byte (TTestThriftTestIf  *iface,
                               gint8              *_return,
                               const gint8         thing,
                               GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testByte(%d)\n", (gint)thing);
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_i32 (TTestThriftTestIf  *iface,
                              gint32             *_return,
                              const gint32        thing,
                              GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testI32(%d)\n", thing);
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_i64 (TTestThriftTestIf  *iface,
                              gint64             *_return,
                              const gint64        thing,
                              GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testI64(%" PRId64 ")\n", thing);
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_double (TTestThriftTestIf  *iface,
                                 gdouble            *_return,
                                 const gdouble       thing,
                                 GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testDouble(%f)\n", thing);
  *_return = thing;

  return TRUE;
}

gboolean 
thrift_test_handler_test_binary (TTestThriftTestIf *iface,
                                 GByteArray ** _return,
                                 const GByteArray * thing,
                                 GError **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testBinary()\n");  // TODO: hex output
  g_byte_array_ref((GByteArray *)thing);
  *_return = (GByteArray *)thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_struct (TTestThriftTestIf  *iface,
                                 TTestXtruct       **_return,
                                 const TTestXtruct  *thing,
                                 GError            **error)
{
  gchar *string_thing = NULL;
  gint   byte_thing;
  gint   i32_thing;
  gint64 i64_thing;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  g_object_get ((TTestXtruct *)thing,
                "string_thing", &string_thing,
                "byte_thing",   &byte_thing,
                "i32_thing",    &i32_thing,
                "i64_thing",    &i64_thing,
                NULL);

  printf ("testStruct({\"%s\", %d, %d, %" PRId64 "})\n",
          string_thing,
          (gint)byte_thing,
          i32_thing,
          i64_thing);

  g_object_set (*_return,
                "string_thing", string_thing,
                "byte_thing",   byte_thing,
                "i32_thing",    i32_thing,
                "i64_thing",    i64_thing,
                NULL);

  if (string_thing != NULL)
    g_free (string_thing);

  return TRUE;
}

gboolean
thrift_test_handler_test_nest (TTestThriftTestIf   *iface,
                               TTestXtruct2       **_return,
                               const TTestXtruct2  *thing,
                               GError             **error)
{
  gchar *inner_string_thing = NULL;
  gint   byte_thing, inner_byte_thing;
  gint   i32_thing, inner_i32_thing;
  gint64 inner_i64_thing;
  TTestXtruct *struct_thing;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  g_object_get ((TTestXtruct2 *)thing,
                "byte_thing",   &byte_thing,
                "struct_thing", &struct_thing,
                "i32_thing",    &i32_thing,
                NULL);
  g_object_get (struct_thing,
                "string_thing", &inner_string_thing,
                "byte_thing",   &inner_byte_thing,
                "i32_thing",    &inner_i32_thing,
                "i64_thing",    &inner_i64_thing,
                NULL);

  printf ("testNest({%d, {\"%s\", %d, %d, %" PRId64 "}, %d})\n",
          byte_thing,
          inner_string_thing,
          inner_byte_thing,
          inner_i32_thing,
          inner_i64_thing,
          i32_thing);

  g_object_set (*_return,
                "byte_thing",   byte_thing,
                "struct_thing", struct_thing,
                "i32_thing",    i32_thing,
                NULL);

  if (inner_string_thing != NULL)
    g_free (inner_string_thing);
  g_object_unref (struct_thing);

  return TRUE;
}

gboolean
thrift_test_handler_test_map (TTestThriftTestIf  *iface,
                              GHashTable        **_return,
                              const GHashTable   *thing,
                              GError            **error)
{
  GHashTableIter hash_table_iter;
  gpointer key;
  gpointer value;
  gboolean first = TRUE;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testMap({");
  g_hash_table_iter_init (&hash_table_iter, (GHashTable *)thing);
  while (g_hash_table_iter_next (&hash_table_iter,
                                 &key,
                                 &value)) {
    gint32 *new_key;
    gint32 *new_value;

    if (first)
      first = FALSE;
    else
      printf (", ");

    printf ("%d => %d", *(gint32 *)key, *(gint32 *)value);

    new_key = g_malloc (sizeof *new_key);
    *new_key = *(gint32 *)key;
    new_value = g_malloc (sizeof *new_value);
    *new_value = *(gint32 *)value;
    g_hash_table_insert (*_return, new_key, new_value);
  }
  printf ("})\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_string_map (TTestThriftTestIf  *iface,
                                     GHashTable        **_return,
                                     const GHashTable   *thing,
                                     GError            **error)
{
  GHashTableIter hash_table_iter;
  gpointer key;
  gpointer value;
  gboolean first = TRUE;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testStringMap({");
  g_hash_table_iter_init (&hash_table_iter, (GHashTable *)thing);
  while (g_hash_table_iter_next (&hash_table_iter,
                                 &key,
                                 &value)) {
    gchar *new_key;
    gchar *new_value;

    if (first)
      first = FALSE;
    else
      printf (", ");

    printf ("%s => %s", (gchar *)key, (gchar *)value);

    new_key = g_strdup ((gchar *)key);
    new_value = g_strdup ((gchar *)value);
    g_hash_table_insert (*_return, new_key, new_value);
  }
  printf ("})\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_set (TTestThriftTestIf  *iface,
                              GHashTable        **_return,
                              const GHashTable   *thing,
                              GError            **error)
{
  GHashTableIter hash_table_iter;
  gpointer key;
  gboolean first = TRUE;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testSet({");
  g_hash_table_iter_init (&hash_table_iter, (GHashTable *)thing);
  while (g_hash_table_iter_next (&hash_table_iter,
                                 &key,
                                 NULL)) {
    gint32 *new_key;

    if (first)
      first = FALSE;
    else
      printf (", ");

    printf ("%d", *(gint32 *)key);

    new_key = g_malloc (sizeof *new_key);
    *new_key = *(gint32 *)key;
    g_hash_table_insert (*_return, new_key, NULL);
  }
  printf ("})\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_list (TTestThriftTestIf  *iface,
                               GArray            **_return,
                               const GArray       *thing,
                               GError            **error)
{
  guint i;
  gboolean first = TRUE;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testList({");
  for (i = 0; i < thing->len; i += 1) {
    gint32 value;
    gint32 *new_value;

    if (first)
      first = FALSE;
    else
      printf (", ");

    value = g_array_index (thing, gint32, i);
    printf ("%d", value);

    new_value = g_malloc (sizeof *new_value);
    *new_value = value;
    g_array_append_val (*_return, *new_value);
  }
  printf ("})\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_enum (TTestThriftTestIf   *iface,
                               TTestNumberz        *_return,
                               const TTestNumberz   thing,
                               GError             **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testEnum(%d)\n", thing);
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_typedef (TTestThriftTestIf  *iface,
                                  TTestUserId        *_return,
                                  const TTestUserId   thing,
                                  GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testTypedef(%" PRId64 ")\n", thing);
  *_return = thing;

  return TRUE;
}

gboolean
thrift_test_handler_test_map_map (TTestThriftTestIf  *iface,
                                  GHashTable        **_return,
                                  const gint32        hello,
                                  GError            **error)
{
  GHashTable *positive;
  GHashTable *negative;
  gint32 *key;
  gint32 *value;
  guint i;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testMapMap(%d)\n", hello);

  positive = g_hash_table_new_full (g_int_hash,
                                    g_int_equal,
                                    g_free,
                                    g_free);
  negative = g_hash_table_new_full (g_int_hash,
                                    g_int_equal,
                                    g_free,
                                    g_free);

  for (i = 1; i < 5; i += 1) {
    key = g_malloc (sizeof *key);
    value = g_malloc (sizeof *value);
    *key = i;
    *value = i;
    g_hash_table_insert (positive, key, value);

    key = g_malloc (sizeof *key);
    value = g_malloc (sizeof *value);
    *key = -i;
    *value = -i;
    g_hash_table_insert (negative, key, value);
  }

  key = g_malloc (sizeof *key);
  *key = 4;
  g_hash_table_insert (*_return, key, positive);

  key = g_malloc (sizeof *key);
  *key = -4;
  g_hash_table_insert (*_return, key, negative);

  return TRUE;
}

gboolean
thrift_test_handler_test_insanity (TTestThriftTestIf    *iface,
                                   GHashTable          **_return,
                                   const TTestInsanity  *argument,
                                   GError              **error)
{
  TTestXtruct *xtruct_in;

  gchar *string_thing = NULL;
  gint   byte_thing;
  gint   i32_thing;
  gint64 i64_thing;

  GPtrArray *xtructs;

  TTestInsanity *looney;

  GHashTable *user_map;
  GHashTable *first_map;
  GHashTable *second_map;

  GHashTableIter hash_table_iter;
  GHashTableIter inner_hash_table_iter;
  GHashTableIter user_map_iter;

  gpointer key;
  gpointer value;

  TTestUserId *user_id;

  guint i;

  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testInsanity()\n");

  first_map = g_hash_table_new_full (g_direct_hash,
                                     g_direct_equal,
                                     NULL,
                                     g_object_unref);
  second_map = g_hash_table_new_full (g_direct_hash,
                                      g_direct_equal,
                                      NULL,
                                      g_object_unref);

  g_hash_table_insert (first_map,
                       GINT_TO_POINTER (T_TEST_NUMBERZ_TWO),
                       (gpointer)argument);
  g_hash_table_insert (first_map,
                       GINT_TO_POINTER (T_TEST_NUMBERZ_THREE),
                       (gpointer)argument);

  /* Increment argument's ref count by two because first_map now holds
     two references to it and the caller is not aware we have made any
     additional references to argument.  (That is, caller owns argument
     and will unref it explicitly in addition to unref-ing *_return.)

     We do this instead of creating a copy of argument in order to mimic
     the C++ implementation (and since, frankly, the world needs less
     argument, not more). */
  g_object_ref ((gpointer)argument);
  g_object_ref ((gpointer)argument);

  looney = g_object_new (T_TEST_TYPE_INSANITY, NULL);
  g_hash_table_insert (second_map,
                       GINT_TO_POINTER (T_TEST_NUMBERZ_SIX),
                       looney);

  user_id = g_malloc (sizeof *user_id);
  *user_id = 1;
  g_hash_table_insert (*_return, user_id, first_map);

  user_id = g_malloc (sizeof *user_id);
  *user_id = 2;
  g_hash_table_insert (*_return, user_id, second_map);

  printf ("return");
  printf (" = {");
  g_hash_table_iter_init (&hash_table_iter, *_return);
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

      printf ("{");
      for (i = 0; i < xtructs->len; ++i) {
        xtruct_in = g_ptr_array_index (xtructs, i);
        g_object_get (xtruct_in,
                      "string_thing", &string_thing,
                      "byte_thing",   &byte_thing,
                      "i32_thing",    &i32_thing,
                      "i64_thing",    &i64_thing,
                      NULL);

        printf ("{\"%s\", %d, %d, %" PRId64 "}, ",
                string_thing,
                byte_thing,
                i32_thing,
                i64_thing);
      }
      printf ("}");
      g_ptr_array_unref (xtructs);

      printf ("}, ");
    }
    printf ("}, ");
  }
  printf ("}\n");

  return TRUE;
}

gboolean
thrift_test_handler_test_multi (TTestThriftTestIf   *iface,
                                TTestXtruct        **_return,
                                const gint8          arg0,
                                const gint32         arg1,
                                const gint64         arg2,
                                const GHashTable    *arg3,
                                const TTestNumberz   arg4,
                                const TTestUserId    arg5,
                                GError             **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);
  THRIFT_UNUSED_VAR (arg3);
  THRIFT_UNUSED_VAR (arg4);
  THRIFT_UNUSED_VAR (arg5);

  printf ("testMulti()\n");

  g_object_set (*_return,
                "string_thing", g_strdup ("Hello2"),
                "byte_thing",   arg0,
                "i32_thing",    arg1,
                "i64_thing",    arg2,
                NULL);

  return TRUE;
}

gboolean
thrift_test_handler_test_exception (TTestThriftTestIf  *iface,
                                    const gchar        *arg,
                                    TTestXception     **err1,
                                    GError            **error)
{
  THRIFT_UNUSED_VAR (iface);

  TTestXtruct *xtruct;
  gboolean result;

  printf ("testException(%s)\n", arg);

  /* Unlike argument objects, exception objects are not pre-created */
  g_assert (*err1 == NULL);

  if (strncmp (arg, "Xception", 9) == 0) {
    /* "Throw" a custom exception: Set the corresponding exception
       argument, set *error to NULL and return FALSE */
    *err1 = g_object_new (T_TEST_TYPE_XCEPTION,
                          "errorCode", 1001,
                          "message",   g_strdup (arg),
                          NULL);
    *error = NULL;
    result = FALSE;
  }
  else if (strncmp (arg, "TException", 11) == 0) {
    /* "Throw" a generic TException (ThriftApplicationException): Set
       all exception arguments to NULL, set *error and return FALSE */
    *err1 = NULL;
    g_set_error (error,
                 thrift_application_exception_error_quark (),
                 THRIFT_APPLICATION_EXCEPTION_ERROR_UNKNOWN,
                 "Default TException.");
    result = FALSE;
  }
  else {
    *err1 = NULL;
    *error = NULL;

    /* This code is duplicated from the C++ test suite, though it
       appears to serve no purpose */
    xtruct = g_object_new (T_TEST_TYPE_XTRUCT,
                           "string_thing", g_strdup (arg),
                           NULL);
    g_object_unref (xtruct);

    result = TRUE;
  }

  return result;
}

gboolean
thrift_test_handler_test_multi_exception (TTestThriftTestIf  *iface,
                                          TTestXtruct       **_return,
                                          const gchar        *arg0,
                                          const gchar        *arg1,
                                          TTestXception     **err1,
                                          TTestXception2    **err2,
                                          GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  TTestXtruct *struct_thing;
  gboolean result;

  printf ("testMultiException(%s, %s)\n", arg0, arg1);

  g_assert (*err1 == NULL);
  g_assert (*err2 == NULL);

  if (strncmp (arg0, "Xception", 8) == 0 && strlen(arg0) == 8) {
    *err1 = g_object_new (T_TEST_TYPE_XCEPTION,
                          "errorCode", 1001,
                          "message",   g_strdup ("This is an Xception"),
                          NULL);
    result = FALSE;
  }
  else if (strncmp (arg0, "Xception2", 9) == 0) {
    *err2 = g_object_new (T_TEST_TYPE_XCEPTION2,
                          "errorCode", 2002,
                          NULL);

    g_object_get (*err2,
                  "struct_thing", &struct_thing,
                  NULL);
    g_object_set (struct_thing,
                  "string_thing", g_strdup ("This is an Xception2"),
                  NULL);
    g_object_set (*err2,
                  "struct_thing", struct_thing,
                  NULL);
    g_object_unref (struct_thing);

    result = FALSE;
  }
  else {
    g_object_set (*_return,
                  "string_thing", g_strdup (arg1),
                  NULL);
    result = TRUE;
  }

  return result;
}

gboolean
thrift_test_handler_test_oneway (TTestThriftTestIf  *iface,
                                 const gint32        secondsToSleep,
                                 GError            **error)
{
  THRIFT_UNUSED_VAR (iface);
  THRIFT_UNUSED_VAR (error);

  printf ("testOneway(%d): Sleeping...\n", secondsToSleep);
  sleep (secondsToSleep);
  printf ("testOneway(%d): done sleeping!\n", secondsToSleep);

  return TRUE;
}

static void
thrift_test_handler_init (ThriftTestHandler *self)
{
  THRIFT_UNUSED_VAR (self);
}

static void
thrift_test_handler_class_init (ThriftTestHandlerClass *klass)
{
  TTestThriftTestHandlerClass *base_class =
    T_TEST_THRIFT_TEST_HANDLER_CLASS (klass);

  base_class->test_void =
    klass->test_void =
    thrift_test_handler_test_void;
  base_class->test_string =
    klass->test_string =
    thrift_test_handler_test_string;
  base_class->test_bool =
    klass->test_bool =
    thrift_test_handler_test_bool;
  base_class->test_byte =
    klass->test_byte =
    thrift_test_handler_test_byte;
  base_class->test_i32 =
    klass->test_i32 =
    thrift_test_handler_test_i32;
  base_class->test_i64 =
    klass->test_i64 =
    thrift_test_handler_test_i64;
  base_class->test_double =
    klass->test_double =
    thrift_test_handler_test_double;
  base_class->test_binary =
    klass->test_binary =
    thrift_test_handler_test_binary;
  base_class->test_struct =
    klass->test_struct =
    thrift_test_handler_test_struct;
  base_class->test_nest =
    klass->test_nest =
    thrift_test_handler_test_nest;
  base_class->test_map =
    klass->test_map =
    thrift_test_handler_test_map;
  base_class->test_string_map =
    klass->test_string_map =
    thrift_test_handler_test_string_map;
  base_class->test_set =
    klass->test_set =
    thrift_test_handler_test_set;
  base_class->test_list =
    klass->test_list =
    thrift_test_handler_test_list;
  base_class->test_enum =
    klass->test_enum =
    thrift_test_handler_test_enum;
  base_class->test_typedef =
    klass->test_typedef =
    thrift_test_handler_test_typedef;
  base_class->test_map_map =
    klass->test_map_map =
    thrift_test_handler_test_map_map;
  base_class->test_insanity =
    klass->test_insanity =
    thrift_test_handler_test_insanity;
  base_class->test_multi =
    klass->test_multi =
    thrift_test_handler_test_multi;
  base_class->test_exception =
    klass->test_exception =
    thrift_test_handler_test_exception;
  base_class->test_multi_exception =
    klass->test_multi_exception =
    thrift_test_handler_test_multi_exception;
  base_class->test_oneway =
    klass->test_oneway =
    thrift_test_handler_test_oneway;
}
