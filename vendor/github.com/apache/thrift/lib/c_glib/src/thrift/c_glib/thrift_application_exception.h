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

#ifndef _THRIFT_APPLICATION_EXCEPTION_H
#define _THRIFT_APPLICATION_EXCEPTION_H

#include <glib-object.h>
#include "thrift_struct.h"

G_BEGIN_DECLS

/*! \file thrift_application_exception.h
 *  \brief C Implementation of a TApplicationException.
 */

/* type macros */
#define THRIFT_TYPE_APPLICATION_EXCEPTION (thrift_application_exception_get_type ())
#define THRIFT_APPLICATION_EXCEPTION(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_APPLICATION_EXCEPTION, ThriftApplicationException))
#define THRIFT_IS_APPLICATION_EXCEPTION(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_APPLICATION_EXCEPTION))
#define THRIFT_APPLICATION_EXCEPTION_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_APPLICATION_EXCEPTION, ThriftApplicationExceptionClass))
#define THRIFT_IS_APPLICATION_EXCEPTION_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_APPLICATION_EXCEPTION))
#define THRIFT_APPLICATION_EXCEPTION_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_APPLICATION_EXCEPTION, ThriftApplicationExceptionClass))

typedef struct _ThriftApplicationException ThriftApplicationException;

struct _ThriftApplicationException
{
  ThriftStruct parent;

  /* private */
  gint32 type;
  gboolean __isset_type;
  gchar *message;
  gboolean __isset_message;
};

typedef struct _ThriftApplicationExceptionClass ThriftApplicationExceptionClass;

struct _ThriftApplicationExceptionClass
{
  ThriftStructClass parent;
};

GType thrift_application_exception_get_type (void);

/* gerror codes */
typedef enum
{
  THRIFT_APPLICATION_EXCEPTION_ERROR_UNKNOWN,
  THRIFT_APPLICATION_EXCEPTION_ERROR_UNKNOWN_METHOD,
  THRIFT_APPLICATION_EXCEPTION_ERROR_INVALID_MESSAGE_TYPE,
  THRIFT_APPLICATION_EXCEPTION_ERROR_WRONG_METHOD_NAME,
  THRIFT_APPLICATION_EXCEPTION_ERROR_BAD_SEQUENCE_ID,
  THRIFT_APPLICATION_EXCEPTION_ERROR_MISSING_RESULT,
  THRIFT_APPLICATION_EXCEPTION_ERROR_INTERNAL_ERROR,
  THRIFT_APPLICATION_EXCEPTION_ERROR_PROTOCOL_ERROR,
  THRIFT_APPLICATION_EXCEPTION_ERROR_INVALID_TRANSFORM,
  THRIFT_APPLICATION_EXCEPTION_ERROR_INVALID_PROTOCOL,
  THRIFT_APPLICATION_EXCEPTION_ERROR_UNSUPPORTED_CLIENT_TYPE,

  THRIFT_APPLICATION_EXCEPTION_ERROR_N
} ThriftApplicationExceptionError;

/* define error domain for GError */
GQuark thrift_application_exception_error_quark (void);
#define THRIFT_APPLICATION_EXCEPTION_ERROR (thrift_application_exception_error_quark ())

G_END_DECLS

#endif /* _THRIFT_APPLICATION_EXCEPTION_H */
