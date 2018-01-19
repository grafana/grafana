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

#ifndef THRIFT_STRUCT_H
#define THRIFT_STRUCT_H

#include <glib-object.h>

#include <thrift/c_glib/protocol/thrift_protocol.h>

G_BEGIN_DECLS

#define THRIFT_TYPE_STRUCT (thrift_struct_get_type ())
#define THRIFT_STRUCT(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_STRUCT, ThriftStruct))
#define THRIFT_STRUCT_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_STRUCT, ThriftStructClass))
#define THRIFT_IS_STRUCT(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_STRUCT))
#define THRIFT_IS_STRUCT_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_STRUCT))
#define THRIFT_STRUCT_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_STRUCT, ThriftStructClass))

typedef struct _ThriftStruct ThriftStruct;

/* struct */
struct _ThriftStruct
{
  GObject parent;

  /* private */
};

typedef struct _ThriftStructClass ThriftStructClass;

struct _ThriftStructClass
{
  GObjectClass parent;

  /* public */
  gint32 (*read) (ThriftStruct *object, ThriftProtocol *protocol,
                  GError **error);
  gint32 (*write) (ThriftStruct *object, ThriftProtocol *protocol,
                   GError **error);
};

GType thrift_struct_get_type (void);

gint32 thrift_struct_read (ThriftStruct *object, ThriftProtocol *protocol,
                           GError **error);

gint32 thrift_struct_write (ThriftStruct *object, ThriftProtocol *protocol,
                            GError **error);
G_END_DECLS

#endif
