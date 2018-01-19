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

#ifndef _THRIFT_MEMORY_BUFFER_H
#define _THRIFT_MEMORY_BUFFER_H

#include <glib.h>
#include <glib-object.h>

#include <thrift/c_glib/transport/thrift_transport.h>

G_BEGIN_DECLS

/*! \file thrift_memory_buffer.h
 *  \brief Implementation of a Thrift memory buffer transport.
 */

/* type macros */
#define THRIFT_TYPE_MEMORY_BUFFER (thrift_memory_buffer_get_type ())
#define THRIFT_MEMORY_BUFFER(obj) (G_TYPE_CHECK_INSTANCE_CAST ((obj), THRIFT_TYPE_MEMORY_BUFFER, ThriftMemoryBuffer))
#define THRIFT_IS_MEMORY_BUFFER(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), THRIFT_TYPE_MEMORY_BUFFER))
#define THRIFT_MEMORY_BUFFER_CLASS(c) (G_TYPE_CHECK_CLASS_CAST ((c), THRIFT_TYPE_MEMORY_BUFFER, ThriftMemoryBufferClass))
#define THRIFT_IS_MEMORY_BUFFER_CLASS(c) (G_TYPE_CHECK_CLASS_TYPE ((c), THRIFT_TYPE_MEMORY_BUFFER)
#define THRIFT_MEMORY_BUFFER_GET_CLASS(obj) (G_TYPE_INSTANCE_GET_CLASS ((obj), THRIFT_TYPE_MEMORY_BUFFER, ThriftMemoryBufferClass))

typedef struct _ThriftMemoryBuffer ThriftMemoryBuffer;

/*!
 * ThriftMemoryBuffer instance.
 */
struct _ThriftMemoryBuffer
{
  ThriftTransport parent;

  /* private */
  GByteArray *buf;
  guint32 buf_size;
  gboolean owner;
};

typedef struct _ThriftMemoryBufferClass ThriftMemoryBufferClass;

/*!
 * ThriftMemoryBuffer class.
 */
struct _ThriftMemoryBufferClass
{
  ThriftTransportClass parent;
};

/* used by THRIFT_TYPE_MEMORY_BUFFER */
GType thrift_memory_buffer_get_type (void);

G_END_DECLS

#endif
