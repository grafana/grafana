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
#include <math.h>
#include <string.h>
#include <glib-object.h>

#ifndef M_PI
#define M_PI 3.1415926535897932385
#endif

#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>

#include "gen-c_glib/t_test_debug_proto_test_types.h"
#include "gen-c_glib/t_test_srv.h"
#include "gen-c_glib/t_test_inherited.h"

static void
test_structs_doubles_create_and_destroy (void)
{
  GObject *object = NULL;

  /* A Doubles structure can be created... */
  object = g_object_new (T_TEST_TYPE_DOUBLES, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_DOUBLES (object));

  /* ...and destroyed */
  g_object_unref (object);
}

static void
test_structs_doubles_initialize (void)
{
  TTestDoubles *doubles = NULL;
  gdouble nan;
  gdouble inf;
  gdouble neginf;
  gdouble repeating;
  gdouble big;
  gdouble tiny;
  gdouble zero;
  gdouble negzero;

  /* Note there seems to be no way to get not-a-number ("NAN") values past
     GObject's range-checking, so that portion of the test has been commented
     out below. */

  /* A Doubles structure's members are available as GObject properties
     that can be initialized at construction... */
  doubles = g_object_new (T_TEST_TYPE_DOUBLES,
                          /* "nan",      0 * INFINITY, */
                          "inf",          INFINITY,
                          "neginf",      -INFINITY,
                          "repeating",     1.0 / 3,
                          "big",       G_MAXDOUBLE,
                          "tiny",          10E-101,
                          "zero",          1.0 * 0,
                          "negzero",      -1.0 * 0,
                          NULL);

  g_assert (doubles != NULL);

  /* ...and later retrieved */
  g_object_get (doubles,
                "nan",       &nan,
                "inf",       &inf,
                "neginf",    &neginf,
                "repeating", &repeating,
                "big",       &big,
                "tiny",      &tiny,
                "zero",      &zero,
                "negzero",   &negzero,
                NULL);

  /* g_assert_cmpint (isnan (nan),    !=,  0); */
  g_assert_cmpint (isinf (inf),    ==,  1);
  g_assert_cmpint (isinf (neginf), ==, -1);

  g_assert_cmpfloat (repeating, ==,     1.0 / 3);
  g_assert_cmpfloat (big,       ==, G_MAXDOUBLE);
  g_assert_cmpfloat (tiny,      ==,     10E-101);
  g_assert_cmpfloat (zero,      ==,     1.0 * 0);
  g_assert_cmpfloat (negzero,   ==,    -1.0 * 0);

  g_object_unref (doubles);
}

static void
test_structs_one_of_each_create_and_destroy (void)
{
  GObject *object = NULL;

  /* A OneOfEach structure can be created... */
  object = g_object_new (T_TEST_TYPE_ONE_OF_EACH, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_ONE_OF_EACH (object));

  /* ...and destroyed */
  g_object_unref (object);
}

static void
test_structs_one_of_each_initialize_default_values (void)
{
  TTestOneOfEach *one_of_each = NULL;
  gint   a_bite;
  gint   integer16;
  gint64 integer64;
  GArray *byte_list;
  GArray *i16_list;
  GArray *i64_list;

  /* A OneOfEach structure created with no explicit property values
     will hold the default values specified in the .thrift file */
  one_of_each = g_object_new (T_TEST_TYPE_ONE_OF_EACH, NULL);

  g_object_get (one_of_each,
                "a_bite",    &a_bite,
                "integer16", &integer16,
                "integer64", &integer64,
                "byte_list", &byte_list,
                "i16_list",  &i16_list,
                "i64_list",  &i64_list,
                NULL);

  g_assert_cmpint (a_bite,    ==, 0x7f);
  g_assert_cmpint (integer16, ==, 0x7fff);
  g_assert_cmpint (integer64, ==, G_GINT64_CONSTANT (10000000000));

  g_assert (byte_list != NULL);
  g_assert_cmpint (byte_list->len, ==, 3);
  g_assert_cmpint (g_array_index (byte_list, gint8, 0), ==, 1);
  g_assert_cmpint (g_array_index (byte_list, gint8, 1), ==, 2);
  g_assert_cmpint (g_array_index (byte_list, gint8, 2), ==, 3);

  g_assert (i16_list != NULL);
  g_assert_cmpint (i16_list->len, ==, 3);
  g_assert_cmpint (g_array_index (i16_list, gint16, 0), ==, 1);
  g_assert_cmpint (g_array_index (i16_list, gint16, 1), ==, 2);
  g_assert_cmpint (g_array_index (i16_list, gint16, 2), ==, 3);

  g_assert (i64_list != NULL);
  g_assert_cmpint (i64_list->len, ==, 3);
  g_assert_cmpint (g_array_index (i64_list, gint64, 0), ==, 1);
  g_assert_cmpint (g_array_index (i64_list, gint64, 1), ==, 2);
  g_assert_cmpint (g_array_index (i64_list, gint64, 2), ==, 3);

  g_array_unref (i64_list);
  g_array_unref (i16_list);
  g_array_unref (byte_list);
  g_object_unref (one_of_each);
}

static void
test_structs_one_of_each_initialize_specified_values (void)
{
  static const gint8 initial_byte_list[5] = { 13, 21, 34, 55, 89 };
  static const gint16 initial_i16_list[5] = { 4181, 6765, 10946, 17711, 28657 };
  static const gint64 initial_i64_list[5] =
    {
      G_GINT64_CONSTANT (1100087778366101931),
      G_GINT64_CONSTANT (1779979416004714189),
      G_GINT64_CONSTANT (2880067194370816120),
      G_GINT64_CONSTANT (4660046610375530309),
      G_GINT64_CONSTANT (7540113804746346429)
    };
  static const guint8 initial_base64[8] =
    {
      0x56, 0x47, 0x68, 0x79, 0x61, 0x57, 0x5a, 0x30
    };

  TTestOneOfEach *one_of_each;
  gboolean im_true;
  gboolean im_false;
  gint a_bite;
  gint integer16;
  gint integer32;
  gint64 integer64;
  double double_precision;
  gchar *some_characters;
  gchar *zomg_unicode;
  gboolean what_who;
  GByteArray *base64;
  GArray *byte_list;
  GArray *i16_list;
  GArray *i64_list;

  base64 = g_byte_array_new ();
  g_byte_array_append (base64, initial_base64, 8);

  byte_list = g_array_new (FALSE, FALSE, sizeof (gint8));
  g_array_append_vals (byte_list, initial_byte_list, 5);

  i16_list = g_array_new (FALSE, FALSE, sizeof (gint16));
  g_array_append_vals (i16_list, initial_i16_list, 5);

  i64_list = g_array_new (FALSE, FALSE, sizeof (gint64));
  g_array_append_vals (i64_list, initial_i64_list, 5);

  /* All of OneOfEach's properties can be set at construction... */
  one_of_each =
    g_object_new (T_TEST_TYPE_ONE_OF_EACH,
                  "im_true",          TRUE,
                  "im_false",         FALSE,
                  "a_bite",           0x50,
                  "integer16",        0x7e57,
                  "integer32",        0xdeadbeef,
                  "integer64",        G_GINT64_CONSTANT (0xfa15efacade15bad),
                  "double_precision", M_PI,
                  "some_characters",  "Debug THIS!",
                  "zomg_unicode",     "\xd7\n\a\t",
                  "what_who",         TRUE,
                  "base64",           base64,
                  "byte_list",        byte_list,
                  "i16_list",         i16_list,
                  "i64_list",         i64_list,
                  NULL);
  g_assert (one_of_each != NULL);

  g_array_unref (i64_list);
  i64_list = NULL;
  g_array_unref (i16_list);
  i16_list = NULL;
  g_array_unref (byte_list);
  byte_list = NULL;
  g_byte_array_unref (base64);
  base64 = NULL;

  /* ...and later retrieved */
  g_object_get (one_of_each,
                "im_true",          &im_true,
                "im_false",         &im_false,
                "a_bite",           &a_bite,
                "integer16",        &integer16,
                "integer32",        &integer32,
                "integer64",        &integer64,
                "double_precision", &double_precision,
                "some_characters",  &some_characters,
                "zomg_unicode",     &zomg_unicode,
                "what_who",         &what_who,
                "base64",           &base64,
                "byte_list",        &byte_list,
                "i16_list",         &i16_list,
                "i64_list",         &i64_list,
                NULL);

  g_assert (im_true  == TRUE);
  g_assert (im_false == FALSE);

  g_assert_cmphex (a_bite,    ==, 0x50);
  g_assert_cmphex (integer16, ==, 0x7e57);
  g_assert_cmphex (integer32, ==, (gint32)0xdeadbeef);
  g_assert_cmphex (integer64, ==, G_GINT64_CONSTANT (0xfa15efacade15bad));

  g_assert_cmpfloat (double_precision, ==, M_PI);

  g_assert_cmpstr (some_characters, ==, "Debug THIS!");
  g_assert_cmpstr (zomg_unicode,    ==, "\xd7\n\a\t");

  g_assert (what_who == TRUE);

  g_assert_cmpint (base64->len, ==, 8);
  g_assert_cmpint (memcmp (base64->data,
                           initial_base64,
                           8 * sizeof (guint8)), ==, 0);

  g_assert_cmpint (byte_list->len, ==, 5);
  g_assert_cmpint (memcmp (byte_list->data,
                           initial_byte_list,
                           5 * sizeof (gint8)),  ==, 0);

  g_assert_cmpint (i16_list->len, ==, 5);
  g_assert_cmpint (memcmp (i16_list->data,
                           initial_i16_list,
                           5 * sizeof (gint16)), ==, 0);

  g_assert_cmpint (i64_list->len, ==, 5);
  g_assert_cmpint (memcmp (i64_list->data,
                           initial_i64_list,
                           5 * sizeof (gint64)), ==, 0);

  g_array_unref (i64_list);
  g_array_unref (i16_list);
  g_array_unref (byte_list);
  g_byte_array_unref (base64);

  g_object_unref (one_of_each);
}

static void
test_structs_one_of_each_properties_byte_list (void)
{
  TTestOneOfEach *one_of_each;
  GArray *byte_list = NULL;

  one_of_each = g_object_new (T_TEST_TYPE_ONE_OF_EACH, NULL);

  /* OneOfEach's "byte_list" member is a list that holds eight-bit-wide integer
     values */
  g_object_get (one_of_each, "byte_list", &byte_list, NULL);

  g_assert (byte_list != NULL);
  g_assert_cmpint (g_array_get_element_size (byte_list), ==, sizeof (gint8));

  g_array_unref (byte_list);
  g_object_unref (one_of_each);
}

static void
test_structs_one_of_each_properties_i16_list (void)
{
  TTestOneOfEach *one_of_each;
  GArray *i16_list = NULL;

  one_of_each = g_object_new (T_TEST_TYPE_ONE_OF_EACH, NULL);

  /* OneOfEach's "i16_list" member is a list that holds sixteen-bit-wide integer
     values */
  g_object_get (one_of_each, "i16_list", &i16_list, NULL);

  g_assert (i16_list != NULL);
  g_assert_cmpint (g_array_get_element_size (i16_list), ==, sizeof (gint16));

  g_array_unref (i16_list);
  g_object_unref (one_of_each);
}

static void
test_structs_one_of_each_properties_i64_list (void)
{
  TTestOneOfEach *one_of_each;
  GArray *i64_list = NULL;

  one_of_each = g_object_new (T_TEST_TYPE_ONE_OF_EACH, NULL);

  /* OneOfEach's "i64_list" member is a list that holds sixty-four-bit-wide
     integer values */
  g_object_get (one_of_each, "i64_list", &i64_list, NULL);

  g_assert (i64_list != NULL);
  g_assert_cmpint (g_array_get_element_size (i64_list), ==, sizeof (gint64));

  g_array_unref (i64_list);
  g_object_unref (one_of_each);
}

static void
test_structs_nesting_create_and_destroy (void)
{
  GObject *object = NULL;

  /* A Nesting structure can be created... */
  object = g_object_new (T_TEST_TYPE_NESTING, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_NESTING (object));

  /* ...and destroyed */
  g_object_unref (object);
}

static void
test_structs_nesting_properties_my_bonk (void)
{
  TTestNesting *nesting;
  TTestBonk *bonk = NULL;
  gint type;
  gchar *message;

  nesting = g_object_new (T_TEST_TYPE_NESTING, NULL);

  /* Nesting's "my_bonk" member is initialized with a new, default Bonk object
     during construction */
  g_object_get (nesting, "my_bonk", &bonk, NULL);

  g_assert (bonk != NULL);
  g_assert (T_TEST_IS_BONK (bonk));

  g_object_get (bonk,
                "type",    &type,
                "message", &message,
                NULL);

  g_assert_cmpint (type, ==, 0);
  g_assert (message == NULL);

  g_object_unref (bonk);
  bonk = NULL;

  /* It can be replaced... */
  bonk = g_object_new (T_TEST_TYPE_BONK,
                       "type",    100,
                       "message", "Replacement Bonk",
                       NULL);
  g_object_set (nesting, "my_bonk", bonk, NULL);
  g_object_unref (bonk);
  bonk = NULL;

  g_object_get (nesting, "my_bonk", &bonk, NULL);

  g_assert (bonk != NULL);
  g_assert (T_TEST_IS_BONK (bonk));

  g_object_get (bonk,
                "type",    &type,
                "message", &message,
                NULL);

  g_assert_cmpint (type, ==, 100);
  g_assert_cmpstr (message, ==, "Replacement Bonk");

  g_free (message);
  g_object_unref (bonk);
  bonk = NULL;

  /* ...or set to null */
  g_object_set (nesting, "my_bonk", NULL, NULL);
  g_object_get (nesting, "my_bonk", &bonk, NULL);

  g_assert (bonk == NULL);

  g_object_unref (nesting);
}

static void
test_structs_nesting_properties_my_ooe (void)
{
  TTestNesting *nesting;
  TTestOneOfEach *one_of_each = NULL;
  gint a_bite;
  gint integer16;

  nesting = g_object_new (T_TEST_TYPE_NESTING, NULL);

  /* Nesting's "my_ooe" member is initialized with a new, default OneOfEach
     object during construction */
  g_object_get (nesting, "my_ooe", &one_of_each, NULL);

  g_assert (one_of_each != NULL);
  g_assert (T_TEST_IS_ONE_OF_EACH (one_of_each));

  g_object_get (one_of_each,
                "a_bite",    &a_bite,
                "integer16", &integer16,
                NULL);

  g_assert_cmphex (a_bite,    ==, 0x7f);
  g_assert_cmphex (integer16, ==, 0x7fff);

  g_object_unref (one_of_each);
  one_of_each = NULL;

  /* It can be replaced... */
  one_of_each = g_object_new (T_TEST_TYPE_ONE_OF_EACH,
                              "a_bite",    0x50,
                              "integer16", 0x5050,
                              NULL);
  g_object_set (nesting, "my_ooe", one_of_each, NULL);
  g_object_unref (one_of_each);
  one_of_each = NULL;

  g_object_get (nesting, "my_ooe", &one_of_each, NULL);

  g_assert (one_of_each != NULL);
  g_assert (T_TEST_IS_ONE_OF_EACH (one_of_each));

  g_object_get (one_of_each,
                "a_bite",    &a_bite,
                "integer16", &integer16,
                NULL);

  g_assert_cmphex (a_bite,    ==, 0x50);
  g_assert_cmphex (integer16, ==, 0x5050);

  g_object_unref (one_of_each);
  one_of_each = NULL;

  /* ...or set to null */
  g_object_set (nesting, "my_ooe", NULL, NULL);
  g_object_get (nesting, "my_ooe", &one_of_each, NULL);

  g_assert (one_of_each == NULL);

  g_object_unref (nesting);
}

static void
test_structs_holy_moley_create_and_destroy (void)
{
  GObject *object = NULL;

  /* A HolyMoley structure can be created... */
  object = g_object_new (T_TEST_TYPE_HOLY_MOLEY, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_HOLY_MOLEY (object));

  /* ...and destroyed */
  g_object_unref (object);
}

static void
test_structs_holy_moley_properties_big (void)
{
  TTestHolyMoley *holy_moley;
  GPtrArray *big = NULL;
  gint a_bite = 0;
  gint integer16 = 0;

  holy_moley = g_object_new (T_TEST_TYPE_HOLY_MOLEY, NULL);

  /* A HolyMoley's "big" member is is initialized on construction */
  g_object_get (holy_moley, "big", &big, NULL);

  g_assert (big != NULL);
  g_assert_cmpint (big->len, ==, 0);

  /* It can be modified... */
  g_ptr_array_add (big,
                   g_object_new (T_TEST_TYPE_ONE_OF_EACH,
                                 "a_bite",    0x50,
                                 "integer16", 0x5050,
                                 NULL));

  g_ptr_array_unref (big);
  big = NULL;

  g_object_get (holy_moley, "big", &big, NULL);

  g_assert_cmpint (big->len, ==, 1);
  g_object_get (g_ptr_array_index (big, 0),
                "a_bite",    &a_bite,
                "integer16", &integer16,
                NULL);

  g_assert_cmphex (a_bite,    ==, 0x50);
  g_assert_cmphex (integer16, ==, 0x5050);

  g_ptr_array_unref (big);
  big = NULL;

  /* ...replaced... */
  big = g_ptr_array_new_with_free_func (g_object_unref);
  g_ptr_array_add (big,
                   g_object_new (T_TEST_TYPE_ONE_OF_EACH,
                                 "a_bite",    0x64,
                                 "integer16", 0x1541,
                                 NULL));

  g_object_set (holy_moley, "big", big, NULL);

  g_ptr_array_unref (big);
  big = NULL;

  g_object_get (holy_moley, "big", &big, NULL);

  g_assert_cmpint (big->len, ==, 1);
  g_object_get (g_ptr_array_index (big, 0),
                "a_bite",    &a_bite,
                "integer16", &integer16,
                NULL);

  g_assert_cmphex (a_bite,    ==, 0x64);
  g_assert_cmphex (integer16, ==, 0x1541);

  g_ptr_array_unref (big);
  big = NULL;

  /* ...or set to NULL */
  g_object_set (holy_moley, "big", NULL, NULL);
  g_object_get (holy_moley, "big", &big, NULL);

  g_assert (big == NULL);

  g_object_unref (holy_moley);
}

static void
test_structs_holy_moley_properties_contain (void)
{
  static gchar *strings[2] = { "Apache", "Thrift" };

  TTestHolyMoley *holy_moley;
  GHashTable *contain = NULL;
  GPtrArray *string_list;
  GList *key_list;

  holy_moley = g_object_new (T_TEST_TYPE_HOLY_MOLEY, NULL);

  /* A HolyMoley's "contain" member is initialized on construction */
  g_object_get (holy_moley, "contain", &contain, NULL);

  g_assert (contain != NULL);
  g_assert_cmpint (g_hash_table_size (contain), ==, 0);

  /* It can be modified... */
  string_list = g_ptr_array_new ();
  g_ptr_array_add (string_list, strings[0]);
  g_ptr_array_add (string_list, strings[1]);

  g_hash_table_insert (contain, string_list, NULL);
  string_list = NULL;

  g_hash_table_unref (contain);
  contain = NULL;

  g_object_get (holy_moley, "contain", &contain, NULL);

  g_assert_cmpint (g_hash_table_size (contain), ==, 1);

  key_list = g_hash_table_get_keys (contain);
  string_list = g_list_nth_data (key_list, 0);

  g_assert_cmpint (string_list->len, ==, 2);
  g_assert_cmpstr (g_ptr_array_index (string_list, 0), ==, "Apache");
  g_assert_cmpstr (g_ptr_array_index (string_list, 1), ==, "Thrift");

  g_list_free (key_list);
  g_hash_table_unref (contain);
  contain = NULL;

  /* ...replaced... */
  contain = g_hash_table_new_full (g_direct_hash,
                                   g_direct_equal,
                                   (GDestroyNotify) g_ptr_array_unref,
                                   NULL);
  g_object_set (holy_moley, "contain", contain, NULL);
  g_hash_table_unref (contain);
  contain = NULL;

  g_object_get (holy_moley, "contain", &contain, NULL);

  g_assert_cmpint (g_hash_table_size (contain), ==, 0);

  g_hash_table_unref (contain);
  contain = NULL;

  /* ...or set to NULL */
  g_object_set (holy_moley, "contain", NULL, NULL);
  g_object_get (holy_moley, "contain", &contain, NULL);

  g_assert (contain == NULL);

  g_object_unref (holy_moley);
}

static void
test_structs_holy_moley_properties_bonks (void)
{
  TTestHolyMoley *holy_moley;
  GHashTable *bonks = NULL;
  GPtrArray *bonk_list = NULL;
  TTestBonk *bonk = NULL;
  gint type;
  gchar *message;
  GList *key_list;

  holy_moley = g_object_new (T_TEST_TYPE_HOLY_MOLEY, NULL);

  /* A HolyMoley's "bonks" member is initialized on construction */
  g_object_get (holy_moley, "bonks", &bonks, NULL);

  g_assert (bonks != NULL);
  g_assert_cmpint (g_hash_table_size (bonks), ==, 0);

  /* It can be modified... */
  bonk = g_object_new (T_TEST_TYPE_BONK,
                       "type",    100,
                       "message", "Sample Bonk",
                       NULL);
  bonk_list = g_ptr_array_new_with_free_func (g_object_unref);
  g_ptr_array_add (bonk_list, bonk);
  bonk = NULL;

  g_hash_table_insert (bonks, g_strdup ("Sample Bonks"), bonk_list);
  bonk_list = NULL;

  g_hash_table_unref (bonks);
  bonks = NULL;

  g_object_get (holy_moley, "bonks", &bonks, NULL);

  g_assert_cmpint (g_hash_table_size (bonks), ==, 1);

  key_list = g_hash_table_get_keys (bonks);
  bonk_list = g_hash_table_lookup (bonks, g_list_nth_data (key_list, 0));

  g_assert_cmpint (bonk_list->len, ==, 1);

  bonk = (g_ptr_array_index (bonk_list, 0));
  g_object_get (bonk,
                "type",    &type,
                "message", &message,
                NULL);

  g_assert_cmpint (type, ==, 100);
  g_assert_cmpstr (message, ==, "Sample Bonk");

  bonk = NULL;
  g_free (message);
  g_list_free (key_list);
  g_hash_table_unref (bonks);
  bonks = NULL;

  /* ...replaced... */
  bonks = g_hash_table_new_full (g_str_hash,
                                 g_str_equal,
                                 g_free,
                                 (GDestroyNotify) g_ptr_array_unref);
  g_object_set (holy_moley, "bonks", bonks, NULL);
  g_hash_table_unref (bonks);
  bonks = NULL;

  g_object_get (holy_moley, "bonks", &bonks, NULL);

  g_assert_cmpint (g_hash_table_size (bonks), ==, 0);

  g_hash_table_unref (bonks);
  bonks = NULL;

  /* ...or set to NULL */
  g_object_set (holy_moley, "bonks", NULL, NULL);
  g_object_get (holy_moley, "bonks", &bonks, NULL);

  g_assert (bonks == NULL);

  g_object_unref (holy_moley);
}

static void
test_structs_empty (void)
{
  GObject *object = NULL;
  GParamSpec **properties;
  guint property_count;

  /* An Empty structure can be created */
  object = g_object_new (T_TEST_TYPE_EMPTY, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_EMPTY (object));

  /* An Empty structure has no members and thus no properties */
  properties = g_object_class_list_properties (G_OBJECT_GET_CLASS (object),
                                               &property_count);
  g_assert_cmpint (property_count, ==, 0);
  g_free (properties);

  /* An Empty structure can be destroyed  */
  g_object_unref (object);
}

static void
test_structs_wrapper_create_and_destroy (void)
{
  GObject *object = NULL;

  /* A Wrapper structure can be created... */
  object = g_object_new (T_TEST_TYPE_EMPTY, NULL);

  g_assert (object != NULL);
  g_assert (T_TEST_IS_EMPTY (object));

  /* ...and destroyed  */
  g_object_unref (object);
}

static void
test_structs_wrapper_properties_foo (void) {
  TTestWrapper *wrapper;
  TTestEmpty *foo;

  wrapper = g_object_new (T_TEST_TYPE_WRAPPER, NULL);

  /* A Wrapper structure has one member, "foo", which is an Empty
     structure initialized during construction */
  g_object_get (wrapper, "foo", &foo, NULL);

  g_assert (foo != NULL);
  g_assert (T_TEST_IS_EMPTY (foo));

  g_object_unref (foo);
  foo = NULL;

  /* A Wrapper's foo property can be replaced... */
  foo = g_object_new (T_TEST_TYPE_EMPTY, NULL);
  g_object_set (wrapper, "foo", foo, NULL);

  g_object_unref (foo);
  foo = NULL;

  g_object_get (wrapper, "foo", &foo, NULL);
  g_assert (foo != NULL);
  g_assert (T_TEST_IS_EMPTY (foo));

  g_object_unref (foo);
  foo = NULL;

  /* ...or set to NULL */
  g_object_set (wrapper, "foo", NULL, NULL);
  g_object_get (wrapper, "foo", &foo, NULL);

  g_assert (foo == NULL);

  g_object_unref (wrapper);
}

static void
test_services_inherited (void)
{
  ThriftProtocol *protocol;
  TTestInheritedClient *inherited_client;
  GObject *input_protocol, *output_protocol;

  protocol = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, NULL);
  inherited_client = g_object_new (T_TEST_TYPE_INHERITED_CLIENT,
                                   NULL);

  /* TTestInheritedClient inherits from TTestSrvClient */
  assert (g_type_is_a (T_TEST_TYPE_INHERITED_CLIENT,
                       T_TEST_TYPE_SRV_CLIENT));

  /* TTestInheritedClient implements TTestSrvClient's interface */
  assert (g_type_is_a (T_TEST_TYPE_INHERITED_CLIENT,
                       T_TEST_TYPE_SRV_IF));

  /* TTestInheritedClient's inherited properties can be set and retrieved */
  g_object_set (inherited_client,
                "input_protocol", protocol,
                "output_protocol", protocol,
                NULL);

  g_object_get (inherited_client,
                "input_protocol", &input_protocol,
                "output_protocol", &output_protocol,
                NULL);

  assert (input_protocol == G_OBJECT(protocol));
  assert (output_protocol == G_OBJECT(protocol));

  g_object_unref (output_protocol);
  g_object_unref (input_protocol);
  g_object_unref (inherited_client);
  g_object_unref (protocol);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Doubles/CreateAndDestroy",
     test_structs_doubles_create_and_destroy);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Doubles/Initialize",
     test_structs_doubles_initialize);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/CreateAndDestroy",
     test_structs_one_of_each_create_and_destroy);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/Initialize/DefaultValues",
     test_structs_one_of_each_initialize_default_values);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/Initialize/SpecifiedValues",
     test_structs_one_of_each_initialize_specified_values);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/Properties/byte_list",
     test_structs_one_of_each_properties_byte_list);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/Properties/i16_list",
     test_structs_one_of_each_properties_i16_list);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/OneOfEach/Properties/i64_list",
     test_structs_one_of_each_properties_i64_list);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Nesting/CreateAndDestroy",
     test_structs_nesting_create_and_destroy);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Nesting/Properties/my_bonk",
     test_structs_nesting_properties_my_bonk);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Nesting/Properties/my_ooe",
     test_structs_nesting_properties_my_ooe);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/HolyMoley/CreateAndDestroy",
     test_structs_holy_moley_create_and_destroy);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/HolyMoley/Properties/big",
     test_structs_holy_moley_properties_big);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/HolyMoley/Properties/contain",
     test_structs_holy_moley_properties_contain);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/HolyMoley/Properties/bonks",
     test_structs_holy_moley_properties_bonks);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Empty",
     test_structs_empty);

  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Wrapper/CreateAndDestroy",
     test_structs_wrapper_create_and_destroy);
  g_test_add_func
    ("/testdebugproto/DebugProto/Structs/Wrapper/Properties/foo",
     test_structs_wrapper_properties_foo);

  g_test_add_func
    ("/testdebugproto/DebugProto/Services/Inherited",
     test_services_inherited);

  return g_test_run ();
}
