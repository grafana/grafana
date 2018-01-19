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

#ifndef _THRIFT_TEST_HANDLER_H
#define _THRIFT_TEST_HANDLER_H

#include <glib-object.h>
#include <stdio.h>

#include "../gen-c_glib/t_test_thrift_test.h"

G_BEGIN_DECLS

/* A handler that implements the TTestThriftTestIf interface */

#define TYPE_THRIFT_TEST_HANDLER (thrift_test_handler_get_type ())

#define THRIFT_TEST_HANDLER(obj)                                \
  (G_TYPE_CHECK_INSTANCE_CAST ((obj),                           \
                               TYPE_THRIFT_TEST_HANDLER,        \
                               ThriftTestHandler))
#define IS_THRIFT_TEST_HANDLER(obj)                             \
  (G_TYPE_CHECK_INSTANCE_TYPE ((obj),                           \
                               TYPE_THRIFT_TEST_HANDLER))
#define THRIFT_TEST_HANDLER_CLASS(c)                    \
  (G_TYPE_CHECK_CLASS_CAST ((c),                        \
                            TYPE_THRIFT_TEST_HANDLER,   \
                            ThriftTestHandlerClass))
#define IS_THRIFT_TEST_HANDLER_CLASS(c)                 \
  (G_TYPE_CHECK_CLASS_TYPE ((c),                        \
                            TYPE_THRIFT_TEST_HANDLER))
#define THRIFT_TEST_HANDLER_GET_CLASS(obj)              \
  (G_TYPE_INSTANCE_GET_CLASS ((obj),                    \
                              TYPE_THRIFT_TEST_HANDLER, \
                              ThriftTestHandlerClass))

typedef struct _ThriftTestHandler ThriftTestHandler;
typedef struct _ThriftTestHandlerClass ThriftTestHandlerClass;

struct _ThriftTestHandler {
  TTestThriftTestHandler parent;
};

struct _ThriftTestHandlerClass {
  TTestThriftTestHandlerClass parent;

  gboolean (*test_void)            (TTestThriftTestIf    *iface,
                                    GError              **error);
  gboolean (*test_string)          (TTestThriftTestIf    *iface,
                                    gchar               **_return,
                                    const gchar          *thing,
                                    GError              **error);
  gboolean (*test_bool)            (TTestThriftTestIf    *iface,
                                    gboolean*_return,
                                    const gboolean        thing,
                                    GError              **error);
  gboolean (*test_byte)            (TTestThriftTestIf    *iface,
                                    gint8*_return,
                                    const gint8           thing,
                                    GError              **error);
  gboolean (*test_i32)             (TTestThriftTestIf    *iface,
                                    gint32*_return,
                                    const gint32          thing,
                                    GError              **error);
  gboolean (*test_i64)             (TTestThriftTestIf    *iface,
                                    gint64*_return,
                                    const gint64          thing,
                                    GError              **error);
  gboolean (*test_double)          (TTestThriftTestIf    *iface,
                                    gdouble*_return,
                                    const gdouble         thing,
                                    GError              **error);
  gboolean (*test_binary)          (TTestThriftTestIf    *iface,
                                    GByteArray        **_return,
                                    const GByteArray     *thing,
                                    GError              **error);
  gboolean (*test_struct)          (TTestThriftTestIf    *iface,
                                    TTestXtruct         **_return,
                                    const TTestXtruct    *thing,
                                    GError              **error);
  gboolean (*test_nest)            (TTestThriftTestIf    *iface,
                                    TTestXtruct2        **_return,
                                    const TTestXtruct2   *thing,
                                    GError              **error);
  gboolean (*test_map)             (TTestThriftTestIf    *iface,
                                    GHashTable          **_return,
                                    const GHashTable     *thing,
                                    GError              **error);
  gboolean (*test_string_map)      (TTestThriftTestIf    *iface,
                                    GHashTable          **_return,
                                    const GHashTable     *thing,
                                    GError              **error);
  gboolean (*test_set)             (TTestThriftTestIf    *iface,
                                    GHashTable          **_return,
                                    const GHashTable     *thing,
                                    GError              **error);
  gboolean (*test_list)            (TTestThriftTestIf    *iface,
                                    GArray              **_return,
                                    const GArray         *thing,
                                    GError              **error);
  gboolean (*test_enum)            (TTestThriftTestIf    *iface,
                                    TTestNumberz*_return,
                                    const TTestNumberz    thing,
                                    GError              **error);
  gboolean (*test_typedef)         (TTestThriftTestIf    *iface,
                                    TTestUserId*_return,
                                    const TTestUserId     thing,
                                    GError              **error);
  gboolean (*test_map_map)         (TTestThriftTestIf    *iface,
                                    GHashTable          **_return,
                                    const gint32          hello,
                                    GError              **error);
  gboolean (*test_insanity)        (TTestThriftTestIf    *iface,
                                    GHashTable          **_return,
                                    const TTestInsanity  *argument,
                                    GError              **error);
  gboolean (*test_multi)           (TTestThriftTestIf    *iface,
                                    TTestXtruct         **_return,
                                    const gint8           arg0,
                                    const gint32          arg1,
                                    const gint64          arg2,
                                    const GHashTable     *arg3,
                                    const TTestNumberz    arg4,
                                    const TTestUserId     arg5,
                                    GError              **error);
  gboolean (*test_exception)       (TTestThriftTestIf    *iface,
                                    const gchar          *arg,
                                    TTestXception       **err1,
                                    GError              **error);
  gboolean (*test_multi_exception) (TTestThriftTestIf    *iface,
                                    TTestXtruct         **_return,
                                    const gchar          *arg0,
                                    const gchar          *arg1,
                                    TTestXception       **err1,
                                    TTestXception2      **err2,
                                    GError              **error);
  gboolean (*test_oneway)          (TTestThriftTestIf    *iface,
                                    const gint32          secondsToSleep,
                                    GError              **error);
};

/* Used by THRIFT_TEST_HANDLER_GET_TYPE */
GType thrift_test_handler_get_type (void);

gboolean thrift_test_handler_test_void            (TTestThriftTestIf    *iface,
                                                   GError              **error);
gboolean thrift_test_handler_test_string          (TTestThriftTestIf    *iface,
                                                   gchar               **_return,
                                                   const gchar          *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_byte            (TTestThriftTestIf    *iface,
                                                   gint8*_return,
                                                   const gint8           thing,
                                                   GError              **error);
gboolean t_test_thrift_test_if_test_i32           (TTestThriftTestIf    *iface,
                                                   gint32*_return,
                                                   const gint32          thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_i64             (TTestThriftTestIf    *iface,
                                                   gint64*_return,
                                                   const gint64          thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_double          (TTestThriftTestIf    *iface,
                                                   gdouble*_return,
                                                   const gdouble         thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_struct          (TTestThriftTestIf    *iface,
                                                   TTestXtruct         **_return,
                                                   const TTestXtruct    *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_nest            (TTestThriftTestIf    *iface,
                                                   TTestXtruct2        **_return,
                                                   const TTestXtruct2   *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_map             (TTestThriftTestIf    *iface,
                                                   GHashTable          **_return,
                                                   const GHashTable     *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_string_map      (TTestThriftTestIf    *iface,
                                                   GHashTable          **_return,
                                                   const GHashTable     *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_set             (TTestThriftTestIf    *iface,
                                                   GHashTable          **_return,
                                                   const GHashTable     *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_list            (TTestThriftTestIf    *iface,
                                                   GArray              **_return,
                                                   const GArray         *thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_typedef         (TTestThriftTestIf    *iface,
                                                   TTestUserId*_return,
                                                   const TTestUserId     thing,
                                                   GError              **error);
gboolean thrift_test_handler_test_map_map         (TTestThriftTestIf    *iface,
                                                   GHashTable          **_return,
                                                   const gint32          hello,
                                                   GError              **error);
gboolean thrift_test_handler_test_insanity        (TTestThriftTestIf    *iface,
                                                   GHashTable          **_return,
                                                   const TTestInsanity  *argument,
                                                   GError              **error);
gboolean thrift_test_handler_test_multi           (TTestThriftTestIf    *iface,
                                                   TTestXtruct         **_return,
                                                   const gint8           arg0,
                                                   const gint32          arg1,
                                                   const gint64          arg2,
                                                   const GHashTable     *arg3,
                                                   const TTestNumberz    arg4,
                                                   const TTestUserId     arg5,
                                                   GError              **error);
gboolean thrift_test_handler_test_exception       (TTestThriftTestIf    *iface,
                                                   const gchar          *arg,
                                                   TTestXception       **err1,
                                                   GError              **error);
gboolean thrift_test_handler_test_multi_exception (TTestThriftTestIf    *iface,
                                                   TTestXtruct         **_return,
                                                   const gchar          *arg0,
                                                   const gchar          *arg1,
                                                   TTestXception       **err1,
                                                   TTestXception2      **err2,
                                                   GError              **error);
gboolean thrift_test_handler_test_oneway          (TTestThriftTestIf    *iface,
                                                   const gint32          secondsToSleep,
                                                   GError              **error);

G_END_DECLS

#endif /* _THRIFT_TEST_HANDLER_H */
