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
#include <thrift/c_glib/protocol/thrift_protocol.h>
#include <thrift/c_glib/transport/thrift_transport.h>

/* define the GError domain string */
#define THRIFT_PROTOCOL_ERROR_DOMAIN "thrift-protocol-error-quark"

/* object properties */
enum _ThriftProtocolProperties
{
  PROP_0,
  PROP_THRIFT_PROTOCOL_TRANSPORT
};

G_DEFINE_ABSTRACT_TYPE(ThriftProtocol, thrift_protocol, G_TYPE_OBJECT)

void
thrift_protocol_get_property (GObject *object, guint property_id,
                              GValue *value, GParamSpec *pspec)
{
  ThriftProtocol *protocol = THRIFT_PROTOCOL (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_PROTOCOL_TRANSPORT:
      g_value_set_object (value, protocol->transport);
      break;
  }
}

void
thrift_protocol_set_property (GObject *object, guint property_id,
                              const GValue *value, GParamSpec *pspec)
{

  ThriftProtocol *protocol = THRIFT_PROTOCOL (object);

  THRIFT_UNUSED_VAR (pspec);

  switch (property_id)
  {
    case PROP_THRIFT_PROTOCOL_TRANSPORT:
      protocol->transport = g_value_get_object (value);
      break;
  }
}


gint32
thrift_protocol_write_message_begin (ThriftProtocol *protocol, 
                                     const gchar *name, 
                                     const ThriftMessageType message_type,
                                     const gint32 seqid, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_message_begin
                                                   (protocol, name,
                                                    message_type, seqid,
                                                    error);
}

gint32
thrift_protocol_write_message_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_message_end (protocol,
                                                                  error);
}

gint32
thrift_protocol_write_struct_begin (ThriftProtocol *protocol, const gchar *name,
                                    GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_struct_begin (protocol,
                                                   name, error);
}

gint32
thrift_protocol_write_struct_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_struct_end (protocol,
                                                                 error);
}

gint32
thrift_protocol_write_field_begin (ThriftProtocol *protocol,
                                   const gchar *name,
                                   const ThriftType field_type,
                                   const gint16 field_id,
                                   GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_field_begin (protocol,
                                                   name, field_type,
                                                   field_id, error);
}

gint32
thrift_protocol_write_field_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_field_end (protocol,
                                                                error);
}

gint32
thrift_protocol_write_field_stop (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_field_stop (protocol,
                                                                 error);
}

gint32
thrift_protocol_write_map_begin (ThriftProtocol *protocol,
                                 const ThriftType key_type,
                                 const ThriftType value_type,
                                 const guint32 size, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_map_begin (protocol,
                                                   key_type, value_type,
                                                   size, error);
}

gint32
thrift_protocol_write_map_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_map_end (protocol,
                                                              error);
}

gint32
thrift_protocol_write_list_begin (ThriftProtocol *protocol,
                                  const ThriftType element_type,
                                  const guint32 size, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_list_begin (protocol,
                                                   element_type, size,
                                                   error);
}

gint32
thrift_protocol_write_list_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_list_end (protocol,
                                                               error);
}

gint32
thrift_protocol_write_set_begin (ThriftProtocol *protocol,
                                 const ThriftType element_type,
                                 const guint32 size, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_set_begin (protocol,
                                                   element_type, size,
                                                   error);
}

gint32
thrift_protocol_write_set_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_set_end (protocol,
                                                              error);
}

gint32
thrift_protocol_write_bool (ThriftProtocol *protocol,
                            const gboolean value, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_bool (protocol, value,
                                                           error);
}

gint32
thrift_protocol_write_byte (ThriftProtocol *protocol, const gint8 value,
                            GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_byte (protocol, value,
                                                           error);
}

gint32
thrift_protocol_write_i16 (ThriftProtocol *protocol, const gint16 value,
                           GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_i16 (protocol, value,
                                                          error);
}

gint32
thrift_protocol_write_i32 (ThriftProtocol *protocol, const gint32 value,
                           GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_i32 (protocol, value,
                                                          error);
}

gint32
thrift_protocol_write_i64 (ThriftProtocol *protocol, const gint64 value,
                           GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_i64 (protocol, value,
                                                          error);
}

gint32
thrift_protocol_write_double (ThriftProtocol *protocol,
                              const gdouble value, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_double (protocol,
                                                             value, error);
}

gint32
thrift_protocol_write_string (ThriftProtocol *protocol,
                              const gchar *str, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_string (protocol, str,
                                                             error);
}

gint32
thrift_protocol_write_binary (ThriftProtocol *protocol, const gpointer buf,
                              const guint32 len, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->write_binary (protocol, buf,
                                                             len, error);
}

gint32 
thrift_protocol_read_message_begin (ThriftProtocol *protocol,
                                    gchar **name,
                                    ThriftMessageType *message_type,
                                    gint32 *seqid, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_message_begin (protocol,
                                                   name, message_type,
                                                   seqid, error);
}

gint32 
thrift_protocol_read_message_end (ThriftProtocol *protocol,
                                  GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_message_end (protocol,
                                                                 error);
}

gint32 
thrift_protocol_read_struct_begin (ThriftProtocol *protocol,
                                   gchar **name,
                                   GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_struct_begin (protocol,
                                                                  name,
                                                                  error);
}

gint32
thrift_protocol_read_struct_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_struct_end (protocol,
                                                                error);
}

gint32 
thrift_protocol_read_field_begin (ThriftProtocol *protocol,
                                  gchar **name,
                                  ThriftType *field_type,
                                  gint16 *field_id,
                                  GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_field_begin (protocol,
                                                                 name,
                                                                 field_type,
                                                                 field_id,
                                                                 error);
}

gint32 
thrift_protocol_read_field_end (ThriftProtocol *protocol,
                                GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_field_end (protocol,
                                                               error);
}

gint32 
thrift_protocol_read_map_begin (ThriftProtocol *protocol,
                                ThriftType *key_type,
                                ThriftType *value_type, guint32 *size,
                                GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_map_begin (protocol,
                                                               key_type,
                                                               value_type,
                                                               size,
                                                               error); 
}

gint32 
thrift_protocol_read_map_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_map_end (protocol,
                                                             error);
}

gint32 
thrift_protocol_read_list_begin (ThriftProtocol *protocol,
                                 ThriftType *element_type,
                                 guint32 *size, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_list_begin (protocol,
                                                                element_type,
                                                                size, error);
}

gint32
thrift_protocol_read_list_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_list_end (protocol,
                                                              error);
}

gint32
thrift_protocol_read_set_begin (ThriftProtocol *protocol,
                                ThriftType *element_type,
                                guint32 *size, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_set_begin (protocol,
                                                               element_type,
                                                               size, error);
}

gint32
thrift_protocol_read_set_end (ThriftProtocol *protocol, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_set_end (protocol,
                                                             error);
}

gint32
thrift_protocol_read_bool (ThriftProtocol *protocol, gboolean *value,
                           GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_bool (protocol, value,
                                                          error);
}

gint32
thrift_protocol_read_byte (ThriftProtocol *protocol, gint8 *value,
                           GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_byte (protocol, value,
                                                          error);
}

gint32
thrift_protocol_read_i16 (ThriftProtocol *protocol, gint16 *value,
                          GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_i16 (protocol, value,
                                                         error);
}

gint32
thrift_protocol_read_i32 (ThriftProtocol *protocol, gint32 *value,
                          GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_i32 (protocol, value,
                                                         error);
}

gint32
thrift_protocol_read_i64 (ThriftProtocol *protocol, gint64 *value,
                          GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_i64 (protocol, value,
                                                         error);
}

gint32
thrift_protocol_read_double (ThriftProtocol *protocol,
                             gdouble *value, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_double (protocol, value,
                                                            error);
}

gint32
thrift_protocol_read_string (ThriftProtocol *protocol,
                             gchar **str, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_string (protocol, str,
                                                            error);
}

gint32
thrift_protocol_read_binary (ThriftProtocol *protocol, gpointer *buf, 
                             guint32 *len, GError **error)
{
  return THRIFT_PROTOCOL_GET_CLASS (protocol)->read_binary (protocol, buf,
                                                            len, error);
}

gint32
thrift_protocol_skip (ThriftProtocol *protocol, ThriftType type, GError **error)
{
  switch (type)
  {
    case T_BOOL:
      {
        gboolean boolv;
        return thrift_protocol_read_bool (protocol, &boolv, error);
      }
    case T_BYTE:
      {
        gint8 bytev;
        return thrift_protocol_read_byte (protocol, &bytev, error);
      }

    case T_I16:
      {
        gint16 i16;
        return thrift_protocol_read_i16 (protocol, &i16, error);
      }
    case T_I32:
      {
        gint32 i32;
        return thrift_protocol_read_i32 (protocol, &i32, error);
      }
    case T_I64:
      {
        gint64 i64;
        return thrift_protocol_read_i64 (protocol, &i64, error);
      }
    case T_DOUBLE:
      {
        gdouble dub;
        return thrift_protocol_read_double (protocol, &dub, error);
      }
    case T_STRING:
      {
        gpointer data;
        guint32 len;
        gint32 ret = thrift_protocol_read_binary (protocol, &data, &len, error);
        g_free (data);
        return ret;
      }
    case T_STRUCT:
      {
        guint32 result = 0;
        gchar *name;
        gint16 fid;
        ThriftType ftype;
        result += thrift_protocol_read_struct_begin (protocol, &name, error);

        while (1)
        {
          result += thrift_protocol_read_field_begin (protocol, &name, &ftype,
                                                      &fid, error);
          if (ftype == T_STOP)
          {
            break;
          }
          result += thrift_protocol_skip (protocol, ftype, error);
          result += thrift_protocol_read_field_end (protocol, error);
        }
        result += thrift_protocol_read_struct_end (protocol, error);
        return result;
      }
    case T_SET:
      {
        guint32 result = 0;
        ThriftType elem_type;
        guint32 i, size;
        result += thrift_protocol_read_set_begin (protocol, &elem_type, &size,
                                                  error);
        for (i = 0; i < size; i++)
        {
          result += thrift_protocol_skip (protocol, elem_type, error);
        }
        result += thrift_protocol_read_set_end (protocol, error);
        return result;
      }
    case T_MAP:
      {
        guint32 result = 0;
        ThriftType elem_type;
        ThriftType key_type;
        guint32 i, size;
        result += thrift_protocol_read_map_begin (protocol, &key_type, &elem_type, &size,
                                                  error);
        for (i = 0; i < size; i++)
        {
          result += thrift_protocol_skip (protocol, key_type, error);
          result += thrift_protocol_skip (protocol, elem_type, error);
        }
        result += thrift_protocol_read_map_end (protocol, error);
        return result;
      }
    case T_LIST:
      {
        guint32 result = 0;
        ThriftType elem_type;
        guint32 i, size;
        result += thrift_protocol_read_list_begin (protocol, &elem_type, &size,
                                                   error);
        for (i = 0; i < size; i++)
        {
          result += thrift_protocol_skip (protocol, elem_type, error);
        }
        result += thrift_protocol_read_list_end (protocol, error);
        return result;
      }
    default:
      return 0;
  }
}

/* define the GError domain for Thrift protocols */
GQuark
thrift_protocol_error_quark (void)
{
  return g_quark_from_static_string (THRIFT_PROTOCOL_ERROR_DOMAIN);
}


static void
thrift_protocol_init (ThriftProtocol *protocol)
{
  protocol->transport = NULL;
}

static void
thrift_protocol_class_init (ThriftProtocolClass *cls)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS (cls);

  gobject_class->get_property = thrift_protocol_get_property;
  gobject_class->set_property = thrift_protocol_set_property;

  g_object_class_install_property (gobject_class,
      PROP_THRIFT_PROTOCOL_TRANSPORT,
      g_param_spec_object ("transport", "Transport", "Thrift Transport",
                           THRIFT_TYPE_TRANSPORT,
                           G_PARAM_READWRITE | G_PARAM_CONSTRUCT_ONLY));

  cls->write_message_begin = thrift_protocol_write_message_begin;
  cls->write_message_end = thrift_protocol_write_message_end;
  cls->write_struct_begin = thrift_protocol_write_struct_begin;
  cls->write_struct_end = thrift_protocol_write_struct_end;
  cls->write_field_begin = thrift_protocol_write_field_begin;
  cls->write_field_end = thrift_protocol_write_field_end;
  cls->write_field_stop = thrift_protocol_write_field_stop;
  cls->write_map_begin = thrift_protocol_write_map_begin;
  cls->write_map_end = thrift_protocol_write_map_end;
  cls->write_list_begin = thrift_protocol_write_list_begin;
  cls->write_list_end = thrift_protocol_write_list_end;
  cls->write_set_begin = thrift_protocol_write_set_begin;
  cls->write_set_end = thrift_protocol_write_set_end;
  cls->write_bool = thrift_protocol_write_bool;
  cls->write_byte = thrift_protocol_write_byte;
  cls->write_i16 = thrift_protocol_write_i16;
  cls->write_i32 = thrift_protocol_write_i32;
  cls->write_i64 = thrift_protocol_write_i64;
  cls->write_double = thrift_protocol_write_double;
  cls->write_string = thrift_protocol_write_string;
  cls->write_binary = thrift_protocol_write_binary;
  cls->read_message_begin = thrift_protocol_read_message_begin;
  cls->read_message_end = thrift_protocol_read_message_end;
  cls->read_struct_begin = thrift_protocol_read_struct_begin;
  cls->read_struct_end = thrift_protocol_read_struct_end;
  cls->read_field_begin = thrift_protocol_read_field_begin;
  cls->read_field_end = thrift_protocol_read_field_end;
  cls->read_map_begin = thrift_protocol_read_map_begin;
  cls->read_map_end = thrift_protocol_read_map_end;
  cls->read_list_begin = thrift_protocol_read_list_begin;
  cls->read_set_begin = thrift_protocol_read_set_begin;
  cls->read_set_end = thrift_protocol_read_set_end;
  cls->read_bool = thrift_protocol_read_bool;
  cls->read_byte = thrift_protocol_read_byte;
  cls->read_i16 = thrift_protocol_read_i16;
  cls->read_i32 = thrift_protocol_read_i32;
  cls->read_i64 = thrift_protocol_read_i64;
  cls->read_double = thrift_protocol_read_double;
  cls->read_string = thrift_protocol_read_string;
  cls->read_binary = thrift_protocol_read_binary;
}
