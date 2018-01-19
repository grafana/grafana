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

#include "thrift_application_exception.h"
#include <thrift/c_glib/protocol/thrift_protocol.h>

/* object properties */
enum _ThriftApplicationExceptionProperties
{
  PROP_0,
  PROP_THRIFT_APPLICATION_EXCEPTION_TYPE,
  PROP_THRIFT_APPLICATION_EXCEPTION_MESSAGE
};

G_DEFINE_TYPE(ThriftApplicationException, thrift_application_exception, THRIFT_TYPE_STRUCT)

gint32
thrift_application_exception_read (ThriftStruct *object,
                                   ThriftProtocol *protocol, GError **error)
{
  gint32 ret;
  gint32 xfer = 0;
  gchar *name;
  ThriftType ftype;
  gint16 fid;
  ThriftApplicationException *this = THRIFT_APPLICATION_EXCEPTION (object);

  /* read the struct begin marker */
  if ((ret = thrift_protocol_read_struct_begin (protocol, &name, error)) < 0)
  {
    if (name) g_free (name);
    return -1;
  }
  xfer += ret;
  if (name) g_free (name);

  while (1)
  {
    if ((ret = thrift_protocol_read_field_begin (protocol, &name, &ftype,
                                                 &fid, error)) < 0)
    {
      if (name) g_free (name);
      return -1;
    }
    xfer += ret;
    if (name) g_free (name);

    /* break if we get a STOP field */
    if (ftype == T_STOP)
    {
      break;
    }

    switch (fid)
    {
      case 1:
        if (ftype == T_STRING)
        {
          if ((ret = thrift_protocol_read_string (protocol, &this->message,
                                                  error)) < 0)
            return -1;
          xfer += ret;
          this->__isset_message = TRUE;
        } else {
          if ((ret = thrift_protocol_skip (protocol, ftype, error)) < 0)
            return -1;
          xfer += ret;
        }
        break;
      case 2:
        if (ftype == T_I32)
        {
          if ((ret = thrift_protocol_read_i32 (protocol, &this->type,
                                               error)) < 0)
            return -1;
          xfer += ret;
          this->__isset_type = TRUE;
        } else {
          if ((ret = thrift_protocol_skip (protocol, ftype, error)) < 0)
            return -1;
          xfer += ret;
        }
        break;
      default:
        if ((ret = thrift_protocol_skip (protocol, ftype, error)) < 0)
          return -1;
        xfer += ret;
        break;
    }
    if ((ret = thrift_protocol_read_field_end (protocol, error)) < 0)
      return -1;
    xfer += ret;
  }

  if ((ret = thrift_protocol_read_struct_end (protocol, error)) < 0)
    return -1;
  xfer += ret;

  return xfer;
}

gint32
thrift_application_exception_write (ThriftStruct *object,
                                    ThriftProtocol *protocol, GError **error)
{
  gint32 ret;
  gint32 xfer = 0;

  ThriftApplicationException *this = THRIFT_APPLICATION_EXCEPTION (object);

  if ((ret = thrift_protocol_write_struct_begin (protocol,
                                                 "TApplicationException",
                                                 error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_field_begin (protocol, "message",
                                                T_STRING, 1, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_string (protocol, this->message, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_field_end (protocol, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_field_begin (protocol, "type",
                                                T_I32, 2, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_i32 (protocol, this->type, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_field_end (protocol, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_field_stop (protocol, error)) < 0)
    return -1;
  xfer += ret;
  if ((ret = thrift_protocol_write_struct_end (protocol, error)) < 0)
    return -1;
  xfer += ret;

  return xfer;
}


/* GError domain */
#define THRIFT_APPLICATION_EXCEPTION_ERROR_DOMAIN "thrift-application-exception-error-quark"

GQuark
thrift_application_exception_error_quark (void)
{
  return g_quark_from_static_string (THRIFT_APPLICATION_EXCEPTION_ERROR_DOMAIN);
}

static void
thrift_application_exception_get_property (GObject *object,
                                           guint property_id,
                                           GValue *value,
                                           GParamSpec *pspec)
{
  ThriftApplicationException *tae = THRIFT_APPLICATION_EXCEPTION (object);

  switch (property_id)
  {
    case PROP_THRIFT_APPLICATION_EXCEPTION_TYPE:
      g_value_set_int (value, tae->type);
      break;
    case PROP_THRIFT_APPLICATION_EXCEPTION_MESSAGE:
      g_value_set_string (value, tae->message);
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
  }
}

static void
thrift_application_exception_set_property (GObject *object,
                                           guint property_id,
                                           const GValue *value,
                                           GParamSpec *pspec)
{
  ThriftApplicationException *tae = THRIFT_APPLICATION_EXCEPTION (object);

  switch (property_id)
  {
    case PROP_THRIFT_APPLICATION_EXCEPTION_TYPE:
      tae->type = g_value_get_int (value);
      tae->__isset_type = TRUE;
      break;
    case PROP_THRIFT_APPLICATION_EXCEPTION_MESSAGE:
      if (tae->message != NULL)
        g_free (tae->message);

      tae->message = g_value_dup_string (value);
      tae->__isset_message = TRUE;
      break;
    default:
      G_OBJECT_WARN_INVALID_PROPERTY_ID (object, property_id, pspec);
      break;
  }
}

void
thrift_application_exception_init (ThriftApplicationException *object)
{
  object->type = 0;
  object->__isset_type = FALSE;
  object->message = NULL;
  object->__isset_message = FALSE;
}

void
thrift_application_exception_finalize (GObject *object)
{
  ThriftApplicationException *tae = THRIFT_APPLICATION_EXCEPTION (object);

  if (tae->__isset_message) {
		g_free(tae->message);
  }
}

void
thrift_application_exception_class_init (ThriftApplicationExceptionClass *class)
{
  GObjectClass *gobject_class = G_OBJECT_CLASS(class);
  ThriftStructClass *cls = THRIFT_STRUCT_CLASS(class);
  GParamSpec *param_spec;

  cls->read = thrift_application_exception_read;
  cls->write = thrift_application_exception_write;

  gobject_class->finalize = thrift_application_exception_finalize;
  gobject_class->get_property = thrift_application_exception_get_property;
  gobject_class->set_property = thrift_application_exception_set_property;

  param_spec = g_param_spec_int ("type",
                                 "Exception type",
                                 "The type of the exception, one of the "
                                 "values defined by the "
                                 "ThriftApplicationExceptionError "
                                 "enumeration.",
                                 0,
                                 THRIFT_APPLICATION_EXCEPTION_ERROR_N - 1,
                                 0,
                                 G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_APPLICATION_EXCEPTION_TYPE,
                                   param_spec);

  param_spec = g_param_spec_string ("message",
                                    "Exception message",
                                    "A string describing the exception that "
                                    "occurred.",
                                    NULL,
                                    G_PARAM_READWRITE);
  g_object_class_install_property (gobject_class,
                                   PROP_THRIFT_APPLICATION_EXCEPTION_MESSAGE,
                                   param_spec);
}
