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

#include <string.h>
#include <stdio.h>

#include <thrift/c_glib/thrift.h>
#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>

G_DEFINE_TYPE(ThriftBinaryProtocol, thrift_binary_protocol, THRIFT_TYPE_PROTOCOL)

static guint64
thrift_bitwise_cast_guint64 (gdouble v)
{
  union {
    gdouble from;
    guint64 to;
  } u;
  u.from = v;
  return u.to;
}

static gdouble
thrift_bitwise_cast_gdouble (guint64 v)
{
  union {
    guint64 from;
    gdouble to;
  } u;
  u.from = v;
  return u.to;
}

gint32
thrift_binary_protocol_write_message_begin (ThriftProtocol *protocol,
    const gchar *name, const ThriftMessageType message_type,
    const gint32 seqid, GError **error)
{
  gint32 version = (THRIFT_BINARY_PROTOCOL_VERSION_1)
                   | ((gint32) message_type);
  gint32 ret;
  gint32 xfer = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_write_i32 (protocol, version, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  if ((ret = thrift_protocol_write_string (protocol, name, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  if ((ret = thrift_protocol_write_i32 (protocol, seqid, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  return xfer;
}

gint32
thrift_binary_protocol_write_message_end (ThriftProtocol *protocol,
                                          GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_struct_begin (ThriftProtocol *protocol,
                                           const gchar *name,
                                           GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (name);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_struct_end (ThriftProtocol *protocol,
                                         GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_field_begin (ThriftProtocol *protocol,
                                          const gchar *name,
                                          const ThriftType field_type,
                                          const gint16 field_id,
                                          GError **error)
{
  gint32 ret;
  gint32 xfer = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  THRIFT_UNUSED_VAR (name);

  if ((ret = thrift_protocol_write_byte (protocol, (gint8) field_type,
                                         error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  if ((ret = thrift_protocol_write_i16 (protocol, field_id, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  return xfer;
}

gint32
thrift_binary_protocol_write_field_end (ThriftProtocol *protocol,
                                        GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_field_stop (ThriftProtocol *protocol,
                                         GError **error)
{
  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);
  return thrift_protocol_write_byte (protocol, (gint8) T_STOP, error);
}

gint32
thrift_binary_protocol_write_map_begin (ThriftProtocol *protocol,
                                        const ThriftType key_type,
                                        const ThriftType value_type,
                                        const guint32 size,
                                        GError **error)
{
  gint32 ret;
  gint32 xfer = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_write_byte (protocol, (gint8) key_type,
                                         error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  if ((ret = thrift_protocol_write_byte (protocol, (gint8) value_type,
                                         error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  if ((ret = thrift_protocol_write_i32 (protocol, (gint32) size, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  return xfer;
}

gint32
thrift_binary_protocol_write_map_end (ThriftProtocol *protocol,
                                      GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_list_begin (ThriftProtocol *protocol,
                                         const ThriftType element_type,
                                         const guint32 size, 
                                         GError **error)
{
  gint32 ret;
  gint32 xfer = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_write_byte (protocol, (gint8) element_type,
                                         error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if ((ret = thrift_protocol_write_i32 (protocol, (gint32) size, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  return xfer;
}

gint32
thrift_binary_protocol_write_list_end (ThriftProtocol *protocol,
                                       GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_set_begin (ThriftProtocol *protocol,
                                        const ThriftType element_type,
                                        const guint32 size, 
                                        GError **error)
{
  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  return thrift_protocol_write_list_begin (protocol, element_type,
                                           size, error);
}

gint32
thrift_binary_protocol_write_set_end (ThriftProtocol *protocol, GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_write_bool (ThriftProtocol *protocol,
                                   const gboolean value, GError **error)
{
  guint8 tmp;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  tmp = value ? 1 : 0;
  return thrift_protocol_write_byte (protocol, tmp, error);
}

gint32
thrift_binary_protocol_write_byte (ThriftProtocol *protocol, const gint8 value,
                                   GError **error)
{
  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);
   
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &value, 1, error))
  {
    return 1;
  } else {
    return -1;
  }
}

gint32
thrift_binary_protocol_write_i16 (ThriftProtocol *protocol, const gint16 value,
                                  GError **error)
{
  gint16 net;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  net = g_htons (value);
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &net, 2, error))
  {
    return 2;
  } else {
    return -1;
  }
}

gint32
thrift_binary_protocol_write_i32 (ThriftProtocol *protocol, const gint32 value,
                                  GError **error)
{
  gint32 net;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  net = g_htonl (value);
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &net, 4, error))
  {
    return 4;
  } else {
    return -1;
  }
}

gint32
thrift_binary_protocol_write_i64 (ThriftProtocol *protocol, const gint64 value,
                                  GError **error)
{
  gint64 net;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  net = GUINT64_TO_BE (value);
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &net, 8, error))
  {
    return 8;
  } else {
    return -1;
  }
}

gint32
thrift_binary_protocol_write_double (ThriftProtocol *protocol,
                                     const gdouble value, GError **error)
{
  guint64 bits;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  bits = GUINT64_FROM_BE (thrift_bitwise_cast_guint64 (value));
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &bits, 8, error))
  {
    return 8;
  } else {
    return -1;
  }
}

gint32
thrift_binary_protocol_write_string (ThriftProtocol *protocol,
                                     const gchar *str, GError **error)
{
  guint32 len;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  len = str != NULL ? strlen (str) : 0;
  /* write the string length + 1 which includes the null terminator */
  return thrift_protocol_write_binary (protocol, (const gpointer) str, 
                                       len, error);
}

gint32
thrift_binary_protocol_write_binary (ThriftProtocol *protocol,
                                     const gpointer buf,
                                     const guint32 len, GError **error)
{
  gint32 ret;
  gint32 xfer = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_write_i32 (protocol, len, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if (len > 0)
  {
    if (thrift_transport_write (protocol->transport,
                                (const gpointer) buf, len, error) == FALSE)
    {
      return -1;
    }
    xfer += len;
  }

  return xfer;
}

gint32
thrift_binary_protocol_read_message_begin (ThriftProtocol *protocol,
                                           gchar **name,
                                           ThriftMessageType *message_type,
                                           gint32 *seqid, GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gint32 sz;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_read_i32 (protocol, &sz, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if (sz < 0)
  {
    /* check for version */
    guint32 version = sz & THRIFT_BINARY_PROTOCOL_VERSION_MASK;
    if (version != THRIFT_BINARY_PROTOCOL_VERSION_1)
    {
      g_set_error (error, THRIFT_PROTOCOL_ERROR,
                   THRIFT_PROTOCOL_ERROR_BAD_VERSION,
                   "expected version %d, got %d",
                   THRIFT_BINARY_PROTOCOL_VERSION_1, version);
      return -1;
    }

    *message_type = (ThriftMessageType) (sz & 0x000000ff);

    if ((ret = thrift_protocol_read_string (protocol, name, error)) < 0)
    {
      return -1;
    }
    xfer += ret;

    if ((ret = thrift_protocol_read_i32 (protocol, seqid, error)) < 0)
    {
      return -1;
    }
    xfer += ret;
  }
  return xfer;
}

gint32
thrift_binary_protocol_read_message_end (ThriftProtocol *protocol,
                                         GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_struct_begin (ThriftProtocol *protocol,
                                          gchar **name,
                                          GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  *name = NULL;
  return 0;
}

gint32
thrift_binary_protocol_read_struct_end (ThriftProtocol *protocol,
                                        GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_field_begin (ThriftProtocol *protocol,
                                         gchar **name,
                                         ThriftType *field_type,
                                         gint16 *field_id,
                                         GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gint8 type;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  THRIFT_UNUSED_VAR (name);

  if ((ret = thrift_protocol_read_byte (protocol, &type, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  *field_type = (ThriftType) type;
  if (*field_type == T_STOP)
  {
    *field_id = 0;
    return xfer;
  }
  if ((ret = thrift_protocol_read_i16 (protocol, field_id, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  return xfer;
}

gint32
thrift_binary_protocol_read_field_end (ThriftProtocol *protocol,
                                       GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_map_begin (ThriftProtocol *protocol,
                                       ThriftType *key_type,
                                       ThriftType *value_type,
                                       guint32 *size,
                                       GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gint8 k, v;
  gint32 sizei;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_read_byte (protocol, &k, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  *key_type = (ThriftType) k;

  if ((ret = thrift_protocol_read_byte (protocol, &v, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  *value_type = (ThriftType) v;

  if ((ret = thrift_protocol_read_i32 (protocol, &sizei, error)) <0)
  {
    return -1;
  }
  xfer += ret;

  if (sizei < 0)
  {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", sizei);
    return -1;
  }

  *size = (guint32) sizei;
  return xfer;
}

gint32
thrift_binary_protocol_read_map_end (ThriftProtocol *protocol,
                                     GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_list_begin (ThriftProtocol *protocol,
                                        ThriftType *element_type,
                                        guint32 *size, GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gint8 e;
  gint32 sizei;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = thrift_protocol_read_byte (protocol, &e, error)) < 0)
  {
    return -1;
  }
  xfer += ret;
  *element_type = (ThriftType) e;

  if ((ret = thrift_protocol_read_i32 (protocol, &sizei, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if (sizei < 0)
  {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", sizei);
    return -1;
  }

  *size = (guint32) sizei;
  return xfer;
}

gint32
thrift_binary_protocol_read_list_end (ThriftProtocol *protocol,
                                      GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_set_begin (ThriftProtocol *protocol,
                                       ThriftType *element_type,
                                       guint32 *size, GError **error)
{
  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  return thrift_protocol_read_list_begin (protocol, element_type, size, error);
}

gint32
thrift_binary_protocol_read_set_end (ThriftProtocol *protocol,
                                     GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_binary_protocol_read_bool (ThriftProtocol *protocol, gboolean *value,
                                  GError **error)
{
  gint32 ret;
  gpointer b[1];

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret = 
       thrift_transport_read_all (protocol->transport,
                                  b, 1, error)) < 0)
  {
    return -1;
  }
  *value = *(gint8 *) b != 0;
  return ret;
}

gint32
thrift_binary_protocol_read_byte (ThriftProtocol *protocol, gint8 *value,
                                  GError **error)
{
  gint32 ret;
  gpointer b[1];

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b, 1, error)) < 0)
  {
    return -1;
  }
  *value = *(gint8 *) b;
  return ret;
}

gint32
thrift_binary_protocol_read_i16 (ThriftProtocol *protocol, gint16 *value,
                                 GError **error)
{
  gint32 ret;
  union
  {
    gint8 byte_array[2];
    gint16 int16;
  } b;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b.byte_array, 2, error)) < 0)
  {
    return -1;
  }
  *value = g_ntohs (b.int16);
  return ret;
}

gint32
thrift_binary_protocol_read_i32 (ThriftProtocol *protocol, gint32 *value,
                                 GError **error)
{
  gint32 ret;
  union
  {
    gint8 byte_array[4];
    gint32 int32;
  } b;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b.byte_array, 4, error)) < 0)
  {
    return -1;
  }
  *value = g_ntohl (b.int32);
  return ret;
}

gint32
thrift_binary_protocol_read_i64 (ThriftProtocol *protocol, gint64 *value,
                                 GError **error)
{
  gint32 ret;
  union
  {
    gint8 byte_array[8];
    gint64 int64;
  } b;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b.byte_array, 8, error)) < 0)
  {
    return -1;
  }
  *value = GUINT64_FROM_BE (b.int64);
  return ret;
}

gint32
thrift_binary_protocol_read_double (ThriftProtocol *protocol,
                                    gdouble *value, GError **error)
{
  gint32 ret;
  union
  {
    gint8 byte_array[8];
    guint64 uint64;
  } b;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b.byte_array, 8, error)) < 0)
  {
    return -1;
  }
  *value = thrift_bitwise_cast_gdouble (GUINT64_FROM_BE (b.uint64));
  return ret;
}

gint32
thrift_binary_protocol_read_string (ThriftProtocol *protocol,
                                    gchar **str, GError **error)
{
  guint32 len;
  gint32 ret;
  gint32 xfer = 0;
  gint32 read_len = 0;

  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  /* read the length into read_len */
  if ((ret =
       thrift_protocol_read_i32 (protocol, &read_len, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if (read_len > 0)
  {
    /* allocate the memory for the string */
    len = (guint32) read_len + 1; /* space for null terminator */
    *str = g_new0 (gchar, len);
    if ((ret =
         thrift_transport_read_all (protocol->transport,
                                    *str, read_len, error)) < 0)
    {
      g_free (*str);
      *str = NULL;
      len = 0;
      return -1;
    }
    xfer += ret;
  } else {
    *str = NULL;
  }

  return xfer;
}

gint32
thrift_binary_protocol_read_binary (ThriftProtocol *protocol,
                                    gpointer *buf, guint32 *len,
                                    GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gint32 read_len = 0;
 
  g_return_val_if_fail (THRIFT_IS_BINARY_PROTOCOL (protocol), -1);

  /* read the length into read_len */
  if ((ret =
       thrift_protocol_read_i32 (protocol, &read_len, error)) < 0)
  {
    return -1;
  }
  xfer += ret;

  if (read_len > 0)
  {
    /* allocate the memory as an array of unsigned char for binary data */
    *len = (guint32) read_len;
    *buf = g_new (guchar, *len);
    if ((ret =
         thrift_transport_read_all (protocol->transport,
                                    *buf, *len, error)) < 0)
    {
      g_free (*buf);
      *buf = NULL;
      *len = 0;
      return -1;
    }
    xfer += ret;
  } else {
    *len = (guint32) read_len;
    *buf = NULL;
  }

  return xfer;
}

static void
thrift_binary_protocol_init (ThriftBinaryProtocol *protocol)
{
  THRIFT_UNUSED_VAR (protocol);
}

/* initialize the class */
static void
thrift_binary_protocol_class_init (ThriftBinaryProtocolClass *klass)
{
  ThriftProtocolClass *cls = THRIFT_PROTOCOL_CLASS (klass);

  cls->write_message_begin = thrift_binary_protocol_write_message_begin;
  cls->write_message_end = thrift_binary_protocol_write_message_end;
  cls->write_struct_begin = thrift_binary_protocol_write_struct_begin;
  cls->write_struct_end = thrift_binary_protocol_write_struct_end;
  cls->write_field_begin = thrift_binary_protocol_write_field_begin;
  cls->write_field_end = thrift_binary_protocol_write_field_end;
  cls->write_field_stop = thrift_binary_protocol_write_field_stop;
  cls->write_map_begin = thrift_binary_protocol_write_map_begin;
  cls->write_map_end = thrift_binary_protocol_write_map_end;
  cls->write_list_begin = thrift_binary_protocol_write_list_begin;
  cls->write_list_end = thrift_binary_protocol_write_list_end;
  cls->write_set_begin = thrift_binary_protocol_write_set_begin;
  cls->write_set_end = thrift_binary_protocol_write_set_end;
  cls->write_bool = thrift_binary_protocol_write_bool;
  cls->write_byte = thrift_binary_protocol_write_byte;
  cls->write_i16 = thrift_binary_protocol_write_i16;
  cls->write_i32 = thrift_binary_protocol_write_i32;
  cls->write_i64 = thrift_binary_protocol_write_i64;
  cls->write_double = thrift_binary_protocol_write_double;
  cls->write_string = thrift_binary_protocol_write_string;
  cls->write_binary = thrift_binary_protocol_write_binary;
  cls->read_message_begin = thrift_binary_protocol_read_message_begin;
  cls->read_message_end = thrift_binary_protocol_read_message_end;
  cls->read_struct_begin = thrift_binary_protocol_read_struct_begin;
  cls->read_struct_end = thrift_binary_protocol_read_struct_end;
  cls->read_field_begin = thrift_binary_protocol_read_field_begin;
  cls->read_field_end = thrift_binary_protocol_read_field_end;
  cls->read_map_begin = thrift_binary_protocol_read_map_begin;
  cls->read_map_end = thrift_binary_protocol_read_map_end;
  cls->read_list_begin = thrift_binary_protocol_read_list_begin;
  cls->read_list_end = thrift_binary_protocol_read_list_end;
  cls->read_set_begin = thrift_binary_protocol_read_set_begin;
  cls->read_set_end = thrift_binary_protocol_read_set_end;
  cls->read_bool = thrift_binary_protocol_read_bool;
  cls->read_byte = thrift_binary_protocol_read_byte;
  cls->read_i16 = thrift_binary_protocol_read_i16;
  cls->read_i32 = thrift_binary_protocol_read_i32;
  cls->read_i64 = thrift_binary_protocol_read_i64;
  cls->read_double = thrift_binary_protocol_read_double;
  cls->read_string = thrift_binary_protocol_read_string;
  cls->read_binary = thrift_binary_protocol_read_binary;
}
