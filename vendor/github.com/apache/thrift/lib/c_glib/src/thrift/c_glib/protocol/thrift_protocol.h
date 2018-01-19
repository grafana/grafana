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

#ifndef _THRIFT_PROTOCOL_H
#define _THRIFT_PROTOCOL_H

#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_protocol.h
 *  \brief Abstract class for Thrift protocol implementations.
 */

/**
 * Enumerated definition of the types that the Thrift protocol supports.
 * Take special note of the T_END type which is used specifically to mark
 * the end of a sequence of fields.
 */
typedef enum {
  T_STOP   = 0,
  T_VOID   = 1,
  T_BOOL   = 2,
  T_BYTE   = 3,
  T_I08    = 3,
  T_I16    = 6,
  T_I32    = 8,
  T_U64    = 9,
  T_I64    = 10,
  T_DOUBLE = 4,
  T_STRING = 11,
  T_UTF7   = 11,
  T_STRUCT = 12,
  T_MAP    = 13,
  T_SET    = 14,
  T_LIST   = 15,
  T_UTF8   = 16,
  T_UTF16  = 17
} ThriftType;

/**
 * Enumerated definition of the message types that the Thrift protocol
 * supports.
 */
typedef enum {
  T_CALL      = 1,
  T_REPLY     = 2,
  T_EXCEPTION = 3,
  T_ONEWAY    = 4
} ThriftMessageType;

/* type macros */
#define THRIFT_TYPE_PROTOCOL (thrift_protocol_get_type ())
#define THRIFT_PROTOCOL(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_PROTOCOL, ThriftProtocol))
#define THRIFT_IS_PROTOCOL(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_PROTOCOL))
#define THRIFT_PROTOCOL_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_PROTOCOL, ThriftProtocolClass))
#define THRIFT_IS_PROTOCOL_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_PROTOCOL))
#define THRIFT_PROTOCOL_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_PROTOCOL, ThriftProtocolClass))

typedef struct _ThriftProtocol ThriftProtocol;

/*!
 * Thrift Protocol object
 */
struct _ThriftProtocol
{
  GObject parent;

  /* protected */
  ThriftTransport *transport;
};

typedef struct _ThriftProtocolClass ThriftProtocolClass;

/*!
 * Thrift Protocol class
 */
struct _ThriftProtocolClass
{
  GObjectClass parent;

  gint32 (*write_message_begin) (ThriftProtocol *protocol, const gchar *name,
                                 const ThriftMessageType message_type,
                                 const gint32 seqid, GError **error);
  gint32 (*write_message_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_struct_begin) (ThriftProtocol *protocol, const gchar *name,
                                GError **error);
  gint32 (*write_struct_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_field_begin) (ThriftProtocol *protocol, const gchar *name,
                               const ThriftType field_type,
                               const gint16 field_id, GError **error);
  gint32 (*write_field_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_field_stop) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_map_begin) (ThriftProtocol *protocol,
                             const ThriftType key_type,
                             const ThriftType value_type,
                             const guint32 size, GError **error);
  gint32 (*write_map_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_list_begin) (ThriftProtocol *protocol,
                              const ThriftType element_type,
                              const guint32 size, GError **error);
  gint32 (*write_list_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_set_begin) (ThriftProtocol *protocol,
                             const ThriftType element_type,
                             const guint32 size, GError **error);
  gint32 (*write_set_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*write_bool) (ThriftProtocol *protocol, const gboolean value,
                        GError **error);
  gint32 (*write_byte) (ThriftProtocol *protocol, const gint8 value,
                        GError **error);
  gint32 (*write_i16) (ThriftProtocol *protocol, const gint16 value,
                       GError **error);
  gint32 (*write_i32) (ThriftProtocol *protocol, const gint32 value,
                       GError **error);
  gint32 (*write_i64) (ThriftProtocol *protocol, const gint64 value,
                       GError **error);
  gint32 (*write_double) (ThriftProtocol *protocol, const gdouble value,
                          GError **error);
  gint32 (*write_string) (ThriftProtocol *protocol, const gchar *str,
                          GError **error);
  gint32 (*write_binary) (ThriftProtocol *protocol, const gpointer buf,
                          const guint32 len, GError **error);

  gint32 (*read_message_begin) (ThriftProtocol *thrift_protocol, gchar **name,
                                ThriftMessageType *message_type,
                                gint32 *seqid, GError **error);
  gint32 (*read_message_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_struct_begin) (ThriftProtocol *protocol, gchar **name,
                               GError **error);
  gint32 (*read_struct_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_field_begin) (ThriftProtocol *protocol, gchar **name,
                              ThriftType *field_type, gint16 *field_id,
                              GError **error);
  gint32 (*read_field_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_map_begin) (ThriftProtocol *protocol, ThriftType *key_type,
                            ThriftType *value_type, guint32 *size,
                            GError **error);
  gint32 (*read_map_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_list_begin) (ThriftProtocol *protocol, ThriftType *element_type,
                             guint32 *size, GError **error);
  gint32 (*read_list_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_set_begin) (ThriftProtocol *protocol, ThriftType *element_type,
                            guint32 *size, GError **error);
  gint32 (*read_set_end) (ThriftProtocol *protocol, GError **error);
  gint32 (*read_bool) (ThriftProtocol *protocol, gboolean *value,
                       GError **error);
  gint32 (*read_byte) (ThriftProtocol *protocol, gint8 *value, GError **error);
  gint32 (*read_i16) (ThriftProtocol *protocol, gint16 *value, GError **error);
  gint32 (*read_i32) (ThriftProtocol *protocol, gint32 *value, GError **error);
  gint32 (*read_i64) (ThriftProtocol *protocol, gint64 *value, GError **error);
  gint32 (*read_double) (ThriftProtocol *protocol, gdouble *value,
                         GError **error);
  gint32 (*read_string) (ThriftProtocol *protocol, gchar **str, GError **error);
  gint32 (*read_binary) (ThriftProtocol *protocol, gpointer *buf,
                         guint32 *len, GError **error);
};

/* used by THRIFT_TYPE_PROTOCOL */
GType thrift_protocol_get_type (void);

/* virtual public methods */
gint32 thrift_protocol_write_message_begin (ThriftProtocol *protocol,
           const gchar *name, const ThriftMessageType message_type,
           const gint32 seqid, GError **error);

gint32 thrift_protocol_write_message_end (ThriftProtocol *protocol,
                                          GError **error);

gint32 thrift_protocol_write_struct_begin (ThriftProtocol *protocol,
                                           const gchar *name,
                                           GError **error);

gint32 thrift_protocol_write_struct_end (ThriftProtocol *protocol,
                                         GError **error);

gint32 thrift_protocol_write_field_begin (ThriftProtocol *protocol,
                                          const gchar *name,
                                          const ThriftType field_type,
                                          const gint16 field_id,
                                          GError **error);

gint32 thrift_protocol_write_field_end (ThriftProtocol *protocol,
                                        GError **error);

gint32 thrift_protocol_write_field_stop (ThriftProtocol *protocol,
                                         GError **error);

gint32 thrift_protocol_write_map_begin (ThriftProtocol *protocol,
                                        const ThriftType key_type,
                                        const ThriftType value_type,
                                        const guint32 size, GError **error);

gint32 thrift_protocol_write_map_end (ThriftProtocol *protocol, GError **error);

gint32 thrift_protocol_write_list_begin (ThriftProtocol *protocol,
                                         const ThriftType element_type,
                                         const guint32 size, GError **error);

gint32 thrift_protocol_write_list_end (ThriftProtocol *protocol,
                                       GError **error);

gint32 thrift_protocol_write_set_begin (ThriftProtocol *protocol,
                                        const ThriftType element_type,
                                        const guint32 size, GError **error);

gint32 thrift_protocol_write_set_end (ThriftProtocol *protocol,
                                      GError **error);

gint32 thrift_protocol_write_bool (ThriftProtocol *protocol,
                                   const gboolean value, GError **error);

gint32 thrift_protocol_write_byte (ThriftProtocol *protocol, const gint8 value,
                                   GError **error);

gint32 thrift_protocol_write_i16 (ThriftProtocol *protocol, const gint16 value,
                                  GError **error);

gint32 thrift_protocol_write_i32 (ThriftProtocol *protocol, const gint32 value,
                                  GError **error);

gint32 thrift_protocol_write_i64 (ThriftProtocol *protocol, const gint64 value,
                                  GError **error);

gint32 thrift_protocol_write_double (ThriftProtocol *protocol,
                                     const gdouble value, GError **error);

gint32 thrift_protocol_write_string (ThriftProtocol *protocol,
                                     const gchar *str, GError **error);

gint32 thrift_protocol_write_binary (ThriftProtocol *protocol,
                                     const gpointer buf,
                                     const guint32 len, GError **error);

gint32 thrift_protocol_read_message_begin (ThriftProtocol *thrift_protocol,
                                           gchar **name,
                                           ThriftMessageType *message_type,
                                           gint32 *seqid, GError **error);

gint32 thrift_protocol_read_message_end (ThriftProtocol *protocol,
                                         GError **error);

gint32 thrift_protocol_read_struct_begin (ThriftProtocol *protocol,
                                          gchar **name,
                                          GError **error);

gint32 thrift_protocol_read_struct_end (ThriftProtocol *protocol,
                                        GError **error);

gint32 thrift_protocol_read_field_begin (ThriftProtocol *protocol,
                                         gchar **name,
                                         ThriftType *field_type,
                                         gint16 *field_id,
                                         GError **error);

gint32 thrift_protocol_read_field_end (ThriftProtocol *protocol,
                                       GError **error);

gint32 thrift_protocol_read_map_begin (ThriftProtocol *protocol,
                                       ThriftType *key_type,
                                       ThriftType *value_type, guint32 *size,
                                       GError **error);

gint32 thrift_protocol_read_map_end (ThriftProtocol *protocol, GError **error);

gint32 thrift_protocol_read_list_begin (ThriftProtocol *protocol,
                                        ThriftType *element_type,
                                        guint32 *size, GError **error);

gint32 thrift_protocol_read_list_end (ThriftProtocol *protocol, GError **error);

gint32 thrift_protocol_read_set_begin (ThriftProtocol *protocol,
                                       ThriftType *element_type,
                                       guint32 *size, GError **error);

gint32 thrift_protocol_read_set_end (ThriftProtocol *protocol, GError **error);

gint32 thrift_protocol_read_bool (ThriftProtocol *protocol, gboolean *value,
                                  GError **error);

gint32 thrift_protocol_read_byte (ThriftProtocol *protocol, gint8 *value,
                                  GError **error);

gint32 thrift_protocol_read_i16 (ThriftProtocol *protocol, gint16 *value,
                                 GError **error);

gint32 thrift_protocol_read_i32 (ThriftProtocol *protocol, gint32 *value,
                                 GError **error);

gint32 thrift_protocol_read_i64 (ThriftProtocol *protocol, gint64 *value,
                                 GError **error);

gint32 thrift_protocol_read_double (ThriftProtocol *protocol,
                                    gdouble *value, GError **error);

gint32 thrift_protocol_read_string (ThriftProtocol *protocol,
                                    gchar **str, GError **error);

gint32 thrift_protocol_read_binary (ThriftProtocol *protocol,
                                    gpointer *buf, guint32 *len,
                                    GError **error);

gint32 thrift_protocol_skip (ThriftProtocol *protocol, ThriftType type,
                             GError **error);

/* define error types */
typedef enum
{
  THRIFT_PROTOCOL_ERROR_UNKNOWN,
  THRIFT_PROTOCOL_ERROR_INVALID_DATA,
  THRIFT_PROTOCOL_ERROR_NEGATIVE_SIZE,
  THRIFT_PROTOCOL_ERROR_SIZE_LIMIT,
  THRIFT_PROTOCOL_ERROR_BAD_VERSION,
  THRIFT_PROTOCOL_ERROR_NOT_IMPLEMENTED,
  THRIFT_PROTOCOL_ERROR_DEPTH_LIMIT
} ThriftProtocolError;

/* define an error domain for GError to use */
GQuark thrift_protocol_error_quark (void);
#define THRIFT_PROTOCOL_ERROR (thrift_protocol_error_quark ())

G_END_DECLS

#endif /* _THRIFT_PROTOCOL_H */
