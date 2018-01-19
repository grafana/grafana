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

#include <string.h>
#include <fcntl.h>
#include <errno.h>
#include <unistd.h>

#include <glib.h>
#include <glib/gstdio.h>

#include <thrift/c_glib/transport/thrift_transport.h>
#include <thrift/c_glib/transport/thrift_fd_transport.h>

static const gchar TEST_DATA[12] = "abcde01234!";

static void
test_create_and_destroy (void)
{
  GObject *object;
  object = g_object_new (THRIFT_TYPE_FD_TRANSPORT, "fd", -1, NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_open_and_close (void)
{
  ThriftTransport *transport;
  ThriftTransportClass *klass;
  GError *error;
  gint fd;
  gchar *filename;

  error = NULL;
  filename = NULL;

  fd = g_file_open_tmp (NULL, &filename, &error);
  assert (fd >= 0);

  transport = THRIFT_TRANSPORT (g_object_new (THRIFT_TYPE_FD_TRANSPORT,
                                              "fd", fd,
                                              NULL));
  klass = THRIFT_TRANSPORT_GET_CLASS (transport);

  /* open is no-op */
  assert (klass->is_open (transport));
  assert (klass->peek (transport, &error));
  assert (klass->open (transport, &error));
  assert (klass->is_open (transport));
  assert (klass->peek (transport, &error));

  assert (klass->close (transport, &error));
  assert (! klass->open (transport, &error));
  assert (! klass->is_open (transport));
  assert (! klass->peek (transport, &error));

  /* already closed */
  assert (close (fd) != 0);
  assert (errno == EBADF);

  g_object_unref (transport);

  g_remove (filename);
  g_free (filename);

  /* test bad fd */
  transport = THRIFT_TRANSPORT (g_object_new (THRIFT_TYPE_FD_TRANSPORT,
                                              "fd", -1,
                                              NULL));
  klass = THRIFT_TRANSPORT_GET_CLASS (transport);

  assert (! klass->is_open (transport));
  error = NULL;
  assert (! klass->peek (transport, &error));
  error = NULL;
  assert (! klass->open (transport, &error));
  error = NULL;
  assert (! klass->close (transport, &error));

  g_object_unref (transport);
}

static void
test_read_and_write (void)
{
  gchar out_buf[8];
  gchar *b;
  gint want, got;
  ThriftTransport *transport;
  ThriftTransportClass *klass;
  GError *error;
  gint fd;
  gchar *filename;

  error = NULL;
  filename = NULL;

  fd = g_file_open_tmp (NULL, &filename, &error);
  assert (fd >= 0);

  /* write */
  transport = THRIFT_TRANSPORT (g_object_new (THRIFT_TYPE_FD_TRANSPORT,
                                              "fd", fd,
                                              NULL));
  klass = THRIFT_TRANSPORT_GET_CLASS (transport);
  assert (klass->is_open (transport));
  assert (klass->write (transport, (gpointer) TEST_DATA, 11, &error));
  assert (klass->flush (transport, &error));
  assert (klass->close (transport, &error));
  g_object_unref (transport);

  /* read */
  fd = open(filename, O_RDONLY, S_IRUSR | S_IWUSR);
  assert (fd >= 0);

  transport = THRIFT_TRANSPORT (g_object_new (THRIFT_TYPE_FD_TRANSPORT,
                                              "fd", fd,
                                              NULL));
  klass = THRIFT_TRANSPORT_GET_CLASS (transport);

  memset(out_buf, 0, 8);
  b = out_buf;
  want = 7;
  while (want > 0) {
    got = klass->read (transport, (gpointer) b, want, &error);
    assert (got > 0 && got <= want);
    b += got;
    want -= got;
  }
  assert (memcmp (out_buf, TEST_DATA, 7) == 0);

  memset(out_buf, 0, 8);
  b = out_buf;
  want = 4;
  while (want > 0) {
    got = klass->read (transport, (gpointer) b, want, &error);
    assert (got > 0 && got <= want);
    b += got;
    want -= got;
  }
  assert (memcmp (out_buf, TEST_DATA + 7, 4) == 0);

  assert (klass->close (transport, &error));
  g_object_unref (transport);

  /* clean up */

  g_remove (filename);
  g_free (filename);
}

int
main (int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init ();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testfdtransport/CreateAndDestroy", test_create_and_destroy);
  g_test_add_func ("/testfdtransport/OpenAndClose", test_open_and_close);
  g_test_add_func ("/testfdtransport/ReadAndWrite", test_read_and_write);

  return g_test_run ();
}
