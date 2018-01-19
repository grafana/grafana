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

/* Disable string-function optimizations when glibc is used, as these produce
   compiler warnings about string length when a string function is used inside
   a call to assert () */
#ifdef __GLIBC__
#include <features.h>
#define __NO_STRING_INLINES 1
#endif

#include <unistd.h>
#include <stdlib.h>
#include <stdio.h>
#include <assert.h>
#include <netdb.h>
#include <string.h>
#include <sys/wait.h>

#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/transport/thrift_socket.h>
#include <thrift/c_glib/transport/thrift_server_socket.h>
#include <thrift/c_glib/transport/thrift_framed_transport.h>

#define TEST_BOOL TRUE
#define TEST_BYTE 123
#define TEST_I16 12345
#define TEST_I32 1234567890
#define TEST_I64 G_GINT64_CONSTANT (123456789012345)
#define TEST_DOUBLE 1234567890.123
#define TEST_STRING "this is a test string 1234567890!@#$%^&*()"
#define TEST_PORT 51199

static int transport_read_count = 0;
static int transport_read_error = 0;
static int transport_read_error_at = -1;
gint32
my_thrift_transport_read_all (ThriftTransport *transport, gpointer buf,
                              guint32 len, GError **error)
{
  if (transport_read_count != transport_read_error_at
      && transport_read_error == 0)
  {
    transport_read_count++;
    return thrift_transport_read_all (transport, buf, len, error);
  }
  return -1;
}

static int transport_write_count = 0;
static int transport_write_error = 0;
static int transport_write_error_at = -1;
gboolean
my_thrift_transport_write (ThriftTransport *transport, const gpointer buf,
                           const guint32 len, GError **error)
{
  if (transport_write_count != transport_write_error_at
      && transport_write_error == 0)
  {
    transport_write_count++;
    return thrift_transport_write (transport, buf, len, error);
  }
  return FALSE;
}

#define thrift_transport_read_all my_thrift_transport_read_all
#define thrift_transport_write my_thrift_transport_write
#include "../src/thrift/c_glib/protocol/thrift_binary_protocol.c"
#undef thrift_transport_read_all
#undef thrift_transport_write

static void thrift_server_primitives (const int port);
static void thrift_server_complex_types (const int port);
static void thrift_server_many_frames (const int port);

static void
test_create_and_destroy(void)
{
  GObject *object = NULL;

  /* create an object and then destroy it */
  object = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, NULL);
  assert (object != NULL);
  g_object_unref (object);
}

static void
test_initialize(void)
{
  ThriftSocket *tsocket = NULL;
  ThriftBinaryProtocol *protocol = NULL;
  ThriftSocket *temp = NULL;

  /* create a ThriftTransport */
  tsocket = g_object_new (THRIFT_TYPE_SOCKET, "hostname", "localhost",
                          "port", 51188, NULL);
  assert (tsocket != NULL);
  /* create a ThriftBinaryProtocol using the Transport */
  protocol = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                           tsocket, NULL);
  assert (protocol != NULL);
  /* fetch the properties */
  g_object_get (G_OBJECT(protocol), "transport", &temp, NULL);
  g_object_unref (temp);

  /* clean up memory */
  g_object_unref (protocol);
  g_object_unref (tsocket);
}

static void
test_read_and_write_primitives(void)
{
  int status;
  pid_t pid;
  ThriftSocket *tsocket = NULL;
  ThriftTransport *transport = NULL;
  ThriftBinaryProtocol *tb = NULL;
  ThriftProtocol *protocol = NULL;
  gpointer binary = (gpointer *) TEST_STRING;
  guint32 len = strlen (TEST_STRING);
  int port = TEST_PORT;

  /* fork a server from the client */
  pid = fork ();
  assert (pid >= 0);

  if (pid == 0)
  {
    /* child listens */
    thrift_server_primitives (port);
    exit (0);
  } else {
    /* parent.  wait a bit for the socket to be created. */
    sleep (1);

    /* create a ThriftSocket */
    tsocket = g_object_new (THRIFT_TYPE_SOCKET, "hostname", "localhost",
                            "port", port, NULL);
    transport = THRIFT_TRANSPORT (tsocket);
    thrift_transport_open (transport, NULL);
    assert (thrift_transport_is_open (transport));

    /* create a ThriftBinaryTransport */
    tb = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                       tsocket, NULL);
    protocol = THRIFT_PROTOCOL (tb);
    assert (protocol != NULL);

    /* write a bunch of primitives */
    assert (thrift_binary_protocol_write_bool (protocol, TEST_BOOL, NULL) > 0);
    assert (thrift_binary_protocol_write_byte (protocol, TEST_BYTE, NULL) > 0);
    assert (thrift_binary_protocol_write_i16 (protocol, TEST_I16, NULL) > 0);
    assert (thrift_binary_protocol_write_i32 (protocol, TEST_I32, NULL) > 0);
    assert (thrift_binary_protocol_write_i64 (protocol, TEST_I64, NULL) > 0);
    assert (thrift_binary_protocol_write_double (protocol, 
                                                 TEST_DOUBLE, NULL) > 0);
    assert (thrift_binary_protocol_write_string (protocol,
                                                 TEST_STRING, NULL) > 0);
    assert (thrift_binary_protocol_write_binary (protocol, binary, 
                                                 len, NULL) > 0);
    assert (thrift_binary_protocol_write_binary (protocol, NULL, 0, NULL) > 0);
    assert (thrift_binary_protocol_write_binary (protocol, binary,
                                                 len, NULL) > 0);

    /* test write errors */
    transport_write_error = 1;
    assert (thrift_binary_protocol_write_byte (protocol, TEST_BYTE, 
                                               NULL) == -1);
    assert (thrift_binary_protocol_write_i16 (protocol, TEST_I16, NULL) == -1);
    assert (thrift_binary_protocol_write_i32 (protocol, TEST_I32, NULL) == -1);
    assert (thrift_binary_protocol_write_i64 (protocol, TEST_I64, NULL) == -1);
    assert (thrift_binary_protocol_write_double (protocol, TEST_DOUBLE,
                                                 NULL) == -1);
    assert (thrift_binary_protocol_write_binary (protocol, binary, len,
                                                 NULL) == -1);
    transport_write_error = 0;

    /* test binary partial failure */
    transport_write_count = 0;
    transport_write_error_at = 1;
    assert (thrift_binary_protocol_write_binary (protocol, binary,
                                                 len, NULL) == -1);
    transport_write_error_at = -1;

    /* clean up */
    thrift_transport_close (transport, NULL);
    g_object_unref (tsocket);
    g_object_unref (protocol);
    assert (wait (&status) == pid);
    assert (status == 0);
  }
}

static void
test_read_and_write_complex_types (void)
{
  int status;
  pid_t pid;
  ThriftSocket *tsocket = NULL;
  ThriftTransport *transport = NULL;
  ThriftBinaryProtocol *tb = NULL;
  ThriftProtocol *protocol = NULL;
  int port = TEST_PORT;

  /* fork a server from the client */
  pid = fork ();
  assert (pid >= 0);

  if (pid == 0)
  {
    /* child listens */
    thrift_server_complex_types (port);
    exit (0);
  } else {
    /* parent.  wait a bit for the socket to be created. */
    sleep (1);

    /* create a ThriftSocket */
    tsocket = g_object_new (THRIFT_TYPE_SOCKET, "hostname", "localhost",
                            "port", port, NULL);
    transport = THRIFT_TRANSPORT (tsocket);
    thrift_transport_open (transport, NULL);
    assert (thrift_transport_is_open (transport));

    /* create a ThriftBinaryTransport */
    tb = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                       tsocket, NULL);
    protocol = THRIFT_PROTOCOL (tb);
    assert (protocol != NULL);

    /* test structures */
    assert (thrift_binary_protocol_write_struct_begin (protocol, 
                                                       NULL, NULL) == 0);
    assert (thrift_binary_protocol_write_struct_end (protocol, NULL) == 0);

    assert (thrift_binary_protocol_write_field_begin (protocol, "test", T_VOID,
                                                      1, NULL) > 0);
    assert (thrift_binary_protocol_write_field_end (protocol, NULL) == 0);

    /* test write error */
    transport_write_error = 1;
    assert (thrift_binary_protocol_write_field_begin (protocol, "test", T_VOID, 
                                                      1, NULL) == -1);
    transport_write_error = 0;

    /* test 2nd write error */
    transport_write_count = 0;
    transport_write_error_at = 1;
    assert (thrift_binary_protocol_write_field_begin (protocol, "test", T_VOID,
                                                      1, NULL) == -1);
    transport_write_error_at = -1;

    /* test 2nd read failure on a field */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);

    /* test write_field_stop */
    assert (thrift_binary_protocol_write_field_stop (protocol, NULL) > 0);

    /* write a map */
    assert (thrift_binary_protocol_write_map_begin (protocol, T_VOID, T_VOID,
                                                    1, NULL) > 0);
    assert (thrift_binary_protocol_write_map_end (protocol, NULL) == 0);

    /* test 2nd read failure on a map */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);

    /* test 3rd read failure on a map */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);

    /* test 1st write failure on a map */
    transport_write_error = 1;
    assert (thrift_binary_protocol_write_map_begin (protocol, T_VOID, T_VOID,
                                                    1, NULL) == -1);
    transport_write_error = 0;

    /* test 2nd write failure on a map */
    transport_write_count = 0;
    transport_write_error_at = 1;
    assert (thrift_binary_protocol_write_map_begin (protocol, T_VOID, T_VOID,
                                                    1, NULL) == -1);
    transport_write_error_at = -1;

    /* test 3rd write failure on a map */
    transport_write_count = 0;
    transport_write_error_at = 2;
    assert (thrift_binary_protocol_write_map_begin (protocol, T_VOID, T_VOID,
                                                    1, NULL) == -1);
    transport_write_error_at = -1;

    /* test negative map size */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);
    thrift_binary_protocol_write_i32 (protocol, -10, NULL);

    /* test list operations */
    assert (thrift_binary_protocol_write_list_begin (protocol, T_VOID,
                                                     1, NULL) > 0);
    assert (thrift_binary_protocol_write_list_end (protocol, NULL) == 0);

    /* test 2nd read failure on a list */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);

    /* test negative list size */
    thrift_binary_protocol_write_byte (protocol, T_VOID, NULL);
    thrift_binary_protocol_write_i32 (protocol, -10, NULL);

    /* test first write error on a list */
    transport_write_error = 1;
    assert (thrift_binary_protocol_write_list_begin (protocol, T_VOID,
                                                     1, NULL) == -1);
    transport_write_error = 0;

    /* test 2nd write error on a list */
    transport_write_count = 0;
    transport_write_error_at = 1;
    assert (thrift_binary_protocol_write_list_begin (protocol, T_VOID,
                                                     1, NULL) == -1);
    transport_write_error_at = -1;

    /* test set operation s*/
    assert (thrift_binary_protocol_write_set_begin (protocol, T_VOID,
                                                    1, NULL) > 0);
    assert (thrift_binary_protocol_write_set_end (protocol, NULL) == 0);

    /* invalid version */
    assert (thrift_binary_protocol_write_i32 (protocol, -1, NULL) > 0);

    /* sz > 0 for a message */
    assert (thrift_binary_protocol_write_i32 (protocol, 1, NULL) > 0);

    /* send a valid message */
    thrift_binary_protocol_write_i32 (protocol, 0x80010000, NULL);
    thrift_binary_protocol_write_string (protocol, "test", NULL);
    thrift_binary_protocol_write_i32 (protocol, 1, NULL);

    /* broken 2nd read */
    thrift_binary_protocol_write_i32 (protocol, 0x80010000, NULL);

    /* send a broken 3rd read */
    thrift_binary_protocol_write_i32 (protocol, 0x80010000, NULL);
    thrift_binary_protocol_write_string (protocol, "test", NULL);

    /* send a valid message */
    assert (thrift_binary_protocol_write_message_begin (protocol, "test",
                                                        T_CALL, 1, NULL) > 0);

    assert (thrift_binary_protocol_write_message_end (protocol, NULL) == 0);

    /* send broken writes */
    transport_write_error = 1;
    assert (thrift_binary_protocol_write_message_begin (protocol, "test",
                                                        T_CALL, 1, NULL) == -1);
    transport_write_error = 0;

    transport_write_count = 0;
    transport_write_error_at = 2;
    assert (thrift_binary_protocol_write_message_begin (protocol, "test",
                                                        T_CALL, 1, NULL) == -1);
    transport_write_error_at = -1;

    transport_write_count = 0;
    transport_write_error_at = 3;
    assert (thrift_binary_protocol_write_message_begin (protocol, "test",
                                                        T_CALL, 1, NULL) == -1);
    transport_write_error_at = -1;

    /* clean up */
    thrift_transport_close (transport, NULL);
    g_object_unref (tsocket);
    g_object_unref (protocol);
    assert (wait (&status) == pid);
    assert (status == 0);
  }
}

static void
test_read_and_write_many_frames (void)
{
  int status;
  pid_t pid;
  ThriftSocket *tsocket = NULL;
  ThriftTransport *transport = NULL;
  ThriftFramedTransport *ft = NULL;
  ThriftBinaryProtocol *tb = NULL;
  ThriftProtocol *protocol = NULL;
  gpointer binary = (gpointer *) TEST_STRING;
  const guint32 len = strlen (TEST_STRING);
  int port = TEST_PORT;

  /* fork a server from the client */
  pid = fork ();
  assert (pid >= 0);

  if (pid == 0)
  {
    /* child listens */
    thrift_server_many_frames (port);
    exit (0);
  } else {
    /* parent.  wait a bit for the socket to be created. */
    sleep (1);

    /* create a ThriftSocket */
    tsocket = g_object_new (THRIFT_TYPE_SOCKET, "hostname", "localhost",
                            "port", port, NULL);
    assert (tsocket != NULL);
    transport = THRIFT_TRANSPORT (tsocket);

    /* wrap in a framed transport */
    ft = g_object_new (THRIFT_TYPE_FRAMED_TRANSPORT, "transport", transport,
                       "w_buf_size", 1, NULL);
    assert (ft != NULL);
    transport = THRIFT_TRANSPORT (ft);

    thrift_transport_open (transport, NULL);
    assert (thrift_transport_is_open (transport));

    /* create a binary protocol */
    tb = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                       transport, NULL);
    protocol = THRIFT_PROTOCOL (tb);
    assert (protocol != NULL);

    /* write a bunch of primitives */
    assert (thrift_binary_protocol_write_bool (protocol, TEST_BOOL, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_byte (protocol, TEST_BYTE, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_i16 (protocol, TEST_I16, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_i32 (protocol, TEST_I32, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_i64 (protocol, TEST_I64, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_double (protocol,
                                                 TEST_DOUBLE, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_string (protocol,
                                                 TEST_STRING, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_binary (protocol, binary,
                                                 len, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_binary (protocol, NULL, 0, NULL) > 0);
    thrift_transport_flush (transport, NULL);
    assert (thrift_binary_protocol_write_binary (protocol, binary,
                                                 len, NULL) > 0);
    thrift_transport_flush (transport, NULL);

    /* clean up */
    thrift_transport_write_end (transport, NULL);
    thrift_transport_close (transport, NULL);
    g_object_unref (ft);
    g_object_unref (tsocket);
    g_object_unref (tb);
    assert (wait (&status) == pid);
    assert (status == 0);
  }
}


static void
thrift_server_primitives (const int port)
{
  ThriftServerTransport *transport = NULL;
  ThriftTransport *client = NULL;
  ThriftBinaryProtocol *tbp = NULL;
  ThriftProtocol *protocol = NULL;
  gboolean value_boolean = FALSE;
  gint8 value_byte = 0;
  gint16 value_16 = 0;
  gint32 value_32 = 0;
  gint64 value_64 = 0;
  gdouble value_double = 0;
  gchar *string = NULL;
  gpointer binary = NULL;
  guint32 len = 0;
  void *comparator = (void *) TEST_STRING;

  ThriftServerSocket *tsocket = g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                                              "port", port, NULL);
  transport = THRIFT_SERVER_TRANSPORT (tsocket);
  thrift_server_transport_listen (transport, NULL);
  client = thrift_server_transport_accept (transport, NULL);
  assert (client != NULL);

  tbp = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                      client, NULL);
  protocol = THRIFT_PROTOCOL (tbp);

  assert (thrift_binary_protocol_read_bool (protocol,
                                            &value_boolean, NULL) > 0);
  assert (thrift_binary_protocol_read_byte (protocol, &value_byte, NULL) > 0);
  assert (thrift_binary_protocol_read_i16 (protocol, &value_16, NULL) > 0);
  assert (thrift_binary_protocol_read_i32 (protocol, &value_32, NULL) > 0);
  assert (thrift_binary_protocol_read_i64 (protocol, &value_64, NULL) > 0);
  assert (thrift_binary_protocol_read_double (protocol,
                                              &value_double, NULL) > 0);
  assert (thrift_binary_protocol_read_string (protocol, &string, NULL) > 0);
  assert (thrift_binary_protocol_read_binary (protocol, &binary,
                                              &len, NULL) > 0);

  assert (value_boolean == TEST_BOOL);
  assert (value_byte == TEST_BYTE);
  assert (value_16 == TEST_I16);
  assert (value_32 == TEST_I32);
  assert (value_64 == TEST_I64);
  assert (value_double == TEST_DOUBLE);
  assert (strcmp (TEST_STRING, string) == 0);
  assert (memcmp (comparator, binary, len) == 0);

  g_free (string);
  g_free (binary);

  thrift_binary_protocol_read_binary (protocol, &binary, &len, NULL);
  g_free (binary);

  transport_read_count = 0;
  transport_read_error_at = 0;
  assert (thrift_binary_protocol_read_binary (protocol, &binary,
                                              &len, NULL) == -1);
  transport_read_error_at = -1;

  transport_read_count = 0;
  transport_read_error_at = 1;
  assert (thrift_binary_protocol_read_binary (protocol, &binary,
                                              &len, NULL) == -1);
  transport_read_error_at = -1;

  transport_read_error = 1;
  assert (thrift_binary_protocol_read_bool (protocol,
                                            &value_boolean, NULL) == -1);
  assert (thrift_binary_protocol_read_byte (protocol,
                                            &value_byte, NULL) == -1);
  assert (thrift_binary_protocol_read_i16 (protocol,
                                           &value_16, NULL) == -1);
  assert (thrift_binary_protocol_read_i32 (protocol, &value_32, NULL) == -1);
  assert (thrift_binary_protocol_read_i64 (protocol, &value_64, NULL) == -1);
  assert (thrift_binary_protocol_read_double (protocol,
                                              &value_double, NULL) == -1);
  transport_read_error = 0;

  /* test partial write failure */
  thrift_protocol_read_i32 (protocol, &value_32, NULL);

  thrift_transport_read_end (client, NULL);
  thrift_transport_close (client, NULL);

  g_object_unref (tbp);
  g_object_unref (client);
  g_object_unref (tsocket);
}

static void
thrift_server_complex_types (const int port)
{
  ThriftServerTransport *transport = NULL;
  ThriftTransport *client = NULL;
  ThriftBinaryProtocol *tbp = NULL;
  ThriftProtocol *protocol = NULL;
  gchar *struct_name = NULL;
  gchar *field_name = NULL;
  gchar *message_name = NULL;
  ThriftType element_type, key_type, value_type, field_type;
  ThriftMessageType message_type;
  gint8 value = 0;
  gint16 field_id = 0;
  guint32 size = 0;
  gint32 seqid = 0;
  gint32 version = 0;

  ThriftServerSocket *tsocket = g_object_new (THRIFT_TYPE_SERVER_SOCKET,
                                              "port", port, NULL);
  transport = THRIFT_SERVER_TRANSPORT (tsocket);
  thrift_server_transport_listen (transport, NULL);
  client = thrift_server_transport_accept (transport, NULL);
  assert (client != NULL);

  tbp = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                      client, NULL);
  protocol = THRIFT_PROTOCOL (tbp);

  thrift_binary_protocol_read_struct_begin (protocol, &struct_name, NULL);
  thrift_binary_protocol_read_struct_end (protocol, NULL);

  thrift_binary_protocol_read_field_begin (protocol, &field_name, &field_type,
                                           &field_id, NULL);
  thrift_binary_protocol_read_field_end (protocol, NULL);

  /* test first read error on a field */
  transport_read_error = 1;
  assert (thrift_binary_protocol_read_field_begin (protocol,
                                                   &field_name, &field_type,
                                                   &field_id, NULL) == -1);
  transport_read_error = 0;

  /* test 2nd write failure */
  thrift_binary_protocol_read_byte (protocol, &value, NULL);

  /* test 2nd read failure on a field */
  transport_read_count = 0;
  transport_read_error_at = 1;
  assert (thrift_binary_protocol_read_field_begin (protocol,
                                                   &field_name, &field_type,
                                                   &field_id, NULL) == -1);
  transport_read_error_at = -1;

  /* test field stop */
  thrift_binary_protocol_read_field_begin (protocol, &field_name, &field_type,
                                           &field_id, NULL);

  thrift_binary_protocol_read_map_begin (protocol, &key_type, &value_type,
                                         &size, NULL);
  thrift_binary_protocol_read_map_end (protocol, NULL);

  /* test read failure on a map */
  transport_read_count = 0;
  transport_read_error_at = 0;
  assert (thrift_binary_protocol_read_map_begin (protocol,
                                                 &key_type, &value_type,
                                                 &size, NULL) == -1);
  transport_read_error_at = -1;

  /* test 2nd read failure on a map */
  transport_read_count = 0;
  transport_read_error_at = 1;
  assert (thrift_binary_protocol_read_map_begin (protocol,
                                                 &key_type, &value_type,
                                                 &size, NULL) == -1);
  transport_read_error_at = -1;

  /* test 3rd read failure on a map */
  transport_read_count = 0;
  transport_read_error_at = 2;
  assert (thrift_binary_protocol_read_map_begin (protocol,
                                                 &key_type, &value_type,
                                                 &size, NULL) == -1);
  transport_read_error_at = -1;

  /* test 2nd write failure */
  thrift_binary_protocol_read_byte (protocol, &value, NULL);

  /* test 3rd write failure */
  thrift_binary_protocol_read_byte (protocol, &value, NULL);
  thrift_binary_protocol_read_byte (protocol, &value, NULL);

  /* test negative map size */
  assert (thrift_binary_protocol_read_map_begin (protocol,
                                                 &key_type, &value_type,
                                                 &size, NULL) == -1);

  /* test list operations */
  thrift_binary_protocol_read_list_begin (protocol, &element_type, &size, NULL);
  thrift_binary_protocol_read_list_end (protocol, NULL);

  /* test read failure */
  transport_read_error = 1;
  assert (thrift_binary_protocol_read_list_begin (protocol, &element_type,
                                                  &size, NULL) == -1);
  transport_read_error = 0;

  /* test 2nd read failure */
  transport_read_count = 0;
  transport_read_error_at = 1;
  thrift_binary_protocol_read_list_begin (protocol, &element_type, &size, NULL);
  transport_read_error_at = -1;

  /* test negative list size failure */
  thrift_binary_protocol_read_list_begin (protocol, &element_type, &size, NULL);

  /* test 2nd write failure */
  thrift_binary_protocol_read_byte (protocol, &value, NULL);

  /* test set operations */
  thrift_binary_protocol_read_set_begin (protocol, &element_type, &size, NULL);
  thrift_binary_protocol_read_set_end (protocol, NULL);

  /* broken read */
  transport_read_error = 1;
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) == -1);
  transport_read_error = 0;

  /* invalid protocol version */
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) == -1);

  /* sz > 0 */
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) > 0);

  /* read a valid message */
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) > 0);
  g_free (message_name);

  /* broken 2nd read on a message */
  transport_read_count = 0;
  transport_read_error_at = 1;
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) == -1);
  transport_read_error_at = -1;

  /* broken 3rd read on a message */
  transport_read_count = 0;
  transport_read_error_at = 3; /* read_string does two reads */
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid,
                                                     NULL) == -1);
  g_free (message_name);
  transport_read_error_at = -1;

  /* read a valid message */
  assert (thrift_binary_protocol_read_message_begin (protocol, &message_name,
                                                     &message_type, &seqid, 
                                                     NULL) > 0);
  g_free (message_name);

  assert (thrift_binary_protocol_read_message_end (protocol, NULL) == 0);

  /* handle 2nd write failure on a message */
  thrift_binary_protocol_read_i32 (protocol, &version, NULL);

  /* handle 2nd write failure on a message */
  thrift_binary_protocol_read_i32 (protocol, &version, NULL);
  thrift_binary_protocol_read_string (protocol, &message_name, NULL);

  g_object_unref (client);
  /* TODO: investigate g_object_unref (tbp); */
  g_object_unref (tsocket);
}

static void
thrift_server_many_frames (const int port)
{
  ThriftServerTransport *transport = NULL;
  ThriftTransport *client = NULL;
  ThriftBinaryProtocol *tbp = NULL;
  ThriftProtocol *protocol = NULL;
  ThriftServerSocket *tsocket = NULL;
  gboolean value_boolean = FALSE;
  gint8 value_byte = 0;
  gint16 value_16 = 0;
  gint32 value_32 = 0;
  gint64 value_64 = 0;
  gdouble value_double = 0;
  gchar *string = NULL;
  gpointer binary = NULL;
  guint32 len = 0;
  void *comparator = (void *) TEST_STRING;

  tsocket = g_object_new (THRIFT_TYPE_SERVER_SOCKET, "port", port, NULL);
  transport = THRIFT_SERVER_TRANSPORT (tsocket);
  thrift_server_transport_listen (transport, NULL);

  /* wrap the client in a framed transport */
  client = g_object_new (THRIFT_TYPE_FRAMED_TRANSPORT, "transport",
                         thrift_server_transport_accept (transport, NULL),
                         "r_buf_size", 1, NULL);
  assert (client != NULL);

  tbp = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL, "transport",
                      client, NULL);
  protocol = THRIFT_PROTOCOL (tbp);

  assert (thrift_binary_protocol_read_bool (protocol,
                                            &value_boolean, NULL) > 0);
  assert (thrift_binary_protocol_read_byte (protocol, &value_byte, NULL) > 0);
  assert (thrift_binary_protocol_read_i16 (protocol, &value_16, NULL) > 0);
  assert (thrift_binary_protocol_read_i32 (protocol, &value_32, NULL) > 0);
  assert (thrift_binary_protocol_read_i64 (protocol, &value_64, NULL) > 0);
  assert (thrift_binary_protocol_read_double (protocol,
                                              &value_double, NULL) > 0);
  assert (thrift_binary_protocol_read_string (protocol, &string, NULL) > 0);
  assert (thrift_binary_protocol_read_binary (protocol, &binary,
                                              &len, NULL) > 0);

  assert (value_boolean == TEST_BOOL);
  assert (value_byte == TEST_BYTE);
  assert (value_16 == TEST_I16);
  assert (value_32 == TEST_I32);
  assert (value_64 == TEST_I64);
  assert (value_double == TEST_DOUBLE);
  assert (strcmp (TEST_STRING, string) == 0);
  assert (memcmp (comparator, binary, len) == 0);

  g_free (string);
  g_free (binary);

  thrift_transport_read_end (client, NULL);
  thrift_transport_close (client, NULL);

  g_object_unref (tbp);
  g_object_unref (client);
  g_object_unref (tsocket);
}

int
main(int argc, char *argv[])
{
#if (!GLIB_CHECK_VERSION (2, 36, 0))
  g_type_init();
#endif

  g_test_init (&argc, &argv, NULL);

  g_test_add_func ("/testbinaryprotocol/CreateAndDestroy", test_create_and_destroy);
  g_test_add_func ("/testbinaryprotocol/Initialize", test_initialize);
  g_test_add_func ("/testbinaryprotocol/ReadAndWritePrimitives", test_read_and_write_primitives);
  g_test_add_func ("/testbinaryprotocol/ReadAndWriteComplexTypes", test_read_and_write_complex_types);
  g_test_add_func ("/testbinaryprotocol/ReadAndWriteManyFrames",
                   test_read_and_write_many_frames);

  return g_test_run ();
}
