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

#ifndef _THRIFT_H
#define _THRIFT_H

#ifdef HAVE_CONFIG_H
#include "config.h"
#endif

#include <glib.h>

/* this macro is called to satisfy -Wall hardcore compilation */
#ifndef THRIFT_UNUSED_VAR
# define THRIFT_UNUSED_VAR(x) ((void) x)
#endif

void thrift_hash_table_get_keys (gpointer key, gpointer value,
                                 gpointer user_data);
void thrift_safe_hash_table_destroy(GHashTable* hash_table);

guint thrift_boolean_hash(gconstpointer v);
gboolean thrift_boolean_equal(gconstpointer a, gconstpointer b);

guint thrift_int8_hash(gconstpointer v);
gboolean thrift_int8_equal(gconstpointer a, gconstpointer b);

guint thrift_int16_hash(gconstpointer v);
gboolean thrift_int16_equal(gconstpointer a, gconstpointer b);

void thrift_string_free (gpointer str);

#endif /* #ifndef _THRIFT_THRIFT_H */
