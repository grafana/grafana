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
#include <netdb.h>

#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_socket.h>
#include <thrift/c_glib/transport/thrift_server_transport.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>

static const gchar TEST_DATA[11] = "abcdefghij";

#include "../src/thrift/c_glib/transport/thrift_memory_buffer.c"

/* test object creation and destruction */
static void
test_create_and_destroy (void)
{
  GObject *object = NULL;
  object = g_object_new (THRIFT_TYPE_MEMORY_BUFFER,
                         "buf_size", 10,
                         NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_create_and_destroy_large (void)
{
  GObject *object = NULL;
  object = g_object_new (THRIFT_TYPE_MEMORY_BUFFER,
                         "buf_size", 10 * 1024 * 1024,
                         NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_create_and_destroy_default (void)
{
  GObject *object = NULL;
  object = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_create_and_destroy_external (void)
{
  GObject *object = NULL;
  GByteArray *buf = g_byte_array_new ();
  assert (buf != NULL);
  object = g_object_new (THRIFT_TYPE_MEMORY_BUFFER,
                         "buf", buf,
                         NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_create_and_destroy_unowned (void)
{
  GObject *object = NULL;
  GValue val = G_VALUE_INIT;
  GByteArray *buf;

  object = g_object_new (THRIFT_TYPE_MEMORY_BUFFER,
                         "owner", FALSE,
                         NULL);
  assert (object != NULL);

  g_value_init (&val, G_TYPE_POINTER);
  g_object_get_property (object, "buf", &val);
  buf = (GByteArray*) g_value_get_pointer (&val);
  assert (buf != NULL);

  g_byte_array_unref (buf);
  g_value_unset (&val);
  g_object_unref (object);
}

static void
test_open_and_close (void)
{
  ThriftMemoryBuffer *tbuffer = NULL;

  /* create a ThriftMemoryBuffer */
  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, NULL);

  /* no-ops */
  assert (thrift_memory_buffer_open (THRIFT_TRANSPORT (tbuffer), NULL) == TRUE);
  assert (thrift_memory_buffer_is_open (THRIFT_TRANSPORT (tbuffer)) == TRUE);
  assert (thrift_memory_buffer_close (THRIFT_TRANSPORT (tbuffer), NULL) == TRUE);

  g_object_unref (tbuffer);
}

static void
test_read_and_write (void)
{
  ThriftMemoryBuffer *tbuffer = NULL;
  gint got, want;
  gchar read[10];
  gchar *b;
  GError *error = NULL;

  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, "buf_size", 5, NULL);
  assert (thrift_memory_buffer_write (THRIFT_TRANSPORT (tbuffer),
                                      (gpointer) TEST_DATA,
                                      10, &error) == FALSE);
  assert (error != NULL);
  g_error_free (error);
  error = NULL;
  g_object_unref (tbuffer);

  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, "buf_size", 15, NULL);
  assert (thrift_memory_buffer_write (THRIFT_TRANSPORT (tbuffer),
                                      (gpointer) TEST_DATA, 10, &error) == TRUE);
  assert (error == NULL);

  memset(read, 0, 10);
  b = read;
  want = 10;
  while (want > 0) {
    got = thrift_memory_buffer_read (THRIFT_TRANSPORT (tbuffer),
                                     (gpointer) b, want, &error);
    assert (got > 0 && got <= want);
    assert (error == NULL);
    b += got;
    want -= got;
  }
  assert (memcmp (read, TEST_DATA, 10) == 0);
  g_object_unref (tbuffer);
}

static void
test_read_and_write_default (void)
{
  ThriftMemoryBuffer *tbuffer = NULL;
  gint got, want, i;
  gchar read[10];
  gchar *b;
  GError *error = NULL;

  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, NULL);
  for (i = 0; i < 100; ++i) {
    assert (thrift_memory_buffer_write (THRIFT_TRANSPORT (tbuffer),
                                        (gpointer) TEST_DATA, 10, &error) == TRUE);
    assert (error == NULL);
  }

  for (i = 0; i < 100; ++i) {
    memset(read, 0, 10);
    b = read;
    want = 10;
    while (want > 0) {
      got = thrift_memory_buffer_read (THRIFT_TRANSPORT (tbuffer),
                                       (gpointer) b, want, &error);
      assert (got > 0 && got <= want);
      assert (error == NULL);
      b += got;
      want -= got;
    }
    assert (memcmp (read, TEST_DATA, 10) == 0);
  }
  g_object_unref (tbuffer);
}

static void
test_read_and_write_external (void)
{
  ThriftMemoryBuffer *tbuffer = NULL;
  gchar *b;
  GError *error = NULL;
  GByteArray *buf = g_byte_array_new ();
  assert (buf != NULL);

  tbuffer = g_object_new (THRIFT_TYPE_MEMORY_BUFFER, "buf", buf, NULL);
  assert (thrift_memory_buffer_write (THRIFT_TRANSPORT (tbuffer),
                                      (gpointer) TEST_DATA, 10, &error) == TRUE);
  assert (error == NULL);

  assert (memcmp (buf->data, TEST_DATA, 10) == 0);
  g_object_unref (tbuffer);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testmemorybuffer/CreateAndDestroy", test_create_and_destroy);
  g_test_add_func ("/testmemorybuffer/CreateAndDestroyLarge", test_create_and_destroy_large);
  g_test_add_func ("/testmemorybuffer/CreateAndDestroyUnlimited", test_create_and_destroy_default);
  g_test_add_func ("/testmemorybuffer/CreateAndDestroyExternal", test_create_and_destroy_external);
  g_test_add_func ("/testmemorybuffer/CreateAndDestroyUnowned", test_create_and_destroy_unowned);
  g_test_add_func ("/testmemorybuffer/OpenAndClose", test_open_and_close);
  g_test_add_func ("/testmemorybuffer/ReadAndWrite", test_read_and_write);
  g_test_add_func ("/testmemorybuffer/ReadAndWriteUnlimited", test_read_and_write_default);
  g_test_add_func ("/testmemorybuffer/ReadAndWriteExternal", test_read_and_write_external);

  return g_test_run ();
}
