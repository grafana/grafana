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
#include <thrift/c_glib/protocol/thrift_compact_protocol.h>

#include <thrift/config.h>

/*
 * *_to_zigzag depend on the fact that the right shift
 * operator on a signed integer is an arithmetic (sign-extending) shift.
 * If this is not the case, the current implementation will not work.
 */
#if !defined(SIGNED_RIGHT_SHIFT_IS) || !defined(ARITHMETIC_RIGHT_SHIFT)
# error "Unable to determine the behavior of a signed right shift"
#endif
#if SIGNED_RIGHT_SHIFT_IS != ARITHMETIC_RIGHT_SHIFT
# error "thrift_compact_protocol only works if signed right shift is arithmetic"
#endif

/* object properties */
enum _ThriftCompactProtocolProperties
{
    PROP_0,
    PROP_THRIFT_COMPACT_PROTOCOL_STRING_LIMIT,
    PROP_THRIFT_COMPACT_PROTOCOL_CONTAINER_LIMIT
};

G_DEFINE_TYPE (ThriftCompactProtocol, thrift_compact_protocol,
               THRIFT_TYPE_PROTOCOL)

static const gint8 PROTOCOL_ID = (gint8)0x82u;
static const gint8 VERSION_N = 1;
static const gint8 VERSION_MASK = 0x1f;       /* 0001 1111 */
static const gint8 TYPE_MASK = (gint8)0xe0u;  /* 1110 0000 */
static const gint8 TYPE_BITS = 0x07;          /* 0000 0111 */
static const gint32 TYPE_SHIFT_AMOUNT = 5;

enum Types {
  CT_STOP           = 0x00,
  CT_BOOLEAN_TRUE   = 0x01,
  CT_BOOLEAN_FALSE  = 0x02,
  CT_BYTE           = 0x03,
  CT_I16            = 0x04,
  CT_I32            = 0x05,
  CT_I64            = 0x06,
  CT_DOUBLE         = 0x07,
  CT_BINARY         = 0x08,
  CT_LIST           = 0x09,
  CT_SET            = 0x0A,
  CT_MAP            = 0x0B,
  CT_STRUCT         = 0x0C
};

static const gint8 TTypeToCType[16] = {
  CT_STOP, /* T_STOP */
  0, /* unused */
  CT_BOOLEAN_TRUE, /* T_BOOL */
  CT_BYTE, /* T_BYTE */
  CT_DOUBLE, /* T_DOUBLE */
  0, /* unused */
  CT_I16, /* T_I16 */
  0, /* unused */
  CT_I32, /* T_I32 */
  0, /* unused */
  CT_I64, /* T_I64 */
  CT_BINARY, /* T_STRING */
  CT_STRUCT, /* T_STRUCT */
  CT_MAP, /* T_MAP */
  CT_SET, /* T_SET */
  CT_LIST, /* T_LIST */
};

static guint64
thrift_bitwise_cast_guint64 (const gdouble v)
{
  union {
    gdouble from;
    guint64 to;
  } u;
  u.from = v;
  return u.to;
}

static gdouble
thrift_bitwise_cast_gdouble (const guint64 v)
{
  union {
    guint64 from;
    gdouble to;
  } u;
  u.from = v;
  return u.to;
}

/**
 * Convert l into a zigzag long. This allows negative numbers to be
 * represented compactly as a varint.
 */
static guint64
i64_to_zigzag (const gint64 l)
{
  return (l << 1) ^ (l >> 63);
}

/**
 * Convert n into a zigzag int. This allows negative numbers to be
 * represented compactly as a varint.
 */
static guint32
i32_to_zigzag (const gint32 n)
{
  return (n << 1) ^ (n >> 31);
}

/**
 * Convert from zigzag int to int.
 */
static gint32
zigzag_to_i32 (guint32 n)
{
  return (n >> 1) ^ (guint32) (-(gint32) (n & 1));
}

/**
 * Convert from zigzag long to long.
 */
static gint64
zigzag_to_i64 (guint64 n)
{
  return (n >> 1) ^ (guint64) (-(gint64) (n & 1));
}

ThriftType thrift_compact_protocol_get_ttype (ThriftCompactProtocol *protocol,
                                              const gint8 type, GError **error)
{
  THRIFT_UNUSED_VAR (protocol);

  switch (type) {
    case T_STOP:
      return T_STOP;
    case CT_BOOLEAN_FALSE:
    case CT_BOOLEAN_TRUE:
      return T_BOOL;
    case CT_BYTE:
      return T_BYTE;
    case CT_I16:
      return T_I16;
    case CT_I32:
      return T_I32;
    case CT_I64:
      return T_I64;
    case CT_DOUBLE:
      return T_DOUBLE;
    case CT_BINARY:
      return T_STRING;
    case CT_LIST:
      return T_LIST;
    case CT_SET:
      return T_SET;
    case CT_MAP:
      return T_MAP;
    case CT_STRUCT:
      return T_STRUCT;
    default:
      g_set_error (error, THRIFT_PROTOCOL_ERROR,
                   THRIFT_PROTOCOL_ERROR_INVALID_DATA,
                   "unrecognized type");
      return -1;
  }
}

/**
 * Write an i32 as a varint. Results in 1-5 bytes on the wire.
 */
gint32
thrift_compact_protocol_write_varint32 (ThriftCompactProtocol *protocol,
                                        const guint32 n,
                                        GError **error)
{
  guint8 buf[5];
  gint32 xfer;
  guint32 m;

  THRIFT_UNUSED_VAR (error);

  xfer = 0;
  m = n;

  while (TRUE) {
    if ((m & ~0x7F) == 0) {
      buf[xfer++] = (gint8)m;
      break;
    } else {
      buf[xfer++] = (gint8)((m & 0x7F) | 0x80);
      m >>= 7;
    }
  }

  if (thrift_transport_write (THRIFT_PROTOCOL (protocol)->transport,
                              (const gpointer) buf, xfer, error)) {
    return xfer;
  } else {
    return -1;
  }
}

/**
 * Write an i64 as a varint. Results in 1-10 bytes on the wire.
 */
gint32
thrift_compact_protocol_write_varint64 (ThriftCompactProtocol *protocol,
                                        const guint64 n,
                                        GError **error)
{
  guint8 buf[10];
  gint32 xfer;
  guint64 m;

  THRIFT_UNUSED_VAR (error);

  xfer = 0;
  m = n;

  while (TRUE) {
    if ((m & ~0x7FL) == 0) {
      buf[xfer++] = (gint8)m;
      break;
    } else {
      buf[xfer++] = (gint8)((m & 0x7F) | 0x80);
      m >>= 7;
    }
  }

  if (thrift_transport_write (THRIFT_PROTOCOL (protocol)->transport,
                              (const gpointer) buf, xfer, error)) {
    return xfer;
  } else {
    return -1;
  }
}

/**
 * Read an i64 from the wire as a proper varint. The MSB of each byte is set
 * if there is another byte to follow. This can read up to 10 bytes.
 */
gint32
thrift_compact_protocol_read_varint64 (ThriftCompactProtocol *protocol,
                                       gint64 *i64,
                                       GError **error)
{
  ThriftProtocol *tp;
  gint32 ret;
  gint32 xfer;
  guint64 val;
  gint shift;
  guint8 byte;

  tp = THRIFT_PROTOCOL (protocol);
  xfer = 0;
  val = 0;
  shift = 0;
  byte = 0;

  while (TRUE) {
    if ((ret = thrift_transport_read_all (tp->transport,
                                          (gpointer) &byte, 1, error)) < 0) {
      return -1;
    }
    ++xfer;
    val |= (guint64)(byte & 0x7f) << shift;
    shift += 7;
    if (!(byte & 0x80)) {
      *i64 = (gint64) val;
      return xfer;
    }
    if (G_UNLIKELY (xfer == 10)) { /* 7 * 9 < 64 < 7 * 10 */
      g_set_error (error, THRIFT_PROTOCOL_ERROR,
                   THRIFT_PROTOCOL_ERROR_INVALID_DATA,
                   "variable-length int over 10 bytes");
      return -1;
    }
  }
}

/**
 * Read an i32 from the wire as a varint. The MSB of each byte is set
 * if there is another byte to follow. This can read up to 5 bytes.
 */
gint32
thrift_compact_protocol_read_varint32 (ThriftCompactProtocol *protocol,
                                       gint32 *i32,
                                       GError **error)
{
  gint64 val;
  gint32 ret;
  gint32 xfer;

  xfer = 0;

  if ((ret = thrift_compact_protocol_read_varint64 (protocol, &val,
                                                    error)) < 0) {
    return -1;
  }
  xfer += ret;

  *i32 = (gint32)val;

  return xfer;
}

gint32
thrift_compact_protocol_write_field_begin_internal (ThriftCompactProtocol
                                                      *protocol,
                                                    const gchar *name,
                                                    const ThriftType field_type,
                                                    const gint16 field_id,
                                                    const gint8 type_override,
                                                    GError **error)
{
  gint32 ret;
  gint32 xfer;
  gint8 type_to_write;

  THRIFT_UNUSED_VAR (name);

  xfer = 0;

  /* if there's a type override, use that. */
  type_to_write
    = (type_override == -1 ? TTypeToCType[field_type] : type_override);

  /* check if we can use delta encoding for the field id */
  if (field_id > protocol->_last_field_id
      && field_id - protocol->_last_field_id <= 15) {
    /* write them together */
    if ((ret = thrift_protocol_write_byte (THRIFT_PROTOCOL (protocol),
                                           (gint8) ((field_id
                                                     - protocol->_last_field_id)
                                                    << 4 | type_to_write),
                                           error)) < 0) {
      return -1;
    }
    xfer += ret;
  } else {
    /* write them separate */
    if ((ret = thrift_protocol_write_byte (THRIFT_PROTOCOL (protocol),
                                           type_to_write, error)) < 0) {
      return -1;
    }
    xfer += ret;

    if ((ret = thrift_protocol_write_i16 (THRIFT_PROTOCOL (protocol), field_id,
                                          error)) < 0) {
      return -1;
    }
    xfer += ret;
  }

  protocol->_last_field_id = field_id;
  return xfer;
}

/**
 * Method for writing the start of lists and sets. List and sets on
 * the wire differ only by the type indicator.
 */
gint32
thrift_compact_protocol_write_collection_begin (ThriftCompactProtocol *protocol,
                                                const ThriftType elem_type,
                                                guint32 size, GError **error)
{
  gint32 ret;
  gint32 xfer;

  xfer = 0;

  if (size <= 14) {
    if ((ret = thrift_protocol_write_byte (THRIFT_PROTOCOL (protocol),
                                           (gint8) (size << 4
                                                    | TTypeToCType[elem_type]),
                                           error)) < 0) {
      return -1;
    }
    xfer += ret;
  } else {
    if ((ret = thrift_protocol_write_byte (THRIFT_PROTOCOL (protocol),
                                           (gint8) (0xf0
                                                    | TTypeToCType[elem_type]),
                                           error)) < 0) {
      return -1;
    }
    xfer += ret;

    if ((ret = thrift_compact_protocol_write_varint32 (protocol,
                                                       (guint32) size,
                                                       error)) < 0) {
      return -1;
    }
    xfer += ret;
  }

  return xfer;
}

/*
 * public methods
 */

gint32
thrift_compact_protocol_write_message_begin (ThriftProtocol *protocol,
                                             const gchar *name,
                                             const ThriftMessageType
                                               message_type,
                                             const gint32 seqid, GError **error)
{
  gint8 version;
  gint32 ret;
  gint32 xfer;

  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  version = (VERSION_N & VERSION_MASK)
            | (((gint32) message_type << TYPE_SHIFT_AMOUNT) & TYPE_MASK);
  xfer = 0;

  if ((ret = thrift_protocol_write_byte (protocol, PROTOCOL_ID, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if ((ret = thrift_protocol_write_byte (protocol, version, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if ((ret = thrift_compact_protocol_write_varint32 (cp,
                                                     (guint32) seqid,
                                                     error)) < 0) {
    return -1;
  }
  xfer += ret;

  if ((ret = thrift_protocol_write_string (protocol, name, error)) < 0) {
    return -1;
  }
  xfer += ret;

  return xfer;
}

gint32
thrift_compact_protocol_write_message_end (ThriftProtocol *protocol,
                                           GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_write_struct_begin (ThriftProtocol *protocol,
                                            const gchar *name,
                                            GError **error)
{
  ThriftCompactProtocol *cp;
  GQueue *q;

  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (name);
  THRIFT_UNUSED_VAR (error);

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);
  q = &(cp->_last_field);

  g_queue_push_tail (q, GINT_TO_POINTER ((gint) cp->_last_field_id));
  cp->_last_field_id = 0;
  return 0;
}

gint32
thrift_compact_protocol_write_struct_end (ThriftProtocol *protocol,
                                          GError **error)
{
  ThriftCompactProtocol *cp;
  GQueue *q;

  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (error);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);
  q = &(cp->_last_field);

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp->_last_field_id = (gint16) GPOINTER_TO_INT (g_queue_pop_tail (q));
  return 0;
}

gint32
thrift_compact_protocol_write_field_begin (ThriftProtocol *protocol,
                                           const gchar *name,
                                           const ThriftType field_type,
                                           const gint16 field_id,
                                           GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  if (field_type == T_BOOL) {
    cp->_bool_field_name = name;
    cp->_bool_field_type = field_type;
    cp->_bool_field_id = field_id;
    return 0;
  } else {
    return thrift_compact_protocol_write_field_begin_internal (cp, name,
                                                               field_type,
                                                               field_id, -1,
                                                               error);
  }
}

gint32
thrift_compact_protocol_write_field_end (ThriftProtocol *protocol,
                                         GError **error)
{
  /* satisfy -Wall */
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_write_field_stop (ThriftProtocol *protocol,
                                          GError **error)
{
  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);
  return thrift_protocol_write_byte (protocol, (gint8) T_STOP, error);
}

gint32
thrift_compact_protocol_write_map_begin (ThriftProtocol *protocol,
                                         const ThriftType key_type,
                                         const ThriftType value_type,
                                         const guint32 size,
                                         GError **error)
{
  gint32 ret;
  gint32 xfer;

  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_write_varint32 (cp, (guint32) size,
                                                     error)) < 0) {
    return -1;
  }
  xfer += ret;

  if (size > 0) {
    if ((ret = thrift_protocol_write_byte (protocol,
                                           (gint8) (TTypeToCType[key_type] << 4
                                                    | TTypeToCType[value_type]),
                                           error)) < 0) {
      return -1;
    }
    xfer += ret;
  }

  return xfer;
}

gint32
thrift_compact_protocol_write_map_end (ThriftProtocol *protocol,
                                       GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_write_list_begin (ThriftProtocol *protocol,
                                          const ThriftType element_type,
                                          const guint32 size,
                                          GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  return thrift_compact_protocol_write_collection_begin (cp, element_type,
                                                         size, error);
}

gint32
thrift_compact_protocol_write_list_end (ThriftProtocol *protocol,
                                        GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_write_set_begin (ThriftProtocol *protocol,
                                         const ThriftType element_type,
                                         const guint32 size,
                                         GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  return thrift_compact_protocol_write_collection_begin (cp, element_type,
                                                         size, error);
}

gint32
thrift_compact_protocol_write_set_end (ThriftProtocol *protocol, GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_write_bool (ThriftProtocol *protocol,
                                    const gboolean value, GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if (cp->_bool_field_name != NULL) {
    /* we haven't written the field header yet */
    if ((ret = thrift_compact_protocol_write_field_begin_internal (cp,
                                 cp->_bool_field_name,
                                 cp->_bool_field_type,
                                 cp->_bool_field_id,
                                 (gint8) (value
                                          ? CT_BOOLEAN_TRUE : CT_BOOLEAN_FALSE),
                                 error)) < 0) {
      return -1;
    }
    xfer += ret;

    cp->_bool_field_name = NULL;
  } else {
    /* we're not part of a field, so just write the value */
    if ((ret = thrift_protocol_write_byte (protocol,
                                           (gint8) (value ? CT_BOOLEAN_TRUE
                                                          : CT_BOOLEAN_FALSE),
                                           error)) < 0) {
      return -1;
    }
    xfer += ret;
  }
  return xfer;
}

gint32
thrift_compact_protocol_write_byte (ThriftProtocol *protocol, const gint8 value,
                                    GError **error)
{
  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &value, 1, error)) {
    return 1;
  } else {
    return -1;
  }
}

gint32
thrift_compact_protocol_write_i16 (ThriftProtocol *protocol, const gint16 value,
                                   GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  return thrift_compact_protocol_write_varint32 (cp,
                         i32_to_zigzag ((gint32) value),
                         error);
}

gint32
thrift_compact_protocol_write_i32 (ThriftProtocol *protocol, const gint32 value,
                                   GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  return thrift_compact_protocol_write_varint32 (cp,
                         i32_to_zigzag (value),
                         error);
}

gint32
thrift_compact_protocol_write_i64 (ThriftProtocol *protocol, const gint64 value,
                                   GError **error)
{
  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  return thrift_compact_protocol_write_varint64 (cp,
                         i64_to_zigzag (value),
                         error);
}

gint32
thrift_compact_protocol_write_double (ThriftProtocol *protocol,
                                      const gdouble value, GError **error)
{
  guint64 bits;

  g_assert (sizeof (gdouble) == sizeof (guint64));

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  bits = GUINT64_TO_LE (thrift_bitwise_cast_guint64 (value));
  if (thrift_transport_write (protocol->transport,
                              (const gpointer) &bits, 8, error)) {
    return 8;
  } else {
    return -1;
  }
}

gint32
thrift_compact_protocol_write_string (ThriftProtocol *protocol,
                                      const gchar *str, GError **error)
{
  size_t len;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  len = str != NULL ? strlen (str) : 0;
  if (len > G_MAXINT32) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                 "string size (guess: %lu) is too large", (unsigned long) len);
    return -1;
  }

  /* write the string length + 1 which includes the null terminator */
  return thrift_protocol_write_binary (protocol, (const gpointer) str,
                                       (const guint32) len, error);
}

gint32
thrift_compact_protocol_write_binary (ThriftProtocol *protocol,
                                      const gpointer buf,
                                      const guint32 len, GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_write_varint32 (cp, len, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if (len > 0) {
    /* checking len + xfer > uint_max, but we don't want to overflow while
     * checking for overflows. transforming to len > uint_max - xfer.
     */
    if (len > (guint32) (G_MAXINT32 - xfer)) {
      g_set_error (error, THRIFT_PROTOCOL_ERROR,
                   THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                   "size %d + %d is too large", len, xfer);
      return -1;
    }

    if (thrift_transport_write (protocol->transport,
                                (const gpointer) buf, len, error) == FALSE) {
      return -1;
    }
    xfer += len;
  }

  return xfer;
}

gint32
thrift_compact_protocol_read_message_begin (ThriftProtocol *protocol,
                                            gchar **name,
                                            ThriftMessageType *message_type,
                                            gint32 *seqid, GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint8 protocol_id, version_and_type, version;

  xfer = 0;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  if ((ret = thrift_protocol_read_byte (protocol, &protocol_id, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if (protocol_id != PROTOCOL_ID) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_BAD_VERSION,
                 "bad protocol id");
    return -1;
  }

  if ((ret = thrift_protocol_read_byte (protocol, &version_and_type,
                                        error)) < 0) {
    return -1;
  }
  xfer += ret;

  version = (gint8)(version_and_type & VERSION_MASK);
  if (version != VERSION_N) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_BAD_VERSION,
                 "bad version and/or type");
    return -1;
  }

  *message_type
    = (ThriftMessageType)((version_and_type >> TYPE_SHIFT_AMOUNT) & TYPE_BITS);

  if ((ret = thrift_compact_protocol_read_varint32 (cp, seqid, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if ((ret = thrift_protocol_read_string (protocol, name, error)) < 0) {
    return -1;
  }
  xfer += ret;

  return xfer;
}

gint32
thrift_compact_protocol_read_message_end (ThriftProtocol *protocol,
                                          GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_read_struct_begin (ThriftProtocol *protocol,
                                           gchar **name,
                                           GError **error)
{
  ThriftCompactProtocol *cp;
  GQueue *q;

  THRIFT_UNUSED_VAR (error);

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);
  q = &(cp->_last_field);

  *name = NULL;

  g_queue_push_tail (q, GINT_TO_POINTER ((gint) cp->_last_field_id));
  cp->_last_field_id = 0;

  return 0;
}

gint32
thrift_compact_protocol_read_struct_end (ThriftProtocol *protocol,
                                         GError **error)
{
  ThriftCompactProtocol *cp;
  GQueue *q;

  THRIFT_UNUSED_VAR (error);

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);
  q = &(cp->_last_field);

  cp->_last_field_id = (gint16) GPOINTER_TO_INT (g_queue_pop_tail (q));

  return 0;
}

gint32
thrift_compact_protocol_read_field_begin (ThriftProtocol *protocol,
                                          gchar **name,
                                          ThriftType *field_type,
                                          gint16 *field_id,
                                          GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint16 modifier;
  gint8 byte;
  gint8 type;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  THRIFT_UNUSED_VAR (name);

  xfer = 0;

  if ((ret = thrift_protocol_read_byte (protocol, &byte, error)) < 0) {
    return -1;
  }
  xfer += ret;

  type = (byte & 0x0f);

  /* if it's a stop, then we can return immediately, as the struct is over. */
  if (type == T_STOP) {
    *field_type = T_STOP;
    *field_id = 0;
    return xfer;
  }

  /* mask off the 4 MSB of the type header.
   * it could contain a field id delta.
   */
  modifier = (gint16)(((guint8)byte & 0xf0) >> 4);
  if (modifier == 0) {
    /* not a delta, look ahead for the zigzag varint field id. */
    if ((ret = thrift_protocol_read_i16 (protocol, field_id, error)) < 0) {
      return -1;
    }
    xfer += ret;
  } else {
    *field_id = (gint16)(cp->_last_field_id + modifier);
  }
  if ((ret = thrift_compact_protocol_get_ttype (cp, type, error)) < 0) {
    return -1;
  }
  *field_type = ret;

  /* if this happens to be a boolean field, the value is encoded in the type */
  if (type == CT_BOOLEAN_TRUE || type == CT_BOOLEAN_FALSE) {
    /* save the boolean value in a special instance variable. */
    cp->_has_bool_value = TRUE;
    cp->_bool_value =
      (type == CT_BOOLEAN_TRUE ? TRUE : FALSE);
  }

  /* push the new field onto the field stack so we can keep the deltas going. */
  cp->_last_field_id = *field_id;

  return xfer;
}

gint32
thrift_compact_protocol_read_field_end (ThriftProtocol *protocol,
                                        GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_read_map_begin (ThriftProtocol *protocol,
                                        ThriftType *key_type,
                                        ThriftType *value_type,
                                        guint32 *size,
                                        GError **error)
{
  gint32 ret;
  gint32 xfer;

  gint8 kv_type;
  gint32 msize;

  ThriftCompactProtocol *cp;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  kv_type = 0;
  msize = 0;

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_read_varint32 (cp, &msize, error)) <0) {
    return -1;
  }
  xfer += ret;

  /* still read the kv byte if negative size */
  if (msize != 0) {
    if ((ret = thrift_protocol_read_byte (protocol, &kv_type, error)) < 0) {
      return -1;
    }
    xfer += ret;
  }

  if (cp->container_limit > 0 && msize > cp->container_limit) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                 "got size over limit (%d > %d)", msize, cp->container_limit);
    return -1;
  } else if (msize > 0) {
    if ((ret = thrift_compact_protocol_get_ttype (cp,
                                                  (gint8)((guint8)kv_type
                                                          >> 4),
                                                  error)) < 0) {
      return -1;
    }
    *key_type = ret;
    if ((ret = thrift_compact_protocol_get_ttype (cp,
                                                  (gint8)((guint8)kv_type
                                                          & 0xf),
                                                  error)) < 0) {
      return -1;
    }
    *value_type = ret;
    *size = (guint32) msize;
  } else if (msize == 0) {
    *key_type = 0;
    *value_type = 0;
    *size = 0;
  } else {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", msize);
    return -1;
  }

  return xfer;
}

gint32
thrift_compact_protocol_read_map_end (ThriftProtocol *protocol,
                                      GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_read_list_begin (ThriftProtocol *protocol,
                                         ThriftType *element_type,
                                         guint32 *size, GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint8 size_and_type;
  gint32 lsize;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  size_and_type = 0;

  xfer = 0;

  if ((ret = thrift_protocol_read_byte (protocol, &size_and_type, error)) < 0) {
    return -1;
  }
  xfer += ret;

  lsize = ((guint8)size_and_type >> 4) & 0x0f;
  if (lsize == 15) {
    if ((ret = thrift_compact_protocol_read_varint32 (cp, &lsize, error)) < 0) {
      return -1;
    }
    xfer += ret;
  }

  if (lsize < 0) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", lsize);
    return -1;
  } else if (cp->container_limit > 0 && lsize > cp->container_limit) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                 "got size over limit (%d > %d)", lsize, cp->container_limit);
    return -1;
  }

  if ((ret = thrift_compact_protocol_get_ttype (cp,
                                                (gint8)(size_and_type & 0x0f),
                                                error)) < 0) {
    return -1;
  }
  *element_type = ret;
  *size = (guint32) lsize;

  return xfer;
}

gint32
thrift_compact_protocol_read_list_end (ThriftProtocol *protocol,
                                       GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_read_set_begin (ThriftProtocol *protocol,
                                        ThriftType *element_type,
                                        guint32 *size, GError **error)
{
  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  return thrift_protocol_read_list_begin (protocol, element_type, size, error);
}

gint32
thrift_compact_protocol_read_set_end (ThriftProtocol *protocol,
                                      GError **error)
{
  THRIFT_UNUSED_VAR (protocol);
  THRIFT_UNUSED_VAR (error);
  return 0;
}

gint32
thrift_compact_protocol_read_bool (ThriftProtocol *protocol, gboolean *value,
                                   GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint8 val;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if (cp->_has_bool_value == TRUE) {
    *value = cp->_bool_value;
    cp->_has_bool_value = FALSE;
    return 0;
  } else {
    if ((ret = thrift_protocol_read_byte (protocol, &val, error)) < 0) {
      return -1;
    }
    xfer += ret;

    *value = (val == CT_BOOLEAN_TRUE);
    return xfer;
  }
}

gint32
thrift_compact_protocol_read_byte (ThriftProtocol *protocol, gint8 *value,
                                   GError **error)
{
  gint32 ret;
  gpointer b[1];

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  b, 1, error)) < 0) {
    return -1;
  }
  *value = *(gint8 *) b;
  return ret;
}

gint32
thrift_compact_protocol_read_i16 (ThriftProtocol *protocol, gint16 *value,
                                  GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 val;
  gint32 xfer;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_read_varint32 (cp, &val, error)) < 0) {
    return -1;
  }
  xfer += ret;

  *value = (gint16) zigzag_to_i32 ((guint32) val);

  return xfer;
}

gint32
thrift_compact_protocol_read_i32 (ThriftProtocol *protocol, gint32 *value,
                                  GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 val;
  gint32 xfer;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_read_varint32 (cp, &val, error)) < 0) {
    return -1;
  }
  xfer += ret;

  *value = zigzag_to_i32 ((guint32) val);

  return xfer;
}

gint32
thrift_compact_protocol_read_i64 (ThriftProtocol *protocol, gint64 *value,
                                  GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint64 val;
  gint32 xfer;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;

  if ((ret = thrift_compact_protocol_read_varint64 (cp, &val, error)) < 0) {
    return -1;
  }
  xfer += ret;

  *value = zigzag_to_i64 ((guint64) val);

  return xfer;
}

gint32
thrift_compact_protocol_read_double (ThriftProtocol *protocol,
                                     gdouble *value, GError **error)
{
  gint32 ret;
  union {
    guint64 bits;
    guint8 b[8];
  } u;

  g_assert (sizeof (gdouble) == sizeof (guint64));

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  if ((ret =
       thrift_transport_read_all (protocol->transport,
                                  u.b, 8, error)) < 0) {
    return -1;
  }
  u.bits = GUINT64_FROM_LE (u.bits);
  *value = thrift_bitwise_cast_gdouble (u.bits);
  return ret;
}

gint32
thrift_compact_protocol_read_string (ThriftProtocol *protocol,
                                     gchar **str, GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint32 read_len;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;
  read_len = 0;

  /* read the length into read_len */
  if ((ret =
       thrift_compact_protocol_read_varint32 (cp, &read_len, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if (cp->string_limit > 0 && read_len > cp->string_limit) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                 "got size over limit (%d > %d)", read_len, cp->string_limit);
    *str = NULL;
    return -1;
  }

  if (read_len > 0) {
    /* allocate the memory as an array of unsigned char for binary data */
    *str = g_new0 (gchar, read_len + 1);
    if ((ret =
         thrift_transport_read_all (protocol->transport,
                                    *str, read_len, error)) < 0) {
      g_free (*str);
      *str = NULL;
      return -1;
    }
    xfer += ret;

  } else if (read_len == 0) {
    *str = NULL;

  } else {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", read_len);
    *str = NULL;
    return -1;
  }

  return xfer;
}

gint32
thrift_compact_protocol_read_binary (ThriftProtocol *protocol,
                                     gpointer *buf, guint32 *len,
                                     GError **error)
{
  ThriftCompactProtocol *cp;

  gint32 ret;
  gint32 xfer;

  gint32 read_len;

  g_return_val_if_fail (THRIFT_IS_COMPACT_PROTOCOL (protocol), -1);

  cp = THRIFT_COMPACT_PROTOCOL (protocol);

  xfer = 0;
  read_len = 0;

  /* read the length into read_len */
  if ((ret =
       thrift_compact_protocol_read_varint32 (cp, &read_len, error)) < 0) {
    return -1;
  }
  xfer += ret;

  if (cp->string_limit > 0 && read_len > cp->string_limit) {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
                 "got size over limit (%d > %d)", read_len, cp->string_limit);
    *buf = NULL;
    *len = 0;
    return -1;
  }

  if (read_len > 0) {
    /* allocate the memory as an array of unsigned char for binary data */
    *len = (guint32) read_len;
    *buf = g_new (guchar, *len);
    if ((ret =
         thrift_transport_read_all (protocol->transport,
                                    *buf, *len, error)) < 0) {
      g_free (*buf);
      *buf = NULL;
      *len = 0;
      return -1;
    }
    xfer += ret;

  } else if (read_len == 0) {
    *len = (guint32) read_len;
    *buf = NULL;

  } else {
    g_set_error (error, THRIFT_PROTOCOL_ERROR,
                 THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
                 "got negative size of %d", read_len);
    *buf = NULL;
    *len = 0;
    return -1;
  }

  return xfer;
}

/* property accessor */
void
thrift_compact_protocol_get_property (GObject *object, guint property_id,
                                      GValue *value, GParamSpec *pspec)
{
  ThriftCompactProtocol *tc;

  THRIFT_UNUSED_VAR (pspec);

  tc = THRIFT_COMPACT_PROTOCOL (object);

  switch (property_id) {
    case PROP_THRIFT_COMPACT_PROTOCOL_STRING_LIMIT:
      g_value_set_int (value, tc->string_limit);
      break;
    case PROP_THRIFT_COMPACT_PROTOCOL_CONTAINER_LIMIT:
      g_value_set_int (value, tc->container_limit);
      break;
  }
}

/* property mutator */
void
thrift_compact_protocol_set_property (GObject *object, guint property_id,
                                      const GValue *value, GParamSpec *pspec)
{
  ThriftCompactProtocol *tc;

  THRIFT_UNUSED_VAR (pspec);

  tc = THRIFT_COMPACT_PROTOCOL (object);

  switch (property_id) {
    case PROP_THRIFT_COMPACT_PROTOCOL_STRING_LIMIT:
      tc->string_limit = g_value_get_int (value);
      break;
    case PROP_THRIFT_COMPACT_PROTOCOL_CONTAINER_LIMIT:
      tc->container_limit = g_value_get_int (value);
      break;
  }
}

/* initialize the class */
static void
thrift_compact_protocol_class_init (ThriftCompactProtocolClass *klass)
{
  ThriftProtocolClass *cls;
  GObjectClass *gobject_class;
  GParamSpec *param_spec;

  cls = THRIFT_PROTOCOL_CLASS (klass);
  gobject_class = G_OBJECT_CLASS (klass);
  param_spec = NULL;

  /* setup accessors and mutators */
  gobject_class->get_property = thrift_compact_protocol_get_property;
  gobject_class->set_property = thrift_compact_protocol_set_property;

  param_spec = g_param_spec_int ("string_limit",
                                 "Max allowed string size",
                                 "Set the max string limit",
                                 0, /* min */
                                 G_MAXINT32, /* max */
                                 0, /* default value */
                                 G_PARAM_CONSTRUCT_ONLY | G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_COMPACT_PROTOCOL_STRING_LIMIT,
                                   param_spec);

  param_spec = g_param_spec_int ("container_limit",
                                 "Max allowed container size",
                                 "Set the max container limit",
                                 0, /* min */
                                 G_MAXINT32, /* max */
                                 0, /* default value */
                                 G_PARAM_CONSTRUCT_ONLY | G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_COMPACT_PROTOCOL_CONTAINER_LIMIT,
                                   param_spec);

  cls->write_message_begin = thrift_compact_protocol_write_message_begin;
  cls->write_message_end = thrift_compact_protocol_write_message_end;
  cls->write_struct_begin = thrift_compact_protocol_write_struct_begin;
  cls->write_struct_end = thrift_compact_protocol_write_struct_end;
  cls->write_field_begin = thrift_compact_protocol_write_field_begin;
  cls->write_field_end = thrift_compact_protocol_write_field_end;
  cls->write_field_stop = thrift_compact_protocol_write_field_stop;
  cls->write_map_begin = thrift_compact_protocol_write_map_begin;
  cls->write_map_end = thrift_compact_protocol_write_map_end;
  cls->write_list_begin = thrift_compact_protocol_write_list_begin;
  cls->write_list_end = thrift_compact_protocol_write_list_end;
  cls->write_set_begin = thrift_compact_protocol_write_set_begin;
  cls->write_set_end = thrift_compact_protocol_write_set_end;
  cls->write_bool = thrift_compact_protocol_write_bool;
  cls->write_byte = thrift_compact_protocol_write_byte;
  cls->write_i16 = thrift_compact_protocol_write_i16;
  cls->write_i32 = thrift_compact_protocol_write_i32;
  cls->write_i64 = thrift_compact_protocol_write_i64;
  cls->write_double = thrift_compact_protocol_write_double;
  cls->write_string = thrift_compact_protocol_write_string;
  cls->write_binary = thrift_compact_protocol_write_binary;
  cls->read_message_begin = thrift_compact_protocol_read_message_begin;
  cls->read_message_end = thrift_compact_protocol_read_message_end;
  cls->read_struct_begin = thrift_compact_protocol_read_struct_begin;
  cls->read_struct_end = thrift_compact_protocol_read_struct_end;
  cls->read_field_begin = thrift_compact_protocol_read_field_begin;
  cls->read_field_end = thrift_compact_protocol_read_field_end;
  cls->read_map_begin = thrift_compact_protocol_read_map_begin;
  cls->read_map_end = thrift_compact_protocol_read_map_end;
  cls->read_list_begin = thrift_compact_protocol_read_list_begin;
  cls->read_list_end = thrift_compact_protocol_read_list_end;
  cls->read_set_begin = thrift_compact_protocol_read_set_begin;
  cls->read_set_end = thrift_compact_protocol_read_set_end;
  cls->read_bool = thrift_compact_protocol_read_bool;
  cls->read_byte = thrift_compact_protocol_read_byte;
  cls->read_i16 = thrift_compact_protocol_read_i16;
  cls->read_i32 = thrift_compact_protocol_read_i32;
  cls->read_i64 = thrift_compact_protocol_read_i64;
  cls->read_double = thrift_compact_protocol_read_double;
  cls->read_string = thrift_compact_protocol_read_string;
  cls->read_binary = thrift_compact_protocol_read_binary;
}

static void
thrift_compact_protocol_init (ThriftCompactProtocol *self)
{
  g_queue_init (&(self->_last_field));
}
