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

#include <thrift/c_glib/thrift.h>

/**
 * GHashTable callback to add keys to a GList.
 */
void
thrift_hash_table_get_keys (gpointer key, gpointer value, gpointer user_data)
{
  GList **list = (GList **) user_data;

  THRIFT_UNUSED_VAR (value);

  *list = g_list_append (*list, key);
}
void thrift_safe_hash_table_destroy(GHashTable* hash_table)
{
  if (hash_table)
  {
    g_hash_table_destroy(hash_table);
  }
}

guint thrift_boolean_hash(gconstpointer v)
{
  const gboolean* p = v;
  return p && *p ? 1 : 0;
}
gboolean thrift_boolean_equal(gconstpointer a, gconstpointer b)
{
  if (a == b) {
    return TRUE;
  }
  if (!a || !b) {
    return FALSE;
  }
  const gboolean* pa = a;
  const gboolean* pb = b;
  return *pa == *pb;
}

guint thrift_int8_hash(gconstpointer v)
{
  const gint8* p = v;
  return p ? *p : 0;
}
gboolean thrift_int8_equal(gconstpointer a, gconstpointer b)
{
  if (a == b) {
    return TRUE;
  }
  if (!a || !b) {
    return FALSE;
  }
  const gint8* pa = a;
  const gint8* pb = b;
  return *pa == *pb;
}

guint thrift_int16_hash(gconstpointer v)
{
  const gint16* p = v;
  return p ? *p : 0;
}
gboolean thrift_int16_equal(gconstpointer a, gconstpointer b)
{
  if (a == b) {
    return TRUE;
  }
  if (!a || !b) {
    return FALSE;
  }
  const gint16* pa = a;
  const gint16* pb = b;
  return *pa == *pb;
}

void
thrift_string_free (gpointer str)
{
	GByteArray* ptr = str;
	g_byte_array_unref(ptr);
}
