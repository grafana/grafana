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
#include <glib-object.h>

#include "../src/thrift/c_glib/thrift_struct.c"

/* tests to ensure we can extend a ThriftStruct */

struct _ThriftTestStruct
{
  ThriftStruct parent;
};
typedef struct _ThriftTestStruct ThriftTestStruct;

struct _ThriftTestStructClass
{
  ThriftStructClass parent;
};
typedef struct _ThriftTestStructClass ThriftTestStructClass;

GType thrift_test_struct_get_type (void);

#define THRIFT_TYPE_TEST_STRUCT (thrift_test_struct_get_type ())
#define THRIFT_TEST_STRUCT(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_TEST_STRUCT, ThriftTestStruct))
#define THRIFT_TEST_STRUCT_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_TEST_STRUCT, ThriftTestStructClass))
#define THRIFT_IS_TEST_STRUCT(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_TEST_STRUCT))
#define THRIFT_IS_TEST_STRUCT_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_TEST_STRUCT))
#define THRIFT_TEST_STRUCT_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_TEST_STRUCT, ThriftTestStructClass))

G_DEFINE_TYPE(ThriftTestStruct, thrift_test_struct, THRIFT_TYPE_STRUCT)

gint32
thrift_test_struct_read (ThriftStruct *object, ThriftProtocol *protocol,
                         GError **error)
{
  THRIFT_UNUSED_VAR (object);
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);

  return 0;
}

gint32
thrift_test_struct_write (ThriftStruct *object, ThriftProtocol *protocol,
                          GError **error)
{
  THRIFT_UNUSED_VAR (object);
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);

  return 0;
}

static void
thrift_test_struct_class_init (ThriftTestStructClass *cls)
{
  ThriftStructClass *ts_cls = THRIFT_STRUCT_CLASS (cls);
  ts_cls->read = thrift_test_struct_read;
  ts_cls->write = thrift_test_struct_write;
}

static void
thrift_test_struct_init (ThriftTestStruct *s)
{
  THRIFT_UNUSED_VAR (s);
}

static void
test_initialize_object (void)
{
  ThriftTestStruct *t = NULL;

  t = g_object_new (THRIFT_TYPE_TEST_STRUCT, NULL);
  assert ( THRIFT_IS_STRUCT (t));
  thrift_struct_read (THRIFT_STRUCT (t), NULL, NULL);
  thrift_struct_write (THRIFT_STRUCT (t), NULL, NULL);
  thrift_test_struct_read (THRIFT_STRUCT (t), NULL, NULL);
  thrift_test_struct_write (THRIFT_STRUCT (t), NULL, NULL);
  g_object_unref (t);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/teststruct/InitializeObject", test_initialize_object);

  return g_test_run ();
}
