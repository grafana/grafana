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

#include <assert.h>
#include <glib.h>

#include <thrift/c_glib/thrift_struct.h>
#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>
#include <thrift/c_glib/transport/thrift_memory_buffer.h>
#include "gen-c_glib/t_test_optional_required_test_types.h"

#include "gen-c_glib/t_test_optional_required_test_types.c"

static void
write_to_read (ThriftStruct *w, ThriftStruct *r, GError **write_error,
               GError **read_error)
{
  ThriftMemoryBuffer *tbuffer = NULL;
  ThriftProtocol *protocol = NULL;

  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, NULL);
  protocol = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                           tbuffer, NULL);

  thrift_struct_write (w, protocol, write_error);
  thrift_struct_read (r, protocol, read_error);

  g_object_unref (protocol);
  g_object_unref (tbuffer);
}

static void
test_old_school1 (void)
{
  TTestOldSchool *o = NULL;

  o = g_object_new (T_TEST_TYPE_OLD_SCHOOL, NULL);
  o->im_int = 10;
  o->im_str = g_strdup ("test");
  o->im_big = g_ptr_array_new ();
  g_ptr_array_free (o->im_big, TRUE);
  o->im_big = NULL;
  g_free (o->im_str);
  o->im_str = NULL;
  g_object_unref (o);
}

/**
 * Write to read with optional fields
 */
static void
test_simple (void)
{
  TTestSimple *s1 = NULL, *s2 = NULL, *s3 = NULL;

  s1 = g_object_new (T_TEST_TYPE_SIMPLE, NULL);
  s2 = g_object_new (T_TEST_TYPE_SIMPLE, NULL);
  s3 = g_object_new (T_TEST_TYPE_SIMPLE, NULL);

  /* write-to-read with optional fields */
  s1->im_optional = 10;
  assert (s1->__isset_im_default == FALSE);
  assert (s1->__isset_im_optional == FALSE);  
  write_to_read (THRIFT_STRUCT (s1), THRIFT_STRUCT (s2), NULL, NULL);
  assert (s2->__isset_im_default == TRUE);
  assert (s2->__isset_im_optional == FALSE);
  assert (s2->im_optional == 0);

  s1->__isset_im_optional = TRUE;
  write_to_read (THRIFT_STRUCT (s1), THRIFT_STRUCT (s3), NULL, NULL);
  assert (s3->__isset_im_default == TRUE);
  assert (s3->__isset_im_optional == TRUE);
  assert (s3->im_optional == 10);

  g_object_unref (s1);
  g_object_unref (s2);
}

/**
 * Writing between optional and default
 */
static void
test_tricky1 (void)
{
  TTestTricky1 *t1 = NULL;
  TTestTricky2 *t2 = NULL;

  t1 = g_object_new (T_TEST_TYPE_TRICKY1, NULL);
  t2 = g_object_new (T_TEST_TYPE_TRICKY2, NULL);

  t2->im_optional = 10;
  write_to_read (THRIFT_STRUCT (t2), THRIFT_STRUCT (t1), NULL, NULL);
  write_to_read (THRIFT_STRUCT (t1), THRIFT_STRUCT (t2), NULL, NULL);

  assert (t1->__isset_im_default == FALSE);
  assert (t2->__isset_im_optional == TRUE);
  assert (t1->im_default == t2->im_optional);
  assert (t1->im_default == 0);

  g_object_unref (t1);
  g_object_unref (t2);
}

/**
 * Writing between default and required.
 */
static void
test_tricky2 (void)
{
  TTestTricky1 *t1 = NULL;
  TTestTricky3 *t3 = NULL;

  t1 = g_object_new (T_TEST_TYPE_TRICKY1, NULL);
  t3 = g_object_new (T_TEST_TYPE_TRICKY3, NULL);

  write_to_read (THRIFT_STRUCT (t1), THRIFT_STRUCT (t3), NULL, NULL);
  write_to_read (THRIFT_STRUCT (t3), THRIFT_STRUCT (t1), NULL, NULL);

  assert (t1->__isset_im_default == TRUE);

  g_object_unref (t1);
  g_object_unref (t3);
}

/**
 * Writing between optional and required.
 */
static void
test_tricky3 (void)
{
  TTestTricky2 *t2 = NULL;
  TTestTricky3 *t3 = NULL;

  t2 = g_object_new (T_TEST_TYPE_TRICKY2, NULL);
  t3 = g_object_new (T_TEST_TYPE_TRICKY3, NULL);

  t2->__isset_im_optional = TRUE;

  write_to_read (THRIFT_STRUCT (t2), THRIFT_STRUCT (t3), NULL, NULL);
  write_to_read (THRIFT_STRUCT (t3), THRIFT_STRUCT (t2), NULL, NULL);

  g_object_unref (t2);
  g_object_unref (t3);
}

/**
 * Catch an optional not set exception.  To quote the
 * C++ test, "Mu-hu-ha-ha-ha!"
 */
static void
test_tricky4 (void)
{
  TTestTricky2 *t2 = NULL;
  TTestTricky3 *t3 = NULL;
  GError *read_error = NULL;

  t2 = g_object_new (T_TEST_TYPE_TRICKY2, NULL);
  t3 = g_object_new (T_TEST_TYPE_TRICKY3, NULL);

  /* throws protocol exception */
  write_to_read (THRIFT_STRUCT (t2), THRIFT_STRUCT (t3), NULL, &read_error);
  assert (read_error != NULL);
  g_error_free (read_error);

  write_to_read (THRIFT_STRUCT (t3), THRIFT_STRUCT (t2), NULL, NULL);

  assert (t2->__isset_im_optional);

  g_object_unref (t2);
  g_object_unref (t3);
}

static void
test_non_set_binary (void)
{
  TTestBinaries *b1 = NULL;
  TTestBinaries *b2 = NULL;
  GError *error = NULL;

  b1 = g_object_new (T_TEST_TYPE_BINARIES, NULL);
  b2 = g_object_new (T_TEST_TYPE_BINARIES, NULL);

  write_to_read (THRIFT_STRUCT (b1), THRIFT_STRUCT (b2), NULL, &error);
  g_assert(!error);
  write_to_read (THRIFT_STRUCT (b2), THRIFT_STRUCT (b1), NULL, &error);
  g_assert(!error);
  /* OK. No segfault */

  g_object_unref (b1);
  g_object_unref (b2);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testoptionalrequired/OldSchool", test_old_school1);
  g_test_add_func ("/testoptionalrequired/Simple", test_simple);
  g_test_add_func ("/testoptionalrequired/Tricky1", test_tricky1);
  g_test_add_func ("/testoptionalrequired/Tricky2", test_tricky2);
  g_test_add_func ("/testoptionalrequired/Tricky3", test_tricky3);
  g_test_add_func ("/testoptionalrequired/Tricky4", test_tricky4);
  g_test_add_func ("/testoptionalrequired/Binary", test_non_set_binary);

  return g_test_run ();
}
